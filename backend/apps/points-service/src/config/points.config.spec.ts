import { pointsConfig, pointsConfigValidationSchema } from './points.config';

describe('pointsConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('validates required points service env vars', () => {
    const { error } = pointsConfigValidationSchema.validate({
      PORT: 3005,
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_ISSUER: 'bgsc-auth-service',
    });

    expect(error).toBeUndefined();
  });

  it('rejects missing required points service env vars', () => {
    const { error } = pointsConfigValidationSchema.validate(
      { PORT: 3005, NODE_ENV: 'test' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.details.map((d) => d.path.join('.'))).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_ISSUER']),
    );
  });

  it('maps env vars into the points config namespace', () => {
    process.env.PORT = '3005';
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://bgsc:bgsc_pass@db.internal:5432/bgsc_prod';
    process.env.JWT_ACCESS_SECRET = 'live-access-secret';
    process.env.JWT_ISSUER = 'bgsc-auth-service';

    expect(pointsConfig()).toEqual({
      port: 3005,
      env: 'production',
      db: { url: 'postgresql://bgsc:bgsc_pass@db.internal:5432/bgsc_prod' },
      jwt: { accessSecret: 'live-access-secret', issuer: 'bgsc-auth-service' },
    });
  });

  it('does not synthesize a database url when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.PORT = '3005';
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'secret';
    process.env.JWT_ISSUER = 'bgsc-auth-service';

    expect(pointsConfig().db.url).toBeUndefined();
  });
});
