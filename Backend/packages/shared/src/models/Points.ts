import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

/**
 * Points Service. See docs/modeldocs/points-model.md.
 * Collections: `point_transactions` (append-only ledger), `point_rules` (config).
 *
 * Hard rule: no point_transactions doc is ever updated or deleted. Corrections are new rows
 * ('adjust' / 'refund'). That is what makes the Spec §7.3 audit requirement free.
 * Balance is Σ amount; users.points_balance is a cache and the ledger is truth.
 */

export const POINTS_TYPE = ['earn', 'spend', 'refund', 'adjust', 'expire'] as const;
export const POINTS_SOURCE = [
    'event',
    'challenge',
    'leaderboard',
    'store', // reserved: store is out of MVP
    'engagement',
    'sponsor', // reserved: sponsors are out of MVP
    'admin',
] as const;
export const POINTS_REFERENCE_TYPE = [
    'event',
    'challenge',
    'registration',
    'leaderboard_entry',
    'store_order',
    'transaction', // an 'expire' row references the credit it expires
] as const;
export const ACTOR_TYPE = ['system', 'admin', 'user'] as const;

export type PointsType = (typeof POINTS_TYPE)[number];
export type PointsSource = (typeof POINTS_SOURCE)[number];
export type PointsReferenceType = (typeof POINTS_REFERENCE_TYPE)[number];
export type ActorType = (typeof ACTOR_TYPE)[number];

/** Sign discipline: one arithmetic rule, `balance = Σ amount`. No `CASE WHEN type`. */
const ALWAYS_POSITIVE: PointsType[] = ['earn', 'refund'];
const ALWAYS_NEGATIVE: PointsType[] = ['spend', 'expire'];

export interface IPointTransaction extends Document<string> {
    _id: string;
    user_id: string;

    amount: number;
    type: PointsType;
    source: PointsSource;
    reason: string;

    reference: { type: PointsReferenceType | null; id: string | null };

    idempotency_key: string;
    balance_after: number;

    actor: { type: ActorType; user_id: string | null };
    note: string | null;

    expires_at: Date | null;

    created_at: Date;
}

