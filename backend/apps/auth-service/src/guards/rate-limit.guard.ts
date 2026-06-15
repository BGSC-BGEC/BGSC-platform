import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { createHash, randomBytes } from 'crypto';
import { RATE_LIMIT_KEY, RateLimitConfig } from '../decorators/rate-limit.decorator';
import { RateLimitExceededException } from '../exceptions/rate-limit-exceeded.exception';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const config = this.reflector.get<RateLimitConfig>(RATE_LIMIT_KEY, handler);

    if (!config) {
      return true; // No rate limit configured
    }

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const key = this.buildKey(config.keyPrefix, request, config);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const member = `${now}:${randomBytes(4).toString('hex')}`;
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);  // Prune old attempts
    pipeline.zadd(key, now, member);                 // Add current attempt
    pipeline.zcard(key);                             // Count active attempts
    pipeline.expire(key, Math.ceil(config.windowMs / 1000)); // Update TTL

    const results = await pipeline.exec();
    if (!results) {
      return true;
    }

    // Results is an array of [err, val]. The third command is zcard (index 2).
    const count = results[2][1] as number;

    if (count > config.max) {
      const oldestInWindow = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      let retryAfterSeconds = Math.ceil(config.windowMs / 1000);

      if (oldestInWindow && oldestInWindow.length >= 2) {
        const oldestTimestamp = parseInt(oldestInWindow[1], 10);
        const elapsed = now - oldestTimestamp;
        const retryAfterMs = config.windowMs - elapsed;
        retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      }

      response.setHeader('Retry-After', retryAfterSeconds.toString());
      response.setHeader('X-RateLimit-Remaining', '0');
      throw new RateLimitExceededException(retryAfterSeconds);
    }

    response.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count).toString());
    return true;
  }

  private buildKey(prefix: string, request: any, config: RateLimitConfig): string {
    let identifier: string | undefined;

    if (config.keyBy === 'email') {
      const email = String(request.body?.email || '').trim().toLowerCase();
      if (email) identifier = createHash('sha256').update(email).digest('hex');
    } else if (config.keyBy === 'refreshToken') {
      const rawToken = request.cookies?.bgsc_refresh_token;
      if (typeof rawToken === 'string') {
        const parts = rawToken.split('.');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const randomHexRegex = /^[0-9a-f]{64}$/i;
        if (
          parts.length === 3 &&
          uuidRegex.test(parts[0]) &&
          uuidRegex.test(parts[1]) &&
          randomHexRegex.test(parts[2])
        ) {
          identifier = parts[0];
        }
      }
    }

    if (!identifier) {
      const forwarded = request.headers['x-forwarded-for'];
      const rawIp = Array.isArray(forwarded)
        ? forwarded[0]
        : String(forwarded || request.socket?.remoteAddress || request.ip || 'unknown');
      identifier = request.user?.sub || rawIp.split(',')[0].trim();
    }

    return `auth:rate:${prefix}:${identifier}`;
  }
}
