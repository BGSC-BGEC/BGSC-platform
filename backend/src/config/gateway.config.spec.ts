import { gatewayConfig, gatewayConfigValidationSchema } from './gateway.config';

describe('gatewayConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('validates required gateway env vars', () => {
    const { error } = gatewayConfigValidationSchema.validate({
      PORT: 3000,
      NODE_ENV: 'test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_ISSUER: 'bgsc-auth-service',
      AUTH_SERVICE_URL: 'http://auth-service:3001',
      USER_SERVICE_URL: 'http://user-service:3002',
      SPONSOR_SERVICE_URL: 'http://sponsor-service:3003',
      EVENT_SERVICE_URL: 'http://event-service:3004',
      POINTS_SERVICE_URL: 'http://points-service:3005',
    });

    expect(error).toBeUndefined();
  });

  it('rejects missing upstream service URLs', () => {
    const { error } = gatewayConfigValidationSchema.validate(
      {
        PORT: 3000,
        NODE_ENV: 'test',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_ISSUER: 'bgsc-auth-service',
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.path.join('.'))).toEqual(
      expect.arrayContaining([
        'AUTH_SERVICE_URL',
        'USER_SERVICE_URL',
        'SPONSOR_SERVICE_URL',
        'EVENT_SERVICE_URL',
        'POINTS_SERVICE_URL',
      ]),
    );
  });

  it('maps env vars into the gateway config namespace', () => {
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://redis.internal:6379';
    process.env.JWT_ACCESS_SECRET = 'live-access-secret';
    process.env.JWT_ISSUER = 'bgsc-auth-service';
    process.env.AUTH_SERVICE_URL = 'http://auth.internal:3001';
    process.env.USER_SERVICE_URL = 'http://user.internal:3002';
    process.env.SPONSOR_SERVICE_URL = 'http://sponsor.internal:3003';
    process.env.EVENT_SERVICE_URL = 'http://event.internal:3004';
    process.env.POINTS_SERVICE_URL = 'http://points.internal:3005';
    process.env.CORS_ORIGINS =
      'https://app.example.com,https://admin.example.com';

    expect(gatewayConfig()).toEqual({
      port: 3000,
      env: 'production',
      redis: {
        url: 'redis://redis.internal:6379',
      },
      jwt: {
        accessSecret: 'live-access-secret',
        issuer: 'bgsc-auth-service',
      },
      services: {
        auth: 'http://auth.internal:3001',
        user: 'http://user.internal:3002',
        sponsor: 'http://sponsor.internal:3003',
        event: 'http://event.internal:3004',
        points: 'http://points.internal:3005',
      },
      cors: {
        origins: ['https://app.example.com', 'https://admin.example.com'],
      },
      rateLimit: {
        general: {
          max: 100,
          windowMs: 60000,
        },
        auth: {
          max: 5,
          windowMs: 900000,
        },
      },
      proxyTimeoutMs: 30000,
    });
  });

  it('does not synthesize upstream URLs when env vars are missing', () => {
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET = 'live-access-secret';
    process.env.JWT_ISSUER = 'bgsc-auth-service';
    delete process.env.AUTH_SERVICE_URL;
    delete process.env.USER_SERVICE_URL;
    delete process.env.SPONSOR_SERVICE_URL;
    delete process.env.EVENT_SERVICE_URL;
    delete process.env.POINTS_SERVICE_URL;

    expect(gatewayConfig().services).toEqual({
      auth: undefined,
      user: undefined,
      sponsor: undefined,
      event: undefined,
      points: undefined,
    });
  });
});
