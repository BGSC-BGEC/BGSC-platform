/**
 * Central routing/classification rules for the gateway.
 *
 * The gateway proxies the same path prefixes the downstream services expose,
 * so no path rewriting is needed:
 *   - auth-service: /auth/**, /account/**
 *   - user-service: /users/**
 *   - sponsor-service: /sponsors/**
 *   - event-service: /events/**, /hall-of-fame/**
 *   - points-service: /points/**
 *   - notification-service: /notifications/**
 */

export const AUTH_SERVICE_PREFIXES = ['/auth', '/account'];
export const USER_SERVICE_PREFIXES = ['/users'];
export const SPONSOR_SERVICE_PREFIXES = ['/sponsors'];
export const EVENT_SERVICE_PREFIXES = ['/events', '/hall-of-fame'];
export const POINTS_SERVICE_PREFIXES = ['/points'];
export const NOTIFICATION_SERVICE_PREFIXES = ['/notifications'];
export const ANNOUNCEMENT_SERVICE_PREFIXES = ['/announcements'];

/** Auth "attempt" endpoints that get the stricter rate limit (5 / 15 min). */
const AUTH_ATTEMPT_PATHS = ['/auth/login', '/auth/register'];

/**
 * Routes that require a valid access token at the edge. These all use the
 * full access token (not the TOTP temp token), so verifying them at the
 * gateway is safe. Everything else is passed through and enforced downstream.
 */
// NOTE: GET /announcements is public — only POST/DELETE require auth.
// The announcement-service enforces auth internally via JwtAuthGuard on those routes.
// Gateway only enforces JWT for prefixes listed here (all methods).
const PROTECTED_PREFIXES = [
  '/users',
  '/account',
  '/events/me',
  '/points/me',
  '/notifications',
  '/auth/logout',
  '/auth/logout-all',
  '/auth/change-password',
  '/auth/sessions',
];

function pathOf(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => matchesPrefix(path, prefix));
}

/** True when the request must carry a valid access token. */
export function isProtectedRoute(url: string): boolean {
  return startsWithAny(pathOf(url), PROTECTED_PREFIXES);
}

/** True when the request should be metered with the strict auth limit. */
export function isAuthAttempt(method: string, url: string): boolean {
  if (method.toUpperCase() !== 'POST') {
    return false;
  }
  return AUTH_ATTEMPT_PATHS.includes(pathOf(url));
}

export function isAuthServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), AUTH_SERVICE_PREFIXES);
}

export function isUserServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), USER_SERVICE_PREFIXES);
}

export function isSponsorServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), SPONSOR_SERVICE_PREFIXES);
}

export function isEventServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), EVENT_SERVICE_PREFIXES);
}

export function isPointsServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), POINTS_SERVICE_PREFIXES);
}

export function isNotificationServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), NOTIFICATION_SERVICE_PREFIXES);
}

export function isAnnouncementServiceRoute(url: string): boolean {
  return startsWithAny(pathOf(url), ANNOUNCEMENT_SERVICE_PREFIXES);
}
