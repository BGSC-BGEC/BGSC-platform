import { IPointTransaction, PointExpiryCursor, PointTransaction, User, idempotencyKey } from '@bgsc/shared';
import { record } from '../points/ledger';

/**
 * Points validity/expiry.
 *
 * The write half is always on: `resolve()` stamps `expires_at` on a credit whenever its rule sets
 * `expires_after_days`. This sweep is the read half. Every seeded rule has `expires_after_days:
 * null`, so it is inert until an admin turns expiry on — which is the point: enabling it later is
 * a config change, not a migration.
 */

const INTERVAL_MS = 60_000;
/** Bound the work per tick; the rest lands on the next one. */
const BATCH = 200;
const CURSOR_ID = 'expiry';

/**
 * How much of `credit` is still unspent, first-in-first-out: spending eats the oldest points, so a
 * balance is made of the newest credits. What is left of this one is the balance minus everything
 * credited after it, clamped to the credit itself.
 *
 * Without this, a user who spent an expiring credit and later earned non-expiring points would
 * lose the new points to the old credit's expiry.
 */
async function unspentOf(credit: IPointTransaction, balance: number): Promise<number> {
    // Newer CREDITS only: a refund gives a spend back (it is not new money on top), and a credit that
    // was itself reversed no longer sits in the balance.
    const newer = await PointTransaction.find({
        user_id: credit.user_id,
        amount: { $gt: 0 },
        type: { $in: ['earn', 'adjust'] },
        created_at: { $gt: credit.created_at },
    })
        .select('_id amount')
        .lean();
    const reversed = new Set(
        (
            await PointTransaction.find({
                idempotency_key: { $in: newer.map((t) => idempotencyKey.participationReversal(t._id)) },
            })
                .select('idempotency_key')
                .lean()
        ).map((t) => t.idempotency_key)
    );
    const live = newer
        .filter((t) => !reversed.has(idempotencyKey.participationReversal(t._id)))
        .reduce((sum, t) => sum + t.amount, 0);
    return Math.max(0, Math.min(credit.amount, balance - live));
}

export async function tick(now: Date = new Date()): Promise<number> {
    const cursor = await PointExpiryCursor.findById(CURSOR_ID).lean();

    // Keyset on (expires_at, _id): each credit is visited once, at its expiry. Re-reading the same
    // first batch every tick (what this did before) stopped the sweep at the first 200 credits.
    const after = cursor
        ? {
              $or: [
                  { expires_at: { $gt: cursor.expires_at } },
                  { expires_at: cursor.expires_at, _id: { $gt: cursor.tx_id } },
              ],
          }
        : {};
    // Served by the partial index on `expires_at`.
    const due = await PointTransaction.find({ $and: [{ expires_at: { $lte: now }, amount: { $gt: 0 } }, after] })
        .sort({ expires_at: 1, _id: 1 })
        .limit(BATCH);

    let expired = 0;
    for (const credit of due) {
        try {
            if (await expireOne(credit)) expired++;
        } catch (err) {
            // A failed row stops the cursor here, so the next tick retries it rather than skipping it.
            console.error(`[points-service] expiry of transaction ${credit._id} failed:`, err);
            break;
        }
        await PointExpiryCursor.updateOne(
            { _id: CURSOR_ID },
            { $set: { expires_at: credit.expires_at, tx_id: credit._id } },
            { upsert: true }
        );
    }
    return expired;
}

async function expireOne(credit: IPointTransaction): Promise<boolean> {
    const key = idempotencyKey.expire(credit._id);
    // "Already expired" is the existence of an `expire` row referencing the credit — the credit
    // itself is immutable and cannot carry a flag (points-model.md §2.1).
    if (await PointTransaction.exists({ idempotency_key: key })) return false;
    // A credit already taken back (event or registration cancelled) has nothing left to expire.
    if (await PointTransaction.exists({ idempotency_key: idempotencyKey.participationReversal(credit._id) })) {
        return false;
    }

    const user = await User.findOne({ _id: credit.user_id, deleted_at: null }).select('points_balance');
    // A deleted account's rows stay in the ledger, but there is no balance left to take from.
    if (!user) return false;
    const amount = await unspentOf(credit, user.points_balance ?? 0);
    if (amount <= 0) return false;

    await record({
        user_id: credit.user_id,
        amount: -amount,
        type: 'expire',
        source: credit.source,
        reason: credit.reason,
        reference: { type: 'transaction', id: credit._id },
        idempotency_key: key,
        actor: { type: 'system', user_id: null },
    });
    return true;
}

/**
 * `setInterval`'s first fire is a full period away, so a process that restarts more often than the
 * period would never sweep: run once at boot, then on the timer, and `unref()` so the timer cannot
 * hold the process open during a shutdown.
 *
 * Safe in N instances: two sweepers race on the `idempotency_key` and the unique index settles it.
 * ponytail: the cursor is last-writer-wins, so two instances can move it back by a few rows; a
 * revisited credit is either already expired (key exists) or re-decided against the same ledger.
 */
export function startExpirySweeper(): void {
    // `setInterval` fires on the clock, not on completion: a sweep that outlives its period would
    // otherwise overlap itself, redoing the same batch.
    let running = false;
    const sweep = async (): Promise<void> => {
        if (running) return;
        running = true;
        try {
            await tick();
        } catch (err) {
            console.error('[points-service] expiry sweep failed:', err);
        } finally {
            running = false;
        }
    };

    void sweep();
    const timer = setInterval(() => void sweep(), INTERVAL_MS);
    timer.unref();
}
