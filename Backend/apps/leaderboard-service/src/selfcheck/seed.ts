import assert from 'assert';
import {
    Event,
    EventDomain,
    EventStatus,
    IEvent,
    ILeaderboardEntry,
    IUser,
    LeaderboardEntry,
    LeaderboardSnapshot,
    PointTransaction,
    ServiceError,
    Team,
    User,
    UserRole,
    config,
} from '@bgsc/shared';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { closeRedis, getRedisClient } from '../leaderboard/redis';

const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_leaderboard$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
    const redis = await getRedisClient();
    if (redis) {
        const keys = await redis.keys('lb:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }
}

export async function closeScratchDb(): Promise<void> {
    await closeRedis();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}

export async function resetCollections(): Promise<void> {
    await LeaderboardEntry.deleteMany({});
    await LeaderboardSnapshot.deleteMany({});
    await mongoose.connection.collection('point_transactions').deleteMany({});
    await Event.deleteMany({});
    await User.deleteMany({});
    await Team.deleteMany({});
    const redis = await getRedisClient();
    if (redis) {
        const keys = await redis.keys('lb:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }
}

export async function seedUser(
    balance = 0,
    role: UserRole = UserRole.USER,
    fullName = 'Selfcheck User'
): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        role,
        points_balance: balance,
        profile: { full_name: fullName, avatar_url: `https://example.com/avatar_${id}.png` },
    });
}

export async function seedEvent(
    overrides: {
        type?: 'LE' | 'DE' | 'ALL' | 'DLL';
        status?: EventStatus;
        domain?: EventDomain;
        min_participants?: number;
        is_teamed?: boolean;
        investment_enabled?: boolean;
        investment_cap?: number | null;
        parameters?: { key: string; label: string; kind: 'int' | 'float' | 'bool'; weight: number }[];
        normalization?: { lower: number; upper: number };
    } = {}
): Promise<IEvent> {
    const id = uuid();
    const isUpcoming = overrides.status === 'upcoming';
    const startAt = isUpcoming ? new Date(Date.now() + 86400_000) : new Date(Date.now() - 3600_000);
    const closesAt = isUpcoming ? new Date(Date.now() + 43200_000) : new Date(Date.now() - 7200_000);
    const endAt = isUpcoming ? new Date(Date.now() + 172800_000) : new Date(Date.now() + 86400_000);

    return Event.create({
        _id: id,
        slug: `sc-event-${id.slice(0, 8)}`,
        title: `Selfcheck Event ${id.slice(0, 8)}`,
        category: 'leagues',
        type: overrides.type ?? 'LE',
        domain: overrides.domain ?? 'sports',
        tags: ['test'],
        status: overrides.status ?? 'ongoing',
        start_at: startAt,
        end_at: endAt,
        timezone: 'UTC',
        registration: {
            form_id: uuid(),
            closes_at: closesAt,
            waitlist_enabled: false,
            requires_approval: false,
        },
        teaming: {
            is_teamed: overrides.is_teamed ?? false,
            captain_application_required: false,
        },
        awards: [],
        contacts: [],
        created_by: uuid(),
        core_admins: [],
        points_pool: {
            participation: 10,
            podium_multipliers: [3, 2, 1],
            sponsor_bonus: 0,
            investment_enabled: overrides.investment_enabled ?? true,
            investment_cap: overrides.investment_cap !== undefined ? overrides.investment_cap : 100,
        },
        scoring: {
            parameters: overrides.parameters ?? [
                { key: 'goals', label: 'Goals', kind: 'int', weight: 10 },
                { key: 'assists', label: 'Assists', kind: 'int', weight: 5 },
                { key: 'mvp', label: 'MVP', kind: 'bool', weight: 20 },
            ],
            normalization: overrides.normalization ?? { lower: 0, upper: 100 },
        },
        leaderboard:
            overrides.type === 'DE'
                ? null
                : {
                      format: 'points_table',
                      elim_after_n: null,
                      min_participants: overrides.min_participants ?? 3,
                  },
    });
}

export async function seedEntry(
    eventId: string,
    participant: { type: 'user' | 'team'; id: string; display_name: string; avatar_url?: string | null },
    overrides: {
        raw?: Record<string, number | boolean>;
        raw_score?: number;
        normalized_score?: number;
        invested_points?: number;
        version?: number;
    } = {}
): Promise<ILeaderboardEntry> {
    const raw = overrides.raw ?? {};
    const rawScore = overrides.raw_score ?? 0;
    const normScore = overrides.normalized_score ?? 0;
    const invPoints = overrides.invested_points ?? 0;
    return LeaderboardEntry.create({
        _id: uuid(),
        event_id: eventId,
        participant: {
            type: participant.type,
            id: participant.id,
            display_name: participant.display_name,
            avatar_url: participant.avatar_url ?? null,
        },
        registration_id: participant.type === 'user' ? uuid() : null,
        raw,
        raw_score: rawScore,
        normalized_score: normScore,
        invested_points: invPoints,
        final_score: normScore + invPoints,
        version: overrides.version ?? 0,
    });
}

export const pass = (msg: string) => console.log(`  ok  ${msg}`);
export const section = (name: string) => console.log(`\n-- ${name} --`);

export async function refuses(
    promise: Promise<unknown>,
    status: number,
    code: string,
    what: string
): Promise<void> {
    try {
        await promise;
        assert.fail(`expected ${what} to be refused ${status} ${code}`);
    } catch (err) {
        assert.ok(err instanceof ServiceError, `${what}: expected ServiceError, got ${String(err)}`);
        assert.strictEqual(err.status, status, `${what}: status`);
        assert.strictEqual(err.code, code, `${what}: code`);
    }
    pass(`${what} -> ${status} ${code}`);
}
