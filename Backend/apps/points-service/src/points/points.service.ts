import {
    AuditLog,
    Event,
    FormSubmission,
    IAuditLog,
    LeaderboardSnapshot,
    IPointTransaction,
    LeaderboardEntry,
    PointTransaction,
    PointTxClaim,
    PointsSource,
    PointsType,
    ServiceError,
    Team,
    User,
    idempotencyKey,
    isEventAdmin,
    recordAudit,
} from '@bgsc/shared';
import { Resolved, resolve } from '../rules/rules.service';
import { allOf, keysetFilter, pageOf } from './cursor';
import { clearStaleClaims, ledgerSum, record, signed, voidKey } from './ledger';

/**
 * Everything above the ledger: the reads, the two admin writes, the internal debit and the cache
 * repair. All of them go through `record()` for anything that moves points.
 */

/** Who did it, for the audit trail. `id` is the live user document's id, not the token's claim. */
export interface Actor {
    id: string;
    ip: string | null;
    /** The live role (`requireActiveUser`); what event-admin scope is decided on. */
    role?: string;
}

/**
 * An audit row after the fact, never in front of it: the ledger row is itself the immutable record
 * Spec §7.3 asks for, so a failed audit write must not undo points that already moved.
 */
async function auditCommitted(entry: Parameters<typeof recordAudit>[0]): Promise<void> {
    try {
        await recordAudit(entry);
    } catch (err) {
        console.error('[points-service] AUDIT WRITE FAILED after commit:', {
            action: entry.action,
            target_id: entry.target_id,
            err,
        });
    }
}

/** Only places the rule table knows about can be awarded: `event.podium.1..3` are the seeded rules. */
const SEEDED_PODIUM_PLACES = 3;

/** Only a credit may carry an expiry; the model refuses one on a debit. */
const creditExpiry = (r: Resolved): Date | null => (r.amount > 0 ? r.expires_at : null);

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export interface Summary {
    balance: number;
    lifetime_earned: number;
    lifetime_spent: number;
}

async function liveUser(user_id: string): Promise<{ points_balance: number }> {
    const user = await User.findOne({ _id: user_id, deleted_at: null }).select('points_balance');
    if (!user) throw new ServiceError(404, 'user_not_found');
    return { points_balance: user.points_balance ?? 0 };
}

/**
 * Credits and debits, both as raw signed sums. Split by sign rather than by `type`: a negative
 * `adjust` is a clawback and a positive one is a grant, which `{ type: 'earn' }` would miscount.
 * A refund is the one positive row that is not earned: it is a spend given back, so it nets against
 * `spent` instead. `earned + spent` stays Σ amount either way.
 */
async function totals(user_id: string): Promise<{ earned: number; spent: number }> {
    const isRefund = { $eq: ['$type', 'refund'] };
    const [row] = await PointTransaction.aggregate<{ earned: number; spent: number }>([
        { $match: { user_id } },
        {
            $group: {
                _id: null,
                earned: { $sum: { $cond: [{ $and: [{ $gt: ['$amount', 0] }, { $not: [isRefund] }] }, '$amount', 0] } },
                spent: { $sum: { $cond: [{ $or: [{ $lt: ['$amount', 0] }, isRefund] }, '$amount', 0] } },
            },
        },
    ]);
    return { earned: row?.earned ?? 0, spent: row?.spent ?? 0 };
}

/** The balance is one document read — never a ledger sum (points-model.md §7). */
export async function summary(user_id: string): Promise<Summary> {
    const [user, t] = await Promise.all([liveUser(user_id), totals(user_id)]);
    return {
        balance: user.points_balance,
        lifetime_earned: t.earned,
        // Stored negative; reported as a positive magnitude, which is how a UI shows "spent".
        lifetime_spent: Math.abs(t.spent),
    };
}

/**
 * The admin view adds the drift flag — an ops signal, not something a member can act on, and not
 * something `GET /points/me` should pay for.
 *
 * `earned + spent` is Σ amount, so the check is free: the aggregate the summary already ran is the
 * same one `ledgerSum` would run.
 */
