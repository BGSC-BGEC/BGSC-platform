import Redis from 'ioredis';
import { config, redisOptions, ServiceError } from '@bgsc/shared';

let redisClient: Redis | null = null;
let announcedDown = false;

/**
 * The cache's Redis client, or null while it is not ready (callers then run database-only).
 *
 * One client for the life of the process, reconnecting in the background: the old one gave up on
 * its first failure (`retryStrategy: () => null`) and then cached "unavailable" forever, so one Redis
 * blip disabled the cache and the rate limit until a restart. Commands fail fast while it is down
 * (no offline queue) instead of piling up behind a dead socket. Connection options, password
 * included, come from `redisOptions()` — REDIS_URL no longer carries the password.
 */
export async function getRedisClient(): Promise<Redis | null> {
    if (!config.redisUrl) return null;
    if (!redisClient) {
        const client = new Redis({
            ...redisOptions(),
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            enableOfflineQueue: false,
            retryStrategy: (times) => Math.min(times * 500, 10_000),
        });
        client.on('ready', () => {
            if (announcedDown) console.log('[leaderboard-service] Redis reconnected.');
            announcedDown = false;
        });
        client.on('error', (err) => {
            // Once per outage, not once per retry.
            if (!announcedDown) console.error('[leaderboard-service] Redis unavailable; database-only until it returns:', err.message);
            announcedDown = true;
        });
        redisClient = client;
        // The first caller waits briefly for the first connection; later callers never wait.
        await new Promise<void>((resolve) => {
            const done = () => resolve();
            client.once('ready', done);
            client.once('error', done);
            setTimeout(done, 2000).unref();
        });
    }
    return redisClient.status === 'ready' ? redisClient : null;
}

export async function closeRedis(): Promise<void> {
    if (redisClient) {
        const client = redisClient;
        redisClient = null;
        try {
            await client.quit();
        } catch {
            client.disconnect();
        }
    }
}

/**
 * Cache event leaderboard entries in Redis ZSET + metadata HASH (Spec §2.3, leaderboard-model.md §8).
 */
export async function cacheEventLeaderboard(
    eventId: string,
    entries: { participant_id: string; final_score: number }[],
    isFrozen = false
): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    const zKey = `lb:event:${eventId}`;
    const metaKey = `lb:event:${eventId}:meta`;

    try {
        const pipeline = redis.pipeline();
        pipeline.del(zKey);

        if (entries.length > 0) {
            const zaddArgs: (string | number)[] = [];
            for (const e of entries) {
                zaddArgs.push(e.final_score, e.participant_id);
            }
            pipeline.zadd(zKey, ...zaddArgs);
        }

        pipeline.hset(metaKey, {
            updated_at: new Date().toISOString(),
            frozen: isFrozen ? 'true' : 'false',
            count: entries.length.toString(),
        });

        await pipeline.exec();
    } catch (err) {
        console.error(`[leaderboard-service] Failed to cache event leaderboard for ${eventId}:`, err);
    }
}

/**
 * Delete event leaderboard cache in Redis.
 */
export async function evictEventLeaderboard(eventId: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
        await redis.del(`lb:event:${eventId}`, `lb:event:${eventId}:meta`);
    } catch (err) {
        console.error(`[leaderboard-service] Failed to evict event leaderboard cache for ${eventId}:`, err);
    }
}

/**
 * Drop every cached global board (all periods, domains and sources).
 *
 * Without this the global board trailed the ledger by up to the 10-minute TTL (audit Sep 26). Called
 * from the PointsEarned / PointsAdjusted consumers; the next read rebuilds from the ledger.
 */
export async function evictGlobalLeaderboards(): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    try {
        let cursor = '0';
        do {
            const [next, keys] = await redis.scan(cursor, 'MATCH', 'lb:global:*', 'COUNT', 200);
            if (keys.length > 0) await redis.del(...keys);
            cursor = next;
        } while (cursor !== '0');
    } catch (err) {
        console.error('[leaderboard-service] Failed to evict global leaderboard cache:', err);
    }
}

/**
 * Cache global leaderboard in Redis ZSET.
 */
export async function cacheGlobalLeaderboard(
    period: string,
    domain: string,
    source: string,
    userScores: { user_id: string; total_points: number }[]
): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    const zKey = `lb:global:${period}:${domain}:${source}`;
    try {
        const pipeline = redis.pipeline();
        pipeline.del(zKey);
        if (userScores.length > 0) {
            const zaddArgs: (string | number)[] = [];
            for (const u of userScores) {
                zaddArgs.push(u.total_points, u.user_id);
            }
            pipeline.zadd(zKey, ...zaddArgs);
        }
        // Expire after 10 minutes so periodic rebuilds refresh it
        pipeline.expire(zKey, 600);
        await pipeline.exec();
    } catch (err) {
        console.error(`[leaderboard-service] Failed to cache global leaderboard for ${period}:${domain}:`, err);
    }
}

/**
 * Read paged global leaderboard slice from Redis ZSET.
 */
export async function getCachedGlobalLeaderboard(
    period: string,
    domain: string,
    source: string,
    skip: number,
    limit: number
): Promise<{ rows: { user_id: string; total_points: number }[]; total: number } | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    const zKey = `lb:global:${period}:${domain}:${source}`;
    try {
        const total = await redis.zcard(zKey);
        if (total === 0) return null;

        const raw = await redis.zrevrange(zKey, skip, skip + limit - 1, 'WITHSCORES');
        if (!raw || raw.length === 0) return { rows: [], total };

        const rows: { user_id: string; total_points: number }[] = [];
        for (let i = 0; i < raw.length; i += 2) {
            rows.push({
                user_id: raw[i],
                total_points: Number(raw[i + 1]),
            });
        }
        return { rows, total };
    } catch {
        return null;
    }
}

/**
 * Enforce investment rate limit: max 5 investments per user per event per hour (Spec §5.6).
 */
export async function checkInvestmentRateLimit(userId: string, eventId: string): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return; // Redis down => fail open for rate limit

    const key = `lb:ratelimit:invest:${userId}:${eventId}`;
    try {
        // Window first, then count: an INCR whose follow-up EXPIRE was lost (crash, blip) left a key
        // that never expired — a user locked out of investing for good. SET NX EX is atomic.
        await redis.set(key, 0, 'EX', 3600, 'NX');
        const count = await redis.incr(key);
        if (count > 5) {
            throw new ServiceError(429, 'rate_limit_exceeded', {
                message: 'Maximum 5 investments per user per event per hour',
            });
        }
    } catch (err) {
        if (err instanceof ServiceError) throw err;
        console.error('[leaderboard-service] Rate limit check error:', err);
    }
}
