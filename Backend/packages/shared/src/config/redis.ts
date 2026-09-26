import { config } from './env';

/**
 * ioredis connection options built from `REDIS_URL` + `REDIS_PASSWORD`, for every Redis client in
 * the platform (the event bus, leaderboard's cache).
 *
 * Passed as an options object rather than `new Redis(url, opts)`: ioredis lets a password in the URL
 * win over `opts.password`, and a raw password with `/ # ? %` in the URL does not parse at all. The
 * URL now carries host/port/db only (compose), and the password travels separately.
 *
 * Throws on an unparseable URL — callers treat that like an unreachable Redis.
 */
export interface RedisConnectionOptions {
    host: string;
    port: number;
    db: number;
    username?: string;
    password?: string;
    tls?: Record<string, never>;
}

export function redisOptions(url: string = config.redisUrl, password: string = config.redisPassword): RedisConnectionOptions {
    const u = new URL(url);
    if (u.protocol !== 'redis:' && u.protocol !== 'rediss:') throw new Error(`REDIS_URL must be redis:// or rediss://, got ${u.protocol}`);
    const db = parseInt(u.pathname.replace(/^\//, '') || '0', 10);
    const urlPassword = u.password ? decodeURIComponent(u.password) : '';
    const opts: RedisConnectionOptions = {
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 6379,
        db: Number.isFinite(db) ? db : 0,
    };
    if (u.username) opts.username = decodeURIComponent(u.username);
    if (password || urlPassword) opts.password = password || urlPassword;
    if (u.protocol === 'rediss:') opts.tls = {};
    return opts;
}