export async function adminSummary(user_id: string): Promise<Summary & { ledger_synced: boolean }> {
    const [user, t] = await Promise.all([liveUser(user_id), totals(user_id)]);
    return {
        balance: user.points_balance,
        lifetime_earned: t.earned,
        lifetime_spent: Math.abs(t.spent),
        ledger_synced: t.earned + t.spent === user.points_balance,
    };
}

export interface HistoryQuery {
    type?: PointsType;
    source?: PointsSource;
    limit: number;
    cursor?: string;
}

export interface Page {
    transactions: IPointTransaction[];
    next_cursor: string | null;
}

/**
 * One paged read for every list in this service. Both lists sort on `(created_at, _id)`
 * descending, so the ordering, the cap and the cursor live here once — two copies of a pagination
 * rule is how one of them starts returning a row twice.
 */
async function listLedger(scope: Record<string, unknown>, q: HistoryQuery): Promise<Page> {
    const conditions: Record<string, unknown>[] = [scope];
    if (q.type) conditions.push({ type: q.type });
    if (q.source) conditions.push({ source: q.source });
    if (q.cursor) conditions.push(keysetFilter(q.cursor));

    const rows = await PointTransaction.find(allOf(conditions))
        .sort({ created_at: -1, _id: -1 })
        .limit(q.limit)
        .lean<IPointTransaction[]>();

    const { rows: transactions, next_cursor } = pageOf(rows, q.limit);
    return { transactions, next_cursor };
}

/**
 * Served directly by the `{ user_id: 1, created_at: -1, _id: -1 }` index.
 *
 * No `liveUser` check: a deleted user's rows stay in the ledger by design (relationships.md §3
 * anonymizes the user and keeps the history), and an admin investigating a balance needs to read
 * them.
 */
export const history = (user_id: string, q: HistoryQuery): Promise<Page> => listLedger({ user_id }, q);

/**
 * The refund/audit view: every row that names this event (served by the `reference` index), plus
 * any podium the final standings named that could not be paid — the admin's to resolve.
 */
export async function eventLedger(event_id: string, q: HistoryQuery): Promise<Page & { podium_conflicts: IAuditLog[] }> {
    const [page, podium_conflicts] = await Promise.all([
        listLedger({ 'reference.type': 'event', 'reference.id': event_id }, q),
        AuditLog.find({ action: 'points.podium_conflict', target_type: 'event', target_id: event_id })
            .sort({ created_at: -1 })
            .limit(20)
            .lean<IAuditLog[]>(),
    ]);
    return { ...page, podium_conflicts };
}

export interface BreakdownRow {
    source: PointsSource;
    total: number;
    count: number;
}

