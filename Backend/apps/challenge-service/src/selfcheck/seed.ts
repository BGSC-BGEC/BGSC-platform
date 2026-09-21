import { IUser, User, UserRole, config } from '@bgsc/shared';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

/**
 * Fixtures shared by the challenge selfchecks.
 *
 * Selfchecks own a scratch database and never touch `bgsc_dev`: the expiry sweeper's `tick()`
 * expires and completes every row in the database it is pointed at, not just this run's fixtures,
 * and the audit rows every write leaves behind are append-only and cannot be cleaned up. Dropped
 * at the START rather than trusted to the end, because a run that fails mid-way exits before it
 * gets there.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_challenge$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    // The unique participation index is what makes a double accept a 409 rather than two rows, and
    // the partial index backs the sweeper: build what the app builds.
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

export const actorOf = (user: IUser) => ({ id: user._id, ip: null });

/** A complete, valid create body. Spread over it to make one field wrong at a time. */
export const challengeInput = (over: Record<string, unknown> = {}) => ({
    title: `Selfcheck ${uuid().slice(0, 8)}`,
    description: 'Do the thing.',
    brief_hidden_until_accept: false,
    cover_media_url: null,
    domain: 'sports' as const,
    kind: 'digital' as const,
    difficulty: 'easy' as const,
    tags: [],
    award_points: 50,
    window: { opens_at: null, closes_at: null, submissions_close_at: null, time_limit_minutes: null },
    location: null,
    teaming: { enabled: false, team_size_min: null, team_size_max: null, max_teams: null },
    max_participants: null,
    resources: [],
    submission: { requires_proof: true, proof_types: ['url' as const], max_files: 5, auto_approve: false },
    reviewers: [],
    ...over,
});
