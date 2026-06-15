import * as crypto from 'crypto';
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: crypto.webcrypto || crypto,
    writable: true,
    configurable: true,
  });
}

process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'e2e_access_secret_change_in_prod_1234567890abcdef';
process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'e2e_refresh_secret_change_in_prod_1234567890abcdef';
process.env.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'bgsc-auth-service';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'dummy_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'dummy_google_client_secret';
process.env.GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';
process.env.AUTH_TOTP_ENCRYPTION_KEY = process.env.AUTH_TOTP_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
process.env.SMTP_PORT = process.env.SMTP_PORT || '2525';
process.env.SMTP_USER = process.env.SMTP_USER || 'dummy_smtp_user';
process.env.SMTP_PASSWORD = process.env.SMTP_PASSWORD || 'dummy_smtp_password';
process.env.SMTP_FROM = process.env.SMTP_FROM || 'noreply@bgsc-platform.in';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '10';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import request from 'supertest';
import type { Response } from 'supertest';
import cookieParser = require('cookie-parser');
import { AuthModule } from './../src/auth.module';
import { EmailService } from './../src/services/email.service';
import { TokenService } from './../src/services/token.service';

const TEST_EMAIL_PREFIX = 'e2e-auth-';
const TEST_USER_AGENT = 'auth-e2e-test';

