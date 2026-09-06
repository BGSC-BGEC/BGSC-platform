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
 * Fail closed at boot rather than serving an internal directory with a published secret.
 * Called from start(); throwing here stops the process before it listens.
 */
export function assertInternalTokenConfigured(): void {
    if (config.nodeEnv === 'production' && config.internalToken === DEV_INTERNAL_TOKEN) {
        throw new Error(
            'INTERNAL_API_TOKEN is still the development default. Set it before starting in production.'
        );
    }
}
