import {
    Challenge,
    ChallengeParticipation,
    DELETED_DISPLAY_NAME,
    DomainEvent,
    Event,
    FormSubmission,
    HallOfFameEntry,
    IEvent,
    LeaderboardEntry,
    Team,
    User,
    anonymizedSnapshot,
    publish,
    subscribe,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { saveEntry } from '../hall-of-fame/hallOfFame.service';
import { finalizeEvent, freezeCancelled, recomputeEventRanks } from '../leaderboard/leaderboard.service';
import { evictGlobalLeaderboards } from '../leaderboard/redis';

const log = (what: string, err: unknown) =>
    console.error(`[leaderboard-service] ${what} failed:`, err);

const safe =
    <P extends Record<string, unknown>>(what: string, handler: (p: P) => Promise<void>) =>
    (event: DomainEvent<P>): void => {
        handler(event.payload).catch((err) => log(what, err));
    };

/** A board still taking entries. A past or cancelled event's standings are history. */
const isLive = (event: IEvent): boolean => event.status === 'upcoming' || event.status === 'ongoing';

/** Before the start, by status alone: a start_at in the future says nothing once an admin started it early. */
const isPreStart = (event: IEvent): boolean => event.status === 'upcoming' || event.status === 'draft';

const blankEntry = {
    raw: {},
    raw_score: 0,
    normalized_score: 0,
    invested_points: 0,
    final_score: 0,
    stats: { played: 0, won: 0, lost: 0, drawn: 0, round_reached: null, fails: null, eliminated: false },
    rank: null,
    previous_rank: null,
    last_scored_at: null,
    scored_by: null,
};

/**
 * An entry leaving the board. Before the start with nothing invested it simply goes; otherwise it
 * stays, eliminated, because points spent on it are only findable (by the cancel sweep) through it.
 */
async function withdrawEntry(entry_id: string, event: IEvent): Promise<void> {
    const entry = await LeaderboardEntry.findById(entry_id);
    if (!entry) return;
    if (isPreStart(event) && entry.invested_points === 0) {
        await LeaderboardEntry.deleteOne({ _id: entry._id, invested_points: 0 });
    } else {
        entry.stats.eliminated = true;
        await entry.save();
    }
    await recomputeEventRanks(event._id, 'score_update');
}

/* ------------------------------------------------------------------ *
 * RegistrationCreated (solo events) — the one "now confirmed" event
 * ------------------------------------------------------------------ */

export interface RegistrationCreatedPayload extends Record<string, unknown> {
    registration_id: string;
    owner: { type: string; id: string };
    user_id: string;
    role?: string;
}

async function onRegistrationCreated(p: RegistrationCreatedPayload): Promise<void> {
    if (p.owner?.type !== 'event') return;

    const event = await Event.findById(p.owner.id);
    if (!event || !isLive(event) || event.type === 'DE' || !event.leaderboard) return;
    if (event.teaming?.is_teamed) return; // Solo events only

    // A deleted account never gets a fresh snapshot.
    const user = await User.findOne({ _id: p.user_id, deleted_at: null });
    if (!user) return;

    // Re-registering after a mid-event cancel: the entry (and whatever was invested in it) comes back.
    await LeaderboardEntry.updateOne(
        { event_id: event._id, 'participant.id': p.user_id, 'stats.eliminated': true },
        { $set: { registration_id: p.registration_id, 'stats.eliminated': false } }
    );
    await LeaderboardEntry.findOneAndUpdate(
        { event_id: event._id, 'participant.id': p.user_id },
        {
            $setOnInsert: {
                _id: uuid(),
                event_id: event._id,
                participant: {
                    type: 'user',
                    id: p.user_id,
                    display_name: user.profile?.full_name || user.username,
                    avatar_url: user.profile?.avatar_url || null,
                },
                registration_id: p.registration_id,
                ...blankEntry,
            },
        },
        { upsert: true }
    );

    // The cancel may have been processed before this message (the bus has no order): if the
    // registration no longer stands, take the entry back out.
    if (!(await FormSubmission.exists({ _id: p.registration_id, status: 'confirmed' }))) {
        const entry = await LeaderboardEntry.findOne({ event_id: event._id, 'participant.id': p.user_id });
        if (entry) await withdrawEntry(entry._id, event);
        return;
    }
    await recomputeEventRanks(event._id, 'score_update');
}

/* ------------------------------------------------------------------ *
 * RegistrationCancelled (solo events)
 * ------------------------------------------------------------------ */

export interface RegistrationCancelledPayload extends Record<string, unknown> {
    registration_id?: string;
    owner?: { type: string; id: string };
    user_id?: string;
}

async function onRegistrationCancelled(p: RegistrationCancelledPayload): Promise<void> {
    // A late cancel for a row that was re-confirmed since (demote, then promote) must not withdraw it.
    if (p.registration_id && (await FormSubmission.exists({ _id: p.registration_id, status: 'confirmed' }))) return;
    const entry =
        (p.registration_id ? await LeaderboardEntry.findOne({ registration_id: p.registration_id }) : null) ||
        (p.owner?.id && p.user_id
            ? await LeaderboardEntry.findOne({ event_id: p.owner.id, 'participant.id': p.user_id })
            : null);
    if (!entry) return;
    // The (event, user) fallback may find a newer registration's entry; only an unlinked or same-row one.
    if (p.registration_id && entry.registration_id && entry.registration_id !== p.registration_id) return;

    // A cancel after the event ended must not move the final standings (or reopen the board).
    const event = await Event.findById(entry.event_id);
    if (!event || !(isLive(event) || event.status === 'draft')) return;
    await withdrawEntry(entry._id, event);
}

/* ------------------------------------------------------------------ *
 * TeamLocked (teamed events)
 * ------------------------------------------------------------------ */

export interface TeamLockedPayload extends Record<string, unknown> {
    team_id: string;
}

/**
 * A team joins the board when it LOCKS (leaderboard-model.md §9), not when it is created: a forming
 * team may never field anyone, and counted toward min_participants all the same. Built from the
 * Team document, not the payload — `TeamLocked` carried no owner, so this used to do nothing.
 */
async function onTeamLocked(p: TeamLockedPayload): Promise<void> {
    const team = await Team.findById(p.team_id);
    if (!team || team.status !== 'locked' || team.owner.type !== 'event') return;

    const event = await Event.findById(team.owner.id);
    if (!event || !isLive(event) || event.type === 'DE' || !event.leaderboard) return;
    if (!event.teaming?.is_teamed) return;

    await LeaderboardEntry.findOneAndUpdate(
        { event_id: event._id, 'participant.id': team._id },
        {
            $setOnInsert: {
                _id: uuid(),
                event_id: event._id,
                participant: {
                    type: 'team',
                    id: team._id,
                    display_name: team.name,
                    avatar_url: team.logo_url || null,
                },
                registration_id: null,
                ...blankEntry,
            },
        },
        { upsert: true }
    );

    await recomputeEventRanks(event._id, 'score_update');
}

/* ------------------------------------------------------------------ *
 * TeamDisbanded
 * ------------------------------------------------------------------ */

export interface TeamDisbandedPayload extends Record<string, unknown> {
    team_id: string;
}

async function onTeamDisbanded(p: TeamDisbandedPayload): Promise<void> {
    const entry = await LeaderboardEntry.findOne({ 'participant.id': p.team_id, 'participant.type': 'team' });
    if (!entry) return;

    const event = await Event.findById(entry.event_id);
    if (!event || !(isLive(event) || event.status === 'draft')) return;
    await withdrawEntry(entry._id, event);
}

/* ------------------------------------------------------------------ *
 * EventCompleted — final freeze, podium to Points
 * ------------------------------------------------------------------ */

export interface EventCompletedPayload extends Record<string, unknown> {
    event_id: string;
}

async function onEventCompleted(p: EventCompletedPayload): Promise<void> {
    const event = await Event.findById(p.event_id);
    if (!event || event.type === 'DE' || !event.leaderboard) return;

    // Points pays `event.podium.<place>` off the LeaderboardFrozen this publishes — once, by the
    // instance that wrote the final.
    await finalizeEvent(p.event_id);
}

/* ------------------------------------------------------------------ *
 * EventCancelled — freeze, never delete
 * ------------------------------------------------------------------ */

export interface EventCancelledPayload extends Record<string, unknown> {
    event_id: string;
}

/**
 * The entries stay: Points Service's refund sweep finds investments through them, and deleting
 * them first (the two consumers race on the same message) lost every refund. The board is frozen
 * instead.
 */
async function onEventCancelled(p: EventCancelledPayload): Promise<void> {
    await freezeCancelled(p.event_id);
}

/* ------------------------------------------------------------------ *
 * User snapshots — profile, deletion, restore
 * ------------------------------------------------------------------ */

export interface UserProfileUpdatedPayload extends Record<string, unknown> {
    user_id: string;
    changed_fields?: string[];
}

const SNAPSHOT_FIELDS = ['full_name', 'avatar_url'];

/**
 * Re-snapshot one live user everywhere this service holds their name and avatar. A profile refresh
 * never touches an anonymized snapshot (a stale UserProfileUpdated arriving after UserDeleted must
 * not bring the name back); only a restore clears the flag.
 */
async function resnapshot(user_id: string, restoring: boolean): Promise<void> {
    const user = await User.findOne({ _id: user_id, deleted_at: null });
    if (!user) return;
    const display_name = user.profile?.full_name || user.username;
    const avatar_url = user.profile?.avatar_url || null;
    const live = (path: string) => (restoring ? {} : { [path]: { $ne: true } });

    await LeaderboardEntry.updateMany(
        { 'participant.id': user_id, 'participant.type': 'user', ...live('participant.deleted') },
        { $set: { 'participant.display_name': display_name, 'participant.avatar_url': avatar_url, 'participant.deleted': false } }
    );
    await HallOfFameEntry.updateMany(
        { 'honoree.id': user_id, 'honoree.type': 'user', ...live('honoree.deleted') },
        { $set: { 'honoree.display_name': display_name, 'honoree.avatar_url': avatar_url, 'honoree.deleted': false } }
    );
    await HallOfFameEntry.updateMany(
        { 'members.user_id': user_id },
        {
            $set: {
                'members.$[m].display_name': display_name,
                'members.$[m].avatar_url': avatar_url,
                'members.$[m].deleted': false,
            },
        },
        { arrayFilters: [{ 'm.user_id': user_id, ...live('m.deleted') }] }
    );
}

async function onUserProfileUpdated(p: UserProfileUpdatedPayload): Promise<void> {
    // Only a change to what the snapshot holds is worth three multi-document writes.
    if (!p.changed_fields?.some((f) => SNAPSHOT_FIELDS.includes(f))) return;
    await resnapshot(p.user_id, false);
}

export interface UserDeletedPayload extends Record<string, unknown> {
    user_id: string;
}

async function onUserDeleted(p: UserDeletedPayload): Promise<void> {
    // One definition of "anonymized" for the whole platform (models/shared.ts).
    await LeaderboardEntry.updateMany(
        { 'participant.id': p.user_id, 'participant.type': 'user' },
        { $set: anonymizedSnapshot('participant.') }
    );
    await HallOfFameEntry.updateMany(
        { 'honoree.id': p.user_id, 'honoree.type': 'user' },
        { $set: anonymizedSnapshot('honoree.') }
    );
    await HallOfFameEntry.updateMany(
        { 'members.user_id': p.user_id },
        { $set: anonymizedSnapshot('members.$[m].') },
        { arrayFilters: [{ 'm.user_id': p.user_id }] }
    );
}

export interface UserRestoredPayload extends Record<string, unknown> {
    user_id: string;
}

/** Not gated on changed_fields: every snapshot comes back from `users`, flag lowered. */
async function onUserRestored(p: UserRestoredPayload): Promise<void> {
    await resnapshot(p.user_id, true);
}

/* ------------------------------------------------------------------ *
 * ChallengeLegendAchieved
 * ------------------------------------------------------------------ */

export interface ChallengeLegendAchievedPayload extends Record<string, unknown> {
    challenge_id: string;
    participation_id: string;
    member_user_ids?: string[];
}

/**
 * Builds the Hall of Fame entry. `challenge_participations` is the Challenge Service's collection
 * and is never written here: `HallOfFameEntryCreated` carries the entry id, and the entry is also
 * findable by `source.id`.
 */
/** Member snapshots from the live users; a deleted member stays, anonymized. */
async function memberSnapshots(user_ids: string[]) {
    const users = new Map((await User.find({ _id: { $in: user_ids }, deleted_at: null }).lean()).map((u) => [u._id, u]));
    return user_ids.map((user_id) => {
        const u = users.get(user_id);
        return u
            ? { user_id, display_name: u.profile?.full_name || u.username, avatar_url: u.profile?.avatar_url || null, deleted: false }
            : { user_id, display_name: DELETED_DISPLAY_NAME, avatar_url: null, deleted: true };
    });
}

async function onChallengeLegendAchieved(p: ChallengeLegendAchievedPayload): Promise<void> {
    const challenge = await Challenge.findById(p.challenge_id).lean();
    if (!challenge) return;

    // The Challenge Service always names the participation; the honoree comes from its snapshot.
    const participation = await ChallengeParticipation.findById(p.participation_id).lean();
    if (!participation) return;
    let honoree = {
        type: participation.participant.type,
        id: participation.participant.id,
        display_name: participation.participant.display_name,
        avatar_url: participation.participant.avatar_url || null,
    };
    // The participation's snapshot may predate a deletion.
    if (participation.participant.type === 'user' && !(await User.exists({ _id: honoree.id, deleted_at: null }))) {
        honoree = { ...honoree, display_name: DELETED_DISPLAY_NAME, avatar_url: null };
    }
    const members =
        participation.participant.type === 'team' && participation.member_user_ids?.length
            ? await memberSnapshots(participation.member_user_ids)
            : undefined;

    const identity = { category: 'challenge_legend' as const, 'honoree.id': honoree.id, 'source.id': challenge._id, deleted_at: null };
    const announce = (e: { _id: string; slug: string; category: string }) =>
        publish('HallOfFameEntryCreated', 'leaderboard-service', {
            entry_id: e._id,
            slug: e.slug,
            category: e.category,
            honoree: { type: honoree.type, id: honoree.id },
            source: { type: 'challenge', id: challenge._id },
            participation_id: p.participation_id,
        });

    // A replay re-announces the existing entry: if the first HallOfFameEntryCreated was lost (pub/sub
    // has no replay), this is the only way the challenge ever learns the entry id. The consumer is an
    // idempotent $set, so announcing twice costs nothing.
    const existing = await HallOfFameEntry.findOne(identity).select('_id slug category').lean();
    if (existing) return void announce(existing);

    const year = new Date().getFullYear();
    const entry = new HallOfFameEntry({
        _id: uuid(),
        category: 'challenge_legend',
        title: `${honoree.display_name} - ${challenge.title}`,
        description: `Completed legend challenge: ${challenge.title}`,
        honoree,
        members,
        source: { type: 'challenge', id: challenge._id, title: challenge.title },
        achievement: { year, award_points: challenge.award_points, difficulty: 'legend' },
        created_by: 'system',
        featured: false,
        tags: ['challenge_legend'],
    });

    try {
        await saveEntry(entry, true);
    } catch (err) {
        // A second instance won the unique (category, honoree, source) index: the entry exists.
        if ((err as { code?: string })?.code === 'entry_exists') {
            const winner = await HallOfFameEntry.findOne(identity).select('_id slug category').lean();
            if (winner) announce(winner);
            return;
        }
        throw err;
    }

    announce(entry);
}

/**
 * The global board is a read over the ledger, so any movement that counts toward it drops the cache.
 *
 * ponytail: trailing debounce of 5s, so a roster of 200 marked attended at once is one eviction, not
 * 200 SCANs. The ceiling is a board up to 5s stale; per-key ZINCRBY is the upgrade if that matters.
 */
let evictTimer: NodeJS.Timeout | null = null;
function scheduleGlobalEviction(): void {
    if (evictTimer) return;
    evictTimer = setTimeout(() => {
        evictTimer = null;
        void evictGlobalLeaderboards();
    }, 5_000);
    evictTimer.unref();
}

export function initializeConsumers(): void {
    subscribe('PointsEarned', () => scheduleGlobalEviction());
    subscribe('PointsAdjusted', () => scheduleGlobalEviction());
    subscribe('RegistrationCreated', safe('registration created', onRegistrationCreated));
    subscribe('RegistrationCancelled', safe('registration cancelled', onRegistrationCancelled));
    subscribe('TeamLocked', safe('team locked', onTeamLocked));
    subscribe('TeamDisbanded', safe('team disbanded', onTeamDisbanded));
    subscribe('EventCompleted', safe('event completed', onEventCompleted));
    subscribe('EventCancelled', safe('event cancelled', onEventCancelled));
    subscribe('UserProfileUpdated', safe('user profile updated', onUserProfileUpdated));
    subscribe('UserDeleted', safe('user deleted', onUserDeleted));
    subscribe('UserRestored', safe('user restored', onUserRestored));
    subscribe('ChallengeLegendAchieved', safe('challenge legend achieved', onChallengeLegendAchieved));
}

export const handlers = {
    onRegistrationCreated,
    onRegistrationCancelled,
    onTeamLocked,
    onTeamDisbanded,
    onEventCompleted,
    onEventCancelled,
    onUserProfileUpdated,
    onUserDeleted,
    onUserRestored,
    onChallengeLegendAchieved,
};
