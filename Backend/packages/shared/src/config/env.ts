import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * One .env at the Backend root, shared by every service. A fixed `../../.env` breaks the moment a
 * file moves or is compiled to dist/, so walk up until we find it instead of counting directories.
 */
function findEnvFile(from: string): string | undefined {
    let dir = from;
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, '.env');
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return undefined;
}

dotenv.config({ path: findEnvFile(__dirname) });

/** A positive integer, or the fallback. NaN and zero both mean "the value was not usable". */
function positiveIntOr(raw: string | undefined, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * `WHATSAPP_GROUP_MAP` is a JSON object of `{ "<announcement category>": "<destination>" }`.
 *
 * A typo here is a deployer error, not a runtime condition: an unparseable map that degraded to
 * `{}` would leave every broadcast resolving `skipped / no_group_mapped` with nothing anywhere
 * saying why. Blank is the legitimate "nothing mapped yet" and is not an error.
 *
 * Blast radius, deliberately accepted: this module is shared, so a malformed value refuses to boot
 * every service that reads it — in compose only notification-service is given the variable, but a
 * developer's single root `.env` is read by all of them. The message names the variable, and a
 * loud stop beats a broadcast system that silently sends nothing.
 */
function parseGroupMap(raw: string | undefined): Record<string, string> {
  if (!raw || raw.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('WHATSAPP_GROUP_MAP is not valid JSON; expected {"<category>":"<destination>"}');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('WHATSAPP_GROUP_MAP must be a JSON object of category -> destination');
  }
  const map: Record<string, string> = {};
  for (const [category, destination] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof destination !== 'string' || destination.trim() === '') {
      throw new Error(`WHATSAPP_GROUP_MAP['${category}'] must be a non-empty string destination`);
    }
    map[category] = destination.trim();
  }
  return map;
}

