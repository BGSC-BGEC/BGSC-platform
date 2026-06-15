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

import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Inject,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { generateSync } from 'otplib';
import { UserStatus } from './../src/constants/roles.constant';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import request from 'supertest';
import type { Response } from 'supertest';
import cookieParser = require('cookie-parser');
import { AuthModule } from './../src/auth.module';
import { EmailService } from './../src/services/email.service';
import { TokenService } from './../src/services/token.service';
import { AccountService } from './../src/services/account.service';
import { GoogleAuthGuard } from './../src/guards/google-auth.guard';
import { UserRole } from './../src/constants/roles.constant';
import { UserCredential } from './../src/entities/user-credential.entity';

const TEST_EMAIL_PREFIX = 'e2e-auth-';
const TEST_OAUTH_EMAIL_PREFIX = 'e2e-oauth-';
const TEST_GOOGLE_ID_PREFIX = 'gid-e2e-';
const TEST_USER_AGENT = 'auth-e2e-test';

@Injectable()
class MockGoogleAuthGuard implements CanActivate {
  static mockProfile: any = null;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  static setProfile(profile: any) {
    this.mockProfile = profile;
  }

  static reset() {
    this.mockProfile = null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpRequest = context.switchToHttp().getRequest();

    if (httpRequest.query?.code) {
      const state = httpRequest.query?.state;
      if (typeof state !== 'string' || state.length === 0) {
        throw new UnauthorizedException('Missing OAuth state parameter');
      }

      const stateKey = `auth:oauth:google:state:${state}`;
      const stored = await this.redis.get(stateKey);
      if (!stored) {
        throw new UnauthorizedException('Invalid or expired OAuth state');
      }
      await this.redis.del(stateKey);

      if (!MockGoogleAuthGuard.mockProfile) {
        throw new Error('Mock profile not configured for callback test');
      }
      httpRequest.user = MockGoogleAuthGuard.mockProfile;
    }

    return true;
  }
}

