import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { isProtectedRoute } from './routing';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface JwtAuthOptions {
  secret: string;
  issuer: string;
  /** Redis client for jti blacklist check (C4). */
  redis: Redis;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || Array.isArray(header)) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
}

function unauthorized(res: Response, message: string): void {
  res.status(401).json({
    statusCode: 401,
    error: 'Unauthorized',
    message,
  });
}

/**
 * Edge JWT verification.
 *
 * Security properties:
 *  - C3: x-user-* headers are stripped unconditionally before this runs
 *        (handled in main.ts before the pipeline). This middleware only
 *        re-injects them after successful verification.
 *  - C4: jti blacklist is checked in Redis so logout actually revokes tokens.
 *  - M13: algorithm is pinned to HS256 — rejects alg:none or RS256 misconfig.
 *
 * Public routes pass straight through (headers already stripped by main.ts).
 */
export function createJwtAuthMiddleware(
  options: JwtAuthOptions,
  jwtService: JwtService = new JwtService(),
): RequestHandler {
  return function jwtAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!isProtectedRoute(req.originalUrl)) {
      next();
      return;
    }

    const token = extractBearer(req);
    if (!token) {
      unauthorized(res, 'Missing or malformed Authorization header');
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwtService.verify<JwtPayload>(token, {
        secret: options.secret,
        issuer: options.issuer,
        algorithms: ['HS256'], // M13: pin algorithm
      });
    } catch {
      unauthorized(res, 'Invalid or expired access token');
      return;
    }

    // C4: Check jti blacklist — catches revoked tokens post-logout.
    // Key format mirrors auth-service SessionService.blacklistJti().
    options.redis
      .exists(`auth:blacklist:${payload.jti}`)
      .then((revoked) => {
        if (revoked) {
          unauthorized(res, 'Token has been revoked');
          return;
        }

        // Re-inject verified identity for downstream services.
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-user-role'] = payload.role;
        req.headers['x-user-email'] = payload.email;
        req.headers['x-username'] = payload.username;

        next();
      })
      .catch(() => {
        // Redis unavailable: fail closed for protected routes.
        // A brief outage means users must re-authenticate; this is
        // preferable to forwarding potentially revoked tokens.
        unauthorized(res, 'Authentication service temporarily unavailable');
      });
  };
}
