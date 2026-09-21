import {
    Announcement,
    AnnouncementCategory,
    Challenge,
    ChallengeParticipation,
    Event,
    FormSubmission,
    IAnnouncement,
    IUser,
    NotificationPreference,
    RoleName,
    User,
    UserRole,
    UserStatus,
    config,
    expiryFor,
} from '@bgsc/shared';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

/**
 * Fixtures shared by the notification selfchecks.
 *
 * Selfchecks own a scratch database and never touch `bgsc_dev`: the scheduler's `tick()` retries,
 * reconciles and writes back every dispatch row in the database it is pointed at — including, on a
 * dev database, real announcements it would try to broadcast. Dropped at the START rather than
 * trusted to the end, because a run that fails mid-way exits before it gets there.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_notification$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    // The unique dedupe index is what makes a replayed broadcast one row instead of two, and the
    // unique dispatch claim is what makes it one message: build what the app builds.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
}

export async function closeScratchDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}

export async function seedUser(
    fullName: string,
    role: UserRole = UserRole.USER,
    status: UserStatus = UserStatus.ACTIVE
): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        role,
        status,
        profile: { full_name: fullName },
    });
}

export async function mute(userId: string, category: string): Promise<void> {
    await NotificationPreference.updateOne(
        { _id: userId },
        { $set: { [`channels.in_app.${category}`]: false } },
        { upsert: true }
    );
}

export async function seedEvent(title: string): Promise<string> {
    const id = uuid();
    await Event.create({
        _id: id,
        slug: `sc-${id.slice(0, 12)}`,
        title,
        category: 'bgec',
        type: 'DE',
        domain: 'sports',
        start_at: new Date(Date.now() + 86_400_000),
        end_at: new Date(Date.now() + 172_800_000),
        registration: { closes_at: new Date(Date.now() + 43_200_000) },
        created_by: uuid(),
    });
    return id;
}

/** A confirmed registration is what puts a user inside an event-scoped audience. */
export async function seedRegistration(
    userId: string,
    eventId: string,
    status: 'confirmed' | 'waitlisted' = 'confirmed'
): Promise<string> {
    const id = uuid();
    await FormSubmission.create({
        _id: id,
        form_id: uuid(),
        form_version: 1,
        owner: { type: 'event', id: eventId },
        user: { user_id: userId, display_name: 'Registrant' },
        context: { event: { role: 'solo' } },
        status,
        confirmed_at: status === 'confirmed' ? new Date() : null,
        // The model pairs these two: a waitlisted row without a position is refused.
        waitlist_position: status === 'waitlisted' ? 1 : null,
    });
    return id;
}

export interface AnnouncementOptions {
    categories?: AnnouncementCategory[];
    min_role?: RoleName;
    event_id?: string | null;
    status?: 'draft' | 'scheduled' | 'published' | 'archived';
    deleted?: boolean;
    body?: string;
}

/**
 * A published announcement, written the way `publishedSet()` writes one — `published_at`,
 * `expires_at` and both `requested` flags — because that is the state the broadcast consumer is
 * handed in production, and a fixture that skips the flags would never be reconciled.
 */
export async function seedAnnouncement(
    author: IUser,
    title: string,
    opts: AnnouncementOptions = {}
): Promise<IAnnouncement> {
    const now = new Date();
    const status = opts.status ?? 'published';
    const live = status === 'published' || status === 'archived';

    return Announcement.create({
        _id: uuid(),
        title,
        body: opts.body ?? 'The body of the announcement.',
        categories: opts.categories ?? ['bgec'],
        priority: 'normal',
        audience: { min_role: opts.min_role ?? 'guest', event_id: opts.event_id ?? null },
        author: {
            user_id: author._id,
            display_name: author.profile.full_name,
            role_label: 'Core',
            avatar_url: null,
        },
        status,
        published_at: live ? now : null,
        expires_at: live ? expiryFor(now) : null,
        delivery: {
            whatsapp: { requested: live, per_category: [] },
            push: { requested: live, status: 'pending', sent_count: null },
        },
        deleted_at: opts.deleted ? now : null,
    });
}

export async function seedChallenge(title: string, awardPoints = 50): Promise<string> {
    const id = uuid();
    await Challenge.create({
        _id: id,
        slug: `sc-${id.slice(0, 12)}`,
        title,
        description: 'Do the thing.',
        domain: 'sports',
        kind: 'digital',
        difficulty: 'easy',
        award_points: awardPoints,
        status: 'active',
        created_by: uuid(),
    });
    return id;
}

/**
 * A participation whose `participant` shape matches its roster: the model refuses a solo
 * participation (`type: 'user'`) that carries anyone but its own id, so more than one member means
 * a team.
 */
export async function seedParticipation(challengeId: string, memberIds: string[]): Promise<string> {
    const id = uuid();
    const team = memberIds.length > 1;
    await ChallengeParticipation.create({
        _id: id,
        challenge_id: challengeId,
        participant: {
            type: team ? 'team' : 'user',
            id: team ? uuid() : memberIds[0],
            display_name: team ? 'Selfcheck Team' : 'Participant',
        },
        member_user_ids: memberIds,
        challenge_snapshot: { title: 'Snapshot', difficulty: 'easy', award_points: 50 },
        status: 'submitted',
    });
    return id;
}
