import { PointTransaction, User, idempotencyKey } from '@bgsc/shared';
import { record } from '../points/ledger';

/**
 * Points validity/expiry (MVP plan Week 3 BE-2, be2-points-service-plan.md §7).
 *
 * The write half is always on: `resolve()` stamps `expires_at` on a credit whenever its rule sets
 * `expires_after_days`. This sweep is the read half. Every seeded rule has `expires_after_days:
 * null`, so it is inert until an admin turns expiry on — which is the point: enabling it later is
 * a config change, not a migration.
 */

const INTERVAL_MS = 60_000;
/** Bound the work per tick; the rest lands on the next one. */
const BATCH = 200;

export async function tick(now: Date = new Date()): Promise<number> {
    // Served by the partial index on `expires_at` (Points.ts:132).
    const due = await PointTransaction.find({ expires_at: { $lte: now }, amount: { $gt: 0 } })
        .sort({ expires_at: 1 })
        .limit(BATCH);

    let expired = 0;
    for (const credit of due) {
        const key = idempotencyKey.expire(credit._id);
        // "Already expired" is the existence of an `expire` row referencing the credit — the credit
        // itself is immutable and cannot carry a flag (points-model.md §2.1).
        if (await PointTransaction.exists({ idempotency_key: key })) continue;

        const user = await User.findOne({ _id: credit.user_id, deleted_at: null }).select('points_balance');
        // A deleted account's rows stay in the ledger, but there is no balance left to take from —
        // and retrying it every 60s forever would be the only thing this log ever said.
        if (!user) continue;
        const balance = user.points_balance ?? 0;
        // Take at most what is left: a user who already spent the expiring credit must not be
        // pushed negative by its expiry.
        const amount = Math.min(credit.amount, balance);
        if (amount <= 0) continue;

        try {
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
            expired++;
        } catch (err) {
            console.error(`[points-service] expiry of transaction ${credit._id} failed:`, err);
        }
    }
    return expired;
}

/**
 * `setInterval`'s first fire is a full period away, so a process that restarts more often than the
 * period would never sweep: run once at boot, then on the timer, and `unref()` so the timer cannot
 * hold the process open during a shutdown.
 *
 * Safe in N instances: two sweepers race on the `idempotency_key` and the unique index settles it.
 *
 * ponytail: a fully-spent credit is rescanned every tick forever, because nothing marks it done
 * and nothing can. Inert in MVP. When expiry is switched on at volume, the upgrade is a
 * `point_expiry_cursor` document holding the last swept `expires_at` — the partial index already
 * supports it.
 */
export function startExpirySweeper(): void {
    // `setInterval` fires on the clock, not on completion: a sweep that outlives its period would
    // otherwise overlap itself, redoing the same batch. The unique key makes that safe but not
    // free, and every conflict would be logged twice.
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
