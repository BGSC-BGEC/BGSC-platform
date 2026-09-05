import { userConfig, userConfigValidationSchema } from './user.config';

describe('userConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('validates required user service env vars', () => {
    const { error } = userConfigValidationSchema.validate({
      PORT: 3002,
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_ISSUER: 'bgsc-auth-service',
      STRAVA_CLIENT_ID: 'test-strava-client-id',
      STRAVA_CLIENT_SECRET: 'test-strava-client-secret',
      STRAVA_WEBHOOK_VERIFY_TOKEN: 'test-strava-webhook-token',
      STRAVA_TOKEN_ENCRYPTION_KEY:
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      INTERNAL_SERVICE_KEY: 'test-internal-service-key-32-characters',
    });

    expect(error).toBeUndefined();
  });

  it('rejects missing required user service env vars', () => {
    const { error } = userConfigValidationSchema.validate(
      {
        PORT: 3002,
        NODE_ENV: 'test',
      },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((detail) => detail.path.join('.'))).toEqual(
      expect.arrayContaining([
        'DATABASE_URL',
        'JWT_ACCESS_SECRET',
        'JWT_ISSUER',
        'STRAVA_CLIENT_ID',
        'STRAVA_CLIENT_SECRET',
        'STRAVA_WEBHOOK_VERIFY_TOKEN',
        'STRAVA_TOKEN_ENCRYPTION_KEY',
        'INTERNAL_SERVICE_KEY',
      ]),
    );
  });

  it('maps env vars into the user config namespace', () => {
    process.env.PORT = '3004';
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL =
      'postgresql://bgsc:bgsc_pass@db.internal:5432/bgsc_prod';
    process.env.JWT_ACCESS_SECRET = 'live-access-secret';
    process.env.JWT_ISSUER = 'bgsc-auth-service';
    process.env.STRAVA_CLIENT_ID = 'live-strava-client-id';
    process.env.STRAVA_CLIENT_SECRET = 'live-strava-client-secret';
    process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'live-strava-webhook-token';
    process.env.STRAVA_TOKEN_ENCRYPTION_KEY =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    process.env.INTERNAL_SERVICE_KEY = 'live-internal-service-key-32-characters';

    expect(userConfig()).toEqual({
      port: 3004,
      env: 'production',
      db: {
        url: 'postgresql://bgsc:bgsc_pass@db.internal:5432/bgsc_prod',
      },
      jwt: {
        accessSecret: 'live-access-secret',
        issuer: 'bgsc-auth-service',
      },
      eventServiceUrl: 'http://localhost:3003',
      strava: {
        clientId: 'live-strava-client-id',
        clientSecret: 'live-strava-client-secret',
        webhookVerifyToken: 'live-strava-webhook-token',
        tokenEncryptionKey:
          'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      },
      internalServiceKey: 'live-internal-service-key-32-characters',
    });
  });

  it('does not synthesize a database url when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.PORT = '3002';
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'live-access-secret';
    process.env.JWT_ISSUER = 'bgsc-auth-service';

    expect(userConfig().db.url).toBeUndefined();
  });
});
