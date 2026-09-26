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
export const TOKEN_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

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

/** The session a Bearer header carries: null when there is none, 'invalid' when it does not verify. */
function sessionOf(header: string | undefined): AuthUser | null | 'invalid' {
    const token = bearerToken(header);
    if (!token) return header ? 'invalid' : null;

    let payload: AccessTokenPayload;
    try {
        payload = jwt.verify(token, config.jwt.accessSecret, {
            algorithms: TOKEN_ALGORITHMS,
        }) as AccessTokenPayload;
    } catch {
        return 'invalid';
    }

    // A token that verifies but carries a shape we do not recognise is not a valid session.
    if (typeof payload.sub !== 'string' || !payload.sub || !ROLES.has(payload.role)) return 'invalid';
    return { id: payload.sub, role: payload.role };
}

/**
 * Verifies the token and populates `req.user`. Rejects with 401 and never leaks why beyond
 * a generic code — an attacker learns nothing from "expired" vs "bad signature".
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const session = sessionOf(req.headers.authorization);
    if (session === null || session === 'invalid') {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    req.user = session;
    next();
}

/**
 * Optional auth: populates `req.user` when a valid token is present and never rejects — a missing,
 * expired or garbage token is a guest. For endpoints whose response differs for a signed-in viewer
 * (field masking, Spec §11.2), for the gateway (which only keys rate limits on it), and for
 * `/auth/logout`, where an expired access token must not stop a refresh-token logout.
 *
 * ponytail: lenient on purpose. Both clients send stale tokens today (mobile keeps a 'logged_out'
 * sentinel; web never refreshes), so a 401 here would break every public page. Make it strict once
 * they refresh on 401.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const session = sessionOf(req.headers.authorization);
    if (session && session !== 'invalid') req.user = session;
    next();
}