describe('AuthService integration (steps 1-10)', () => {
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
      .overrideGuard(GoogleAuthGuard)
      .useClass(MockGoogleAuthGuard)
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
    MockGoogleAuthGuard.reset();
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

  describe('Local auth flow (steps 1-9)', () => {

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
      role: UserRole.USER,
    } as UserCredential);

    await post('/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'OAuthPassword1!' })
      .expect(200);

    await post('/auth/login')
      .send({ usernameOrEmail: email, password: 'OAuthPassword1!' })
      .expect(200);
  }, 60_000);

  });

  describe('Google OAuth2 callback (step 10, with mocked Google responses)', () => {
    const oauthIpCounter = { v: 200 };

    it('rejects callback with missing state parameter', async () => {
      await request(server)
        .get('/auth/google/callback?code=fake')
        .expect(401);
    });

    it('rejects callback with invalid state', async () => {
      await request(server)
        .get('/auth/google/callback?code=fake&state=invalid-state')
        .expect(401);
    });

    it('auto-registers a new user, sets refresh cookie, redirects with token in fragment, and writes audit log', async () => {
      const state = randomBytes(32).toString('hex');
      await redis.set(`auth:oauth:google:state:${state}`, '1', 'EX', 600);

      const googleId = `${TEST_GOOGLE_ID_PREFIX}new-${Date.now()}`;
      const email = testOAuthEmail('new');
      MockGoogleAuthGuard.setProfile({
        googleId,
        email,
        emailVerified: true,
        firstName: 'New',
        lastName: 'User',
      });

      const response = await request(server)
        .get(`/auth/google/callback?code=fake&state=${state}`)
        .set('x-forwarded-for', `10.91.0.${oauthIpCounter.v++}`)
        .set('user-agent', 'oauth-e2e-test')
        .expect(302);

      const location = response.headers['location'];
      expect(location).toMatch(/^http:\/\/localhost:3000\/auth\/callback#/);
      expect(location).toMatch(/#access_token=[^&]+/);
      expect(location).toMatch(/is_new_user=true/);

      const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies?.some(c => c.startsWith('bgsc_refresh_token=') && c.includes('HttpOnly'))).toBe(true);

      const stateAfter = await redis.get(`auth:oauth:google:state:${state}`);
      expect(stateAfter).toBeNull();

      const users = await dataSource.query(
        'SELECT * FROM users WHERE google_id = $1',
        [googleId],
      );
      expect(users.length).toBe(1);
      expect(users[0].password_hash).toBeNull();
      expect(users[0].email).toBe(email);
      expect(users[0].status).toBe('active');
      expect(users[0].role).toBe('user');

      const audits = await dataSource.query(
        'SELECT * FROM login_audit_log WHERE user_id = $1 AND method = $2 AND success = TRUE',
        [users[0].id, 'google'],
      );
      expect(audits.length).toBe(1);
      expect(audits[0].ip_address).toMatch(/^10\.91\.0\./);
      expect(audits[0].user_agent).toBe('oauth-e2e-test');
    });

    it('logs in an existing Google user without creating a duplicate (is_new_user=false)', async () => {
      const googleId = `${TEST_GOOGLE_ID_PREFIX}existing-${Date.now()}`;
      const email = testOAuthEmail('existing');
      const userId = crypto.randomUUID();
      await dataSource.query(
        `INSERT INTO users (id, username, email, password_hash, google_id, role, status, totp_enabled)
         VALUES ($1, $2, $3, NULL, $4, 'user', 'active', FALSE)`,
        [userId, `e2egoogle${Date.now()}`, email, googleId],
      );

      const state = randomBytes(32).toString('hex');
      await redis.set(`auth:oauth:google:state:${state}`, '1', 'EX', 600);
      MockGoogleAuthGuard.setProfile({
        googleId,
        email,
        emailVerified: true,
      });

      const response = await request(server)
        .get(`/auth/google/callback?code=fake&state=${state}`)
        .set('x-forwarded-for', `10.91.0.${oauthIpCounter.v++}`)
        .set('user-agent', 'oauth-e2e-test')
        .expect(302);

      expect(response.headers['location']).toMatch(/is_new_user=false/);

      const users = await dataSource.query(
        'SELECT COUNT(*) as count FROM users WHERE email = $1',
        [email],
      );
      expect(parseInt(users[0].count, 10)).toBe(1);
    });

    it('rejects email collision (existing user with same email but no google_id)', async () => {
      const email = testOAuthEmail('collision');
      await dataSource.query(
        `INSERT INTO users (id, username, email, password_hash, google_id, role, status, totp_enabled)
         VALUES ($1, $2, $3, $4, NULL, 'user', 'active', FALSE)`,
        [crypto.randomUUID(), `e2ecollision${Date.now()}`, email, 'some_bcrypt_hash'],
      );

      const state = randomBytes(32).toString('hex');
      await redis.set(`auth:oauth:google:state:${state}`, '1', 'EX', 600);
      MockGoogleAuthGuard.setProfile({
        googleId: `${TEST_GOOGLE_ID_PREFIX}attacker`,
        email,
        emailVerified: true,
      });

      await request(server)
        .get(`/auth/google/callback?code=fake&state=${state}`)
        .set('x-forwarded-for', `10.91.0.${oauthIpCounter.v++}`)
        .set('user-agent', 'oauth-e2e-test')
        .expect(409);

      const users = await dataSource.query(
        'SELECT * FROM users WHERE email = $1',
        [email],
      );
      expect(users.length).toBe(1);
      expect(users[0].google_id).toBeNull();
    });

    it('rejects disabled account via OAuth callback (403) and writes failed audit log', async () => {
      const googleId = `${TEST_GOOGLE_ID_PREFIX}disabled-${Date.now()}`;
      const email = testOAuthEmail('disabled');
      const userId = crypto.randomUUID();
      await dataSource.query(
        `INSERT INTO users (id, username, email, password_hash, google_id, role, status, totp_enabled)
         VALUES ($1, $2, $3, NULL, $4, 'user', 'disabled', FALSE)`,
        [userId, `e2egoogledisabled${Date.now()}`, email, googleId],
      );

      const state = randomBytes(32).toString('hex');
      await redis.set(`auth:oauth:google:state:${state}`, '1', 'EX', 600);
      MockGoogleAuthGuard.setProfile({
        googleId,
        email,
        emailVerified: true,
      });

      await request(server)
        .get(`/auth/google/callback?code=fake&state=${state}`)
        .set('x-forwarded-for', `10.91.0.${oauthIpCounter.v++}`)
        .set('user-agent', 'oauth-e2e-test')
        .expect(403);

      const audits = await dataSource.query(
        'SELECT * FROM login_audit_log WHERE user_id = $1 AND method = $2 AND success = FALSE',
        [userId, 'google'],
      );
      expect(audits.length).toBe(1);
      expect(audits[0].failure_reason).toBe('account_disabled');
    });

    it('rejects state reuse (state is single-use)', async () => {
      const state = randomBytes(32).toString('hex');
      await redis.set(`auth:oauth:google:state:${state}`, '1', 'EX', 600);
      MockGoogleAuthGuard.setProfile({
        googleId: `${TEST_GOOGLE_ID_PREFIX}reuse`,
        email: testOAuthEmail('reuse'),
        emailVerified: true,
      });

      await request(server)
        .get(`/auth/google/callback?code=fake&state=${state}`)
        .expect(302);

      await request(server)
        .get(`/auth/google/callback?code=fake&state=${state}`)
        .expect(401);
    });

    function testOAuthEmail(label: string): string {
      return `${TEST_OAUTH_EMAIL_PREFIX}${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    }
  });

  describe('Additional flows (steps 11-16)', () => {
    it('supports TOTP setup, verification, authenticate, and disable', async () => {
      const email = testEmail('totp');
      const registerRes = await registerUser('E2ETotpUser', email, 'Password1!');
      const accessToken = registerRes.body.accessToken;

      // 1. Setup TOTP
      const setupRes = await post('/auth/totp/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      expect(setupRes.body.qrCodeUrl).toEqual(expect.any(String));
      const secret = setupRes.body.secret;
      expect(secret).toEqual(expect.any(String));
      expect(setupRes.body.backupCodes).toHaveLength(10);
      const backupCodes = setupRes.body.backupCodes;

      // 2. Verify with invalid code
      await post('/auth/totp/verify-setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: '000000' })
        .expect(401);

      // 3. Verify with valid code
      const validCode = generateSync({ secret });
      const verifyRes = await post('/auth/totp/verify-setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: validCode })
        .expect(200);
      expect(verifyRes.body.enabled).toBe(true);

      // 4. Login -> expect requiresTOTP
      const loginRes = await post('/auth/login')
        .send({ usernameOrEmail: email, password: 'Password1!' })
        .expect(200);
      expect(loginRes.body.requiresTOTP).toBe(true);
      const tempToken = loginRes.body.tempToken;
      expect(tempToken).toBeDefined();

      // 5. Authenticate with invalid code
      await post('/auth/totp/authenticate')
        .send({ tempToken, token: '000000' })
        .expect(401);

      // 6. Authenticate with valid code
      const validCode2 = generateSync({ secret });
      const authRes = await post('/auth/totp/authenticate')
        .send({ tempToken, token: validCode2 })
        .expect(200);
      expect(authRes.body.accessToken).toEqual(expect.any(String));
      const refreshCookie = getRefreshCookie(authRes);
      expect(refreshCookie).toContain('bgsc_refresh_token=');

      // 7. Authenticate with backup code
      const loginRes2 = await post('/auth/login')
        .send({ usernameOrEmail: email, password: 'Password1!' })
        .expect(200);
      const tempToken2 = loginRes2.body.tempToken;
      
      const backupAuthRes = await post('/auth/totp/authenticate')
        .send({ tempToken: tempToken2, token: backupCodes[0] })
        .expect(200);
      expect(backupAuthRes.body.accessToken).toEqual(expect.any(String));

      // Check backup code consumption
      const userInDb = await dataSource.query('SELECT totp_backup_codes_hash FROM users WHERE email = $1', [email]);
      expect(userInDb[0].totp_backup_codes_hash.split(',')).toHaveLength(9);

      // 8. Disable TOTP
      const activeAccessToken = backupAuthRes.body.accessToken;
      const disableCode = generateSync({ secret });
      await post('/auth/totp/disable')
        .set('Authorization', `Bearer ${activeAccessToken}`)
        .send({ token: disableCode })
        .expect(200);

      // Check login works directly now
      const loginRes3 = await post('/auth/login')
        .send({ usernameOrEmail: email, password: 'Password1!' })
        .expect(200);
      expect(loginRes3.body.accessToken).toEqual(expect.any(String));
    }, 60_000);

    it('supports session listing and revocation', async () => {
      const email = testEmail('sessions');
      const registerRes = await registerUser('E2ESessionsUser', email, 'Password1!');
      const accessToken = registerRes.body.accessToken;
      const refreshCookie = getRefreshCookie(registerRes);

      // List sessions
      const listRes1 = await request(server)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie)
        .expect(200);
      expect(listRes1.body).toHaveLength(1);
      expect(listRes1.body[0].isCurrent).toBe(true);

      // Mock login on a different device (using different User-Agent)
      const loginRes = await request(server)
        .post('/auth/login')
        .set('User-Agent', 'mock-other-device')
        .send({ usernameOrEmail: email, password: 'Password1!', keepMeLoggedIn: true })
        .expect(200);
      const otherAccessToken = loginRes.body.accessToken;
      const otherRefreshCookie = getRefreshCookie(loginRes);

      // List sessions again
      const listRes2 = await request(server)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .set('Cookie', otherRefreshCookie)
        .expect(200);
      expect(listRes2.body).toHaveLength(2);

      const otherSession = listRes2.body.find((s: any) => !s.isCurrent);
      expect(otherSession).toBeDefined();

      // Revoke the first session
      await request(server)
        .delete(`/auth/sessions/${otherSession.familyId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .set('Cookie', otherRefreshCookie)
        .expect(200);

      // Try to refresh with the revoked session
      await request(server)
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);
    }, 60_000);

    it('supports account lifecycle and RBAC policies', async () => {
      const emailA = testEmail('user-a');
      const emailB = testEmail('user-b');

      const registerResA = await registerUser('E2EUserA', emailA, 'Password1!');
      const tokenA = registerResA.body.accessToken;
      const userIdA = registerResA.body.user.id;

      const registerResB = await registerUser('E2EUserB', emailB, 'Password1!');
      const userIdB = registerResB.body.user.id;

      // Assign coordinator role to B
      await dataSource.query("UPDATE users SET role = 'coordinator' WHERE email = $1", [emailB]);

      // B is coordinator, so B can fetch its role. Let's sign a fresh token for B so that the role claims are updated in the JWT.
      const freshLoginB = await post('/auth/login')
        .send({ usernameOrEmail: emailB, password: 'Password1!' })
        .expect(200);
      const tokenBCoordinator = freshLoginB.body.accessToken;

      // Non-admin trying to enable throws 403 (implicit check because A is not enabled, but let's check enable directly)
      await post(`/account/${userIdA}/enable`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(403);

      // User A self-disables account
      await post('/account/disable')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(200);

      // Try to login as User A -> expect 403 Forbidden
      await post('/auth/login')
        .send({ usernameOrEmail: emailA, password: 'Password1!' })
        .expect(403);

      // Coordinator (User B) enables User A
      await post(`/account/${userIdA}/enable`)
        .set('Authorization', `Bearer ${tokenBCoordinator}`)
        .expect(200);

      // Login as A succeeds again
      const loginResA = await post('/auth/login')
        .send({ usernameOrEmail: emailA, password: 'Password1!' })
        .expect(200);
      const activeTokenA = loginResA.body.accessToken;

      // Coordinator B disables User A
      await post('/account/disable')
        .set('Authorization', `Bearer ${tokenBCoordinator}`)
        .send({ userId: userIdA })
        .expect(200);

      // Login as A fails again
      await post('/auth/login')
        .send({ usernameOrEmail: emailA, password: 'Password1!' })
        .expect(403);

      // Enable A again so we can delete it
      await post(`/account/${userIdA}/enable`)
        .set('Authorization', `Bearer ${tokenBCoordinator}`)
        .expect(200);

      // Login A
      const freshLoginA = await post('/auth/login')
        .send({ usernameOrEmail: emailA, password: 'Password1!' })
        .expect(200);
      const loginTokenA = freshLoginA.body.accessToken;

      // User A schedules deletion
      await post('/account/delete')
        .set('Authorization', `Bearer ${loginTokenA}`)
        .expect(200);

      const dbUserA = await dataSource.query('SELECT status, deletion_scheduled FROM users WHERE id = $1', [userIdA]);
      expect(dbUserA[0].status).toBe(UserStatus.PENDING_DELETION);
      expect(dbUserA[0].deletion_scheduled).toBeInstanceOf(Date);

      // Login pending deletion user -> expect 403 with message and accessToken
      const cancelLoginRes = await post('/auth/login')
        .send({ usernameOrEmail: emailA, password: 'Password1!' })
        .expect(403);
      expect(cancelLoginRes.body.message).toContain('Account is scheduled for deletion');
      const tempCancelToken = cancelLoginRes.body.accessToken;
      expect(tempCancelToken).toBeDefined();

      // Cancel deletion using the returned token
      await post('/account/cancel-deletion')
        .set('Authorization', `Bearer ${tempCancelToken}`)
        .expect(200);

      const dbUserAAfter = await dataSource.query('SELECT status, deletion_scheduled FROM users WHERE id = $1', [userIdA]);
      expect(dbUserAAfter[0].status).toBe(UserStatus.ACTIVE);
      expect(dbUserAAfter[0].deletion_scheduled).toBeNull();
    }, 60_000);

    it('returns 429 Too Many Requests when rate limits are exceeded', async () => {
      const email = testEmail('ratelimit');
      await registerUser('E2ERateLimitUser', email, 'Password1!');

      const limitIp = '10.99.99.99';

      // Send 5 failed logins (allowed limit is 5 per 15 minutes)
      for (let i = 0; i < 5; i++) {
        await request(server)
          .post('/auth/login')
          .set('x-forwarded-for', limitIp)
          .set('user-agent', TEST_USER_AGENT)
          .send({ usernameOrEmail: email, password: 'WrongPassword!' })
          .expect(401);
      }

      // 6th failed login should get 429
      const limitRes = await request(server)
        .post('/auth/login')
        .set('x-forwarded-for', limitIp)
        .set('user-agent', TEST_USER_AGENT)
        .send({ usernameOrEmail: email, password: 'WrongPassword!' })
        .expect(429);
      expect(limitRes.headers['retry-after']).toBeDefined();

      // Clean up rate limit in redis for subsequent runs
      const keys = await redis.keys('auth:rate:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }, 60_000);

    it('verifies the full step-16 lifecycle and scheduled job cleanup', async () => {
      const email = testEmail('full-lifecycle');
      
      // 1. Register
      const regRes = await registerUser('E2ELifecycleUser', email, 'Password1!');
      const userId = regRes.body.user.id;
      let accessToken = regRes.body.accessToken;
      let refreshCookie = getRefreshCookie(regRes);

      // 2. Refresh
      const refRes = await post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);
      accessToken = refRes.body.accessToken;
      refreshCookie = getRefreshCookie(refRes);

      // Verify refresh audit log in DB
      const audits = await dataSource.query(
        'SELECT * FROM login_audit_log WHERE user_id = $1 AND method = $2',
        [userId, 'refresh'],
      );
      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].success).toBe(true);
      expect(audits[0].ip_address).toBeDefined();
      expect(audits[0].user_agent).toBe(TEST_USER_AGENT);

      // 3. Change password
      await post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie)
        .send({ currentPassword: 'Password1!', newPassword: 'NewPassword1!' })
        .expect(200);

      // 4. Logout
      await post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshCookie)
        .expect(200);

      // 5. Login with new password
      const logRes = await post('/auth/login')
        .send({ usernameOrEmail: email, password: 'NewPassword1!' })
        .expect(200);
      accessToken = logRes.body.accessToken;

      // 6. Enable TOTP
      const setupRes = await post('/auth/totp/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      const secret = setupRes.body.secret;
      const setupCode = generateSync({ secret });
      await post('/auth/totp/verify-setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: setupCode })
        .expect(200);

      // 7. Login with TOTP
      const totpLogRes = await post('/auth/login')
        .send({ usernameOrEmail: email, password: 'NewPassword1!' })
        .expect(200);
      const tempToken = totpLogRes.body.tempToken;
      const authCode = generateSync({ secret });
      const totpAuthRes = await post('/auth/totp/authenticate')
        .send({ tempToken, token: authCode })
        .expect(200);
      accessToken = totpAuthRes.body.accessToken;

      // 8. Disable TOTP
      const disableCode = generateSync({ secret });
      await post('/auth/totp/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: disableCode })
        .expect(200);

      // 9. Forgot password and reset
      await post('/auth/forgot-password')
        .send({ email })
        .expect(200);
      const resetToken = resetTokensByEmail.get(email);
      expect(resetToken).toBeDefined();
      await post('/auth/reset-password')
        .send({ token: resetToken!, newPassword: 'ResetPassword1!' })
        .expect(200);

      // 10. Login after reset
      const resetLoginRes = await post('/auth/login')
        .send({ usernameOrEmail: email, password: 'ResetPassword1!' })
        .expect(200);
      accessToken = resetLoginRes.body.accessToken;

      // 11. Delete account (sets pending_deletion)
      await post('/account/delete')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 12. Simulate 31 days elapsed
      await dataSource.query("UPDATE users SET deletion_scheduled = NOW() - INTERVAL '31 days' WHERE id = $1", [userId]);

      // 13. Run deletion job manually using AccountService
      const AccountServiceModule = app.get(AccountService);
      const purgedCount = await AccountServiceModule.purgeScheduledDeletions(new Date());
      expect(purgedCount).toBe(1);

      // 14. Verify user is completely removed from DB
      const userCheck = await dataSource.query('SELECT * FROM users WHERE id = $1', [userId]);
      expect(userCheck).toHaveLength(0);
    }, 90_000);
  });

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
      'SELECT id FROM users WHERE email LIKE $1 OR email LIKE $2 OR google_id LIKE $3',
      [
        `${TEST_EMAIL_PREFIX}%@example.com`,
        `${TEST_OAUTH_EMAIL_PREFIX}%@example.com`,
        `${TEST_GOOGLE_ID_PREFIX}%`,
      ],
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

    await dataSource.query(
      'DELETE FROM users WHERE email LIKE $1 OR email LIKE $2 OR google_id LIKE $3',
      [
        `${TEST_EMAIL_PREFIX}%@example.com`,
        `${TEST_OAUTH_EMAIL_PREFIX}%@example.com`,
        `${TEST_GOOGLE_ID_PREFIX}%`,
      ],
    );

    const stateKeys = await redis.keys('auth:oauth:google:state:*');
    if (stateKeys.length > 0) {
      await redis.del(...stateKeys);
    }

    const rateKeys = await redis.keys('auth:rate:*');
    if (rateKeys.length > 0) {
      await redis.del(...rateKeys);
    }
  }
});
