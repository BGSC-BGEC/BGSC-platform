import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import Redis from 'ioredis';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { createRateLimitMiddleware } from './gateway/rate-limit.middleware';
import { createJwtAuthMiddleware } from './gateway/jwt-auth.middleware';
import { createServiceProxy } from './gateway/proxy';
import {
  isAnnouncementServiceRoute,
  isAuthServiceRoute,
  isEventServiceRoute,
  isNotificationServiceRoute,
  isPointsServiceRoute,
  isSponsorServiceRoute,
  isUserServiceRoute,
  isSocialServiceRoute,
  isChallengeServiceRoute,
} from './gateway/routing';

async function bootstrap() {
  // bodyParser:false so request bodies stream straight to the proxy untouched.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  const port = config.get<number>('gateway.port', 3000);
  const corsOrigins = config.get<string[]>('gateway.cors.origins', []);
  const redisUrl = config.get<string>('gateway.redis.url')!;
  const jwtSecret = config.get<string>('gateway.jwt.accessSecret')!;
  const jwtIssuer = config.get<string>('gateway.jwt.issuer')!;
  const authTarget = config.get<string>('gateway.services.auth')!;
  const userTarget = config.get<string>('gateway.services.user')!;
  const sponsorTarget = config.get<string>('gateway.services.sponsor')!;
  const eventTarget = config.get<string>('gateway.services.event')!;
  const pointsTarget = config.get<string>('gateway.services.points')!;
  const notificationTarget = config.get<string>('gateway.services.notification')!;
  const announcementTarget = config.get<string>('gateway.services.announcement')!;
  const socialTarget = config.get<string>('gateway.services.social')!;
  const challengeTarget = config.get<string>('gateway.services.challenge')!;
  const proxyTimeoutMs = config.get<number>('gateway.proxyTimeoutMs', 30000);
  const rateLimit = {
    general: config.get<{ max: number; windowMs: number }>(
      'gateway.rateLimit.general',
    )!,
    auth: config.get<{ max: number; windowMs: number }>(
      'gateway.rateLimit.auth',
    )!,
  };

  // C2: trust proxy=1 so req.ip is derived from the rightmost trusted hop,
  // not from the client-controlled X-Forwarded-For leftmost value.
  app.set('trust proxy', 1);

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  redis.on('error', (err) => {
    console.error(`[api-gateway] Redis error: ${err.message}`);
  });
  app.enableShutdownHooks();

  // Security + CORS at the edge.
  app.use(helmet());
  app.enableCors({
    // H4: never reflect origin back as wildcard-with-credentials.
    // In dev with no CORS_ORIGINS set, default to [] (no cross-origin access).
    origin: corsOrigins.length > 0 ? corsOrigins : [],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Remaining', 'Retry-After'],
  });

  // H12: Reject oversized payloads before they reach the proxy.
  // 10 MB is generous for this API; adjust per endpoint type if needed.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] ?? '0', 10);
    if (contentLength > 10 * 1024 * 1024) {
      res.status(413).json({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Request body exceeds the 10 MB limit.',
      });
      return;
    }
    next();
  });

  // C3: Strip all identity headers unconditionally before the pipeline.
  // They are only re-injected by the JWT middleware after verification.
  // This prevents privilege escalation via forged headers on public routes.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    delete req.headers['x-user-id'];
    delete req.headers['x-user-role'];
    delete req.headers['x-user-email'];
    delete req.headers['x-username'];
    next();
  });

  // Block POST /notifications at the edge — internal-only endpoint.
  app.use('/notifications', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST') {
      res.status(403).json({ statusCode: 403, message: 'Forbidden: internal endpoint' });
      return;
    }
    next();
  });

  // Block /strava/internal/* at the edge — service-to-service only.
  app.use('/strava/internal', (_req: Request, res: Response) => {
    res.status(403).json({ statusCode: 403, message: 'Forbidden: internal endpoint' });
  });

  // Edge pipeline: rate limit -> JWT verification (with jti blacklist) -> proxy.
  app.use(createRateLimitMiddleware(redis, rateLimit));
  app.use(createJwtAuthMiddleware({ secret: jwtSecret, issuer: jwtIssuer, redis }));

  app.use(
    createServiceProxy({
      target: authTarget,
      pathFilter: (path) => isAuthServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: userTarget,
      pathFilter: (path) => isUserServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: sponsorTarget,
      pathFilter: (path) => isSponsorServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: eventTarget,
      pathFilter: (path) => isEventServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: pointsTarget,
      pathFilter: (path) => isPointsServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: notificationTarget,
      pathFilter: (path) => isNotificationServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: announcementTarget,
      pathFilter: (path) => isAnnouncementServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: socialTarget,
      pathFilter: (path) => isSocialServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );
  app.use(
    createServiceProxy({
      target: challengeTarget,
      pathFilter: (path) => isChallengeServiceRoute(path),
      timeoutMs: proxyTimeoutMs,
    }),
  );

  await app.listen(port);
}
void bootstrap();
