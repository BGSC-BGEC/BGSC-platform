import { Challenge, ChallengeParticipation, HallOfFameEntry } from '@bgsc/shared';
import { fillRewardIds, publishCompleted, publishLegend } from '../challenges/participation.service';
import { PRODUCER } from '../challenges/challenge.service';

/**
 * Replay sweep. The bus is Redis pub/sub: no persistence, no redelivery. An
 * approval whose `ChallengeCompleted` was published while Points was down is paid by nobody, ever,
 * and a lost `ChallengeLegendAchieved` means a Legend that never reaches Hall of Fame.
 *
 * So every 5 minutes, over approvals touched in the last 7 days (and not in the last 5 minutes —
 * the live event gets its chance first):
 *  (A) payout: reward ids short of one per member AFTER reading the ledger back -> republish
 *      `ChallengeCompleted`. Points dedupes on `challenge.completed:<participation>:<user>`, so a
 *      republish of something that was paid moves nothing.
 *  (B) Hall of Fame: a legend approval with no `reward.hall_of_fame_entry_id` -> read the entry back
 *      by its identity first (leaderboard's unique `{category, honoree.id, source.id}`), and only
 *      republish `ChallengeLegendAchieved` when there is none. Leaderboard's consumer is idempotent
 *      on the same identity and re-announces an existing entry.
 *
 * `updated_at` is the window key (partial index on approved rows, Challenge.ts). It is never older
 * than the approval, so the window can only over-include, which the dedupe makes harmless.
 * ponytail: a payout whose Points rule is disabled never produces ledger rows, so it is republished
 * every tick for 7 days — bounded, idempotent, and cheaper than a "gave up" marker.
 */

const INTERVAL_MS = 5 * 60_000;
const WINDOW_MS = 7 * 86_400_000;
const SETTLE_MS = 5 * 60_000;
/** Bound the work per tick per kind; the rest lands on the next one. */
const PAGE = 200;

export async function replayTick(now: Date = new Date()): Promise<{ payouts: number; legends: number; linked: number }> {
    const updated_at = { $gte: new Date(now.getTime() - WINDOW_MS), $lte: new Date(now.getTime() - SETTLE_MS) };

    // (A) One indexed range on approved rows, the short-reward test done by the server.
    const unpaid = await ChallengeParticipation.find({
        status: 'approved',
        updated_at,
        reward: { $ne: null },
        // `$ifNull`: `$size` of a missing array is a query error, and the conjunction's order of
        // evaluation is the server's choice, not ours.
        $expr: { $lt: [{ $size: { $ifNull: ['$reward.point_transaction_ids', []] } }, { $size: '$member_user_ids' }] },
    })
        .sort({ updated_at: 1 })
        .limit(PAGE);

    let payouts = 0;
    for (const row of unpaid) {
        const p = await fillRewardIds(row);
        if (p.reward!.point_transaction_ids.length >= p.member_user_ids.length) continue;
        publishCompleted(p);
        payouts++;
    }

    // (B) Legend challenges are few; their ids bound the participation query.
    const legendIds = await Challenge.distinct('_id', { grants_hall_of_fame: true });
    let legends = 0;
    let linked = 0;
    if (legendIds.length > 0) {
        const unannounced = await ChallengeParticipation.find({
            status: 'approved',
            updated_at,
            challenge_id: { $in: legendIds },
            reward: { $ne: null },
            'reward.hall_of_fame_entry_id': null,
        })
            .sort({ updated_at: 1 })
            .limit(PAGE);

        for (const p of unannounced) {
            const entry = await HallOfFameEntry.findOne({
                category: 'challenge_legend',
                'honoree.id': p.participant.id,
                'source.id': p.challenge_id,
                deleted_at: null,
            })
                .select('_id')
                .lean<{ _id: string }>();
            if (entry) {
                await ChallengeParticipation.updateOne(
                    { _id: p._id, status: 'approved', 'reward.hall_of_fame_entry_id': null },
                    { $set: { 'reward.hall_of_fame_entry_id': entry._id } }
                );
                linked++;
                continue;
            }
            publishLegend(p);
            legends++;
        }
    }

    return { payouts, legends, linked };
}

/** Same shape as the expiry sweeper: once at boot, then on a timer, single-flight, `unref`'d. */
export function startReplaySweeper(): void {
    let running = false;
    const sweep = async (): Promise<void> => {
        if (running) return;
        running = true;
        try {
            await replayTick();
        } catch (err) {
            console.error(`[${PRODUCER}] replay sweep failed:`, err);
        } finally {
            running = false;
        }
    };

    void sweep();
    setInterval(() => void sweep(), INTERVAL_MS).unref();
}