export const config = {
  /** Overridden per service; each passes its own port to startService(). */
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://bgsc_admin:bgsc_password@localhost:27017/bgsc_dev?authSource=admin',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  // Shared secret for /internal/* service-to-service routes. Must be overridden in production.
  internalToken: process.env.INTERNAL_API_TOKEN || 'dev_internal_token_change_me',

  /**
   * The public edge — the gateway, which is the only port compose publishes. These were :3001 and
   * :3000 when auth was the whole API; after the split :3001 is an internal-only service port and
   * :3000 is the gateway, so an OAuth redirect or an email link pointing at either was aimed at
   * something the user's browser cannot reach.
   */
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.GATEWAY_PORT || '3000'}`,
  /** The web app, not the API. Matches the Vite dev server already trusted in corsOrigin. */
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    // Google matches redirect_uri exactly against the console entry, so this must be the address
    // the browser is sent to — the gateway — and the same string in both places.
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      `${process.env.API_BASE_URL || `http://localhost:${process.env.GATEWAY_PORT || '3000'}`}/auth/google/callback`,
  },
  /**
   * Strava account linking (Spec §9.1, §12.4). A CONNECTION, never a login method: `clientId` and
   * `clientSecret` blank means every /strava route answers 503 strava_not_configured, exactly like
   * the Google block above when OAuth is unconfigured.
   *
   * `callbackUrl` is built off API_BASE_URL — the gateway, the only port compose publishes — for
   * the same reason the Google one is: a redirect aimed at an internal service port is aimed at
   * something the user's browser cannot reach.
   *
   * `tokenKey` encrypts the stored Strava tokens at rest (AES-256-GCM). Blank is tolerated in
   * development, where it is derived from the JWT secret, and refused at boot in production —
   * a predictable key on a third-party bearer token is not a dev convenience worth shipping.
   */
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID || '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET || '',
    callbackUrl:
      process.env.STRAVA_CALLBACK_URL ||
      `${process.env.API_BASE_URL || `http://localhost:${process.env.GATEWAY_PORT || '3000'}`}/strava/callback`,
    tokenKey: process.env.STRAVA_TOKEN_ENCRYPTION_KEY || '',
  },

  /**
   * WhatsApp Business (Cloud) API — announcement broadcast (Spec §9.4, §6.4).
   *
   * Blank `accessToken` or `phoneNumberId` means every dispatch row resolves `skipped` with
   * `not_configured` and no HTTP call is made, exactly as the Strava block above turns every
   * /strava route into a 503 when unconfigured. This repo ships in that state: no WhatsApp
   * Business account is registered.
   *
   * `groupMap` maps an announcement category to the destination that category broadcasts to.
   * The Cloud API addresses phone numbers, not WhatsApp groups (be2-broadcast-service-plan.md
   * §0.3), so the value is an opaque destination string the provider hands to the API — swap the
   * provider, keep the map.
   */
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    /**
     * The Graph API host. Overridable because Meta publishes regional endpoints, and because a
     * deployment that wants to put the send path behind its own egress proxy should not have to
     * fork the provider — which also makes the send path runnable against a local stub instead of
     * only against a mocked `fetch`.
     */
    apiBase: (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com').replace(/\/+$/, ''),
    /**
     * Parsed once, here, because a malformed map must stop the process rather than turn every
     * broadcast into a silent `skipped` that nobody notices for a month. Blank is fine and means
     * "no categories mapped yet".
     */
    groupMap: parseGroupMap(process.env.WHATSAPP_GROUP_MAP),
    /**
     * Spec §9.4: max 1 announcement per tag per hour.
     *
     * Sanitized rather than `parseInt`ed straight: a typo would otherwise produce NaN, and every
     * comparison against NaN is false — so `recent.length < rate` would never pass and the
     * platform would rate-limit every broadcast forever, silently. A limiter that fails closed on
     * a typo is worse than one that falls back to the Spec's own default.
     */
    ratePerHour: positiveIntOr(process.env.WHATSAPP_RATE_LIMIT_PER_HOUR, 1),
  },

  /** Port this process listens on. Each service overrides via its own PORT. */
  gatewayPort: parseInt(process.env.GATEWAY_PORT || '3000', 10),

  /**
   * Downstream service addresses, used by the gateway to route and by services to call each other.
   * Ordered by the week each is built (docs/be2-user-service-plan.md); no slots for sponsor,
   * social or union — out of MVP scope.
   */
  services: {
    auth:         process.env.AUTH_SERVICE_URL         || 'http://localhost:3001',
    user:         process.env.USER_SERVICE_URL         || 'http://localhost:3002',
    event:        process.env.EVENT_SERVICE_URL        || 'http://localhost:3003',
    registration: process.env.REGISTRATION_SERVICE_URL || 'http://localhost:3004',
    announcement: process.env.ANNOUNCEMENT_SERVICE_URL || 'http://localhost:3005',
    points:       process.env.POINTS_SERVICE_URL       || 'http://localhost:3006',
    leaderboard:  process.env.LEADERBOARD_SERVICE_URL  || 'http://localhost:3007',
    challenge:    process.env.CHALLENGE_SERVICE_URL    || 'http://localhost:3008',
    media:        process.env.MEDIA_SERVICE_URL        || 'http://localhost:3009',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010',
    feedback:     process.env.FEEDBACK_SERVICE_URL     || 'http://localhost:3011',
    bracket:      process.env.BRACKET_SERVICE_URL      || 'http://localhost:3012',
  },

  /** Cross-process event bus. Absent => the in-process emitter only (single-service dev). */
  redisUrl: process.env.REDIS_URL || '',

  /**
   * Allowed CORS origins. Defaults to dev localhost only. In production the env var must be set;
   * empty/default is a hard boot error — silently trusting localhost with `credentials: true`
   * is the kind of bug a deployer never notices until a real audit lands.
   */
  corsOrigin:
    process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
      : process.env.NODE_ENV === 'production'
        ? (() => { throw new Error('CORS_ORIGIN must be set in production'); })()
        : ['http://localhost:3000', 'http://localhost:5173'],
};