const PointTransactionSchema = new Schema<IPointTransaction>(
    {
        _id: uuidId,
        user_id: { type: String, required: true },

        // Signed integer: + credit, - debit. Never 0.
        amount: { type: Number, required: true },
        type: { type: String, enum: POINTS_TYPE, required: true },
        source: { type: String, enum: POINTS_SOURCE, required: true },
        // Machine key, e.g. 'event.participation', 'event.podium.1'. Maps to a point_rules._id.
        reason: { type: String, required: true },

        reference: {
            type: { type: String, enum: POINTS_REFERENCE_TYPE, default: null },
            id: { type: String, default: null },
        },

        // The whole dedupe story: a replayed domain event fails this index and is ignored.
        idempotency_key: { type: String, required: true },
        // Running balance at insert time; makes ledger-vs-cache drift detectable in O(1).
        balance_after: { type: Number, required: true },

        actor: {
            type: { type: String, enum: ACTOR_TYPE, required: true },
            user_id: { type: String, default: null },
        },
        note: { type: String, default: null },

        // Only ever set on positive rows. Expiry inserts a negative 'expire' row; the credit is not touched.
        expires_at: { type: Date, default: null },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

PointTransactionSchema.pre('validate', function (this: IPointTransaction) {
    const t = this;
    const fail = (msg: string): never => {
        throw new Error(`PointTransaction invariant: ${msg}`);
    };

    if (!Number.isInteger(t.amount)) return fail('amount must be an integer');
    if (t.amount === 0) return fail('amount must not be zero');
    if (ALWAYS_POSITIVE.includes(t.type) && t.amount < 0) return fail(`type '${t.type}' must be positive`);
    if (ALWAYS_NEGATIVE.includes(t.type) && t.amount > 0) return fail(`type '${t.type}' must be negative`);
    if (t.expires_at && t.amount < 0) return fail('only a credit may carry an expires_at');
    if ((t.reference.type === null) !== (t.reference.id === null)) {
        return fail('reference.type and reference.id must be set together');
    }
    if (t.actor.type !== 'system' && t.actor.user_id === null) {
        return fail("a non-system actor must name a user_id");
    }
});

/**
 * The ledger is append-only. Block every query that would mutate or remove a row, so an audit trail
 * cannot be quietly rewritten. Corrections go in as a new adjust/refund row.
 */
PointTransactionSchema.pre(
    /^(updateOne|updateMany|replaceOne|deleteOne|deleteMany|findOneAndUpdate|findOneAndReplace|findOneAndDelete)$/,
    function () {
        throw new Error('point_transactions is append-only: correct with a new adjust/refund row');
    }
);

// The query hooks above never see a loaded row being re-saved, or a bulkWrite — both would rewrite
// the ledger unchecked (audit Sep 26). Inserting a new row is the one write allowed.
PointTransactionSchema.pre('save', function (this: IPointTransaction) {
    if (!this.isNew) throw new Error('point_transactions is append-only: correct with a new adjust/refund row');
});
PointTransactionSchema.pre('bulkWrite', function () {
    throw new Error('point_transactions is append-only: correct with a new adjust/refund row');
});

PointTransactionSchema.index({ idempotency_key: 1 }, { unique: true });
// Paginated transaction history. `_id` is in the index because it is in the sort: the keyset
// tiebreak is `(created_at, _id)`, and without the third key Mongo adds a SORT stage that reads
// EVERY row the user has to return one page (measured: 500 examined for a 20-row page, vs 20 with
// it). The two-key prefix still serves every `user_id`-only read.
PointTransactionSchema.index({ user_id: 1, created_at: -1, _id: -1 });
PointTransactionSchema.index({ user_id: 1, source: 1 }); // breakdown by source
PointTransactionSchema.index({ type: 1, source: 1, created_at: -1 }); // global leaderboard aggregations
PointTransactionSchema.index({ type: 1, created_at: -1 }); // unconstrained global leaderboard
PointTransactionSchema.index({ 'reference.type': 1, 'reference.id': 1 }); // "all points for event X"; refunds on cancel
PointTransactionSchema.index({ expires_at: 1 }, { partialFilterExpression: { expires_at: { $type: 'date' } } });

export const PointTransaction = model<IPointTransaction>('PointTransaction', PointTransactionSchema, 'point_transactions');

/* ------------------------------------------------------------------ *
 * point_rules — the "rules engine": a table of reason -> amount. No DSL.
 * ------------------------------------------------------------------ */

export const OVERRIDABLE_BY = ['event', 'challenge'] as const;
export type OverridableBy = (typeof OVERRIDABLE_BY)[number];

export interface IPointRule extends Document<string> {
    _id: string; // == the reason key, e.g. 'event.participation'
    label: string;
    source: PointsSource;
    default_amount: number;
    overridable_by: OverridableBy | null;
    enabled: boolean;
    expires_after_days: number | null;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}

const PointRuleSchema = new Schema<IPointRule>(
    {
        // Resolution order: trigger override -> default_amount. Disabled rule => no transaction.
        _id: { type: String, required: true, match: /^[a-z][a-z0-9_.]{0,63}$/ },
        label: { type: String, required: true },
        source: { type: String, enum: POINTS_SOURCE, required: true },
        default_amount: { type: Number, required: true },
        overridable_by: { type: String, enum: OVERRIDABLE_BY, default: null },
        enabled: { type: Boolean, default: true },
        expires_after_days: { type: Number, default: null, min: 1 },
        updated_by: { type: String, required: true },
    },
    timestamps
);

PointRuleSchema.index({ enabled: 1, source: 1 }); // "earning opportunities" list

export const PointRule = model<IPointRule>('PointRule', PointRuleSchema, 'point_rules');

export interface PointRuleSeed {
    _id: string;
    label: string;
    source: PointsSource;
    default_amount: number;
    overridable_by: OverridableBy | null;
    enabled: boolean;
    expires_after_days: number | null;
}

/** Seed rows for MVP (points-model.md §3). default_amount 0 means the trigger always supplies the amount. */
export const POINT_RULE_SEED: PointRuleSeed[] = [
    { _id: 'event.participation', label: 'Event participation', source: 'event', default_amount: 10, overridable_by: 'event', enabled: true, expires_after_days: null },
    { _id: 'event.podium.1', label: 'Event winner', source: 'event', default_amount: 30, overridable_by: 'event', enabled: true, expires_after_days: null },
    { _id: 'event.podium.2', label: 'Event runner-up', source: 'event', default_amount: 20, overridable_by: 'event', enabled: true, expires_after_days: null },
    { _id: 'event.podium.3', label: 'Event third place', source: 'event', default_amount: 15, overridable_by: 'event', enabled: true, expires_after_days: null },
    { _id: 'challenge.completed', label: 'Challenge completed', source: 'challenge', default_amount: 0, overridable_by: 'challenge', enabled: true, expires_after_days: null },
    { _id: 'leaderboard.investment', label: 'Points invested in a leaderboard', source: 'leaderboard', default_amount: 0, overridable_by: null, enabled: true, expires_after_days: null },
    { _id: 'engagement.profile_completed', label: 'Profile completed', source: 'engagement', default_amount: 5, overridable_by: null, enabled: true, expires_after_days: null },
    { _id: 'admin.manual', label: 'Manual adjustment', source: 'admin', default_amount: 0, overridable_by: null, enabled: true, expires_after_days: null },
];

/** Idempotency keys are contracts between services — build them in one place, never inline. */
export const idempotencyKey = {
    eventParticipation: (registration_id: string) => `event.participation:${registration_id}`,
    /**
     * Keyed on the CREDIT row, not on the registration: a registration cancel and an event
     * cancellation can both want to reverse the same credit, and keying them apart would let both
     * land — one reversal each, balance driven negative. One credit, at most one reversal.
     */
    participationReversal: (credit_tx_id: string) => `event.participation.reversal:${credit_tx_id}`,
    eventPodium: (event_id: string, user_id: string) => `event.podium:${event_id}:${user_id}`,
    challengeCompleted: (participation_id: string, user_id: string) => `challenge.completed:${participation_id}:${user_id}`,
    /**
     * The investing user, the entry and the client's request id: a client retry
     * lands on the same key, and a request id can never be replayed against another entry or user.
     */
    leaderboardInvestment: (user_id: string, entry_id: string, request_id: string) =>
        `leaderboard.investment:${user_id}:${entry_id}:${request_id}`,
    /** Retired formats, read only — rows written under them must still count. */
    legacy: {
        leaderboardInvestment: (request_id: string) => `leaderboard.investment:${request_id}`,
        investmentRefund: (request_id: string) => `leaderboard.investment.refund:${request_id}`,
        eventCancelRefund: (spend_tx_id: string) => `event.cancel.refund:${spend_tx_id}`,
    },
    /**
     * Keyed on the SPEND row, never on a request id: the leaderboard's compensation and the
     * event-cancel sweep can both want to give the same spend back, and one shared key is what lets
     * the unique index refuse the second (backend-audit-2026-09-26: two keys paid twice).
     */
    investmentRefund: (spend_tx_id: string) => `leaderboard.investment.refund:${spend_tx_id}`,
    adminAdjust: (request_uuid: string) => `admin:${request_uuid}`,
    /** The expiry sweep's marker: an 'expire' row referencing the credit is what makes it done. */
    expire: (tx_id: string) => `expire:${tx_id}`,
};

/* ------------------------------------------------------------------ *
 * point_expiry_cursor — how far the expiry sweep has got
 * ------------------------------------------------------------------ */

/**
 * One document (`_id: 'expiry'`). The sweep walks due credits in `(expires_at, _id)` order and each
 * credit is decided exactly once, at its expiry — a credit already spent to zero then must not be
 * "expired" later out of points earned since. Without this the sweep re-read the same first batch
 * forever and never reached anything behind it.
 */
export interface IPointExpiryCursor extends Document<string> {
    _id: string;
    expires_at: Date;
    tx_id: string;
}

const PointExpiryCursorSchema = new Schema<IPointExpiryCursor>(
    {
        _id: { type: String, required: true },
        expires_at: { type: Date, required: true },
        tx_id: { type: String, required: true },
    },
    { versionKey: false }
);

export const PointExpiryCursor = model<IPointExpiryCursor>(
    'PointExpiryCursor',
    PointExpiryCursorSchema,
    'point_expiry_cursor'
);

/* ------------------------------------------------------------------ *
 * point_tx_claims — who is writing an idempotency key right now
 * ------------------------------------------------------------------ */

/**
 * Claimed BEFORE the balance moves. Two callers with one key used to both `$inc`
 * and have the loser compensate, and a spend landing in that window could drive a balance negative
 * or stamp a wrong `balance_after`. Now only the claim holder moves money.
 *
 *  - `pending`: claimed, nothing moved. Takeable once `lease_until` has passed — the holder checks it
 *    still owns a `pending` claim (CAS to `moving`) before it touches the balance, so a takeover can
 *    never overlap a live writer.
 *  - `moving`: the balance may have moved. Never taken over; resolved by the row appearing, by the
 *    holder's own compensation deleting the claim, or — if the holder died — by an admin recalculate
 *    of `user_id`, which re-derives the balance and drops the user's expired claims.
 *  - `void`: this key must never be written (a refund found no spend behind it and closed the door).
 *
 * The claim is deleted once the row exists; the row is the permanent record.
 */
export const CLAIM_STATE = ['pending', 'moving', 'void'] as const;
export type ClaimState = (typeof CLAIM_STATE)[number];

export interface IPointTxClaim extends Document<string> {
    _id: string; // the idempotency key
    state: ClaimState;
    owner: string;
    /** Whose balance this key moves; null on a `void` claim. */
    user_id: string | null;
    lease_until: Date;
    created_at: Date;
}

const PointTxClaimSchema = new Schema<IPointTxClaim>(
    {
        _id: { type: String, required: true },
        state: { type: String, enum: CLAIM_STATE, required: true },
        owner: { type: String, required: true },
        user_id: { type: String, default: null },
        lease_until: { type: Date, required: true },
        created_at: { type: Date, required: true, default: Date.now },
    },
    { versionKey: false }
);

export const PointTxClaim = model<IPointTxClaim>('PointTxClaim', PointTxClaimSchema, 'point_tx_claims');
