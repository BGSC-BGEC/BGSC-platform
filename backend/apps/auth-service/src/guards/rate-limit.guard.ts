import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
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

    const request = context.switchToHttp().getRequest();
    const key = this.buildKey(config.keyPrefix, request);
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

      throw new RateLimitExceededException(retryAfterSeconds);
    }

    return true;
  }

  private buildKey(prefix: string, request: any): string {
    const ip = request.headers['x-forwarded-for'] || request.socket.remoteAddress || request.ip;
    const identifier = request.user?.sub || ip;
    return `auth:rate:${prefix}:${identifier}`;
  }
}
