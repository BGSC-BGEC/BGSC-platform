import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { createRateLimitMiddleware } from './gateway/rate-limit.middleware';
import { createJwtAuthMiddleware } from './gateway/jwt-auth.middleware';
import { createServiceProxy } from './gateway/proxy';
import { isAuthServiceRoute, isUserServiceRoute } from './gateway/routing';

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
  const proxyTimeoutMs = config.get<number>('gateway.proxyTimeoutMs', 30000);
  const rateLimit = {
    general: config.get<{ max: number; windowMs: number }>(
      'gateway.rateLimit.general',
    )!,
    auth: config.get<{ max: number; windowMs: number }>(
      'gateway.rateLimit.auth',
    )!,
  };

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  // Keep the process alive if Redis is unreachable; the limiter fails open.
  redis.on('error', (err) => {
    console.error(`[api-gateway] Redis error: ${err.message}`);
  });
  app.enableShutdownHooks();

  // Security + CORS at the edge.
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Remaining', 'Retry-After'],
  });

  // Edge pipeline: rate limit -> JWT verification -> reverse proxy.
  // Proxies use a pathFilter, so unmatched paths (e.g. /health) fall through
  // to the Nest controllers.
  app.use(createRateLimitMiddleware(redis, rateLimit));
  app.use(createJwtAuthMiddleware({ secret: jwtSecret, issuer: jwtIssuer }));
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

  await app.listen(port);
}
void bootstrap();
