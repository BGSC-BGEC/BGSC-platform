import {
    Bracket,
    IBracket,
    IMatch,
    Match,
    MatchStatus,
    MatchWinner,
    ServiceError,
    isTerminalMatch,
    publish,
    recordAudit,
    roleRank,
} from '@bgsc/shared';
import { Actor, assertMayScore } from '../brackets/actor';
import { ReportResultInput, ScheduleMatchInput } from '../brackets/bracket.schemas';
import { loadEvent } from '../brackets/bracket.service';
import { championOf } from '../brackets/standings';

/**
 * Reporting a result, and everything that follows from it (plan §8).
 *
 * The write itself is a compare-and-swap, because a double-clicked "save score" must not advance
 * two people out of one fixture — and the advance is a second compare-and-swap for the same reason.
 */

const PRODUCER = 'bracket-service';

function winnerOf(scoreA: number, scoreB: number): MatchWinner {
    if (scoreA > scoreB) return 'a';
    if (scoreB > scoreA) return 'b';
    return 'draw';
}

async function loadForReport(matchId: string, actor: Actor): Promise<{ match: IMatch; bracket: IBracket }> {
    const match = await Match.findById(matchId);
    if (!match) throw new ServiceError(404, 'match_not_found');

    const event = await loadEvent(match.event_id);
    assertMayScore(event, actor);
    // A result for an event that was called off is a fixture nobody played.
    if (event.status === 'cancelled') throw new ServiceError(409, 'event_cancelled');

    const bracket = await Bracket.findById(match.bracket_id);
    if (!bracket) throw new ServiceError(404, 'bracket_not_found');
    return { match, bracket };
}

export async function reportResult(
    matchId: string,
    input: ReportResultInput,
    actor: Actor
): Promise<IMatch> {
    const { match, bracket } = await loadForReport(matchId, actor);

    // A bye was never played and a cancelled fixture never will be.
    if (match.status === 'bye') throw new ServiceError(409, 'cannot_report_bye');
    if (match.status === 'cancelled') throw new ServiceError(409, 'match_cancelled');

    // An empty slot means an earlier round has not finished. Scoring it would invent a result for
    // a fixture whose participants are not known yet.
    if (!match.a || !match.b) throw new ServiceError(422, 'match_not_ready');

    const winner = winnerOf(input.score_a, input.score_b);
    // A knockout has to knock somebody out. Round robin keeps draws, which is what its table is for.
    if (winner === 'draw' && bracket.format === 'single_elim') {
        throw new ServiceError(422, 'draw_not_allowed');
    }

    const isCorrection = match.status === 'completed';
    if (isCorrection) {
        // Spec §5.15.2 gives admins an override; core reports, coordinator corrects.
        if (roleRank(actor.role) < roleRank('coordinator')) throw new ServiceError(409, 'already_reported');
        // ...but not once the winner has played their next fixture. Rewriting this result would
        // leave the round after it standing on a result that no longer exists, and this service
        // cannot un-play a match.
        if (match.advances_to) {
            const next = await Match.findById(match.advances_to.match_id).select('reported_by').lean<{
                reported_by: string | null;
            }>();
            if (next?.reported_by) throw new ServiceError(409, 'downstream_already_played');
        }
    }

    // Typed, not inferred: a bare string[] here widens the filter and mongoose falls back to an
    // overload that returns a ModifyResult instead of the document.
    const from: MatchStatus[] = isCorrection
        ? ['scheduled', 'ongoing', 'completed']
        : ['scheduled', 'ongoing'];
    const claimed = await Match.findOneAndUpdate(
        { _id: matchId, status: { $in: from } },
        {
            $set: {
                score_a: input.score_a,
                score_b: input.score_b,
                winner,
                status: 'completed',
                reported_by: actor.id,
            },
        },
        { returnDocument: 'after' }
    );
    // Lost the race: somebody else reported this fixture between the load and the swap.
    if (!claimed) throw new ServiceError(409, 'already_reported');

    await advanceWinner(claimed, isCorrection);

    await recordAudit({
        actor_id: actor.id,
        action: isCorrection ? 'match.corrected' : 'match.reported',
        target_type: 'match',
        target_id: matchId,
        previous_value: isCorrection ? { score_a: match.score_a, score_b: match.score_b, winner: match.winner } : undefined,
        new_value: { score_a: input.score_a, score_b: input.score_b, winner },
        ip: actor.ip,
    });

    const side = winner === 'a' ? claimed.a : winner === 'b' ? claimed.b : null;
    publish('MatchCompleted', PRODUCER, {
        event_id: claimed.event_id,
        bracket_id: claimed.bracket_id,
        match_id: claimed._id,
        round: claimed.round,
        winner_id: side?.id ?? null,
        loser_id: winner === 'a' ? claimed.b?.id ?? null : winner === 'b' ? claimed.a?.id ?? null : null,
        draw: winner === 'draw',
    });

    await completeBracketIfDone(bracket);
    return claimed;
}

