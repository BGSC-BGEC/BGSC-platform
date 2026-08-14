process.env.PORT = '3003';
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
import { UserRole } from '../src/sponsors/enums/user-role.enum';
import { SponsorStatus } from '../src/sponsors/enums/sponsor-status.enum';

const TEST_SPONSOR_PREFIX = 'e2e-sponsor-';
const CURRENT_YEAR = new Date().getUTCFullYear();
const ACTIVE_TENURE_START = `${CURRENT_YEAR - 1}-01-01`;
const ACTIVE_TENURE_END = `${CURRENT_YEAR + 1}-12-31`;
const FUTURE_TENURE_START = `${CURRENT_YEAR + 10}-01-01`;
const FUTURE_TENURE_END = `${CURRENT_YEAR + 10}-12-31`;
const EXPIRED_TENURE_START = `${CURRENT_YEAR - 10}-01-01`;
const EXPIRED_TENURE_END = `${CURRENT_YEAR - 10}-12-31`;

interface TestUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

function signToken(jwt: JwtService, user: TestUser): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    {
      issuer: process.env.JWT_ISSUER,
      expiresIn: '15m',
    },
  );
}

describe('SponsorService e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;

  const founder: TestUser = {
    id: 'a1b2c3d4-e5f6-4789-abcd-ef1234567801',
    username: 'e2e_founder',
    email: 'founder@e2e.test',
    role: UserRole.FOUNDER,
  };

  const coordinator: TestUser = {
    id: 'a1b2c3d4-e5f6-4789-abcd-ef1234567802',
    username: 'e2e_coordinator',
    email: 'coordinator@e2e.test',
    role: UserRole.COORDINATOR,
  };

  const regularUser: TestUser = {
    id: 'a1b2c3d4-e5f6-4789-abcd-ef1234567803',
    username: 'e2e_user',
    email: 'user@e2e.test',
    role: UserRole.USER,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
    jwt = app.get(JwtService);

    await cleanupTestSponsors();
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanupTestSponsors();
    }
    if (app) {
      await app.close();
    }
  });

  describe('GET /sponsors/active', () => {
    it('returns only active sponsors within tenure dates', async () => {
      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}active`,
        tenureStart: ACTIVE_TENURE_START,
        tenureEnd: ACTIVE_TENURE_END,
        status: SponsorStatus.ACTIVE,
      });

      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}inactive`,
        tenureStart: ACTIVE_TENURE_START,
        tenureEnd: ACTIVE_TENURE_END,
        status: SponsorStatus.INACTIVE,
      });

      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}future`,
        tenureStart: FUTURE_TENURE_START,
        tenureEnd: FUTURE_TENURE_END,
        status: SponsorStatus.ACTIVE,
      });

      const res = await request(app.getHttpServer())
        .get('/sponsors/active')
        .expect(200);

      const names = res.body.map((s: any) => s.name);
      expect(names).toContain(`${TEST_SPONSOR_PREFIX}active`);
      expect(names).not.toContain(`${TEST_SPONSOR_PREFIX}inactive`);
      expect(names).not.toContain(`${TEST_SPONSOR_PREFIX}future`);
    });
  });

  describe('GET /sponsors', () => {
    it('filters by status', async () => {
      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}filter-active`,
        tenureStart: ACTIVE_TENURE_START,
        status: SponsorStatus.ACTIVE,
      });
      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}filter-inactive`,
        tenureStart: ACTIVE_TENURE_START,
        status: SponsorStatus.INACTIVE,
      });

      const resActive = await request(app.getHttpServer())
        .get('/sponsors?status=active')
        .expect(200);
      expect(
        resActive.body.every((s: any) => s.status === SponsorStatus.ACTIVE),
      ).toBe(true);

      const resInactive = await request(app.getHttpServer())
        .get('/sponsors?status=inactive')
        .expect(200);
      expect(
        resInactive.body.every((s: any) => s.status === SponsorStatus.INACTIVE),
      ).toBe(true);
    });
  });

  describe('POST /sponsors', () => {
    it('rejects unauthenticated callers with 401', async () => {
      await request(app.getHttpServer())
        .post('/sponsors')
        .send({ name: 'Unauth', tenureStart: ACTIVE_TENURE_START })
        .expect(401);
    });

    it('rejects non-coordinator/non-founder users with 403', async () => {
      const token = signToken(jwt, regularUser);
      await request(app.getHttpServer())
        .post('/sponsors')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'UserCreated', tenureStart: ACTIVE_TENURE_START })
        .expect(403);
    });

    it('allows founder to create a sponsor', async () => {
      const token = signToken(jwt, founder);
      const res = await request(app.getHttpServer())
        .post('/sponsors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `${TEST_SPONSOR_PREFIX}founder-created`,
          tenureStart: ACTIVE_TENURE_START,
        })
        .expect(201);

      expect(res.body.name).toBe(`${TEST_SPONSOR_PREFIX}founder-created`);
      expect(res.body.status).toBe(SponsorStatus.ACTIVE);
    });

    it('allows coordinator to create a sponsor', async () => {
      const token = signToken(jwt, coordinator);
      const res = await request(app.getHttpServer())
        .post('/sponsors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `${TEST_SPONSOR_PREFIX}coord-created`,
          tenureStart: ACTIVE_TENURE_START,
        })
        .expect(201);

      expect(res.body.name).toBe(`${TEST_SPONSOR_PREFIX}coord-created`);
    });
  });

  describe('PATCH /sponsors/:id', () => {
    it('updates allowed fields', async () => {
      const id = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}before-update`,
        tenureStart: ACTIVE_TENURE_START,
      });

      const token = signToken(jwt, founder);
      const res = await request(app.getHttpServer())
        .patch(`/sponsors/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `${TEST_SPONSOR_PREFIX}after-update`,
          description: 'Updated description',
        })
        .expect(200);

      expect(res.body.name).toBe(`${TEST_SPONSOR_PREFIX}after-update`);
      expect(res.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /sponsors/:id', () => {
    it('soft-removes by setting inactive and tenureEnd', async () => {
      const id = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}to-delete`,
        tenureStart: ACTIVE_TENURE_START,
      });

      const token = signToken(jwt, founder);
      const res = await request(app.getHttpServer())
        .delete(`/sponsors/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe(SponsorStatus.INACTIVE);
      expect(res.body.tenureEnd).toBeTruthy();
    });
  });

  describe('POST /sponsors/:id/fans', () => {
    it('awards fans to an affiliated user', async () => {
      const sponsorId = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}fans-test`,
        tenureStart: ACTIVE_TENURE_START,
      });

      await insertAffiliation(regularUser.id, sponsorId);

      const token = signToken(jwt, founder);
      const res = await request(app.getHttpServer())
        .post(`/sponsors/${sponsorId}/fans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: regularUser.id,
          eventId: 'event-uuid',
          amount: 10,
          reason: 'event_win',
        })
        .expect(201);

      expect(res.body.totalFans).toBe(10);
    });

    it('rejects award for inactive sponsor', async () => {
      const sponsorId = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}fans-inactive`,
        tenureStart: ACTIVE_TENURE_START,
        status: SponsorStatus.INACTIVE,
      });

      const token = signToken(jwt, founder);
      await request(app.getHttpServer())
        .post(`/sponsors/${sponsorId}/fans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: regularUser.id,
          eventId: 'event-uuid',
          amount: 5,
          reason: 'event_win',
        })
        .expect(400);
    });

    it('rejects award for non-affiliated user', async () => {
      const sponsorId = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}fans-no-affil`,
        tenureStart: ACTIVE_TENURE_START,
      });

      const token = signToken(jwt, founder);
      await request(app.getHttpServer())
        .post(`/sponsors/${sponsorId}/fans`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: regularUser.id,
          eventId: 'event-uuid',
          amount: 5,
          reason: 'event_win',
        })
        .expect(400);
    });
  });

  describe('GET /sponsors/leaderboard', () => {
    it('returns active sponsors ranked by fan count (default)', async () => {
      const idA = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-alpha`,
        tenureStart: ACTIVE_TENURE_START,
        totalFans: 50,
      });
      const idB = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-beta`,
        tenureStart: ACTIVE_TENURE_START,
        totalFans: 100,
      });

      await insertAffiliation(regularUser.id, idA);
      await insertAffiliation(founder.id, idB);

      const res = await request(app.getHttpServer())
        .get('/sponsors/leaderboard')
        .expect(200);

      const ourSponsors = res.body.filter((s: any) =>
        s.name.startsWith(`${TEST_SPONSOR_PREFIX}lb-`),
      );
      expect(ourSponsors).toHaveLength(2);
      expect(ourSponsors[0].name).toBe(`${TEST_SPONSOR_PREFIX}lb-beta`);
      expect(ourSponsors[0].rank).toBeLessThan(ourSponsors[1].rank);
      expect(ourSponsors[1].name).toBe(`${TEST_SPONSOR_PREFIX}lb-alpha`);
    });

    it('excludes sponsors outside the active tenure window', async () => {
      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-future`,
        tenureStart: FUTURE_TENURE_START,
        tenureEnd: FUTURE_TENURE_END,
        totalFans: 999,
      });

      await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-expired`,
        tenureStart: EXPIRED_TENURE_START,
        tenureEnd: EXPIRED_TENURE_END,
        totalFans: 999,
      });

      const res = await request(app.getHttpServer())
        .get('/sponsors/leaderboard')
        .expect(200);

      const names = res.body.map((s: any) => s.name);
      expect(names).not.toContain(`${TEST_SPONSOR_PREFIX}lb-future`);
      expect(names).not.toContain(`${TEST_SPONSOR_PREFIX}lb-expired`);
    });

    it('sorts by events when sort=events', async () => {
      const idA = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-events-a`,
        tenureStart: ACTIVE_TENURE_START,
      });
      const idB = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-events-b`,
        tenureStart: ACTIVE_TENURE_START,
      });

      await insertAffiliation(regularUser.id, idA, ['ev1', 'ev2', 'ev3']);
      await insertAffiliation(founder.id, idB, ['ev4']);

      const res = await request(app.getHttpServer())
        .get('/sponsors/leaderboard?sort=events')
        .expect(200);

      const ourSponsors = res.body.filter((s: any) =>
        s.name.startsWith(`${TEST_SPONSOR_PREFIX}lb-events-`),
      );
      expect(ourSponsors).toHaveLength(2);
      expect(ourSponsors[0].name).toBe(`${TEST_SPONSOR_PREFIX}lb-events-a`);
      expect(ourSponsors[0].eventsWonCount).toBe(3);
    });

    it('sorts by users when sort=users', async () => {
      const idA = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-users-a`,
        tenureStart: ACTIVE_TENURE_START,
      });
      const idB = await insertSponsor({
        name: `${TEST_SPONSOR_PREFIX}lb-users-b`,
        tenureStart: ACTIVE_TENURE_START,
      });

      await insertAffiliation(regularUser.id, idA);
      await insertAffiliation(founder.id, idA);
      await insertAffiliation(coordinator.id, idB);

      const res = await request(app.getHttpServer())
        .get('/sponsors/leaderboard?sort=users')
        .expect(200);

      const ourSponsors = res.body.filter((s: any) =>
        s.name.startsWith(`${TEST_SPONSOR_PREFIX}lb-users-`),
      );
      expect(ourSponsors).toHaveLength(2);
      expect(ourSponsors[0].name).toBe(`${TEST_SPONSOR_PREFIX}lb-users-a`);
      expect(ourSponsors[0].affiliatedUserCount).toBe(2);
    });
  });

  async function insertSponsor(
    overrides: Record<string, unknown>,
  ): Promise<string> {
    const id = (overrides.id as string) || randomUUID();
    const name = overrides.name || `${TEST_SPONSOR_PREFIX}${Date.now()}`;
    const tenureStart = overrides.tenureStart || ACTIVE_TENURE_START;
    const tenureEnd = overrides.tenureEnd ?? null;
    const status = overrides.status || SponsorStatus.ACTIVE;
    const totalFans = (overrides.totalFans as number) ?? 0;

    await dataSource.query(
      `INSERT INTO sponsors (id, name, tenure_start, tenure_end, status, total_fans)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, tenureStart, tenureEnd, status, totalFans],
    );
    return id;
  }

  async function insertAffiliation(
    userId: string,
    sponsorId: string,
    eventsWon: string[] = [],
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO user_sponsor_affiliations (user_id, sponsor_id, events_won)
       VALUES ($1, $2, $3)`,
      [userId, sponsorId, eventsWon],
    );
  }

  async function cleanupTestSponsors(): Promise<void> {
    await dataSource.query(
      `DELETE FROM user_sponsor_affiliations
       WHERE sponsor_id IN (
         SELECT id FROM sponsors WHERE name LIKE $1
       )`,
      [`${TEST_SPONSOR_PREFIX}%`],
    );
    await dataSource.query(`DELETE FROM sponsors WHERE name LIKE $1`, [
      `${TEST_SPONSOR_PREFIX}%`,
    ]);
    await dataSource.query(
      `DELETE FROM user_sponsor_affiliations WHERE user_id IN ($1, $2, $3)`,
      [founder.id, coordinator.id, regularUser.id],
    );
  }
});
