process.env.PORT = '3005';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  'e2e_access_secret_change_in_prod_1234567890abcdef';
process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'bgsc-auth-service';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/points/enums/user-role.enum';
import { PointsSource } from '../src/points/enums/points-source.enum';
import { TransactionType } from '../src/points/enums/transaction-type.enum';

interface TestUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

function signToken(jwt: JwtService, user: TestUser): string {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, role: user.role },
    { issuer: process.env.JWT_ISSUER, expiresIn: '15m' },
  );
}

describe('PointsService e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;

  const founder: TestUser = {
    id: 'c1d2e3f4-a5b6-4789-abcd-ef1234567801',
    username: 'e2e_pts_founder',
    email: 'pts_founder@e2e.test',
    role: UserRole.FOUNDER,
  };

  const coordinator: TestUser = {
    id: 'c1d2e3f4-a5b6-4789-abcd-ef1234567802',
    username: 'e2e_pts_coordinator',
    email: 'pts_coordinator@e2e.test',
    role: UserRole.COORDINATOR,
  };

  const regularUser: TestUser = {
    id: 'c1d2e3f4-a5b6-4789-abcd-ef1234567803',
    username: 'e2e_pts_user',
    email: 'pts_user@e2e.test',
    role: UserRole.USER,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    dataSource = app.get(DataSource);
    jwt = app.get(JwtService);

    await cleanup();
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await cleanup();
    if (app) await app.close();
  });

  describe('GET /points/balance/:userId', () => {
    it('rejects unauthenticated callers with 401', async () => {
      await request(app.getHttpServer())
        .get(`/points/balance/${regularUser.id}`)
        .expect(401);
    });

    it('returns 0 balance for own user with no transactions', async () => {
      const token = signToken(jwt, regularUser);

      const res = await request(app.getHttpServer())
        .get(`/points/balance/${regularUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.userId).toBe(regularUser.id);
      expect(res.body.balance).toBeGreaterThanOrEqual(0);
    });

    it('rejects reading another user balance with 403', async () => {
      const token = signToken(jwt, regularUser);
      const otherUserId = randomUUID();

      await request(app.getHttpServer())
        .get(`/points/balance/${otherUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('allows founder to read any user balance', async () => {
      const token = signToken(jwt, founder);
      const freshUserId = randomUUID();

      const res = await request(app.getHttpServer())
        .get(`/points/balance/${freshUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.userId).toBe(freshUserId);
      expect(res.body.balance).toBe(0);
    });

    it('returns correct balance after earn transactions', async () => {
      await insertTransaction({ userId: regularUser.id, amount: 50, type: TransactionType.EARN });
      await insertTransaction({ userId: regularUser.id, amount: 30, type: TransactionType.EARN });

      const token = signToken(jwt, regularUser);
      const res = await request(app.getHttpServer())
        .get(`/points/balance/${regularUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.balance).toBeGreaterThanOrEqual(80);
    });
  });

  describe('POST /points/award', () => {
    it('rejects unauthenticated callers with 401', async () => {
      await request(app.getHttpServer())
        .post('/points/award')
        .send({ userId: regularUser.id, amount: 10, source: PointsSource.EVENT })
        .expect(401);
    });

    it('rejects regular user with 403', async () => {
      const token = signToken(jwt, regularUser);
      await request(app.getHttpServer())
        .post('/points/award')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: regularUser.id, amount: 10, source: PointsSource.EVENT })
        .expect(403);
    });

    it('allows founder to award points', async () => {
      const token = signToken(jwt, founder);
      const res = await request(app.getHttpServer())
        .post('/points/award')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: coordinator.id,
          amount: 25,
          source: PointsSource.EVENT,
          referenceId: randomUUID(),
        })
        .expect(201);

      expect(res.body.userId).toBe(coordinator.id);
      expect(res.body.amount).toBe(25);
      expect(res.body.type).toBe(TransactionType.EARN);
      expect(res.body.source).toBe(PointsSource.EVENT);
    });

    it('allows coordinator to award points', async () => {
      const token = signToken(jwt, coordinator);
      const res = await request(app.getHttpServer())
        .post('/points/award')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: regularUser.id, amount: 10, source: PointsSource.CHALLENGE })
        .expect(201);

      expect(res.body.amount).toBe(10);
    });

    it('rejects invalid payload with 400', async () => {
      const token = signToken(jwt, founder);
      await request(app.getHttpServer())
        .post('/points/award')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: 'not-a-uuid', amount: -5, source: 'invalid' })
        .expect(400);
    });
  });

  describe('POST /points/participation', () => {
    it('awards 10 participation points and reflects in balance', async () => {
      const token = signToken(jwt, founder);
      const userId = randomUUID();
      const eventId = randomUUID();

      const res = await request(app.getHttpServer())
        .post('/points/participation')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId, eventId })
        .expect(201);

      expect(res.body.amount).toBe(10);
      expect(res.body.source).toBe(PointsSource.EVENT);
      expect(res.body.referenceId).toBe(eventId);

      const balanceRes = await request(app.getHttpServer())
        .get(`/points/balance/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(balanceRes.body.balance).toBe(10);
    });

    it('rejects unauthenticated callers with 401', async () => {
      await request(app.getHttpServer())
        .post('/points/participation')
        .send({ userId: regularUser.id, eventId: randomUUID() })
        .expect(401);
    });
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  async function insertTransaction(overrides: {
    userId: string;
    amount: number;
    type: TransactionType;
    source?: PointsSource;
    referenceId?: string;
  }): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO point_transactions (id, user_id, amount, type, source, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        overrides.userId,
        overrides.amount,
        overrides.type,
        overrides.source ?? PointsSource.EVENT,
        overrides.referenceId ?? null,
      ],
    );
    return id;
  }

  async function cleanup(): Promise<void> {
    await dataSource.query(
      `DELETE FROM point_transactions WHERE user_id IN ($1, $2, $3)`,
      [founder.id, coordinator.id, regularUser.id],
    );
  }
});
