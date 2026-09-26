import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config/env';
import { redisOptions } from '../config/redis';

/**
 * Guard for `/internal/*`. These routes are for service-to-service calls (seat reservation, points
 * moves, roster locks, …) and carry no user session, so `requireAuth` does not apply.
 *
 * "Not exposed on the gateway" is a deployment assumption, not an access control: without this
 * anyone who can reach a service's port could move points.
 */

export const DEV_INTERNAL_TOKEN = 'dev_internal_token_change_me';

/** Constant-time compare; a length mismatch is reported without leaking the length via timing. */
function tokensMatch(given: string, expected: string): boolean {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
        timingSafeEqual(b, b); // keep the work constant regardless of the branch taken
        return false;
    }
    return timingSafeEqual(a, b);
}

/**
 * The current token, or during a rotation the previous one — the same pair the event bus verifies
 * with, so a service not yet restarted onto the new value is still heard over HTTP too.
 */
export function requireServiceToken(req: Request, res: Response, next: NextFunction): void {
    const given = req.header('x-internal-token');
    const accepted = [config.internalToken, config.internalTokenPrevious].filter(Boolean);
    // Both compared every time, so the timing does not say which one matched.
    const ok = !!given && accepted.map((t) => tokensMatch(given, t)).includes(true);
    if (!ok) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    next();
}

/** The Mongo root password committed in docker-compose.yml and .env.example. */
export const DEV_MONGO_PASSWORD = 'bgsc_password';
/** The Redis password compose falls back to when REDIS_PASSWORD is unset. */
export const DEV_REDIS_PASSWORD = 'dev_redis_password_change_me';

const passwordOf = (uri: string): string | null => {
    try {
        return decodeURIComponent(new URL(uri).password) || null;
    } catch {
        return null;
    }
};

/**
 * Fail closed at boot rather than serving with published secrets. Called from startService() and
 * the gateway's start(); throwing here stops the process before it listens.
 *
 * A production process on any development default is worse than one that fails to start: a default
 * JWT signing key means anyone who has read the repository can mint a founder token.
 *
 * Checked in production only — dev defaults are the point of dev defaults.
 *
 * `datastores: false` is the gateway: it holds no database or bus connection, so its env carries no
 * MONGO_URI / REDIS_URL and checking the fallbacks would refuse a correct deployment.
 */
export function assertInternalTokenConfigured(opts: { datastores?: boolean } = {}): void {
    if (config.nodeEnv !== 'production') return;

    // Both the code default and the .env.example value — .env.example is in the repository, so a
    // secret copied straight out of it is as public as one that was never set.
    const published: Record<string, string[]> = {
        JWT_ACCESS_SECRET: [
            'dev_access_secret_change_me',
            'bgsc_dev_super_secret_access_key_change_in_production',
        ],
        JWT_REFRESH_SECRET: [
            'dev_refresh_secret_change_me',
            'bgsc_dev_super_secret_refresh_key_change_in_production',
        ],
        INTERNAL_API_TOKEN: [DEV_INTERNAL_TOKEN],
        // Verified by the bus and the internal guard, so a published value here is as good as
        // a published current token.
        INTERNAL_API_TOKEN_PREVIOUS: [DEV_INTERNAL_TOKEN],
    };

    const actual: Record<string, string> = {
        JWT_ACCESS_SECRET: config.jwt.accessSecret,
        JWT_REFRESH_SECRET: config.jwt.refreshSecret,
        INTERNAL_API_TOKEN: config.internalToken,
        INTERNAL_API_TOKEN_PREVIOUS: config.internalTokenPrevious,
    };

    const offenders = Object.keys(published).filter((name) =>
        published[name].includes(actual[name])
    );

    if (opts.datastores !== false) {
        // The root password published in compose opens the whole database to anyone who reaches it.
        const mongoPassword = passwordOf(config.mongoUri);
        if (mongoPassword === DEV_MONGO_PASSWORD) offenders.push('MONGO_URI');
        // The bus carries domain events that move points; a password-less Redis lets anyone who can
        // reach it read the channel. Missing entirely is refused too: a production service without
        // the bus silently stops hearing every other service.
        // The password is REDIS_PASSWORD, else whatever the URL carries (config/redis.ts). An
        // unparseable URL is refused here rather than disabling the bus at runtime.
        let redisPassword: string | null = null;
        try {
            redisPassword = config.redisUrl ? redisOptions().password ?? null : null;
        } catch {
            redisPassword = null;
        }
        if (!redisPassword || redisPassword === DEV_REDIS_PASSWORD) offenders.push('REDIS_URL');
    }

    if (offenders.length > 0) {
        throw new Error(
            `Refusing to start in production: ${offenders.join(', ')} still set to a development ` +
                'default (or missing its password). Anyone with the repository can use these.'
        );
    }
}