/** Served by the `{ user_id: 1, source: 1 }` index, which exists for exactly this query. */
export async function breakdown(user_id: string): Promise<{ balance: number; breakdown: BreakdownRow[] }> {
    const [user, rows] = await Promise.all([
        liveUser(user_id),
        PointTransaction.aggregate<{ _id: PointsSource; total: number; count: number }>([
            { $match: { user_id } },
            { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
        ]),
    ]);

    return {
        balance: user.points_balance,
        breakdown: rows.map((r) => ({ source: r._id, total: r.total, count: r.count })),
    };
}

export async function transactionAudit(transaction_id: string): Promise<IAuditLog[]> {
    if (!(await PointTransaction.exists({ _id: transaction_id }))) {
        throw new ServiceError(404, 'transaction_not_found');
    }
    return AuditLog.find({ target_type: 'point_transaction', target_id: transaction_id })
        .sort({ created_at: -1 })
        .limit(50)
        .lean<IAuditLog[]>();
}

/* ------------------------------------------------------------------ *
 * Admin writes
 * ------------------------------------------------------------------ */

export interface AdjustInput {
    user_id: string;
    /** Signed: positive grants, negative claws back. The only route where the caller sets the sign. */
    amount: number;
    note: string;
    /** Stable across a retry — it is the idempotency key. A fresh uuid is a second adjustment. */
    request_id: string;
}

export async function adjust(input: AdjustInput, actor: Actor): Promise<{ tx: IPointTransaction; replayed: boolean }> {
    const resolved = await resolve('admin.manual', input.amount);
    if (!resolved) throw new ServiceError(409, 'rule_disabled');

    const result = await record({
        user_id: input.user_id,
        amount: resolved.amount,
        type: 'adjust',
        source: 'admin',
        reason: 'admin.manual',
        reference: { type: null, id: null },
        idempotency_key: idempotencyKey.adminAdjust(input.request_id),
        actor: { type: 'admin', user_id: actor.id },
        note: input.note,
        expires_at: creditExpiry(resolved),
    });

    // The request_id is the key, so a reused id with a different user or amount would come back
    // as a silent "replay" of someone else's row. Say so instead.
    if (result.replayed && (result.tx.user_id !== input.user_id || result.tx.amount !== resolved.amount)) {
        throw new ServiceError(409, 'request_id_reused');
    }

    // A replay is the same decision arriving twice, not a second one to record.
    if (!result.replayed) {
        await auditCommitted({
            actor_id: actor.id,
            action: 'points.adjusted',
            target_type: 'point_transaction',
            target_id: result.tx._id,
            new_value: {
                user_id: input.user_id,
                amount: result.tx.amount,
                balance_after: result.tx.balance_after,
            },
            reason: input.note,
            ip: actor.ip,
        });
    }
    return result;
}

export interface AwardInput {
    user_id: string;
    event_id: string;
    place: number;
}

/** Who pays a podium: an admin through the route, or the system off `LeaderboardFrozen`. */
export type PodiumPayer = { type: 'admin'; actor: Actor } | { type: 'system' };

/**
 * Podium points. Two producers share this one function and one key, `(event_id, user_id)`: the
 * admin route and the `LeaderboardFrozen` consumer. Whichever lands first pays;
 * the other is a replay.
 */
export async function awardPodium(input: AwardInput, actor: Actor): Promise<{ tx: IPointTransaction; replayed: boolean }> {
    return payPodium(input, { type: 'admin', actor });
}

export async function payPodium(
    input: AwardInput,
    payer: PodiumPayer
): Promise<{ tx: IPointTransaction; replayed: boolean }> {
    const event = await Event.findOne({ _id: input.event_id, deleted_at: null }).select(
        'points_pool status created_by core_admins'
    );
    if (!event) throw new ServiceError(404, 'event_not_found');
    // An admin pays out only on an event they administer, not any event on the platform.
    if (payer.type === 'admin' && !isEventAdmin(event, { id: payer.actor.id, role: payer.actor.role ?? '' })) {
        throw new ServiceError(403, 'forbidden');
    }

    const reason = `event.podium.${input.place}`;
    const key = idempotencyKey.eventPodium(event._id, input.user_id);

    // The key is (event, user), so one user takes one podium place per event. Looked up before any
    // check that can change after the payment (the winner cancels, a rule is switched off): a replay
    // of a place already paid is that payment, not a refusal. A call for a DIFFERENT place would
    // otherwise come back as a silent "replay" carrying the first place's row — an admin correcting
    // a mis-click would believe it went through. Refuse it by name and let them decide: the
    // existing row stands until someone adjusts it deliberately.
    const already = await PointTransaction.findOne({ idempotency_key: key });
    if (already && already.reason !== reason) {
        throw new ServiceError(409, 'already_awarded', { place: already.reason, amount: already.amount });
    }
    if (already) return { tx: already, replayed: true };

    // 'past' is the status that makes EventCompleted fire.
    if (event.status !== 'past') throw new ServiceError(409, 'event_not_completed');

    const multipliers = event.points_pool.podium_multipliers;
    // Awardable only if the event pays that many places AND a rule exists for it: only
    // event.podium.1..SEEDED_PODIUM_PLACES are seeded.
    if (input.place > multipliers.length || input.place > SEEDED_PODIUM_PLACES) {
        throw new ServiceError(422, 'place_not_awarded');
    }

    // Only someone who was actually in the event. Team members hold their own confirmed
    // registration (Team.ts: event members carry a registration_id), so one check covers both.
    const registered = await FormSubmission.exists({
        'owner.type': 'event',
        'owner.id': event._id,
        'user.user_id': input.user_id,
        status: 'confirmed',
    });
    if (!registered) throw new ServiceError(409, 'not_a_participant');

    // Once the leaderboard has a final, it decides who holds each place: an admin award may not
    // pre-empt it for someone else (the automated payment would then find the place taken).
    if (payer.type === 'admin') {
        const final = await LeaderboardSnapshot.findOne({ event_id: event._id, reason: 'final' }).sort({ taken_at: -1 });
        const holder = final?.ranks.find((r) => r.rank === input.place)?.participant_id;
        if (
            holder &&
            holder !== input.user_id &&
            !(await Team.exists({ _id: holder, 'members.user_id': input.user_id }))
        ) {
            throw new ServiceError(409, 'podium_mismatch', { place: input.place, holder });
        }
    }

    // One participant per place. Several users may share it only as members of one team.
    // ponytail: read-then-write, so two admins awarding the same place to two people in the same
    // millisecond both land; a per-(event, place) marker row would close it if that ever happens.
    const holders = (
        await PointTransaction.distinct('user_id', {
            'reference.type': 'event',
            'reference.id': event._id,
            reason,
            type: 'earn',
        })
    ).filter((u) => u !== input.user_id);
    if (holders.length > 0) {
        const sameTeam = await Team.exists({
            'owner.type': 'event',
            'owner.id': event._id,
            status: { $ne: 'disbanded' },
            'members.user_id': { $all: [input.user_id, ...holders] },
        });
        if (!sameTeam) throw new ServiceError(409, 'place_taken', { holders });
    }

    const override = event.points_pool.participation * multipliers[input.place - 1];
    // A pool of 0 pays nothing for any place; "rule_disabled" would send the admin to the wrong fix.
    if (!Number.isFinite(override) || Math.round(override) === 0) {
        throw new ServiceError(422, 'event_pays_no_podium');
    }
    const resolved = await resolve(reason, override);
    if (!resolved) throw new ServiceError(409, 'rule_disabled');

    const result = await record({
        user_id: input.user_id,
        amount: signed('earn', resolved.amount),
        type: 'earn',
        source: 'event',
        reason,
        reference: { type: 'event', id: event._id },
        idempotency_key: key,
        actor: payer.type === 'admin' ? { type: 'admin', user_id: payer.actor.id } : { type: 'system', user_id: null },
        expires_at: resolved.expires_at,
    });

    if (!result.replayed && payer.type === 'admin') {
        await auditCommitted({
            actor_id: payer.actor.id,
            action: 'points.awarded',
            target_type: 'point_transaction',
            target_id: result.tx._id,
            new_value: {
                user_id: input.user_id,
                event_id: event._id,
                place: input.place,
                amount: result.tx.amount,
            },
            ip: payer.actor.ip,
        });
    }
    return result;
}

/**
 * Repair the cache from the ledger. The ledger is truth, so this never writes a transaction — it
 * rewrites the denormalized number that drifted away from it. Once the two agree it also drops the
 * user's expired key claims (`clearStaleClaims`), drift or not.
 */
export async function recalculate(
    user_id: string,
    actor: Actor
): Promise<{ previous: number; balance: number; repaired: boolean }> {
    const user = await liveUser(user_id);
    // A live writer that has already moved the balance but not yet written its row would read as
    // drift, and "repairing" it would erase that write. Checked between the balance read and the
    // sum: a write that moved the balance before the read still holds its claim until its row lands
    // after the sum. A `moving` claim past its lease is a dead writer — exactly what this repairs.
    if (await PointTxClaim.exists({ user_id, state: 'moving', lease_until: { $gte: new Date() } })) {
        throw new ServiceError(409, 'write_in_flight');
    }
    const total = await ledgerSum(user_id);
    if (total === user.points_balance) {
        await clearStaleClaims(user_id);
        return { previous: user.points_balance, balance: total, repaired: false };
    }

    // A balance with no ledger behind it is not drift, it is a number that predates this service
    // (or was written by something that should not have). "Repairing" it would delete points
    // nobody can reconstruct, so it takes a deliberate POST /points/adjust instead.
    if (total === 0 && (await PointTransaction.countDocuments({ user_id })) === 0) {
        throw new ServiceError(409, 'ledger_empty');
    }

    // Compare-and-swap on the balance we summed against. A plain $set would clobber any transaction
    // that landed while we were summing — repairing drift by creating it.
    const swap = await User.updateOne(
        { _id: user_id, points_balance: user.points_balance },
        { $set: { points_balance: total } }
    );
    if (swap.matchedCount === 0) throw new ServiceError(409, 'balance_moved');
    await clearStaleClaims(user_id);
    await auditCommitted({
        actor_id: actor.id,
        action: 'points.recalculated',
        target_type: 'user',
        target_id: user_id,
        previous_value: { points_balance: user.points_balance },
        new_value: { points_balance: total },
        ip: actor.ip,
    });
    return { previous: user.points_balance, balance: total, repaired: true };
}

/* ------------------------------------------------------------------ *
 * Internal: the leaderboard investment debit
 * ------------------------------------------------------------------ */

export interface SpendInput {
    user_id: string;
    /** Positive magnitude. The route debits; a caller never sends a sign. */
    amount: number;
    reference: { type: 'leaderboard_entry'; id: string };
    request_id: string;
}


const spendKey = (user_id: string, entry_id: string, request_id: string) =>
    idempotencyKey.leaderboardInvestment(user_id, entry_id, request_id);

/** The spend a request made — under today's key, or the retired one rows may still carry. */
async function findSpend(user_id: string, entry_id: string, request_id: string): Promise<IPointTransaction | null> {
    const spend = await PointTransaction.findOne({
        idempotency_key: { $in: [spendKey(user_id, entry_id, request_id), idempotencyKey.legacy.leaderboardInvestment(request_id)] },
        type: 'spend',
    });
    return spend && spend.user_id === user_id && spend.reference.id === entry_id ? spend : null;
}

/** The refund row for a spend, under the current key or either retired one. */
async function refundOf(spend: IPointTransaction): Promise<IPointTransaction | null> {
    const keys = [idempotencyKey.investmentRefund(spend._id), idempotencyKey.legacy.eventCancelRefund(spend._id)];
    const legacyPrefix = 'leaderboard.investment:';
    const tail = spend.idempotency_key.slice(legacyPrefix.length);
    // A retired-format spend was refunded under `leaderboard.investment.refund:<request_id>`.
    if (!tail.includes(':')) keys.push(idempotencyKey.legacy.investmentRefund(tail));
    return PointTransaction.findOne({ idempotency_key: { $in: keys }, type: 'refund' });
}

export async function spendForInvestment(input: SpendInput): Promise<{ tx: IPointTransaction; replayed: boolean }> {
    // A retry is answered from the key first, before any check that can change after the first
    // attempt landed (the event moved on, the rule was switched off). Refusing it would tell the
    // caller "nothing taken" about a spend that stands, and it would give up on the points.
    const earlier = await findSpend(input.user_id, input.reference.id, input.request_id);
    if (earlier) {
        // A spend that has since been given back is not a live debit: the caller must not credit
        // the entry for money the user holds again.
        if (await refundOf(earlier)) throw new ServiceError(409, 'request_voided');
        return { tx: earlier, replayed: true };
    }

    // The entry is BE-1's document and this is a read, so it goes straight to the model. Checked
    // because a debit whose reference names nothing can never be refunded: the event-cancel sweep
    // finds spends by their entry ids, and a typo would silently opt out of it.
    const entry = await LeaderboardEntry.findById(input.reference.id).select('participant event_id');
    if (!entry) throw new ServiceError(404, 'leaderboard_entry_not_found');
    // Same round trip, one more guarantee: on a solo entry the payer must be the participant. A
    // caller holding the service token can name any user_id, so a bug on the other side would
    // otherwise debit a stranger. Team entries are not checked here — membership lives in `teams`,
    // and the investing service is the one that knows who may spend on a team's behalf.
    if (entry.participant.type === 'user' && entry.participant.id !== input.user_id) {
        throw new ServiceError(409, 'entry_participant_mismatch');
    }
    const eventStatus = async () => (await Event.findById(entry.event_id).select('status'))?.status;
    if ((await eventStatus()) !== 'ongoing') throw new ServiceError(409, 'event_not_ongoing');

    const resolved = await resolve('leaderboard.investment', input.amount);
    if (!resolved) throw new ServiceError(409, 'rule_disabled');

    const result = await record({
        user_id: input.user_id,
        amount: signed('spend', resolved.amount),
        type: 'spend',
        source: 'leaderboard',
        reason: 'leaderboard.investment',
        reference: input.reference,
        idempotency_key: spendKey(input.user_id, input.reference.id, input.request_id),
        // The user chose to invest; the Leaderboard Service is only the messenger.
        actor: { type: 'user', user_id: input.user_id },
    });

    // A replay of a spend that has since been given back is not a live debit: the caller must not
    // credit the entry for money the user holds again.
    if (result.replayed && (await refundOf(result.tx))) throw new ServiceError(409, 'request_voided');

    // The cancel sweep may have run between the status check and the write; this spend would then
    // never be found by it. Give it back here.
    if (!result.replayed && (await eventStatus()) === 'cancelled') {
        await refundSpend(result.tx, 'refund: event_cancelled');
        throw new ServiceError(409, 'event_not_ongoing');
    }
    return result;
}

export interface RefundInput {
    user_id: string;
    reference: { type: 'leaderboard_entry'; id: string };
    request_id: string;
    /** Optional, and never trusted: the refund is always exactly what the spend took. */
    amount?: number;
}

/**
 * The leaderboard's compensation. Bound to the spend it undoes: a refund with no spend behind it
 * would let a service token mint points.
 *
 * "No spend" is only an answer once it is final: the spend key is voided first, so a spend still in
 * flight can never land afterwards. While a writer holds the key the answer is 409
 * `request_in_flight` — outcome unknown, ask again later.
 */
export async function refundForInvestment(input: RefundInput): Promise<{ tx: IPointTransaction; replayed: boolean }> {
    let spend = await findSpend(input.user_id, input.reference.id, input.request_id);
    if (!spend) {
        if (await voidKey(spendKey(input.user_id, input.reference.id, input.request_id))) {
            throw new ServiceError(404, 'spend_not_found');
        }
        spend = await findSpend(input.user_id, input.reference.id, input.request_id);
        if (!spend) throw new ServiceError(409, 'request_in_flight');
    }
    if (input.amount !== undefined && input.amount !== Math.abs(spend.amount)) {
        throw new ServiceError(409, 'refund_amount_mismatch', { spent: Math.abs(spend.amount) });
    }
    return refundSpend(spend, 'refund: leaderboard_investment');
}

/**
 * Give one spend back, once. Both refund paths — this compensation and the event-cancel sweep —
 * come through here with the same key, so whichever lands second is a replay; a refund written
 * under a retired key counts too.
 */
export async function refundSpend(spend: IPointTransaction, note: string): Promise<{ tx: IPointTransaction; replayed: boolean }> {
    const earlier = await refundOf(spend);
    if (earlier) return { tx: earlier, replayed: true };
    return record({
        user_id: spend.user_id,
        // A refund is always positive: the spend row was negative.
        amount: signed('refund', spend.amount),
        type: 'refund',
        source: spend.source,
        reason: spend.reason,
        reference: spend.reference,
        idempotency_key: idempotencyKey.investmentRefund(spend._id),
        actor: { type: 'system', user_id: null },
        note,
    });
}
