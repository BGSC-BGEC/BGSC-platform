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
  },

  /** Cross-process event bus. Absent => the in-process emitter only (single-service dev). */
  redisUrl: process.env.REDIS_URL || '',

  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
};
