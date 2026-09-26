import {
    Announcement,
    DISPATCH_MAX_ATTEMPTS,
    DISPATCH_RETRYABLE,
    INotificationDispatch,
    NOTIFICATION_TTL_DAYS,
    Notification,
    NotificationDispatch,
} from '@bgsc/shared';
import { dedupe, deliverAnnouncement } from '../broadcast/broadcast';
import { attempt, nextRetryAt, writeback } from '../broadcast/dispatch';

/**
 * The scheduler. Four sweeps, one timer.
 *
 * ponytail: one in-process 60s timer, running in every instance. Correct under concurrency —
 * every send is claimed with a compare-and-swap before it happens — and wasteful at N instances.
 * Move to a leader election or a real scheduler when there is more than one instance to care about.
 */

export const TICK_INTERVAL_MS = 60_000;

/** How far back reconciliation looks for a broadcast that never happened. */
export const RECONCILE_WINDOW_MS = 24 * 3_600_000;

/**
 * How old a publish must be before reconciliation may call it lost. A fan-out still running in the
 * consumer has fewer rows than channels too, and re-running it underneath itself is wasted work.
 */
export const RECONCILE_GRACE_MS = 2 * 60_000;

/**
 * Work cap per sweep per tick. A bounded page rather than "drain the queue": the next tick is 60
 * seconds away, and a loop that re-queries until it finds nothing can spin forever on a row it
 * keeps failing to claim.
 */
const SWEEP_LIMIT = 50;

const log = (what: string, err: unknown) => console.error(`[notification-service] ${what} failed:`, err);

/**
 * Retry every send whose backoff has elapsed.
 *
 * Each attempt is caught on its own: one row whose re-read throws must not abandon the other 49 in
 * the page — nor, by rejecting out of `tick()`, the reconcile and writeback sweeps behind it.
 */
export async function retryDue(now: Date = new Date()): Promise<number> {
    const rows = await NotificationDispatch.find({
        status: { $in: DISPATCH_RETRYABLE },
        attempts: { $lt: DISPATCH_MAX_ATTEMPTS },
        next_attempt_at: { $lte: now },
    })
        .sort({ next_attempt_at: 1 })
        .limit(SWEEP_LIMIT);

    for (const row of rows) {
        try {
            await attempt(row);
        } catch (err) {
            log(`dispatch attempt ${row._id}`, err);
        }
    }
    return rows.length;
}

/**
 * Close out a final attempt that never finished.
 *
 * `attempt()` claims by setting `pending` with a lease (`next_attempt_at`) and spends the attempt up
 * front. If the process dies — or the attempt throws — before it settles, an earlier attempt is
 * simply retried when the lease runs out. The FIFTH one is not: `retryDue` stops at the cap, so the
 * row would read `pending` forever and the composer would be told "still trying" about a send that
 * is over. Once its lease has lapsed it is certainly not in flight, so it is failed, honestly.
 *
 * `failed` keeps a retry date (the model's invariant for a retryable status) but is past the cap,
 * so nothing picks it up again — exactly like a fifth attempt that failed normally.
 */
