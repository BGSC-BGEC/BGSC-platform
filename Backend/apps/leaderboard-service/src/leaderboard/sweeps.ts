import { Event, FormSubmission, LeaderboardEntry, LeaderboardSnapshot, Team } from '@bgsc/shared';
import { handlers } from '../events/consumers';
import { finalizeEvent, freezeCancelled, settlePendingInvestments } from './leaderboard.service';

/**
 * Background repair. The bus has no outbox and an investment spans two services,
 * so both need a sweep that re-derives what should already be true. Everything here is idempotent.
 */

const SETTLE_MS = 60_000;
const REPLAY_MS = 5 * 60_000;
const WINDOW_MS = 7 * 86_400_000;
const EVENT_PAGE = 50;

/**
 * Events completed in the last 7 days: finalize the ones whose EventCompleted never arrived, and
 * re-announce the final podium of the rest while some of it is unpaid — a LeaderboardFrozen that
 * Points missed would otherwise never pay. Points pays each place under one key, so an announcement
 * it already has writes nothing.
 */
export async function replayFinals(now: Date = new Date()): Promise<{ finalized: number; republished: number }> {
    const events = await Event.find({
        status: 'past',
        completed_at: { $gte: new Date(now.getTime() - WINDOW_MS) },
        type: { $ne: 'DE' },
        leaderboard: { $ne: null },
        deleted_at: null,
    })
        .select('_id')
        .sort({ completed_at: -1 })
        .limit(EVENT_PAGE)
        .lean();

    let finalized = 0;
    let republished = 0;
    for (const e of events) {
        if (await LeaderboardSnapshot.exists({ event_id: e._id, reason: 'final' })) {
            if (await finalizeEvent(e._id, true)) republished++;
        } else if (await finalizeEvent(e._id)) {
            finalized++;
        }
    }
    return { finalized, republished };
}

/**
 * The membership messages, re-derived: a RegistrationCreated or TeamLocked this service missed
 * leaves a participant off the board, and a missed EventCancelled leaves a cancelled board open.
 * Each fix goes through the consumer it stands in for, so a second run finds nothing to do.
 *
 * ponytail: reads every live board's registrations and teams each tick — fine at club scale; page
 * by event if live events ever run to hundreds.
 */
export async function replayMembership(now: Date = new Date()): Promise<{ joined: number; frozen: number }> {
    const boards = { type: { $ne: 'DE' as const }, leaderboard: { $ne: null }, deleted_at: null };
    let joined = 0;
    let frozen = 0;

    const live = await Event.find({ ...boards, status: { $in: ['upcoming', 'ongoing'] } })
        .select('_id teaming.is_teamed')
        .lean();
    for (const event of live) {
        const entries = await LeaderboardEntry.find({ event_id: event._id }).select('participant.id registration_id stats.eliminated').lean();
        const byParticipant = new Map(entries.map((e) => [e.participant.id, e]));
        if (event.teaming?.is_teamed) {
            const teams = await Team.find({ 'owner.type': 'event', 'owner.id': event._id, status: 'locked' }).select('_id').lean();
            for (const t of teams.filter((t) => !byParticipant.has(t._id))) {
                await handlers.onTeamLocked({ team_id: t._id });
                joined++;
            }
            continue;
        }
        const regs = await FormSubmission.find({ 'owner.type': 'event', 'owner.id': event._id, status: 'confirmed' })
            .select('_id user.user_id')
            .lean();
        for (const r of regs) {
            const entry = byParticipant.get(r.user.user_id);
            // Missing, or eliminated although a confirmed registration stands now (a newer row, or
            // the same row demoted then promoted again). Only a withdrawal eliminates an entry.
            if (entry && !entry.stats?.eliminated) continue;
            await handlers.onRegistrationCreated({
                registration_id: r._id,
                owner: { type: 'event', id: event._id },
                user_id: r.user.user_id,
            });
            joined++;
        }
    }

    const cancelled = await Event.find({ ...boards, status: 'cancelled', cancelled_at: { $gte: new Date(now.getTime() - WINDOW_MS) } })
        .select('_id')
        .lean();
    for (const e of cancelled) {
        const latest = await LeaderboardSnapshot.findOne({ event_id: e._id }).sort({ taken_at: -1 }).select('frozen').lean();
        if (latest?.frozen || !(await LeaderboardEntry.exists({ event_id: e._id }))) continue;
        await freezeCancelled(e._id);
        frozen++;
    }
    return { joined, frozen };
}

function every(ms: number, what: string, job: () => Promise<unknown>): void {
    let running = false;
    const run = async (): Promise<void> => {
        if (running) return;
        running = true;
        try {
            await job();
        } catch (err) {
            console.error(`[leaderboard-service] ${what} failed:`, err);
        } finally {
            running = false;
        }
    };
    setInterval(() => void run(), ms).unref();
}

export function startSweeps(): void {
    every(SETTLE_MS, 'investment settle sweep', () => settlePendingInvestments());
    every(REPLAY_MS, 'final replay sweep', () => replayFinals());
    every(REPLAY_MS, 'membership replay sweep', () => replayMembership());
}
