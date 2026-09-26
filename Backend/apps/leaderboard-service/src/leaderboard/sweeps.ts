import { Event, LeaderboardSnapshot } from '@bgsc/shared';
import { finalizeEvent, settlePendingInvestments } from './leaderboard.service';

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
 * re-announce the final podium of the rest — a LeaderboardFrozen that Points missed would otherwise
 * never pay. Points pays each place under one key, so an announcement it already has writes nothing.
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
}
