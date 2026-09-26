import { Event, FormSubmission, IUser, User, UserRole, config } from '@bgsc/shared';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

/**
 * Fixtures shared by the announcement selfchecks. Announcements snapshot a real user and the audience
 * gate reads real registrations, so these need rows in `users`, `events` and `form_submissions`
 * rather than stubs.
 */

/**
 * Selfchecks own a scratch database, like the e2e does, and never touch `bgsc_dev`.
 *
 * They have to: the scheduler's `tick()` publishes, archives and purges every announcement in the
 * database it is pointed at, not just this run's fixtures, and the audit rows every write leaves
 * behind are append-only and cannot be cleaned up. Dropped at the start rather than trusted to the
 * end, because a run that fails mid-way exits before it gets there.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_announcement$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    // The text index backs `q`, and the partial indexes back the scheduler: build what the app builds.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
}

export async function closeScratchDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}

export async function seedUser(fullName: string, role: UserRole = UserRole.USER): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        role,
        profile: { full_name: fullName },
    });
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

/** A confirmed registration is what makes an event-scoped announcement visible. */
export async function seedConfirmedRegistration(userId: string, eventId: string): Promise<string> {
    const id = uuid();
    await FormSubmission.create({
        _id: id,
        form_id: uuid(),
        form_version: 1,
        owner: { type: 'event', id: eventId },
        user: { user_id: userId, display_name: 'Registrant' },
        context: { event: { role: 'solo' } },
        status: 'confirmed',
        confirmed_at: new Date(),
    });
    return id;
}
