import { Event, FormSubmission } from '@bgsc/shared';
import { promoteNext } from '../registrations/registration.service';
import { lockReadyRosters } from '../teams/team.service';

/**
 * Replay sweeps. The bus is Redis pub/sub with no outbox: an event published while
 * this service was down is gone. So what the consumers do on `EventStarted` / `AuctionClosed` /
 * `RegistrationCancelled` is also re-derived from state every 5 minutes. Both are idempotent (a
 * roster lock is a CAS; a promotion needs a free seat and a CAS on the row), so a sweep that
 * overlaps a live consumer changes nothing twice.
 */

const SWEEP_MS = 5 * 60 * 1000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 200;
/** Promotions per event per sweep: enough to fill the gaps a missed cancel leaves, not a stampede. */
const MAX_PROMOTIONS = 50;

/** Running events (started within the window) whose ready rosters are still unlocked. */
export async function rosterLockSweep(now = new Date()): Promise<number> {
    const events = await Event.find({
        status: 'ongoing',
        deleted_at: null,
        'teaming.is_teamed': true,
        // Keyed on when it actually started; events started before the field existed fall
        // back to their scheduled start.
        $or: [
            { started_at: { $gte: new Date(now.getTime() - WINDOW_MS) } },
            { started_at: null, start_at: { $gte: new Date(now.getTime() - WINDOW_MS) } },
        ],
    })
        .select('_id')
        .sort({ started_at: 1, start_at: 1 })
        .limit(PAGE)
        .lean();

    let locked = 0;
    for (const e of events) locked += await lockReadyRosters(e._id);
    return locked;
}

/**
 * Events with a free seat and a waitlist: a release whose `RegistrationCancelled` was lost, or a
 * safety-net release (a CAS loser giving a seat back) never promoted anyone.
 */
export async function promotionSweep(): Promise<number> {
    const events = await Event.find({
        status: { $in: ['upcoming', 'ongoing'] },
        deleted_at: null,
        'registration.max_participants': { $ne: null },
        $expr: { $lt: [{ $size: { $ifNull: ['$seat_holders', []] } }, '$registration.max_participants'] },
    })
        .select('_id seat_holders registration.max_participants')
        .sort({ start_at: 1 })
        .limit(PAGE)
        .lean();

    let promoted = 0;
    for (const e of events) {
        if (!(await FormSubmission.exists({ 'owner.type': 'event', 'owner.id': e._id, status: 'waitlisted' }))) continue;
        const free = Math.min(MAX_PROMOTIONS, e.registration.max_participants! - (e.seat_holders?.length ?? 0));
        for (let i = 0; i < free; i++) {
            if (!(await promoteNext(e._id))) break;
            promoted++;
        }
    }
    return promoted;
}

let running = false;

export function startSweeps(): void {
    const run = async () => {
        if (running) return; // a slow sweep is never overlapped by the next tick
        running = true;
        try {
            await rosterLockSweep();
            await promotionSweep();
        } catch (err) {
            console.error('[registration-service] sweep failed:', err);
        } finally {
            running = false;
        }
    };
    setTimeout(() => void run(), 30_000).unref();
    setInterval(() => void run(), SWEEP_MS).unref();
}