describe('AuthService integration (steps 1-9)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let server: any;
  let ipCounter = 10;
  const resetTokensByEmail = new Map<string, string>();

  const emailService = {
    sendPasswordResetEmail: jest.fn(async (to: string, rawToken: string) => {
      resetTokensByEmail.set(to, rawToken);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }));

    await app.init();
    server = app.getHttpServer();
    dataSource = app.get(DataSource);
    redis = app.get('REDIS_CLIENT');

    await cleanupTestState();
  }, 30_000);

  afterEach(async () => {
    resetTokensByEmail.clear();
    emailService.sendPasswordResetEmail.mockClear();
  });

  afterAll(async () => {
    if (dataSource && redis) {
      await cleanupTestState();
    }
    if (app) {
      await app.close();
    }
    if (redis) {
      redis.disconnect();
    }
  });

  it('registers, rejects duplicates, validates login failures, rotates refresh tokens, detects reuse, and logs out', async () => {
    const email = testEmail('flow');
    const registerResponse = await post('/auth/register')
      .send({
        username: 'E2EFlowUser',
        email,
        password: 'Password1!',
        acceptedTos: true,
      })
      .expect(201);

    expect(registerResponse.body.user).toEqual(expect.objectContaining({
      username: 'e2eflowuser',
      email,
      role: 'user',
    }));
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.isNewUser).toBe(true);
    const firstRefreshCookie = getRefreshCookie(registerResponse);

    await post('/auth/register')
      .send({
        username: 'E2EFlowUser2',
        email,
        password: 'Password1!',
        acceptedTos: true,
      })
      .expect(409);

    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'WrongPassword1!' })
      .expect(401);

    const loginResponse = await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'Password1!', keepMeLoggedIn: true })
      .expect(200);
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    const loginRefreshCookie = getRefreshCookie(loginResponse);

    const refreshResponse = await post('/auth/refresh')
      .set('Cookie', loginRefreshCookie)
      .send()
      .expect(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    const rotatedRefreshCookie = getRefreshCookie(refreshResponse);
    expect(rotatedRefreshCookie).not.toBe(loginRefreshCookie);

    await post('/auth/refresh')
      .set('Cookie', loginRefreshCookie)
      .send()
      .expect(401);

    const postBreachLogin = await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'Password1!', keepMeLoggedIn: true })
      .expect(200);
    const postBreachRefreshCookie = getRefreshCookie(postBreachLogin);

    const logoutResponse = await post('/auth/logout')
      .set('Authorization', `Bearer ${postBreachLogin.body.accessToken}`)
      .set('Cookie', postBreachRefreshCookie)
      .send()
      .expect(200);
    expect(logoutResponse.body.message).toBe('Logged out successfully');
    expect(getClearedRefreshCookie(logoutResponse)).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');

    await post('/auth/refresh')
      .set('Cookie', postBreachRefreshCookie)
      .send()
      .expect(401);

    expect(firstRefreshCookie).toContain('bgsc_refresh_token=');
    expect(rotatedRefreshCookie).toContain('bgsc_refresh_token=');
  }, 60_000);

  it('returns TOTP-required response and blocks disabled account login', async () => {
    const email = testEmail('status');
    await registerUser('E2EStatusUser', email, 'Password1!');

    await dataSource.query('UPDATE users SET totp_enabled = TRUE WHERE email = $1', [email]);
    const totpLogin = await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'Password1!' })
      .expect(200);
    expect(totpLogin.body).toEqual({ requiresTOTP: true, tempToken: expect.any(String) });

    await dataSource.query('UPDATE users SET totp_enabled = FALSE, status = $1 WHERE email = $2', ['disabled', email]);
    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'Password1!' })
      .expect(403);
  }, 60_000);

  it('supports change-password and forgot/reset-password with real DB and Redis state', async () => {
    const email = testEmail('passwords');
    const registerResponse = await registerUser('E2EPasswordUser', email, 'Password1!');
    const accessToken = registerResponse.body.accessToken;
    const refreshCookie = getRefreshCookie(registerResponse);

    await post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'ChangedPassword1!' })
      .expect(401);

    await post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', refreshCookie)
      .send({ currentPassword: 'Password1!', newPassword: 'ChangedPassword1!' })
      .expect(200);

    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'Password1!' })
      .expect(401);

    const changedLogin = await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'ChangedPassword1!', keepMeLoggedIn: true })
      .expect(200);
    expect(changedLogin.body.accessToken).toEqual(expect.any(String));

    await post('/auth/forgot-password')
      .send({ email: 'missing-user@example.com' })
      .expect(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    await post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(email, expect.any(String));

    const resetToken = resetTokensByEmail.get(email);
    expect(resetToken).toMatch(/^[a-f0-9]{64}$/);

    await post('/auth/reset-password')
      .send({ token: resetToken, newPassword: 'ResetPassword1!' })
      .expect(200);

    await post('/auth/reset-password')
      .send({ token: resetToken, newPassword: 'AnotherPassword1!' })
      .expect(400);

    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'ChangedPassword1!' })
      .expect(401);

    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'ResetPassword1!' })
      .expect(200);
  }, 60_000);

  it('allows OAuth-only users to set an initial password without currentPassword', async () => {
    const email = testEmail('oauth');
    const userId = crypto.randomUUID();
    await dataSource.query(
      `INSERT INTO users (id, username, email, password_hash, google_id, role, status, totp_enabled)
       VALUES ($1, $2, $3, NULL, $4, 'user', 'active', FALSE)`,
      [userId, 'e2eoauthuser', email, `google-${userId}`],
    );

    const tokenService = app.get(TokenService);
    const accessToken = tokenService.signAccessToken({
      id: userId,
      username: 'e2eoauthuser',
      email,
      role: 'user',
    });

    await post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'OAuthPassword1!' })
      .expect(200);

    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'OAuthPassword1!' })
      .expect(200);
  }, 60_000);

  function post(path: string) {
    return request(server)
      .post(path)
      .set('x-forwarded-for', `10.91.0.${ipCounter++}`)
      .set('user-agent', TEST_USER_AGENT);
  }

  async function registerUser(username: string, email: string, password: string) {
    return post('/auth/register')
      .send({ username, email, password, acceptedTos: true })
      .expect(201);
  }

  function testEmail(label: string): string {
    return `${TEST_EMAIL_PREFIX}${label}-${Date.now()}@example.com`;
  }

  function getRefreshCookie(response: Response): string {
    const cookie = findSetCookie(response, 'bgsc_refresh_token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    return cookie.split(';')[0];
  }

  function getClearedRefreshCookie(response: Response): string {
    return findSetCookie(response, 'bgsc_refresh_token');
  }

  function findSetCookie(response: Response, name: string): string {
    const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
    expect(cookie).toBeDefined();
    return cookie!;
  }

  async function cleanupTestState(): Promise<void> {
    const users = await dataSource.query(
      'SELECT id FROM users WHERE email LIKE $1',
      [`${TEST_EMAIL_PREFIX}%@example.com`],
    ) as Array<{ id: string }>;

    for (const user of users) {
      const sessionKeys = await redis.keys(`auth:session:${user.id}:*`);
      if (sessionKeys.length > 0) {
        await redis.del(...sessionKeys);
      }
      await redis.del(`auth:session_index:${user.id}`);
    }

    const resetKeys = await redis.keys('auth:password_reset:*');
    if (resetKeys.length > 0) {
      await redis.del(...resetKeys);
    }

    if (users.length > 0) {
      await dataSource.query('DELETE FROM login_audit_log WHERE user_id = ANY($1::uuid[])', [users.map((user) => user.id)]);
    }

    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [`${TEST_EMAIL_PREFIX}%@example.com`]);
  }
});
