import {
    ActorType,
    IPointTransaction,
    PointTransaction,
    PointsReferenceType,
    PointsSource,
    PointsType,
    ServiceError,
    User,
    publish,
} from '@bgsc/shared';
import { ruleExists } from '../rules/rules.service';

/**
 * The one write path. Every point movement in the platform — consumer, admin route, internal
 * route, expiry sweep — goes through `record()`. There is no second path that touches
 * `point_transactions` or `users.points_balance` (be2-points-service-plan.md §3).
 */

export const PRODUCER = 'points-service';

/** Sign discipline, declared once. `adjust` is the only type that keeps the caller's sign. */
const SIGN: Record<PointsType, 1 | -1 | 0> = { earn: 1, refund: 1, spend: -1, expire: -1, adjust: 0 };

/** Routes and consumers pass a magnitude and a type; the sign is the server's business. */
export const signed = (type: PointsType, magnitude: number): number =>
    SIGN[type] === 0 ? magnitude : SIGN[type] * Math.abs(magnitude);

/** A new type cannot be added without naming the event it emits. */
const EVENT_FOR: Record<PointsType, string> = {
    earn: 'PointsEarned',
    spend: 'PointsSpent',
    refund: 'PointsRefunded',
    adjust: 'PointsAdjusted',
    expire: 'PointsExpired',
};

export interface RecordInput {
    user_id: string;
    /** Signed, non-zero integer. The caller has already resolved it (see `signed`). */
    amount: number;
    type: PointsType;
    source: PointsSource;
    /** A point_rules._id. */
    reason: string;
    reference: { type: PointsReferenceType | null; id: string | null };
    idempotency_key: string;
    actor: { type: ActorType; user_id: string | null };
    note?: string | null;
    expires_at?: Date | null;
}

export interface RecordResult {
    tx: IPointTransaction;
    /** True when this key had already been written — the caller must not treat it as new. */
    replayed: boolean;
}

const MAX_KEY_LENGTH = 200;

/**
 * Every model invariant, refused as a 4xx before the insert.
 *
 * The model's `pre('validate')` hook throws a plain `Error`, which the shared handler maps to 500
 * (plan §0.6). Without this function a caller's typo reads as a server fault.
 */
async function assertRecordable(input: RecordInput): Promise<void> {
    const fail = (code: string): never => {
        throw new ServiceError(422, code);
    };

    if (!Number.isInteger(input.amount) || input.amount === 0) fail('invalid_amount');
    if (signed(input.type, input.amount) !== input.amount) fail('amount_sign_mismatch');
    if (input.expires_at && input.amount < 0) fail('expiry_on_debit');
    if ((input.reference.type === null) !== (input.reference.id === null)) fail('invalid_reference');
    if (input.actor.type !== 'system' && !input.actor.user_id) fail('invalid_actor');
    if (!input.idempotency_key || input.idempotency_key.length > MAX_KEY_LENGTH) fail('invalid_idempotency_key');
    if (!(await ruleExists(input.reason))) fail('unknown_reason');
}

const isDuplicateKey = (err: unknown): boolean => (err as { code?: number } | null)?.code === 11000;

function payloadOf(tx: IPointTransaction): Record<string, unknown> {
    const base = {
        transaction_id: tx._id,
        user_id: tx.user_id,
        amount: tx.amount,
        balance_after: tx.balance_after,
    };
    if (tx.type === 'adjust') {
        return { ...base, reason: tx.reason, actor_user_id: tx.actor.user_id, note: tx.note };
    }
    if (tx.type === 'expire') {
        return { ...base, credit_transaction_id: tx.reference.id };
    }
    const event = { ...base, source: tx.source, reason: tx.reason, reference: tx.reference };
    // points-model.md §6: PointsRefunded carries why the money came back, which is the note the
    // refunding path wrote ('refund: event_cancelled').
    return tx.type === 'refund' ? { ...event, reason_text: tx.note } : event;
}

/**
 * Cache first, row second, compensate on failure — the inverse of points-model.md §2.2, which
 * inserts the row and then compare-and-swaps the balance (plan §3.2, D1).
 *
 * That order cannot be repaired: the ledger refuses updates and deletes by hook, so a row written
 * before a lost CAS keeps a wrong `balance_after` forever. This order's only failure window is
 * step 3 throwing, and the cache is not immutable, so `$inc: -amount` undoes it.
 */
