import { Event, publish } from '@bgsc/shared';
import { settleExpiredLots } from '../auction/auction.service';

/**
 * Two ticks:
 *
 * 1. Events, every 60s (and once at boot): `upcoming → ongoing` at `start_at` (event-model.md §5).
 *    Only events that have NOT ended (`end_at > now`). The first run used to flip every stale
 *    `upcoming` event — ones that ended months ago included — and fire an EventStarted storm
 *    (roster locks, investments opening) for events long over (audit #2). An ended event still
 *    `upcoming` is left alone and logged: an admin decides whether it happened.
 *    Completion (`ongoing → past`) stays manual: EventCompleted freezes the final board and pays
 *    podium points, and results are routinely entered after `end_at`.
 *
 * 2. Auction lots, every 2s: settle lots whose server timer expired ("auto-close on deadline").
 *    CAS-safe, so every instance can run it.
 *
 * Each flip is a CAS, so several instances ticking together publish one event per transition.
 * ponytail: 100 events per tick; a job queue if start times ever need to-the-second precision.
 */
const EVENT_TICK_MS = 60_000;
const LOT_TICK_MS = 2_000;

export async function startDueEvents(now = new Date()): Promise<number> {
    const due = await Event.find(
        { status: 'upcoming', start_at: { $lte: now }, end_at: { $gt: now }, deleted_at: null },
        { _id: 1, title: 1 }
    )
        .limit(100)
        .lean();

    let started = 0;
    for (const e of due) {
        const res = await Event.updateOne(
            { _id: e._id, status: 'upcoming' },
            { $set: { status: 'ongoing', started_at: now } }
        );
        if (res.modifiedCount === 1) {
            started++;
            publish('EventStarted', 'event-service', { event_id: e._id, title: e.title });
        }
    }

    const stale = await Event.countDocuments({ status: 'upcoming', end_at: { $lte: now }, deleted_at: null });
    if (stale > 0) {
        console.warn(`[event-service] ${stale} event(s) still 'upcoming' after end_at; left for an admin to resolve`);
    }
    return started;
}

export function startScheduler(): () => void {
    const tickEvents = () =>
        startDueEvents().catch((err) => console.error('[event-service] event tick failed:', err));
    let lotsRunning = false;
    const tickLots = () => {
        // One pass at a time per instance; a slow Registration call must not stack ticks.
        if (lotsRunning) return;
        lotsRunning = true;
        settleExpiredLots()
            .catch((err) => console.error('[event-service] lot tick failed:', err))
            .finally(() => (lotsRunning = false));
    };

    void tickEvents(); // boot tick: nothing waits a minute after a restart
    const events = setInterval(tickEvents, EVENT_TICK_MS);
    const lots = setInterval(tickLots, LOT_TICK_MS);
    events.unref();
    lots.unref();
    return () => {
        clearInterval(events);
        clearInterval(lots);
    };
}
