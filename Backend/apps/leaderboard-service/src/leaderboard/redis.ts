import Redis from 'ioredis';
import { config, ServiceError } from '@bgsc/shared';

let redisClient: Redis | null = null;
let isConnected = false;

export async function getRedisClient(): Promise<Redis | null> {
    if (!config.redisUrl) return null;
    if (redisClient) return isConnected ? redisClient : null;

    try {
        const client = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            connectTimeout: 2000,
        });

        client.on('connect', () => {
            isConnected = true;
        });

        client.on('error', (err) => {
            isConnected = false;
            console.error('[leaderboard-service] Redis error:', err.message);
        });

        client.on('close', () => {
            isConnected = false;
        });

        await client.connect();
        redisClient = client;
        isConnected = true;
        return redisClient;
    } catch (err) {
        console.warn('[leaderboard-service] Redis unavailable; proceeding with database-only mode.');
        redisClient = null;
        isConnected = false;
        return null;
    }
}

export async function closeRedis(): Promise<void> {
    if (redisClient) {
        try {
            await redisClient.quit();
        } catch {
            // Ignore quit error
        }
        redisClient = null;
        isConnected = false;
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
        const count = await redis.incr(key);
        if (count === 1) {
            await redis.expire(key, 3600);
        }
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

/**
 * Acquire distributed lock for an entry during concurrent point investments.
 * Resolves to a lockId or null if locked.
 */
export async function acquireEntryLock(entryId: string, ttlMs = 5000): Promise<string | null> {
    const redis = await getRedisClient();
    if (!redis) return 'db-fallback-lock';

    const lockId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const key = `lb:lock:entry:${entryId}`;
    try {
        const result = await redis.set(key, lockId, 'PX', ttlMs, 'NX');
        return result === 'OK' ? lockId : null;
    } catch {
        return 'db-fallback-lock';
    }
}

/**
 * Release distributed lock for an entry using atomic Lua CAS.
 */
export async function releaseEntryLock(entryId: string, lockId: string): Promise<void> {
    if (lockId === 'db-fallback-lock') return;
    const redis = await getRedisClient();
    if (!redis) return;

    const key = `lb:lock:entry:${entryId}`;
    const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    `;
    try {
        await redis.eval(luaScript, 1, key, lockId);
    } catch {
        // Suppress release error
    }
}

