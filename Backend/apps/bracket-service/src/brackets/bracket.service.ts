import {
    Bracket,
    BracketFormat,
    BracketParticipant,
    Event,
    FormSubmission,
    IBracket,
    IEvent,
    IMatch,
    Match,
    ParticipantType,
    REGISTERED_STATUS,
    ServiceError,
    Team,
    publish,
    recordAudit,
} from '@bgsc/shared';
import { randomUUID } from 'crypto';
import { Actor, Viewer, adminEventOr404, assertEventVisible } from './actor';
import { GenerateBracketInput, MAX_FIELD } from './bracket.schemas';
import { generate, seedParticipants } from './generate';
import { completeBracketIfDone } from '../matches/match.service';

/**
 * The draw's data access, guards and domain events. The arithmetic lives in `generate.ts`, which
 * knows nothing about Mongo; this file knows nothing about seeding order.
 *
 * Writes nothing outside its own two collections. `events`, `teams` and `form_submissions` are
 * read through their models — a read is a read (`adding-a-service.md §6.5`) — and the reserved
 * `events.bracket` slot is deliberately left null.
 */

const PRODUCER = 'bracket-service';

/** The formats `generate.ts` can draw. The event model carries five. */
const SUPPORTED: readonly string[] = ['round_robin', 'single_elim'];

/* ------------------------------------------------------------------ *
 * Reading the event
 * ------------------------------------------------------------------ */

export async function loadEvent(eventId: string, notFound = 'event_not_found'): Promise<IEvent> {
    const event = await Event.findOne({ _id: eventId, deleted_at: null });
    if (!event) throw new ServiceError(404, notFound);
    return event;
}

/**
 * A bracket needs an event that has a competition in it.
 *
 * `type: 'DE'` is a direct event and carries no leaderboard at all (`Event.ts` enforces the pair),
 * so there is nothing to draw. A cancelled event is refused outright: fixtures for something that
 * will not happen are noise the console has to explain away.
 */
function assertDrawable(event: IEvent): BracketFormat {
    if (event.status === 'cancelled') throw new ServiceError(409, 'event_cancelled');
    if (!event.leaderboard) throw new ServiceError(422, 'event_has_no_leaderboard');

    const format = event.leaderboard.format;
    if (!SUPPORTED.includes(format)) {
        // Named, not generic: an organiser who picked double elimination should be told that it is
        // the format we cannot draw yet, not that something went wrong.
        throw new ServiceError(422, 'format_not_supported', { format });
    }
    return format as BracketFormat;
}

/* ------------------------------------------------------------------ *
 * The field
 * ------------------------------------------------------------------ */

export interface Field {
    participant_type: ParticipantType;
    entries: Omit<BracketParticipant, 'seed'>[];
}

/**
 * Who is in the draw.
 *
 * A teamed event draws **locked** rosters only: Spec §5.5's "Roster Lockdown" is the moment a team
 * stops changing, and seeding a roster that can still gain a player produces a bracket that lies
 * about who is playing. A solo event draws confirmed registrations, in the order they arrived,
 * which is also the default seeding.
 */
export async function readField(event: IEvent): Promise<Field> {
    if (event.teaming.is_teamed) {
        const teams = await Team.find({ 'owner.type': 'event', 'owner.id': event._id, status: 'locked' })
            .sort({ created_at: 1 })
            .select('_id name')
            .lean<{ _id: string; name: string }[]>();
        return {
            participant_type: 'team',
            entries: teams.map((t) => ({ id: t._id, display_name: t.name, avatar_url: null })),
        };
    }

    const registrations = await FormSubmission.find({
        'owner.type': 'event',
        'owner.id': event._id,
        status: REGISTERED_STATUS,
        // A deleted account is not a new seat; its snapshot is already anonymized.
        'user.deleted': { $ne: true },
    })
        .sort({ submitted_at: 1, _id: 1 })
        .select('user')
        .lean<{ user: { user_id: string; display_name: string; avatar_url: string | null } }[]>();

    // One seat per person. The unique registration index is per FORM, so an event that has had
    // two forms can hold two confirmed rows for one user — and a duplicate id fails the Bracket
    // invariant as a 500. The earlier registration keeps the seat.
    const seen = new Set<string>();
    const unique = registrations.filter((r) => !seen.has(r.user.user_id) && !!seen.add(r.user.user_id));

    return {
        participant_type: 'user',
        entries: unique.map((r) => ({
            id: r.user.user_id,
            display_name: r.user.display_name,
            avatar_url: r.user.avatar_url ?? null,
        })),
    };
}