/**
 * Put the winner into the next fixture.
 *
 * Guarded on the target still being unplayed, so a correction can move somebody out of a slot but
 * never out of a fixture that has already been contested. On the first report the slot is empty by
 * construction — a completed match needs both participants, so the target cannot have been played.
 */
async function advanceWinner(match: IMatch, isCorrection: boolean): Promise<void> {
    if (!match.advances_to || match.winner === 'draw' || match.winner === null) return;
    const side = match.winner === 'a' ? match.a : match.b;
    if (!side) return;

    const updated = await Match.updateOne(
        { _id: match.advances_to.match_id, reported_by: null },
        { $set: { [match.advances_to.slot]: side } }
    );

    if ((updated.matchedCount ?? 0) === 0 && !isCorrection) {
        // Not fatal and not silent: the result stands, the bracket just could not be walked
        // forward, and somebody has to look at it.
        console.error(
            `[bracket-service] match ${match._id} completed but its winner could not be advanced into ${match.advances_to.match_id}`
        );
    }
}

/**
 * The draw is finished when nothing is left to play.
 *
 * The status change is a compare-and-swap from 'active', so `BracketCompleted` is emitted exactly
 * once however many results land at the same moment.
 */
async function completeBracketIfDone(bracket: IBracket): Promise<void> {
    const outstanding = await Match.countDocuments({
        bracket_id: bracket._id,
        status: { $in: ['scheduled', 'ongoing'] },
    });
    if (outstanding > 0) return;

    const claimed = await Bracket.findOneAndUpdate(
        { _id: bracket._id, status: 'active' },
        { $set: { status: 'completed' } },
        { returnDocument: 'after' }
    );
    if (!claimed) return; // another report got there first

    const matches = await Match.find({ bracket_id: bracket._id }).lean<IMatch[]>();
    const champion = championOf(claimed, matches);

    publish('BracketCompleted', PRODUCER, {
        event_id: claimed.event_id,
        bracket_id: claimed._id,
        format: claimed.format,
        participant_type: claimed.participant_type,
        winner_id: champion?.id ?? null,
        winner_name: champion?.display_name ?? null,
    });
}

/**
 * Time and venue. Separate from reporting because Spec §5.15.2 makes them different console
 * actions, and because a reschedule must never be able to carry a score with it.
 */
export async function scheduleMatch(
    matchId: string,
    input: ScheduleMatchInput,
    actor: Actor
): Promise<IMatch> {
    const { match } = await loadForReport(matchId, actor);
    if (isTerminalMatch(match.status)) throw new ServiceError(409, 'match_not_open');

    const set: Record<string, unknown> = {};
    if (input.scheduled_at !== undefined) set.scheduled_at = input.scheduled_at;
    if (input.venue !== undefined) set.venue = input.venue;

    const updated = await Match.findOneAndUpdate(
        { _id: matchId, status: { $in: ['scheduled', 'ongoing'] } },
        { $set: set },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'match_not_open');

    await recordAudit({
        actor_id: actor.id,
        action: 'match.scheduled',
        target_type: 'match',
        target_id: matchId,
        new_value: set,
        ip: actor.ip,
    });

    publish('MatchScheduled', PRODUCER, {
        event_id: updated.event_id,
        match_id: updated._id,
        scheduled_at: updated.scheduled_at,
        venue: updated.venue,
    });
    return updated;
}
