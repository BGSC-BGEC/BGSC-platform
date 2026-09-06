import { config } from '@bgsc/shared';

/**
 * Central routing table for the gateway (Spec §2.1 API Gateway).
 *
 * The gateway proxies the same path prefixes the services expose, so there is no path rewriting to
 * get wrong. Adding a service means one row here and one entry in config.services.
 */

export interface Route {
    /** Path prefixes owned by this service. */
    prefixes: string[];
    target: string;
    /** Which BE owns it, and the week it lands. Documentation, not behaviour. */
    owner: string;
}

export const ROUTES: Record<string, Route> = {
    auth: { prefixes: ['/auth', '/account'], target: config.services.auth, owner: 'BE-1 · W1' },
    user: { prefixes: ['/users'], target: config.services.user, owner: 'BE-2 · W1' },
    event: { prefixes: ['/events', '/auction'], target: config.services.event, owner: 'BE-1 · W2' },
    registration: { prefixes: ['/forms', '/registrations', '/teams'], target: config.services.registration, owner: 'BE-2 · W2' },
    announcement: { prefixes: ['/announcements'], target: config.services.announcement, owner: 'BE-2 · W2' },
    points: { prefixes: ['/points'], target: config.services.points, owner: 'BE-2 · W3' },
    leaderboard: { prefixes: ['/leaderboards'], target: config.services.leaderboard, owner: 'BE-1 · W3' },
    challenge: { prefixes: ['/challenges'], target: config.services.challenge, owner: 'BE-2 · W3' },
    media: { prefixes: ['/media', '/uploads'], target: config.services.media, owner: 'BE-1 · W4' },
    notification: { prefixes: ['/notifications'], target: config.services.notification, owner: 'W4' },
};

/** Services that actually exist today. Everything else 503s with a clear reason, not a hang. */
export const LIVE_SERVICES = new Set(['auth', 'user']);

/**
 * Prefix match on a whole path segment, so `/usersfoo` never routes to the user service.
 * Exported because the proxy's pathFilter uses the same rule — one definition, no drift.
 */
export const startsWithSegment = (path: string, prefix: string) =>
    path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?');

export function resolveService(path: string): { key: string; route: Route } | null {
    for (const [key, route] of Object.entries(ROUTES)) {
        if (route.prefixes.some((p) => startsWithSegment(path, p))) return { key, route };
    }
    return null;
}

/**
 * Auth endpoints that get the strict limit (Spec §11.1: 5 attempts / 15 min / IP). Anything
 * brute-forceable belongs here, not just login — a reset-password endpoint in the general
 * 100/min bucket is a password oracle.
 */
export const AUTH_ATTEMPT_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/verify-email',
    '/auth/resend-otp',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/totp/verify',
];

export const isAuthAttempt = (path: string) =>
    AUTH_ATTEMPT_PATHS.some((p) => path === p || path.startsWith(p + '?'));

/**
 * `/internal/*` is service-to-service only and must never be reachable from the edge, whatever a
 * service happens to mount. Blocked here as well as guarded there — defence in depth, because the
 * cost of getting this wrong is an unauthenticated user directory.
 */
export const isInternalPath = (path: string) => path === '/internal' || path.startsWith('/internal/');
