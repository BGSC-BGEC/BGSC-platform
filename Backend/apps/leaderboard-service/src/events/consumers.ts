import {
    DomainEvent,
    Event,
    LeaderboardEntry,
    LeaderboardSnapshot,
    Team,
    User,
    publish,
    subscribe,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { recomputeEventRanks } from '../leaderboard/leaderboard.service';
import { evictEventLeaderboard } from '../leaderboard/redis';

const log = (what: string, err: unknown) =>
    console.error(`[leaderboard-service] ${what} failed:`, err);

const safe =
    <P extends Record<string, unknown>>(what: string, handler: (p: P) => Promise<void>) =>
    (event: DomainEvent<P>): void => {
        handler(event.payload).catch((err) => log(what, err));
    };

/* ------------------------------------------------------------------ *
 * RegistrationCreated (solo events)
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
    if (!event || event.type === 'DE' || !event.leaderboard) return;
    if (event.teaming?.is_teamed) return; // Solo events only

    const user = await User.findById(p.user_id);
    if (!user) return;

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
                raw: {},
                raw_score: 0,
                normalized_score: 0,
                invested_points: 0,
                final_score: 0,
                stats: {
                    played: 0,
                    won: 0,
                    lost: 0,
                    drawn: 0,
                    round_reached: null,
                    fails: null,
                    eliminated: false,
                },
                rank: null,
                previous_rank: null,
                last_scored_at: null,
                scored_by: null,
                version: 0,
            },
        },
        { upsert: true }
    );

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
    const entry =
        (p.registration_id ? await LeaderboardEntry.findOne({ registration_id: p.registration_id }) : null) ||
        (p.owner?.id && p.user_id
            ? await LeaderboardEntry.findOne({ event_id: p.owner.id, 'participant.id': p.user_id })
            : null);

    if (!entry) return;

    const event = await Event.findById(entry.event_id);
    const isPreStart =
        event?.status === 'upcoming' ||
        event?.status === 'draft' ||
        (event?.start_at && new Date() < event.start_at);

    if (isPreStart) {
        await LeaderboardEntry.deleteOne({ _id: entry._id });
        await recomputeEventRanks(entry.event_id, 'score_update');
    } else {
        entry.stats.eliminated = true;
        await entry.save();
        await recomputeEventRanks(entry.event_id, 'score_update');
    }
}

/* ------------------------------------------------------------------ *
 * TeamCreated / TeamLocked (teamed events)
 * ------------------------------------------------------------------ */

export interface TeamCreatedPayload extends Record<string, unknown> {
    team_id: string;
    owner: { type: string; id: string };
    captain_user_id?: string;
    name?: string;
}

async function onTeamCreated(p: TeamCreatedPayload): Promise<void> {
    if (p.owner?.type !== 'event') return;

    const event = await Event.findById(p.owner.id);
    if (!event || event.type === 'DE' || !event.leaderboard) return;
    if (!event.teaming?.is_teamed) return;

    const team = await Team.findById(p.team_id);
    const teamName = team?.name || p.name || 'Team';

    await LeaderboardEntry.findOneAndUpdate(
        { event_id: event._id, 'participant.id': p.team_id },
        {
            $setOnInsert: {
                _id: uuid(),
                event_id: event._id,
                participant: {
                    type: 'team',
                    id: p.team_id,
                    display_name: teamName,
                    avatar_url: team?.logo_url || null,
                },
                registration_id: null,
                raw: {},
                raw_score: 0,
                normalized_score: 0,
                invested_points: 0,
                final_score: 0,
                stats: {
                    played: 0,
                    won: 0,
                    lost: 0,
                    drawn: 0,
                    round_reached: null,
                    fails: null,
                    eliminated: false,
                },
                rank: null,
                previous_rank: null,
                last_scored_at: null,
                scored_by: null,
                version: 0,
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
    const entry = await LeaderboardEntry.findOne({ 'participant.id': p.team_id });
    if (!entry) return;

    const event = await Event.findById(entry.event_id);
    const isPreStart =
        event?.status === 'upcoming' ||
        event?.status === 'draft' ||
        (event?.start_at && new Date() < event.start_at);

    if (isPreStart) {
        await LeaderboardEntry.deleteOne({ _id: entry._id });
        await recomputeEventRanks(entry.event_id, 'score_update');
    } else {
        entry.stats.eliminated = true;
        await entry.save();
        await recomputeEventRanks(entry.event_id, 'score_update');
    }
}

/* ------------------------------------------------------------------ *
 * EventCompleted
 * ------------------------------------------------------------------ */

export interface EventCompletedPayload extends Record<string, unknown> {
    event_id: string;
}

async function onEventCompleted(p: EventCompletedPayload): Promise<void> {
    const event = await Event.findById(p.event_id);
    if (!event || event.type === 'DE' || !event.leaderboard) return;

    await recomputeEventRanks(p.event_id, 'final');
    publish('LeaderboardFrozen', 'leaderboard-service', {
        event_id: p.event_id,
        reason: 'final',
    });
}

/* ------------------------------------------------------------------ *
 * EventCancelled
 * ------------------------------------------------------------------ */

export interface EventCancelledPayload extends Record<string, unknown> {
    event_id: string;
}

async function onEventCancelled(p: EventCancelledPayload): Promise<void> {
    await LeaderboardEntry.deleteMany({ event_id: p.event_id });
    await LeaderboardSnapshot.deleteMany({ event_id: p.event_id });
    await evictEventLeaderboard(p.event_id);
}

/* ------------------------------------------------------------------ *
 * UserProfileUpdated
 * ------------------------------------------------------------------ */

export interface UserProfileUpdatedPayload extends Record<string, unknown> {
    user_id: string;
    changed_fields?: string[];
}

async function onUserProfileUpdated(p: UserProfileUpdatedPayload): Promise<void> {
    const user = await User.findById(p.user_id);
    if (!user) return;

    await LeaderboardEntry.updateMany(
        { 'participant.id': p.user_id, 'participant.type': 'user' },
        {
            $set: {
                'participant.display_name': user.profile?.full_name || user.username,
                'participant.avatar_url': user.profile?.avatar_url || null,
            },
        }
    );

    const { HallOfFameEntry } = await import('@bgsc/shared');
    await HallOfFameEntry.updateMany(
        { 'honoree.id': p.user_id, 'honoree.type': 'user' },
        {
            $set: {
                'honoree.display_name': user.profile?.full_name || user.username,
                'honoree.avatar_url': user.profile?.avatar_url || null,
            },
        }
    );
    await HallOfFameEntry.updateMany(
        { 'members.user_id': p.user_id },
        {
            $set: {
                'members.$[elem].display_name': user.profile?.full_name || user.username,
                'members.$[elem].avatar_url': user.profile?.avatar_url || null,
            },
        },
        { arrayFilters: [{ 'elem.user_id': p.user_id }] }
    ).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * UserDeleted
 * ------------------------------------------------------------------ */

export interface UserDeletedPayload extends Record<string, unknown> {
    user_id: string;
}

async function onUserDeleted(p: UserDeletedPayload): Promise<void> {
    await LeaderboardEntry.updateMany(
        { 'participant.id': p.user_id, 'participant.type': 'user' },
        {
            $set: {
                'participant.display_name': 'Deleted User',
                'participant.avatar_url': null,
                'participant.deleted': true,
            },
        }
    );

    const { HallOfFameEntry } = await import('@bgsc/shared');
    await HallOfFameEntry.updateMany(
        { 'honoree.id': p.user_id, 'honoree.type': 'user' },
        {
            $set: {
                'honoree.display_name': 'Deleted User',
                'honoree.avatar_url': null,
            },
        }
    );
    await HallOfFameEntry.updateMany(
        { 'members.user_id': p.user_id },
        {
            $set: {
                'members.$[elem].display_name': 'Deleted User',
                'members.$[elem].avatar_url': null,
            },
        },
        { arrayFilters: [{ 'elem.user_id': p.user_id }] }
    ).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * UserRestored
 * ------------------------------------------------------------------ */

export interface UserRestoredPayload extends Record<string, unknown> {
    user_id: string;
}

async function onUserRestored(p: UserRestoredPayload): Promise<void> {
    const user = await User.findById(p.user_id);
    if (!user) return;

    await LeaderboardEntry.updateMany(
        { 'participant.id': p.user_id, 'participant.type': 'user' },
        {
            $set: {
                'participant.display_name': user.profile?.full_name || user.username,
                'participant.avatar_url': user.profile?.avatar_url || null,
                'participant.deleted': false,
            },
        }
    );

    const { HallOfFameEntry } = await import('@bgsc/shared');
    await HallOfFameEntry.updateMany(
        { 'honoree.id': p.user_id, 'honoree.type': 'user' },
        {
            $set: {
                'honoree.display_name': user.profile?.full_name || user.username,
                'honoree.avatar_url': user.profile?.avatar_url || null,
            },
        }
    );
    await HallOfFameEntry.updateMany(
        { 'members.user_id': p.user_id },
        {
            $set: {
                'members.$[elem].display_name': user.profile?.full_name || user.username,
                'members.$[elem].avatar_url': user.profile?.avatar_url || null,
            },
        },
        { arrayFilters: [{ 'elem.user_id': p.user_id }] }
    ).catch(() => {});
}

export function initializeConsumers(): void {
    subscribe('RegistrationCreated', safe('registration created', onRegistrationCreated));
    subscribe('RegistrationCancelled', safe('registration cancelled', onRegistrationCancelled));
    subscribe('TeamCreated', safe('team created', onTeamCreated));
    subscribe('TeamLocked', safe('team locked', onTeamCreated));
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
    onTeamCreated,
    onTeamDisbanded,
    onEventCompleted,
    onEventCancelled,
    onUserProfileUpdated,
    onUserDeleted,
    onUserRestored,
    onChallengeLegendAchieved,
};

/* ------------------------------------------------------------------ *
 * ChallengeLegendAchieved
 * ------------------------------------------------------------------ */

export interface ChallengeLegendAchievedPayload extends Record<string, unknown> {
    challenge_id: string;
    participation_id?: string;
    participant_id?: string;
    participant_type?: 'user' | 'team';
    member_user_ids?: string[];
}

async function onChallengeLegendAchieved(p: ChallengeLegendAchievedPayload): Promise<void> {
    const { Challenge, ChallengeParticipation, User, Team, HallOfFameEntry } = await import('@bgsc/shared');
    const challenge = await Challenge.findById(p.challenge_id).lean();
    if (!challenge) return;

    let honoree: { type: 'user' | 'team'; id: string; display_name: string; avatar_url: string | null } | null = null;
    let members: Array<{ user_id: string; display_name: string; avatar_url: string | null }> | undefined = undefined;

    if (p.participation_id) {
        const participation = await ChallengeParticipation.findById(p.participation_id).lean();
        if (participation) {
            honoree = {
                type: participation.participant.type,
                id: participation.participant.id,
                display_name: participation.participant.display_name,
                avatar_url: participation.participant.avatar_url || null,
            };
            if (participation.participant.type === 'team' && participation.member_user_ids?.length) {
                const users = await User.find({ _id: { $in: participation.member_user_ids } }).lean();
                members = users.map((u) => ({
                    user_id: u._id,
                    display_name: u.profile?.full_name || u.username,
                    avatar_url: u.profile?.avatar_url || null,
                }));
            }
        }
    }

    if (!honoree) {
        if (p.participant_type === 'team') {
            const team = await Team.findById(p.participant_id).lean();
            if (!team) return;
            honoree = {
                type: 'team',
                id: team._id,
                display_name: team.name,
                avatar_url: team.logo_url || null,
            };
        } else if (p.participant_id) {
            const user = await User.findById(p.participant_id).lean();
            if (!user) return;
            honoree = {
                type: 'user',
                id: user._id,
                display_name: user.profile?.full_name || user.username,
                avatar_url: user.profile?.avatar_url || null,
            };
        }
    }

    if (!honoree) return;

    const title = `${honoree.display_name} - ${challenge.title}`;
    const year = new Date().getFullYear();
    const baseSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${year}`;
    let slug = baseSlug;
    let suffix = 1;

    while (true) {
        const existing = await HallOfFameEntry.findOne({ slug, deleted_at: null }).lean();
        if (!existing) break;
        slug = `${baseSlug}-${suffix}`;
        suffix++;
    }

    const entryId = uuid();
    const createdOrExisting = await HallOfFameEntry.findOneAndUpdate(
        {
            category: 'challenge_legend',
            'honoree.id': honoree.id,
            'source.id': challenge._id,
            deleted_at: null,
        },
        {
            $setOnInsert: {
                _id: entryId,
                slug,
                category: 'challenge_legend',
                title: `${honoree.display_name} - ${challenge.title}`,
                description: `Completed legend challenge: ${challenge.title}`,
                honoree,
                members,
                source: {
                    type: 'challenge',
                    id: challenge._id,
                    title: challenge.title,
                },
                achievement: {
                    year,
                    award_points: challenge.award_points,
                    difficulty: 'legend',
                },
                created_by: 'system',
                featured: false,
                tags: ['challenge_legend'],
            },
        },
        { upsert: true, returnDocument: 'after' }
    );

    if (p.participation_id && createdOrExisting) {
        await ChallengeParticipation.updateOne(
            { _id: p.participation_id },
            { $set: { 'reward.hall_of_fame_entry_id': createdOrExisting._id } }
        ).catch(() => {});
    }
}