/* ------------------------------------------------------------------ *
 * Generate
 * ------------------------------------------------------------------ */

export interface DrawResult {
    bracket: IBracket;
    matches: IMatch[];
}

export async function generateBracket(input: GenerateBracketInput, actor: Actor): Promise<DrawResult> {
    const event = await adminEventOr404(input.event_id, actor);
    const format = assertDrawable(event);

    const field = await readField(event);
    if (field.entries.length < 2) {
        throw new ServiceError(422, 'not_enough_participants', { found: field.entries.length });
    }
    // A round robin of n is n(n-1)/2 fixtures in one insert: 256 is 32,640, 1,000 would be ~500k.
    if (field.entries.length > MAX_FIELD) {
        throw new ServiceError(422, 'too_many_participants', { found: field.entries.length, max: MAX_FIELD });
    }
    if (input.seeding === 'manual' && !input.seeds) throw new ServiceError(422, 'manual_seeding_requires_seeds');

    let participants: BracketParticipant[];
    try {
        participants = seedParticipants(field.entries, input.seeding, input.seeds);
    } catch (err) {
        // The only thing `seedParticipants` throws for is a manual list that is not the field.
        throw new ServiceError(422, 'seeds_must_match_participants', { expected: field.entries.length });
    }

    const draw = generate(participants, format);
    const bracketId = randomUUID();

    // Two writes and no transaction (Mongo is standalone here, relationships.md §5). The bracket
    // goes first because its unique `event_id` is the claim: a second generator loses here, before
    // any fixture exists.
    let bracket: IBracket;
    try {
        bracket = await Bracket.create({
            _id: bracketId,
            event_id: event._id,
            format,
            participant_type: field.participant_type,
            seeding: input.seeding,
            participants,
            rounds: draw.rounds,
            status: 'active',
            generated_by: actor.id,
        });
    } catch (err) {
        if ((err as { code?: number }).code === 11000) throw new ServiceError(409, 'bracket_exists');
        throw err;
    }

    try {
        await Match.insertMany(
            draw.matches.map((m) => ({
                _id: m._id,
                event_id: event._id,
                bracket_id: bracketId,
                round: m.round,
                slot: m.slot,
                bracket_side: 'main',
                a: m.a ? { seed: m.a.seed, id: m.a.id, display_name: m.a.display_name } : null,
                b: m.b ? { seed: m.b.seed, id: m.b.id, display_name: m.b.display_name } : null,
                status: m.status,
                winner: m.winner,
                advances_to: m.advances_to,
            }))
        );
    } catch (err) {
        // A bracket with no fixtures would sit there holding the event's unique key and refusing
        // every retry. Nothing else can have touched it yet: it is one statement old.
        await Bracket.deleteOne({ _id: bracketId });
        await Match.deleteMany({ bracket_id: bracketId });
        throw err;
    }

    await recordAudit({
        actor_id: actor.id,
        action: 'bracket.generated',
        target_type: 'event',
        target_id: event._id,
        new_value: { bracket_id: bracketId, format, participants: participants.length, rounds: draw.rounds },
        ip: actor.ip,
    });

    publish('BracketGenerated', PRODUCER, {
        event_id: event._id,
        bracket_id: bracketId,
        format,
        participant_type: field.participant_type,
        participants: participants.length,
        rounds: draw.rounds,
    });

    return { bracket, matches: await listMatches(event._id) };
}

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

export async function listMatches(
    eventId: string,
    filter: { round?: number; status?: string } = {}
): Promise<IMatch[]> {
    const query: Record<string, unknown> = { event_id: eventId };
    if (filter.round !== undefined) query.round = filter.round;
    if (filter.status) query.status = filter.status;
    // Bracket order, always: a fixture list in any other order is not a bracket.
    return Match.find(query).sort({ round: 1, slot: 1 }).lean<IMatch[]>();
}

