import assert from 'assert';
import {
    Event,
    EventDomain,
    FormSubmission,
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
    createServiceApp,
} from '@bgsc/shared';
import { Server } from 'http';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { closeRedis, getRedisClient } from '../leaderboard/redis';

const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_leaderboard$2');

// The cache and rate limits go to their own logical database: the suite wipes `lb:*`, and on the
// shared dev Redis that was the dev services' cache and every user's investment quota. Set before
// the first `getRedisClient()`, which reads it. Pub/sub (the bus) is not per-database.
if (config.redisUrl) {
    const url = new URL(config.redisUrl);
    url.pathname = '/15';
    (config as { redisUrl: string }).redisUrl = url.toString();
}

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

/**
 * Points Service's real internal routes, in this process, on a random port: an investment's debit
 * and refund go over HTTP exactly as in production (there is no fallback to fake them any more).
 * Required by path at runtime — the selfcheck is excluded from this service's `tsc` build.
 */
let pointsServer: Server | null = null;

export async function startPointsService(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { internalRoutes } = require('../../../points-service/src/internal/internal.routes');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedRules } = require('../../../points-service/src/rules/rules.service');
    await seedRules();
    const app = createServiceApp({
        name: 'points-selfcheck',
        port: 0,
        routes: (a) => a.use('/internal', internalRoutes),
    });
    pointsServer = app.listen(0);
    await new Promise((r) => pointsServer!.once('listening', r));
    usePointsUrl(`http://127.0.0.1:${(pointsServer.address() as { port: number }).port}`);
}

/** Point the leaderboard at a Points Service (or at nothing, to see it fail closed). */
export function usePointsUrl(url: string): void {
    (config.services as { points: string }).points = url;
}

export async function closeScratchDb(): Promise<void> {
    pointsServer?.close();
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
    await FormSubmission.deleteMany({});
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
            ...(overrides.is_teamed ? { team_size_min: 1, team_size_max: 5 } : {}),
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
    });
}

/** A confirmed registration: the only thing scoring will build an entry from. */
export async function seedRegistration(eventId: string, userId: string): Promise<string> {
    const sub = await FormSubmission.create({
        form_id: uuid(),
        form_version: 1,
        owner: { type: 'event', id: eventId },
        user: { user_id: userId, display_name: 'Selfcheck User' },
        context: { event: { role: 'solo' } },
        status: 'confirmed',
    });
    return sub._id;
}

/** A locked team of `eventId` with the given members. */
export async function seedLockedTeam(eventId: string, name: string, memberIds: string[]): Promise<string> {
    const team = await Team.create({
        owner: { type: 'event', id: eventId },
        name,
        name_lower: name.toLowerCase(),
        captain_user_id: memberIds[0],
        members: memberIds.map((user_id) => ({
            user_id,
            display_name: 'Member',
            registration_id: uuid(),
            acquired_via: 'created',
        })),
        invite_code: uuid().replace(/-/g, '').slice(0, 8).toUpperCase(),
        size_min: 1,
        size_max: 5,
        status: 'locked',
    });
    return team._id;
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
