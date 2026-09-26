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
import { Actor, adminEventOr404 } from '../brackets/actor';
import { ReportResultInput, ScheduleMatchInput } from '../brackets/bracket.schemas';
import { championOf } from '../brackets/standings';

/** A delete claim older than this belongs to a deleter that died; a report may take it back. */
const DELETE_CLAIM_STALE_MS = 60_000;

/**
 * Reporting a result, and everything that follows from it.
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

    // Visibility before permission: a draft event's fixture is a 404 to a non-admin, not a 403
    // that confirms it exists (audit #2).
    const event = await adminEventOr404(match.event_id, actor, 'match_not_found');
    // A result for an event that was called off is a fixture nobody played.
    if (event.status === 'cancelled') throw new ServiceError(409, 'event_cancelled');

    let bracket = await Bracket.findById(match.bracket_id);
    if (!bracket) throw new ServiceError(404, 'bracket_not_found');
    // `draft` is a delete in progress (bracket.service.ts `deleteBracket`) — unless its claim is
    // stale, i.e. the deleter died between claim and delete. Then the claim is taken back, or the
    // bracket would refuse every report forever.
    if (bracket.status === 'draft') {
        bracket = await Bracket.findOneAndUpdate(
            { _id: bracket._id, status: 'draft', claimed_at: { $lt: new Date(Date.now() - DELETE_CLAIM_STALE_MS) } },
            { $set: { status: 'active', claimed_at: null } },
            { returnDocument: 'after' }
        );
        if (!bracket) throw new ServiceError(409, 'bracket_being_redrawn');
    }
    return { match, bracket };
}

/** Put a fixture back exactly as it was, if it still holds what this request wrote. */
async function undoClaim(match: IMatch, wrote: { score_a: number; score_b: number; reported_by: string }): Promise<void> {
    await Match.updateOne(
        { _id: match._id, status: 'completed', ...wrote },
        {
            $set: {
                score_a: match.score_a,
                score_b: match.score_b,
                winner: match.winner,
                status: match.status,
                reported_by: match.reported_by,
            },
        }
    );
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

    // The same score again is a retry (a double-clicked save, a lost response), not a correction:
    // answer with the result as it stands, whoever sends it, and emit nothing.
    if (match.status === 'completed' && match.score_a === input.score_a && match.score_b === input.score_b) {
        return match;
    }

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

    // The swap pins everything this decision was made on, not just the status: the two
    // participants (an upstream correction can re-seat a slot between load and write), and for a
    // correction the result being corrected — so two coordinators correcting at once produce one
    // correction, and the audit row's "previous" is really what was replaced (audit #2).
    // Typed, not inferred: a bare string[] here widens the filter and mongoose falls back to an
    // overload that returns a ModifyResult instead of the document.
    const from: MatchStatus[] = isCorrection ? ['completed'] : ['scheduled', 'ongoing'];
    const pinned: Record<string, unknown> = { 'a.id': match.a.id, 'b.id': match.b.id };
    if (isCorrection) {
        Object.assign(pinned, { score_a: match.score_a, score_b: match.score_b, reported_by: match.reported_by });
    }
    const claimed = await Match.findOneAndUpdate(
        { _id: matchId, status: { $in: from }, ...pinned },
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
    const wrote = { score_a: input.score_a, score_b: input.score_b, reported_by: actor.id };

    // A delete that claimed the bracket after our load: its "nothing played" check may already
    // have passed, so this result must not stand (deleteBracket's claim is the other half).
    const live = await Bracket.findById(bracket._id).select('status').lean<{ status: string }>();
    if (!live || live.status === 'draft') {
        await undoClaim(match, wrote);
        // The delete may have lost its own race and handed the bracket back; a sibling report that
        // finished while we held this fixture could not complete it then (audit #2).
        if (live) await completeBracketIfDone(bracket);
        throw new ServiceError(409, 'bracket_being_redrawn');
    }

    if (!(await advanceWinner(claimed, isCorrection))) {
        // The next round was reported between the downstream check above and this write, with the
        // OLD winner in it. Letting the correction stand would leave the bracket saying B won
        // while A played on — so it is undone, and the caller gets the same refusal as the check.
        await undoClaim(match, wrote);
        await completeBracketIfDone(bracket);
        throw new ServiceError(409, 'downstream_already_played');
    }

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

    await completeBracketIfDone(bracket, isCorrection);
    return claimed;
}

/**
 * Put the winner into the next fixture.
 *
 * Guarded on the target still being unplayed, so a correction can move somebody out of a slot but
 * never out of a fixture that has already been contested. On the first report the slot is empty by
 * construction — a completed match needs both participants, so the target cannot have been played.
 *
 * Returns false only when the target was already played with somebody OTHER than this winner in
 * the slot — the one outcome a correction must not leave standing. A score-only correction (same
 * winner) into a played fixture is fine: the slot already says the right thing.
 */
async function advanceWinner(match: IMatch, isCorrection: boolean): Promise<boolean> {
    if (!match.advances_to || match.winner === 'draw' || match.winner === null) return true;
    const side = match.winner === 'a' ? match.a : match.b;
    if (!side) return true;
    const { match_id, slot } = match.advances_to;

    const updated = await Match.updateOne({ _id: match_id, reported_by: null }, { $set: { [slot]: side } });
    if ((updated.matchedCount ?? 0) > 0) return true;

    const target = await Match.findById(match_id).select(slot).lean<IMatch>();
    if (target?.[slot]?.id === side.id) return true;

    if (!isCorrection) {
        // Not fatal and not silent: the result stands, the bracket just could not be walked
        // forward, and somebody has to look at it.
        console.error(`[bracket-service] match ${match._id} completed but its winner could not be advanced into ${match_id}`);
        return true;
    }
    return false;
}

/**
 * The draw is finished when nothing is left to play.
 *
 * The status change is a compare-and-swap from 'active', so `BracketCompleted` is emitted exactly
 * once however many results land at the same moment.
 *
 * A coordinator's correction to an already-completed bracket can change who won it, so it
 * re-announces the champion with `corrected: true` — consumers key on `bracket_id` and take the
 * latest. Without it the published winner silently disagreed with the standings (audit Sep 26).
 */
export async function completeBracketIfDone(bracket: Pick<IBracket, '_id'>, isCorrection = false): Promise<void> {
    const outstanding = await Match.countDocuments({
        bracket_id: bracket._id,
        status: { $in: ['scheduled', 'ongoing'] },
    });
    if (outstanding > 0) return;

    let done = await Bracket.findOneAndUpdate(
        { _id: bracket._id, status: 'active' },
        { $set: { status: 'completed' } },
        { returnDocument: 'after' }
    );
    if (!done) {
        // Another report got there first — unless this is a correction to a finished draw.
        if (!isCorrection) return;
        done = await Bracket.findOne({ _id: bracket._id, status: 'completed' });
        if (!done) return;
    }

    const matches = await Match.find({ bracket_id: bracket._id }).lean<IMatch[]>();
    const champion = championOf(done, matches);

    publish('BracketCompleted', PRODUCER, {
        event_id: done.event_id,
        bracket_id: done._id,
        format: done.format,
        participant_type: done.participant_type,
        winner_id: champion?.id ?? null,
        winner_name: champion?.display_name ?? null,
        corrected: isCorrection,
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
