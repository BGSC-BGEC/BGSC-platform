import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { createRateLimitMiddleware } from './rate-limit.middleware';

/**
 * Minimal in-memory fake of the ioredis pipeline surface the limiter uses,
 * implementing just enough of the sliding-window commands to assert behaviour.
 */
function fakeRedis() {
  const store = new Map<string, Array<{ score: number; member: string }>>();

  const api = {
    pipeline() {
      const ops: Array<() => unknown> = [];
      const builder = {
        zremrangebyscore(key: string, min: number, max: number) {
          ops.push(() => {
            const entries = store.get(key) ?? [];
            store.set(
              key,
              entries.filter((e) => e.score < min || e.score > max),
            );
            return 0;
          });
          return builder;
        },
        zadd(key: string, score: number, member: string) {
          ops.push(() => {
            const entries = store.get(key) ?? [];
            entries.push({ score, member });
            store.set(key, entries);
            return 1;
          });
          return builder;
        },
        zcard(key: string) {
          ops.push(() => (store.get(key) ?? []).length);
          return builder;
        },
        expire() {
          ops.push(() => 1);
          return builder;
        },
        exec() {
          return Promise.resolve(ops.map((op) => [null, op()]));
        },
      };
      return builder;
    },
    zrange(key: string) {
      const entries = (store.get(key) ?? [])
        .slice()
        .sort((a, b) => a.score - b.score);
      const oldest = entries[0];
      return Promise.resolve(
        oldest ? [oldest.member, String(oldest.score)] : [],
      );
    },
  };

  return api as unknown as Redis;
}

function mockReq(method: string, url: string): Request {
  return {
    method,
    originalUrl: url,
    headers: { 'x-forwarded-for': '203.0.113.5' },
    socket: { remoteAddress: '203.0.113.5' },
  } as unknown as Request;
}

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    getHeader(k: string) {
      return headers[k];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    getHeader(k: string): string | undefined;
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('createRateLimitMiddleware', () => {
  const options = {
    general: { max: 3, windowMs: 60_000 },
    auth: { max: 2, windowMs: 900_000 },
  };

  it('allows requests under the general limit and sets remaining header', async () => {
    const mw = createRateLimitMiddleware(fakeRedis(), options);
    const res = mockRes();
    const next = jest.fn();

    mw(mockReq('GET', '/users/me'), res, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.getHeader('X-RateLimit-Remaining')).toBe('2');
  });

  it('blocks once the general limit is exceeded', async () => {
    const redis = fakeRedis();
    const mw = createRateLimitMiddleware(redis, options);

    for (let i = 0; i < options.general.max; i++) {
      const next = jest.fn();
      mw(mockReq('GET', '/users/me'), mockRes(), next);
      await flush();
      expect(next).toHaveBeenCalledTimes(1);
    }

    const res = mockRes();
    const next = jest.fn();
    mw(mockReq('GET', '/users/me'), res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.getHeader('Retry-After')).toBeDefined();
  });

  it('applies the stricter auth bucket to POST /auth/login', async () => {
    const redis = fakeRedis();
    const mw = createRateLimitMiddleware(redis, options);

    for (let i = 0; i < options.auth.max; i++) {
      const next = jest.fn();
      mw(mockReq('POST', '/auth/login'), mockRes(), next);
      await flush();
      expect(next).toHaveBeenCalledTimes(1);
    }

    const res = mockRes();
    const next = jest.fn();
    mw(mockReq('POST', '/auth/login'), res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });
});