export async function record(input: RecordInput): Promise<RecordResult> {
    await assertRecordable(input);

    // 1. Dedupe first: a replayed domain event costs one indexed read and no writes at all.
    const existing = await PointTransaction.findOne({ idempotency_key: input.idempotency_key });
    if (existing) return { tx: existing, replayed: true };

    // 2. Move the balance atomically, with the solvency guard inside the filter. Two simultaneous
    //    spends of the last 10 points cannot both match — which is what makes "no negative
    //    balance" true under concurrency rather than true in the common case.
    const guard = input.amount < 0 ? { points_balance: { $gte: -input.amount } } : {};
    const user = await User.findOneAndUpdate(
        { _id: input.user_id, deleted_at: null, ...guard },
        { $inc: { points_balance: input.amount } },
        { returnDocument: 'after', projection: { points_balance: 1 } }
    );
    if (!user) {
        // Two reasons to match nothing, and the caller must be able to tell them apart: one is
        // retryable by a human with more points, the other never is.
        const exists = await User.exists({ _id: input.user_id, deleted_at: null });
        throw new ServiceError(exists ? 409 : 404, exists ? 'insufficient_points' : 'user_not_found');
    }

    // 3. Append the row, carrying the balance the $inc actually produced.
    let tx: IPointTransaction;
    try {
        tx = await PointTransaction.create({
            user_id: input.user_id,
            amount: input.amount,
            type: input.type,
            source: input.source,
            reason: input.reason,
            reference: input.reference,
            idempotency_key: input.idempotency_key,
            balance_after: user.points_balance ?? input.amount,
            actor: input.actor,
            note: input.note ?? null,
            expires_at: input.expires_at ?? null,
        });
    } catch (err) {
        // The row did not land, so the balance movement must not stand. If the compensation itself
        // fails, the cache is now ahead of the ledger: say so loudly and still surface the original
        // error, because swallowing it would report a write that never happened. `recalculate`
        // repairs the balance from the ledger, which is truth.
        await User.updateOne({ _id: input.user_id }, { $inc: { points_balance: -input.amount } }).catch(
            (compensationErr) =>
                console.error(
                    `[points-service] COMPENSATION FAILED for ${input.user_id}: balance is ahead of the ledger by ${input.amount}`,
                    compensationErr
                )
        );
        if (isDuplicateKey(err)) {
            // Lost a race with an identical key: the winner's row is the answer, not an error.
            const winner = await PointTransaction.findOne({ idempotency_key: input.idempotency_key });
            if (winner) return { tx: winner, replayed: true };
        }
        throw err;
    }

    // Fire-and-forget by contract: a throwing consumer cannot fail the write that produced it.
    publish(EVENT_FOR[tx.type], PRODUCER, payloadOf(tx));
    return { tx, replayed: false };
}

/**
 * Σ amount for a user — the truth the cache is supposed to mirror.
 *
 * Deliberately not "read the newest row's `balance_after`", which would be two point reads instead
 * of a group: `created_at` has millisecond resolution and `_id` is a random uuid, so two rows
 * written in the same millisecond have no reliable order and the wrong one's running balance would
 * report drift that is not there. Served by `{ user_id: 1, created_at: -1 }`.
 *
 * ponytail: O(rows-per-user) per call, and only an admin read calls it. If a user's ledger ever
 * runs to thousands of rows, keep a periodic checkpoint row and sum forward from it.
 */
export async function ledgerSum(user_id: string): Promise<number> {
    const [row] = await PointTransaction.aggregate<{ total: number }>([
        { $match: { user_id } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return row?.total ?? 0;
}

/**
 * Cache minus ledger. Non-zero needs a crash between the `$inc` and its compensation — narrow, and
 * the only window there is, which is why there is no nightly reconciliation job (plan §3.5, D8).
 */
export async function drift(user_id: string): Promise<number> {
    const [user, total] = await Promise.all([
        User.findById(user_id).select('points_balance'),
        ledgerSum(user_id),
    ]);
    return (user?.points_balance ?? 0) - total;
}
