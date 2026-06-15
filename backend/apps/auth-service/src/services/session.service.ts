import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Session } from '../interfaces/session.interface';
import { InvalidCredentialsException } from '../exceptions/invalid-credentials.exception';
import { TokenReuseDetectedException } from '../exceptions/token-reuse-detected.exception';

@Injectable()
export class SessionService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private getSessionKey(userId: string, familyId: string): string {
    return `auth:session:${userId}:${familyId}`;
  }

  private getIndexKey(userId: string): string {
    return `auth:session_index:${userId}`;
  }

  private getTtl(keepMeLoggedIn: boolean): number {
    return keepMeLoggedIn ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7 days vs 24 hours in seconds
  }

  async createSession(
    userId: string,
    tokenHash: string,
    familyId: string,
    ip: string,
    userAgent: string,
    keepMeLoggedIn: boolean,
  ): Promise<void> {
    const sessionKey = this.getSessionKey(userId, familyId);
    const indexKey = this.getIndexKey(userId);
    const ttl = this.getTtl(keepMeLoggedIn);
    const now = Date.now().toString();

    const pipeline = this.redis.pipeline();
    pipeline.hset(sessionKey, {
      tokenHash,
      deviceIp: ip,
      deviceUserAgent: userAgent,
      createdAt: now,
      lastUsedAt: now,
      keepMeLoggedIn: String(keepMeLoggedIn),
    });
    pipeline.expire(sessionKey, ttl);
    pipeline.sadd(indexKey, familyId);
    pipeline.expire(indexKey, ttl);
    await pipeline.exec();

    // Enforce 5 concurrent sessions limit
    const familyIds = await this.redis.smembers(indexKey);
    if (familyIds.length > 5) {
      await this.evictOldestSession(userId, familyIds);
    }
  }

  async validateAndRotateSession(
    userId: string,
    familyId: string,
    oldTokenHash: string,
    newTokenHash: string,
    ip: string,
    userAgent: string,
  ): Promise<boolean> {
    const sessionKey = this.getSessionKey(userId, familyId);
    const session = await this.redis.hgetall(sessionKey);

    if (!session || !session.tokenHash) {
      throw new InvalidCredentialsException();
    }

    if (session.tokenHash !== oldTokenHash) {
      // Breach detected! Replaying an old token
      await this.revokeAllSessions(userId);
      throw new TokenReuseDetectedException();
    }

    const keepMeLoggedIn = session.keepMeLoggedIn === 'true';
    const ttl = this.getTtl(keepMeLoggedIn);
    const now = Date.now().toString();

    const pipeline = this.redis.pipeline();
    pipeline.hset(sessionKey, {
      tokenHash: newTokenHash,
      deviceIp: ip,
      deviceUserAgent: userAgent,
      lastUsedAt: now,
    });
    pipeline.expire(sessionKey, ttl);
    
    const indexKey = this.getIndexKey(userId);
    pipeline.expire(indexKey, ttl);
    await pipeline.exec();

    return keepMeLoggedIn;
  }

  async revokeSession(userId: string, familyId: string): Promise<void> {
    const sessionKey = this.getSessionKey(userId, familyId);
    const indexKey = this.getIndexKey(userId);

    const pipeline = this.redis.pipeline();
    pipeline.del(sessionKey);
    pipeline.srem(indexKey, familyId);
    await pipeline.exec();
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const indexKey = this.getIndexKey(userId);
    const familyIds = await this.redis.smembers(indexKey);

    const pipeline = this.redis.pipeline();
    for (const familyId of familyIds) {
      pipeline.del(this.getSessionKey(userId, familyId));
    }
    pipeline.del(indexKey);
    await pipeline.exec();
  }

  async listSessions(userId: string, currentFamilyId?: string): Promise<any[]> {
    const indexKey = this.getIndexKey(userId);
    const familyIds = await this.redis.smembers(indexKey);
    
    const sessions: any[] = [];
    for (const familyId of familyIds) {
      const session = await this.redis.hgetall(this.getSessionKey(userId, familyId));
      if (session && session.tokenHash) {
        sessions.push({
          familyId,
          deviceIp: session.deviceIp,
          deviceUserAgent: session.deviceUserAgent,
          createdAt: new Date(parseInt(session.createdAt, 10)),
          lastUsedAt: new Date(parseInt(session.lastUsedAt, 10)),
          isCurrent: familyId === currentFamilyId,
        });
      }
    }
    
    return sessions.sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
  }

  async blacklistJti(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`auth:blacklist:${jti}`, '1', 'EX', Math.max(1, ttlSeconds));
  }

  async isJtiBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.get(`auth:blacklist:${jti}`);
    return !!result;
  }

  private async evictOldestSession(userId: string, familyIds: string[]): Promise<void> {
    const sessionsMeta: { familyId: string; lastUsedAt: number }[] = [];

    for (const familyId of familyIds) {
      const lastUsed = await this.redis.hget(this.getSessionKey(userId, familyId), 'lastUsedAt');
      if (lastUsed) {
        sessionsMeta.push({ familyId, lastUsedAt: parseInt(lastUsed, 10) });
      } else {
        // Handle expired/ghost sessions in the set
        await this.redis.srem(this.getIndexKey(userId), familyId);
      }
    }

    if (sessionsMeta.length > 5) {
      sessionsMeta.sort((a, b) => a.lastUsedAt - b.lastUsedAt); // Oldest first
      const oldest = sessionsMeta[0];
      await this.revokeSession(userId, oldest.familyId);
    }
  }
}
