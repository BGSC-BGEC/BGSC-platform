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
    event: { prefixes: ['/events'], target: config.services.event, owner: 'BE-1 · W2' },
    auction: { prefixes: ['/auction'], target: config.services.event, owner: 'BE-1 · W3' },
    registration: {
        prefixes: ['/forms', '/registrations', '/teams'],
        target: config.services.registration,
        owner: 'BE-2 · W2',
    },
    announcement: { prefixes: ['/announcements'], target: config.services.announcement, owner: 'BE-2 · W2' },
    points: { prefixes: ['/points'], target: config.services.points, owner: 'BE-2 · W3' },
    leaderboard: { prefixes: ['/leaderboards'], target: config.services.leaderboard, owner: 'BE-1 · W3' },
    challenge: { prefixes: ['/challenges'], target: config.services.challenge, owner: 'BE-2 · W3' },
    // Strava account linking is served by the Challenge Service, not by a container of its own:
    // physical challenges are what the activities are proof for, and a second port for four routes
    // is a deployment nobody wants to operate. Two keys, one
    // target — `target` is what the proxy dials, so nothing else here cares.
    strava: { prefixes: ['/strava'], target: config.services.challenge, owner: 'BE-2 · W3' },
    // In Week 4, Media Service consolidates storage ownership and serves all /uploads (*.jpg, *.png, *.webp, *.mp4, *.webm)
    // alongside gallery routes /media.
    media: { prefixes: ['/media', '/uploads'], target: config.services.media, owner: 'BE-1 · W4' },
    notification: { prefixes: ['/notifications'], target: config.services.notification, owner: 'BE-2 · W4' },
    feedback: { prefixes: ['/feedback', '/contact'], target: config.services.feedback, owner: 'BE-2 · W4' },
    // Two prefixes, one container: a bracket is a plan and a match is a fixture, and both belong to
    // the same service.
    bracket: { prefixes: ['/brackets', '/matches'], target: config.services.bracket, owner: 'BE-2 · W4' },
    hallOfFame: { prefixes: ['/hall-of-fame'], target: config.services.leaderboard, owner: 'BE-1 · W4' },
};

/** Services that actually exist today. Everything else 503s with a clear reason, not a hang. */
export const LIVE_SERVICES = new Set([
    'auth',
    'user',
    'registration',
    'announcement',
    'event',
    'auction',
    'points',
    'leaderboard',
    'challenge',
    // Same container as `challenge`; live or not live together, always.
    'strava',
    'media',
    'notification',
    'feedback',
    'bracket',
    'hallOfFame',
]);

/**
 * Prefix match on a whole path segment, so `/usersfoo` never routes to the user service.
 * Exported because the proxy's pathFilter uses the same rule — one definition, no drift.
 */
export const startsWithSegment = (path: string, prefix: string) =>
    path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?');

/**
 * Auth endpoints that get the strict limit (Spec §11.1: 5 attempts / 15 min). Anything
 * brute-forceable or that sends mail/SMS belongs here, not just login — a reset-password endpoint in
 * the general 100/min bucket is a password oracle, and a resend endpoint there is an email cannon.
 *
 * Two kinds, because "success" means different things:
 *  - CREDENTIAL paths check a secret. A success is a real login, so it does not count against the
 *    bucket — five students logging in behind one campus NAT must not lock out the sixth.
 *  - SEND paths trigger an email or SMS and answer 200 whatever the outcome (anti-enumeration), so
 *    every call counts, or the limit never bites.
 *
 * The list named two routes that do not exist (`/auth/resend-otp`, `/auth/totp/verify`)
 * and missed the three that do.
 */
export const CREDENTIAL_ATTEMPT_PATHS = [
    '/auth/login',
    '/auth/verify-email',
    '/auth/reset-password',
    '/auth/phone/verify-otp',
    // Trades a one-time Google login code for tokens.
    '/auth/google/exchange',
    // Takes login + password and mints tokens, so it is a login by another name.
    '/account/reactivate',
];

export const SEND_ATTEMPT_PATHS = [
    '/auth/register',
    '/auth/resend-verification',
    '/auth/forgot-password',
    '/auth/phone/send-otp',
];

export const AUTH_ATTEMPT_PATHS = [...CREDENTIAL_ATTEMPT_PATHS, ...SEND_ATTEMPT_PATHS];

/**
 * The path as the downstream router will match it. Express routes case-insensitively and ignores a
 * trailing slash, so an exact compare let `POST /auth/Login` and `/auth/login/` reach the login
 * handler through the 100/min general bucket instead of this one.
 */
export const normalizePath = (path: string) => path.toLowerCase().replace(/\/+$/, '') || '/';

export const isAuthAttempt = (path: string) => AUTH_ATTEMPT_PATHS.includes(normalizePath(path));
export const isCredentialAttempt = (path: string) => CREDENTIAL_ATTEMPT_PATHS.includes(normalizePath(path));

/**
 * `/internal/*` is service-to-service only and must never be reachable from the edge, whatever a
 * service happens to mount. Blocked here as well as guarded there — defence in depth, because the
 * cost of getting this wrong is an unauthenticated user directory.
 */
export const isInternalPath = (path: string) => {
    const p = normalizePath(path);
    return p === '/internal' || p.startsWith('/internal/');
};
