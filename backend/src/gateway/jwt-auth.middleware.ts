import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { JwtService } from '@nestjs/jwt';
import { isProtectedRoute } from './routing';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export interface JwtAuthOptions {
  secret: string;
  issuer: string;
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
 * Edge JWT verification. Protected routes (see routing.ts) must carry a valid
 * access token; the verified claims are forwarded to downstream services as
 * `x-user-*` headers (in addition to the original Authorization header, which
 * downstream services still verify independently as defense-in-depth).
 *
 * Public routes (login, register, refresh, OAuth, password reset, TOTP login)
 * pass straight through.
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
      });
    } catch {
      unauthorized(res, 'Invalid or expired access token');
      return;
    }

    // Forward verified identity to downstream services.
    req.headers['x-user-id'] = payload.sub;
    req.headers['x-user-role'] = payload.role;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-username'] = payload.username;

    next();
  };
}