export async function getBracket(eventId: string, viewer: Viewer): Promise<DrawResult> {
    const bracket = await Bracket.findOne({ event_id: eventId });
    if (!bracket) throw new ServiceError(404, 'bracket_not_found');
    // Same rule the Event Service applies to the event itself — and ONE 404 code whether the
    // event is missing, deleted or a draft, so the code is not an oracle for which.
    assertEventVisible(await loadEvent(eventId, 'bracket_not_found'), viewer, 'bracket_not_found');
    return { bracket, matches: await listMatches(eventId) };
}

/** The public fixture list. Gated on the event, exactly as the bracket read is. */
export async function listMatchesFor(
    eventId: string,
    viewer: Viewer,
    filter: { round?: number; status?: string } = {}
): Promise<IMatch[]> {
    assertEventVisible(await loadEvent(eventId), viewer, 'event_not_found');
    return listMatches(eventId, filter);
}

export async function getMatch(id: string, viewer: Viewer): Promise<IMatch> {
    const match = await Match.findById(id).lean<IMatch>();
    if (!match) throw new ServiceError(404, 'match_not_found');
    // A missing event or a draft the viewer may not see: the fixture is not theirs to read either,
    // and it answers as the fixture rather than leaking which half was missing. Anything else (a
    // database failure) is not a 404.
    assertEventVisible(await loadEvent(match.event_id, 'match_not_found'), viewer, 'match_not_found');
    return match;
}

/* ------------------------------------------------------------------ *
 * Delete
 * ------------------------------------------------------------------ */

/**
 * Clear a draw so it can be made again.
 *
 * Refused once anything has actually been **played**, which is `reported_by`, not `completed`:
 * byes are completed at generation (`generate.ts`), so a bracket of six would otherwise be
 * unregenerable from the moment it was drawn — the opposite of what this guard is for.
 */
export async function deleteBracket(eventId: string, actor: Actor): Promise<void> {
    await adminEventOr404(eventId, actor, 'bracket_not_found');

    // Claim first: `active` → `draft`. A report re-reads the bracket AFTER its own compare-and-swap
    // and backs out when it finds `draft` (match.service.ts), so once this claim lands no result
    // can slip in between the "nothing played" check and the delete — the check-then-delete this
    // replaced could destroy a result reported in that gap. A `draft` bracket is
    // also claimable, so a delete that died half way can be retried.
    // `claimed_at` dates the claim, so a delete that dies before finishing does not leave the
    // bracket refusing reports forever: a report takes a stale claim back (match.service.ts).
    const bracket = await Bracket.findOneAndUpdate(
        { event_id: eventId, status: { $in: ['active', 'draft'] } },
        { $set: { status: 'draft', claimed_at: new Date() } },
        { returnDocument: 'after' }
    );
    if (!bracket) {
        if (await Bracket.exists({ event_id: eventId })) throw new ServiceError(409, 'bracket_already_played');
        throw new ServiceError(404, 'bracket_not_found');
    }
    const release = () =>
        Bracket.updateOne({ _id: bracket._id, status: 'draft' }, { $set: { status: 'active', claimed_at: null } });

    let played: boolean;
    try {
        played = !!(await Match.exists({ bracket_id: bracket._id, reported_by: { $ne: null } }));
    } catch (err) {
        // Nothing has been deleted yet: give the claim back rather than strand the bracket in draft.
        await release().catch(() => undefined);
        throw err;
    }
    if (played) {
        await release();
        // A report that finished while we held the claim could not complete the bracket then (its
        // active → completed swap found 'draft'); if that was the last fixture, complete it now.
        await completeBracketIfDone(bracket);
        throw new ServiceError(409, 'bracket_already_played');
    }

    // Fixtures first, then the bracket. The other order would leave fixtures whose bracket is gone
    // — rows that still answer `GET /matches` and belong to nothing. This order can only leave an
    // empty bracket, which the next Generate replaces after one 409 the organiser can read.
    await Match.deleteMany({ bracket_id: bracket._id });
    await Bracket.deleteOne({ _id: bracket._id });

    await recordAudit({
        actor_id: actor.id,
        action: 'bracket.deleted',
        target_type: 'event',
        target_id: eventId,
        previous_value: { bracket_id: bracket._id, format: bracket.format },
        ip: actor.ip,
    });
}
