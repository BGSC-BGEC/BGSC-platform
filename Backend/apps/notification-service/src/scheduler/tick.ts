import {
    Announcement,
    DISPATCH_MAX_ATTEMPTS,
    DISPATCH_RETRYABLE,
    INotificationDispatch,
    NotificationDispatch,
} from '@bgsc/shared';
import { deliverAnnouncement } from '../broadcast/broadcast';
import { attempt, writeback } from '../broadcast/dispatch';

/**
 * The scheduler (be2-broadcast-service-plan.md §8). Three sweeps, one timer.
 *
 * ponytail: one in-process 60s timer, running in every instance. Correct under concurrency —
 * every send is claimed with a compare-and-swap before it happens — and wasteful at N instances.
 * Move to a leader election or a real scheduler when there is more than one instance to care about.
 */

export const TICK_INTERVAL_MS = 60_000;

/** How far back reconciliation looks for a broadcast that never happened. */
export const RECONCILE_WINDOW_MS = 24 * 3_600_000;

/**
 * Work cap per sweep per tick. A bounded page rather than "drain the queue": the next tick is 60
 * seconds away, and a loop that re-queries until it finds nothing can spin forever on a row it
 * keeps failing to claim.
 */
const SWEEP_LIMIT = 50;

/** Retry every send whose backoff has elapsed. */
export async function retryDue(now: Date = new Date()): Promise<number> {
    const rows = await NotificationDispatch.find({
        status: { $in: DISPATCH_RETRYABLE },
        attempts: { $lt: DISPATCH_MAX_ATTEMPTS },
        next_attempt_at: { $lte: now },
    })
        .sort({ next_attempt_at: 1 })
        .limit(SWEEP_LIMIT);

    for (const row of rows) {
        await attempt(row);
    }
    return rows.length;
}

/**
 * Deliver announcements that were published while nobody was listening.
 *
 * Redis pub/sub has no persistence: an announcement published while this service was down, or
 * while the bus was reconnecting, emits an event nobody hears (`events/publish.ts`). Without this
 * sweep that broadcast is lost in silence — the announcement is live in the app and no inbox, no
 * group and no delivery row ever knows about it.
 *
 * "Not fully processed" is decided by COUNTING rows, not by their absence. `dispatchAnnouncement`
 * claims one row per category plus one for push, and it claims them one at a time — so a process
 * that dies half way through leaves an announcement that *has* rows and is still missing a
 * category. An `exists` test would call that one done and the second community group would never
 * hear about it. Re-running is harmless either way: every claim is idempotent.
 *
 * It is also what makes scheduled broadcasts true end to end — the Announcement Service's own tick
 * publishes them, and this guarantees the broadcast follows even if that event was dropped.
 */
export async function reconcile(now: Date = new Date()): Promise<number> {
    const candidates = await Announcement.find({
        status: 'published',
        deleted_at: null,
        'delivery.whatsapp.requested': true,
        published_at: { $gte: new Date(now.getTime() - RECONCILE_WINDOW_MS) },
    })
        .select('_id categories')
        .limit(SWEEP_LIMIT)
        .lean<{ _id: string; categories: string[] }[]>();

    let delivered = 0;
    for (const { _id, categories } of candidates) {
        const rows = await NotificationDispatch.countDocuments({ 'source.type': 'announcement', 'source.id': _id });
        // One per category, plus the push row.
        if (rows >= categories.length + 1) continue;
        await deliverAnnouncement(_id);
        delivered += 1;
    }
    return delivered;
}

/**
 * Re-send delivery outcomes the Announcement Service never received.
 *
 * `writeback_at` is cleared by every `settle`, so this picks up both a writeback that failed and
 * one whose row has changed since — the composer's view catches up within a tick either way.
 */
export async function retryWritebacks(): Promise<number> {
    const stale = await NotificationDispatch.find({ writeback_at: null })
        .select('source')
        .limit(SWEEP_LIMIT)
        .lean<Pick<INotificationDispatch, 'source'>[]>();

    const announcementIds = [...new Set(stale.map((r) => r.source.id))];
    let written = 0;
    for (const id of announcementIds) {
        if (await writeback(id)) written += 1;
    }
    return written;
}

export interface TickResult {
    retried: number;
    reconciled: number;
    written_back: number;
}

export async function tick(now: Date = new Date()): Promise<TickResult> {
    // Order matters only in that reconciliation can create rows the writeback sweep should then
    // pick up — doing it before the writeback pass saves those rows a minute.
    const retried = await retryDue(now);
    const reconciled = await reconcile(now);
    const written_back = await retryWritebacks();
    return { retried, reconciled, written_back };
}

export function startScheduler(): NodeJS.Timeout {
    // setInterval's first fire is a full period away, so a restart would leave anything already due
    // sitting until the next minute — and a service that restarts more often than the period would
    // never sweep at all. Run once now, then on the interval.
    void tick().catch((err) => console.error('[notification-service] First scheduler tick failed:', err));

    const timer = setInterval(() => {
        // A failing tick must not take the process down: the next one is 60 seconds away and the
        // rows it could not move are still exactly where it left them.
        void tick().catch((err) => console.error('[notification-service] Scheduler tick failed:', err));
    }, TICK_INTERVAL_MS);

    // Nothing here should hold the process open on its own.
    timer.unref();
    return timer;
}
