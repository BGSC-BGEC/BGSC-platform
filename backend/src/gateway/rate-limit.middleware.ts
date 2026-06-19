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

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : String(forwarded || req.socket?.remoteAddress || req.ip || 'unknown');
  return raw.split(',')[0].trim() || 'unknown';
}

/**
 * Redis-backed sliding-window rate limiter, mirroring the algorithm used by the
 * auth-service guard. Meters per client IP at the edge. Auth login/register get
 * the strict bucket (5 / 15 min); everything else gets the general bucket
 * (100 / min).
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
    const key = `gateway:rate:${prefix}:${clientIp(req)}`;

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
          // Redis hiccup: fail open rather than block all traffic.
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
        // Never let a limiter error take down the gateway.
        next();
      });
  };
}
