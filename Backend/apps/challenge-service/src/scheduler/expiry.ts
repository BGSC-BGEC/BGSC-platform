import { Challenge, ChallengeParticipation, publish } from '@bgsc/shared';
import { PRODUCER } from '../challenges/challenge.service';

/**
 * Two time-driven transitions the model has indexes for and nothing else would ever fire.
 *
 * (A) is load-bearing, not housekeeping: `accepted` has no other exit, so without it an abandoned
 * participation sits in "my active challenges" forever, keeps `counts` lying, and can still be
 * submitted against the moment somebody notices the deadline is not enforced elsewhere.
 *
 * ponytail: expiring does NOT free the unique `{ challenge_id, participant.id }` slot, so one
 * attempt per challenge per participant is the rule — which is what challenge-model.md §3.1's
 * lifecycle says (`expired` is terminal; there is no edge back). Nor does it give the seat back:
 * `counts.accepted` stays claimed, because the participant did take a place. If re-attempts are
 * ever wanted, the change is an `attempt` counter in the unique key, not a deletion.
 */

const INTERVAL_MS = 60_000;
/** Bound the work per tick; the rest lands on the next one. */
const BATCH = 200;

export async function tick(now: Date = new Date()): Promise<{ expired: number; completed: number }> {
    // (A) Served by the partial index on { status, deadline_at } (Challenge.ts).
    const due = await ChallengeParticipation.find({ status: 'accepted', deadline_at: { $lte: now } })
        .sort({ deadline_at: 1 })
        .limit(BATCH);

    let expired = 0;
    for (const p of due) {
        // Compare-and-swap, so two instances sweeping the same row produce one transition and one
        // event; the loser matches nothing.
        const won = await ChallengeParticipation.findOneAndUpdate(
            { _id: p._id, status: 'accepted' },
            {
                $set: { status: 'expired' },
                $push: { status_history: { from: 'accepted', to: 'expired', by: 'system', at: now } },
            },
            { returnDocument: 'after' }
        );
        if (!won) continue;
        expired++;
        publish('ChallengeExpired', PRODUCER, { participation_id: p._id, challenge_id: p.challenge_id });
    }

    // (B) Served by { status, window.closes_at } (Challenge.ts). `updateMany` runs no document
    // middleware, which is fine here because nothing on this path is derived — and is exactly why
    // it must not also touch `counts`.
    const closed = await Challenge.updateMany(
        { status: 'active', deleted_at: null, 'window.closes_at': { $lte: now } },
        { $set: { status: 'completed' } }
    );

    return { expired, completed: closed.modifiedCount };
}

/**
 * `setInterval`'s first fire is a full period away, so a process that restarts more often than the
 * period would never sweep: run once at boot, then on the timer, and `unref()` so the timer cannot
 * hold the process open during a shutdown.
 */
export function startExpirySweeper(): void {
    // `setInterval` fires on the clock, not on completion: a sweep that outlives its period would
    // otherwise overlap itself and redo the same batch.
    let running = false;
    const sweep = async (): Promise<void> => {
        if (running) return;
        running = true;
        try {
            await tick();
        } catch (err) {
            console.error(`[${PRODUCER}] expiry sweep failed:`, err);
        } finally {
            running = false;
        }
    };

    void sweep();
    const timer = setInterval(() => void sweep(), INTERVAL_MS);
    timer.unref();
}
