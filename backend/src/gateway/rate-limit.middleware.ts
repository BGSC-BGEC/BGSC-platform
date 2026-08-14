import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type Redis from 'ioredis';
import { randomBytes } from 'crypto';
import { isAuthAttempt } from './routing';

export interface RateLimitBucket {
  max: number;
  windowMs: number;
}

export interface RateLimitOptions {
  general: RateLimitBucket;
  auth: RateLimitBucket;
}

/** In-memory fallback for auth bucket when Redis is unavailable (H6). */
const authFallback = new Map<string, { count: number; resetAt: number }>();

/**
 * C2: Use req.ip (set by Express trust-proxy) instead of raw
 * X-Forwarded-For, which is client-controlled and bypassable.
 * main.ts must call app.set('trust proxy', 1) for this to work correctly.
 */
function clientIp(req: Request): string {
  return (req.ip ?? req.socket?.remoteAddress ?? 'unknown')
    .replace(/^::ffff:/, '') // normalise IPv4-mapped IPv6
    .replace(/[^0-9a-fA-F.:]/g, '') // sanitise for log safety
    || 'unknown';
}

function applyAuthFallback(ip: string, bucket: RateLimitBucket): boolean {
  const now = Date.now();
  const entry = authFallback.get(ip);

  if (!entry || now >= entry.resetAt) {
    authFallback.set(ip, { count: 1, resetAt: now + bucket.windowMs });
    return false; // not rate-limited
  }

  entry.count++;
  if (entry.count > bucket.max) {
    return true; // rate-limited
  }
  return false;
}

/**
 * Redis-backed sliding-window rate limiter.
 *
 * H6: On Redis failure the auth bucket falls back to an in-memory counter
 * so login/register remain protected even during a Redis outage. The general
 * bucket still fails open (non-auth traffic should not be blocked by infra).
 */
export function createRateLimitMiddleware(
  redis: Redis,
  options: RateLimitOptions,
): RequestHandler {
  return function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const isAuth = isAuthAttempt(req.method, req.originalUrl);
    const bucket = isAuth ? options.auth : options.general;
    const prefix = isAuth ? 'auth' : 'general';
    const ip = clientIp(req);
    const key = `gateway:rate:${prefix}:${ip}`;

    const now = Date.now();
    const windowStart = now - bucket.windowMs;
    const member = `${now}:${randomBytes(4).toString('hex')}`;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, member);
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(bucket.windowMs / 1000));

    pipeline
      .exec()
      .then(async (results) => {
        if (!results) {
          // H6: Redis hiccup — auth bucket uses in-memory fallback; general fails open.
          if (isAuth && applyAuthFallback(ip, bucket)) {
            res.status(429).json({
              statusCode: 429,
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
            });
            return;
          }
          next();
          return;
        }

        const count = results[2][1] as number;

        if (count > bucket.max) {
          const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
          let retryAfter = Math.ceil(bucket.windowMs / 1000);
          if (oldest && oldest.length >= 2) {
            const oldestTs = parseInt(oldest[1], 10);
            const retryMs = bucket.windowMs - (now - oldestTs);
            retryAfter = Math.max(1, Math.ceil(retryMs / 1000));
          }
          res.setHeader('Retry-After', retryAfter.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.status(429).json({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter,
          });
          return;
        }

        res.setHeader(
          'X-RateLimit-Remaining',
          Math.max(0, bucket.max - count).toString(),
        );
        next();
      })
      .catch(() => {
        // H6: Redis error — auth bucket falls back to in-memory; general passes through.
        if (isAuth && applyAuthFallback(ip, bucket)) {
          res.status(429).json({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
          });
          return;
        }
        next();
      });
  };
}