export async function settleAbandoned(now: Date = new Date()): Promise<number> {
    // Died AFTER the provider call started (`sending_at` set): the message may be in the group, so
    // it is closed as `outcome_unknown` whatever attempt it was — never handed back to the retry
    // sweep, which would post it again.
    const midSend = await NotificationDispatch.updateMany(
        { status: 'pending', sending_at: { $ne: null }, next_attempt_at: { $lte: now } },
        {
            $set: {
                status: 'outcome_unknown',
                error: 'interrupted_mid_send',
                next_attempt_at: null,
                sending_at: null,
                writeback_at: null,
            },
            $inc: { revision: 1 },
        }
    );

    const res = await NotificationDispatch.updateMany(
        { status: 'pending', attempts: { $gte: DISPATCH_MAX_ATTEMPTS }, next_attempt_at: { $lte: now } },
        {
            $set: {
                status: 'failed',
                error: 'attempt_interrupted',
                next_attempt_at: nextRetryAt(DISPATCH_MAX_ATTEMPTS, now),
                writeback_at: null,
            },
            $inc: { revision: 1 },
        }
    );
    return (midSend.modifiedCount ?? 0) + (res.modifiedCount ?? 0);
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
 * The whole window is read (two fields per announcement) and counted in ONE aggregate; only the
 * incomplete ones are capped. The first version capped the candidate page instead, unsorted — so
 * past fifty publishes in a day, the complete ones filled the page and a lost one could sit outside
 * it every tick until it aged out of the window.
 *
 * It is also what makes scheduled broadcasts true end to end — the Announcement Service's own tick
 * publishes them, and this guarantees the broadcast follows even if that event was dropped.
 */
export async function reconcile(now: Date = new Date()): Promise<number> {
    const candidates = await Announcement.find({
        status: 'published',
        deleted_at: null,
        'delivery.whatsapp.requested': true,
        published_at: {
            $gte: new Date(now.getTime() - RECONCILE_WINDOW_MS),
            $lte: new Date(now.getTime() - RECONCILE_GRACE_MS),
        },
    })
        .sort({ published_at: -1 })
        .select('_id categories')
        .lean<{ _id: string; categories: string[] }[]>();
    if (candidates.length === 0) return 0;

    const counts = await NotificationDispatch.aggregate<{ _id: string; n: number }>([
        { $match: { 'source.type': 'announcement', 'source.id': { $in: candidates.map((c) => c._id) } } },
        { $group: { _id: '$source.id', n: { $sum: 1 } } },
    ]);
    const rowsFor = new Map(counts.map((c) => [c._id, c.n]));

    // One per category, plus the push row.
    const incomplete = candidates.filter((c) => (rowsFor.get(c._id) ?? 0) < c.categories.length + 1);

    let delivered = 0;
    for (const { _id } of incomplete.slice(0, SWEEP_LIMIT)) {
        try {
            await deliverAnnouncement(_id);
            delivered += 1;
        } catch (err) {
            log(`reconcile ${_id}`, err);
        }
    }
    return delivered;
}

/**
 * Retract the cards of deletes whose `AnnouncementDeleted` never arrived.
 *
 * The same outage that loses a publish loses a delete, and the retraction consumer is the only
 * other thing that removes a card — so without this, every recipient keeps one that opens onto a
 * 404 for the rest of its ninety days. Looks back exactly that far: an older card has already been
 * dropped by the TTL index. One `deleteMany` over the whole page, served by the `dedupe_key` prefix.
 *
 * ponytail: re-retracts the same recent deletes every tick (an index probe each, deleting nothing).
 * Mark them done in a local collection if deletions ever number in the thousands per quarter.
 */
export async function retractDeleted(now: Date = new Date()): Promise<number> {
    const deleted = await Announcement.find({
        deleted_at: { $gte: new Date(now.getTime() - NOTIFICATION_TTL_DAYS * 86_400_000) },
    })
        .sort({ deleted_at: -1 })
        .limit(SWEEP_LIMIT * 10)
        .select('_id')
        .lean<{ _id: string }[]>();
    if (deleted.length === 0) return 0;

    const res = await Notification.deleteMany({ dedupe_key: { $in: deleted.map((a) => dedupe.announcement(a._id)) } });
    return res.deletedCount ?? 0;
}

/**
 * Re-send delivery outcomes the Announcement Service never received.
 *
 * `writeback_at` is cleared by every `settle`, so this picks up both a writeback that failed and
 * one whose row has changed since — the composer's view catches up within a tick either way.
 *
 * Least recently tried first (never-tried rows sort first: null is lowest), and every row taken is
 * stamped before its attempt. Unsorted, the bounded page could be the same fifty rows every tick —
 * ones whose writeback keeps answering `retry` — and the rows behind them never got a turn.
 *
 * ponytail: the sort is in memory over the `writeback_at: null` set, which is small unless the
 * Announcement Service is down. Index `{ writeback_at: 1, writeback_tried_at: 1 }` if it is not.
 */
export async function retryWritebacks(now: Date = new Date()): Promise<number> {
    const stale = await NotificationDispatch.find({ writeback_at: null })
        .sort({ writeback_tried_at: 1, _id: 1 })
        .select('source')
        .limit(SWEEP_LIMIT)
        .lean<Pick<INotificationDispatch, '_id' | 'source'>[]>();
    if (stale.length === 0) return 0;

    const announcementIds = [...new Set(stale.map((r) => r.source.id))];
    // Every unstamped row of each announcement, not just the ones in the page: the writeback below
    // reports all of them, so they have all had their turn.
    await NotificationDispatch.updateMany(
        { 'source.id': { $in: announcementIds }, writeback_at: null },
        { $set: { writeback_tried_at: now } }
    );

    let written = 0;
    for (const id of announcementIds) {
        try {
            if (await writeback(id)) written += 1;
        } catch (err) {
            log(`writeback ${id}`, err);
        }
    }
    return written;
}

export interface TickResult {
    retried: number;
    abandoned: number;
    reconciled: number;
    retracted: number;
    written_back: number;
}

export async function tick(now: Date = new Date()): Promise<TickResult> {
    // Order matters only in that reconciliation can create rows the writeback sweep should then
    // pick up — doing it before the writeback pass saves those rows a minute.
    const retried = await retryDue(now);
    const abandoned = await settleAbandoned(now);
    const reconciled = await reconcile(now);
    const retracted = await retractDeleted(now);
    const written_back = await retryWritebacks(now);
    return { retried, abandoned, reconciled, retracted, written_back };
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
