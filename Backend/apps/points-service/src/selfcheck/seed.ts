import {
    Event,
    EventStatus,
    IUser,
    LeaderboardEntry,
    PointRule,
    PointTransaction,
    User,
    UserRole,
    config,
} from '@bgsc/shared';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { seedRules } from '../rules/rules.service';

/**
 * Fixtures for the points selfchecks.
 *
 * The selfchecks own a scratch database and never touch `bgsc_dev`: the expiry sweep acts on the
 * whole collection rather than on this run's fixtures, and `point_transactions` rows are
 * append-only, so a run against dev leaves rows nothing can ever clean up. Dropped at the start
 * rather than trusted to the end, because a run that fails mid-way never gets there.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_points$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    // The unique index on idempotency_key is the whole dedupe story, and the partial index on
    // expires_at backs the sweep: build what the app builds.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
    await seedRules();
}

export async function closeScratchDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}

/** Between areas: wipe the ledger and restore the rule table to its seeded state. */
export async function resetLedger(): Promise<void> {
    await mongoose.connection.collection('point_transactions').deleteMany({});
    await mongoose.connection.collection('audit_logs').deleteMany({});
    await PointRule.deleteMany({});
    await seedRules();
}

export async function seedUser(balance = 0, role: UserRole = UserRole.USER): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        role,
        points_balance: balance,
        profile: { full_name: 'Selfcheck User' },
    });
}

export async function seedEvent(
    overrides: { status?: EventStatus; participation?: number; multipliers?: number[] } = {}
): Promise<string> {
    const id = uuid();
    await Event.create({
        _id: id,
        slug: `sc-${id.slice(0, 12)}`,
        title: 'Selfcheck Event',
        category: 'bgec',
        type: 'DE',
        domain: 'sports',
        status: overrides.status ?? 'upcoming',
        start_at: new Date(Date.now() + 86_400_000),
        end_at: new Date(Date.now() + 172_800_000),
        registration: { closes_at: new Date(Date.now() + 43_200_000) },
        created_by: uuid(),
        points_pool: {
            participation: overrides.participation ?? 10,
            podium_multipliers: overrides.multipliers ?? [3, 2, 1.5],
        },
    });
    return id;
}

export async function seedLeaderboardEntry(event_id: string, user: IUser): Promise<string> {
    const entry = await LeaderboardEntry.create({
        _id: uuid(),
        event_id,
        participant: { type: 'user', id: user._id, display_name: 'Selfcheck User', avatar_url: null },
        registration_id: uuid(),
    });
    return entry._id;
}

export const balanceOf = async (user_id: string): Promise<number> =>
    (await User.findById(user_id).select('points_balance'))?.points_balance ?? 0;

export const rowsFor = async (user_id: string): Promise<number> =>
    PointTransaction.countDocuments({ user_id });

export const section = (name: string): void => console.log(`\n-- ${name} --`);
export const pass = (what: string): void => console.log(`  ok  ${what}`);
