import { Event, FormSubmission, publish } from '@bgsc/shared';
import { settleExpiredLots } from '../auction/auction.service';
import { releaseSeat } from './event.service';

/**
 * Three ticks:
 *
 * 1. Events, every 60s (and once at boot): `upcoming → ongoing` at `start_at` (event-model.md §5).
 *    Only events that have NOT ended (`end_at > now`). The first run used to flip every stale
 *    `upcoming` event — ones that ended months ago included — and fire an EventStarted storm
 *    (roster locks, investments opening) for events long over. An ended event still
 *    `upcoming` is left alone and logged: an admin decides whether it happened.
 *    Completion (`ongoing → past`) stays manual: EventCompleted freezes the final board and pays
 *    podium points, and results are routinely entered after `end_at`.
 *
 * 2. Auction lots, every 2s: settle lots whose server timer expired ("auto-close on deadline").
 *    CAS-safe, so every instance can run it.
 *
 * 3. Seats, every 5 minutes: `reconcileSeats` below.
 *
 * Each flip is a CAS, so several instances ticking together publish one event per transition.
 * ponytail: 100 events per tick; a job queue if start times ever need to-the-second precision.
 */
const EVENT_TICK_MS = 60_000;
const LOT_TICK_MS = 2_000;
const SEAT_TICK_MS = 5 * 60_000;
/** A row must have sat in its seatless status this long before its seat is taken back. */
const SEAT_GRACE_MS = 10 * 60_000;
const NO_SEAT_STATUSES = ['cancelled', 'rejected', 'waitlisted'];

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

/**
 * Seat ledger repair: a capped, still-running event gives back every seat whose registration no
 * longer uses it — the row is gone, or has been cancelled, rejected or waitlisted for longer than the
 * grace period (a release Registration could not complete, or a lost RegistrationCancelled).
 * `confirmed` rows hold their seat; `submitted` ones may be mid-reserve and Registration retries
 * those itself. Every release is the ledger's own conditional `$pull`, so concurrent runs (or a late
 * release-seat call) can never decrement twice.
 *
 * A promotion or an admin re-confirm reserves first and flips the row after, so each row is read
 * again right before its release: one confirmed since the batch read keeps its seat.
 * ponytail: the window between that reserve and its row flip (milliseconds) is still open — a
 * sweep landing exactly there strips the seat of a row about to be confirmed. Closing it needs a
 * reserve-time marker on the seat.
 * ponytail: every capped live event, re-scanned whole each tick (streamed); there are few at once.
 */
export async function reconcileSeats(now = new Date()): Promise<number> {
    const events = Event.find(
        {
            status: { $nin: ['past', 'cancelled'] },
            deleted_at: null,
            'registration.max_participants': { $ne: null },
            'seat_holders.0': { $exists: true },
        },
        { _id: 1, seat_holders: 1 }
    )
        .lean()
        .cursor();

    const cutoff = new Date(now.getTime() - SEAT_GRACE_MS);
    const isStale = (row: { status: string; updated_at: Date } | null) =>
        !row || (NO_SEAT_STATUSES.includes(row.status) && row.updated_at < cutoff);
    let released = 0;
    for await (const e of events) {
        const rows = await FormSubmission.find({ _id: { $in: e.seat_holders } }, { status: 1, updated_at: 1 }).lean();
        const byId = new Map(rows.map((r) => [r._id, r]));
        for (const id of e.seat_holders.filter((id) => isStale(byId.get(id) ?? null))) {
            if (!isStale(await FormSubmission.findById(id, { status: 1, updated_at: 1 }).lean())) continue;
            if ((await releaseSeat(e._id, id)).released) released++;
        }
    }
    if (released > 0) console.warn(`[event-service] seat reconciliation released ${released} stale seat(s)`);
    return released;
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
    const seats = setInterval(
        () => void reconcileSeats().catch((err) => console.error('[event-service] seat tick failed:', err)),
        SEAT_TICK_MS
    );
    events.unref();
    lots.unref();
    seats.unref();
    return () => {
        clearInterval(events);
        clearInterval(lots);
        clearInterval(seats);
    };
}
