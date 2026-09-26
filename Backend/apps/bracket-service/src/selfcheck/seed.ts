import {
    Event,
    TeamStatus,
    FormSubmission,
    IEvent,
    IUser,
    LeaderboardFormat,
    Team,
    User,
    UserRole,
    config,
} from '@bgsc/shared';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

const uuid = (): string => randomUUID();

/**
 * Fixtures for the bracket selfchecks.
 *
 * A scratch database, dropped at the START: this service's generator writes whole collections of
 * fixtures, and a run that dies half way through would otherwise leave them in `bgsc_dev` for the
 * next person to wonder about.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_bracket$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    // The unique (bracket_id, round, slot) index is what makes a re-run of the generator a
    // collision rather than a second draw: build what the app builds.
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

export interface EventOptions {
    format?: LeaderboardFormat;
    teamed?: boolean;
    status?: 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled';
    type?: 'LE' | 'DE' | 'ALL' | 'DLL';
    created_by?: string;
}

/** An event with a leaderboard format, which is what a bracket is drawn from. */
export async function seedEvent(title: string, opts: EventOptions = {}): Promise<IEvent> {
    const id = uuid();
    const type = opts.type ?? 'LE';
    const teamed = opts.teamed ?? false;

    return Event.create({
        _id: id,
        slug: `sc-${id.slice(0, 12)}`,
        title,
        category: 'bgec',
        type,
        domain: 'sports',
        status: opts.status ?? 'ongoing',
        start_at: new Date(Date.now() + 86_400_000),
        end_at: new Date(Date.now() + 172_800_000),
        // The Event model refuses a formless registration on anything but an uncapped solo 'DE',
        // so every seeded league carries one.
        registration: { closes_at: new Date(Date.now() + 43_200_000), form_id: type === 'DE' ? null : uuid() },
        teaming: teamed
            ? { is_teamed: true, team_size_min: 1, team_size_max: 5, max_teams: null, captain_application_required: false }
            : { is_teamed: false },
        // The model pairs these: a leaderboard exists exactly when the type is not 'DE'.
        leaderboard: type === 'DE' ? null : { format: opts.format ?? 'single_elim' },
        created_by: opts.created_by ?? uuid(),
    });
}

/** A confirmed registration — the solo participant list a bracket is seeded from. */
export async function seedRegistration(user: IUser, eventId: string, submittedAt: Date): Promise<string> {
    const id = uuid();
    await FormSubmission.create({
        _id: id,
        form_id: uuid(),
        form_version: 1,
        owner: { type: 'event', id: eventId },
        user: { user_id: user._id, display_name: user.profile.full_name, avatar_url: null },
        context: { event: { role: 'solo' } },
        status: 'confirmed',
        confirmed_at: new Date(),
        submitted_at: submittedAt,
    });
    return id;
}

/** A locked team — Spec §5.5's roster lockdown is what makes a team seedable. */
export async function seedTeam(
    name: string,
    eventId: string,
    captain: IUser,
    status: TeamStatus = 'locked'
): Promise<string> {
    const id = uuid();
    await Team.create({
        _id: id,
        owner: { type: 'event', id: eventId },
        name,
        name_lower: name.toLowerCase(),
        captain_user_id: captain._id,
        // Required by the model, and generated the same way the Registration Service generates it.
        invite_code: uuid().replace(/-/g, '').substring(0, 8).toUpperCase(),
        members: [
            {
                user_id: captain._id,
                display_name: captain.profile.full_name,
                registration_id: await seedRegistration(captain, eventId, new Date()),
                acquired_via: 'created',
            },
        ],
        size_min: 1,
        size_max: 5,
        status,
    });
    return id;
}

/** A field of `n` confirmed solo registrants, in a known arrival order. */
export async function seedField(eventId: string, n: number): Promise<IUser[]> {
    const users: IUser[] = [];
    for (let i = 0; i < n; i++) {
        const user = await seedUser(`Player ${i + 1}`);
        // Distinct, increasing submission times: registration order is the default seeding, so a
        // fixture with ties would make the draw non-deterministic and the assertions meaningless.
        await seedRegistration(user, eventId, new Date(Date.now() + i * 1000));
        users.push(user);
    }
    return users;
}
