import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config/env';

/**
 * Guard for `/internal/*`. These routes are for service-to-service calls (snapshot refresh across
 * the six BE-2 collections) and carry no user session, so `requireAuth` does not apply.
 *
 * Without this the snapshot endpoint is an unauthenticated directory of every user's real name and
 * avatar, reachable by anyone who can reach the port. "Not exposed on the gateway" is a deployment
 * assumption, not an access control.
 */

export const DEV_INTERNAL_TOKEN = 'dev_internal_token_change_me';

/**
 * Every secret that ships with a development default. A production process starting on any of
 * these is worse than one that fails to start: a default JWT signing key means anyone who has read
 * the repository can mint a founder token.
 */


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

export function requireServiceToken(req: Request, res: Response, next: NextFunction): void {
    const given = req.header('x-internal-token');
    if (!given || !tokensMatch(given, config.internalToken)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    next();
}

/**
 * Fail closed at boot rather than serving with published secrets. Called from startService();
 * throwing here stops the process before it listens.
 *
 * Checked in production only — dev defaults are the point of dev defaults.
 */
export function assertInternalTokenConfigured(): void {
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
    };

    const actual: Record<string, string> = {
        JWT_ACCESS_SECRET: config.jwt.accessSecret,
        JWT_REFRESH_SECRET: config.jwt.refreshSecret,
        INTERNAL_API_TOKEN: config.internalToken,
    };

    const offenders = Object.keys(published).filter((name) =>
        published[name].includes(actual[name])
    );

    if (offenders.length > 0) {
        throw new Error(
            `Refusing to start in production: ${offenders.join(', ')} still set to the development ` +
                'default. Anyone with the repository can forge tokens against these.'
        );
    }
}
