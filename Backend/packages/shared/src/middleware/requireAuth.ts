import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '../models/User';

/**
 * JWT verification + role extraction on every request (Spec §7.2).
 * Owned by BE-2, consumed by BE-1's Auth Service for its protected routes.
 *
 * CONTRACT WITH BE-1 — the access token payload this expects:
 *
 *   { sub: <user _id, uuid string>, role: <UserRole>, iat, exp }
 *
 * Signed with `config.jwt.accessSecret` using HS256, 15 min expiry (Spec §11.1). `sub` is the
 * standard JWT subject claim, so it must hold the user id and nothing else. If BE-1 signs a
 * different shape, change it here — one place — rather than in every route.
 */

/**
 * Pinned, not left to the library default. If the project ever moves to RS256, an unpinned verifier
 * will happily accept a token the attacker signed with HS256 using the *public* key as the HMAC
 * secret. Pinning now costs nothing and removes the whole class.
 */
export const ACCESS_TOKEN_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

export interface AuthUser {
    id: string;
    role: UserRole;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export interface AccessTokenPayload extends jwt.JwtPayload {
    sub: string;
    role: UserRole;
}

const ROLES = new Set<string>(Object.values(UserRole));

/** Pulls a Bearer token out of the Authorization header. Case-insensitive scheme, per RFC 6750. */
export function bearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token, ...rest] = header.trim().split(/\s+/);
    if (rest.length > 0 || !token) return null;
    if (scheme.toLowerCase() !== 'bearer') return null;
    return token;
}

/**
 * Verifies the token and populates `req.user`. Rejects with 401 and never leaks why beyond
 * a generic code — an attacker learns nothing from "expired" vs "bad signature".
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const token = bearerToken(req.headers.authorization);
    if (!token) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    let payload: AccessTokenPayload;
    try {
        payload = jwt.verify(token, config.jwt.accessSecret, {
            algorithms: ACCESS_TOKEN_ALGORITHMS,
        }) as AccessTokenPayload;
    } catch {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    // A token that verifies but carries a shape we do not recognise is not a valid session.
    if (typeof payload.sub !== 'string' || !payload.sub || !ROLES.has(payload.role)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    req.user = { id: payload.sub, role: payload.role };
    next();
}

/**
 * Optional auth: populates `req.user` when a valid token is present, but does not reject.
 * For endpoints whose response differs for a signed-in viewer (field masking, Spec §11.2).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const token = bearerToken(req.headers.authorization);
    if (!token) return next();
    try {
        const payload = jwt.verify(token, config.jwt.accessSecret, {
            algorithms: ACCESS_TOKEN_ALGORITHMS,
        }) as AccessTokenPayload;
        if (typeof payload.sub === 'string' && payload.sub && ROLES.has(payload.role)) {
            req.user = { id: payload.sub, role: payload.role };
        }
    } catch {
        // A bad token on an optional route is treated as no token, not as an error.
    }
    next();
}
