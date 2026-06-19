import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { createJwtAuthMiddleware } from './jwt-auth.middleware';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

const SECRET = 'test_access_secret_1234567890abcdef';
const ISSUER = 'bgsc-auth-service';

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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
  };
}

function mockReq(url: string, headers: Record<string, string> = {}) {
  return {
    originalUrl: url,
    headers,
  } as unknown as Request;
}

describe('createJwtAuthMiddleware', () => {
  const jwtService = new JwtService();
  const middleware = createJwtAuthMiddleware(
    { secret: SECRET, issuer: ISSUER },
    jwtService,
  );

  const sign = (payload: Partial<JwtPayload>, issuer = ISSUER) =>
    jwtService.sign(payload, { secret: SECRET, issuer });

  it('passes public routes through without a token', () => {
    const req = mockReq('/auth/login');
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('rejects protected routes with no token', () => {
    const req = mockReq('/users/me');
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects protected routes with an invalid token', () => {
    const req = mockReq('/users/me', { authorization: 'Bearer not-a-jwt' });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token signed with the wrong issuer', () => {
    const token = sign(
      { sub: 'u1', username: 'a', email: 'a@b.c', role: 'user', jti: 'j1' },
      'evil-issuer',
    );
    const req = mockReq('/users/me', { authorization: `Bearer ${token}` });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid token and forwards identity headers', () => {
    const token = sign({
      sub: 'user-1',
      username: 'alice',
      email: 'alice@bgsc.in',
      role: 'coordinator',
      jti: 'jti-1',
    });
    const req = mockReq('/users/me', { authorization: `Bearer ${token}` });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.headers['x-user-id']).toBe('user-1');
    expect(req.headers['x-user-role']).toBe('coordinator');
    expect(req.headers['x-user-email']).toBe('alice@bgsc.in');
    expect(req.headers['x-username']).toBe('alice');
  });
});
