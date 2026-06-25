process.env.PORT = '3004';
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
import { UserRole } from '../src/events/enums/user-role.enum';
import { EventStatus } from '../src/events/enums/event-status.enum';
import { EventType } from '../src/events/enums/event-type.enum';

const TEST_EVENT_PREFIX = 'e2e-event-';
const CURRENT_YEAR = new Date().getUTCFullYear();
const FUTURE_START = `${CURRENT_YEAR + 1}-09-01T10:00:00.000Z`;
const FUTURE_END = `${CURRENT_YEAR + 1}-09-01T18:00:00.000Z`;
const FUTURE_DEADLINE = `${CURRENT_YEAR + 1}-08-25T23:59:59.000Z`;
const _PAST_START = `${CURRENT_YEAR - 1}-09-01T10:00:00.000Z`;
const _PAST_END = `${CURRENT_YEAR - 1}-09-01T18:00:00.000Z`;
const PAST_DEADLINE = `${CURRENT_YEAR - 1}-08-01T23:59:59.000Z`;

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

describe('EventService e2e', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: JwtService;

  const founder: TestUser = {
    id: 'b1c2d3e4-f5a6-4789-abcd-ef1234567801',
    username: 'e2e_founder',
    email: 'founder@e2e.test',
    role: UserRole.FOUNDER,
  };

  const coordinator: TestUser = {
    id: 'b1c2d3e4-f5a6-4789-abcd-ef1234567802',
    username: 'e2e_coordinator',
    email: 'coordinator@e2e.test',
    role: UserRole.COORDINATOR,
  };

  const regularUser: TestUser = {
    id: 'b1c2d3e4-f5a6-4789-abcd-ef1234567803',
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

  describe('POST /events', () => {
    it('rejects unauthenticated callers with 401', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send(validCreatePayload())
        .expect(401);
    });

    it('rejects regular users with 403', async () => {
      const token = signToken(jwt, regularUser);
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreatePayload())
        .expect(403);
    });

    it('allows founder to create an event', async () => {
      const token = signToken(jwt, founder);
      const payload = validCreatePayload(`${TEST_EVENT_PREFIX}founder-created`);

      const res = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${token}`)
        .send(payload)
        .expect(201);

      expect(res.body.title).toBe(payload.title);
      expect(res.body.status).toBe(EventStatus.UPCOMING);
      expect(res.body.type).toBe(EventType.LE);
      expect(res.body.createdBy).toBe(founder.id);
    });

    it('allows coordinator to create an event', async () => {
      const token = signToken(jwt, coordinator);
      const res = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${token}`)
        .send(validCreatePayload(`${TEST_EVENT_PREFIX}coord-created`))
        .expect(201);

      expect(res.body.title).toContain(TEST_EVENT_PREFIX);
    });

    it('rejects invalid payload with 400', async () => {
      const token = signToken(jwt, founder);
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Missing dates' })
        .expect(400);
    });
  });

  describe('GET /events', () => {
    it('returns all events without filter', async () => {
      await insertEvent({ title: `${TEST_EVENT_PREFIX}upcoming-a`, status: EventStatus.UPCOMING });
      await insertEvent({ title: `${TEST_EVENT_PREFIX}past-a`, status: EventStatus.PAST });

      const res = await request(app.getHttpServer()).get('/events').expect(200);

      const titles = res.body.map((e: any) => e.title);
      expect(titles).toContain(`${TEST_EVENT_PREFIX}upcoming-a`);
      expect(titles).toContain(`${TEST_EVENT_PREFIX}past-a`);
    });

    it('filters by status=upcoming', async () => {
      const res = await request(app.getHttpServer())
        .get('/events?status=upcoming')
        .expect(200);

      expect(res.body.every((e: any) => e.status === EventStatus.UPCOMING)).toBe(true);
    });

    it('filters by status=past', async () => {
      const res = await request(app.getHttpServer())
        .get('/events?status=past')
        .expect(200);

      expect(res.body.every((e: any) => e.status === EventStatus.PAST)).toBe(true);
    });
  });

  describe('GET /events/:id', () => {
    it('returns event by id', async () => {
      const id = await insertEvent({ title: `${TEST_EVENT_PREFIX}get-by-id` });

      const res = await request(app.getHttpServer())
        .get(`/events/${id}`)
        .expect(200);

      expect(res.body.id).toBe(id);
      expect(res.body.title).toBe(`${TEST_EVENT_PREFIX}get-by-id`);
    });

    it('returns 404 for missing event', async () => {
      await request(app.getHttpServer())
        .get(`/events/${randomUUID()}`)
        .expect(404);
    });
  });

  describe('POST /events/:id/register', () => {
    it('rejects unauthenticated callers with 401', async () => {
      const id = await insertEvent({ title: `${TEST_EVENT_PREFIX}reg-unauth` });
      await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .expect(401);
    });

    it('registers a user for an open event', async () => {
      const id = await insertEvent({ title: `${TEST_EVENT_PREFIX}reg-open` });
      const token = signToken(jwt, regularUser);

      const res = await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.eventId).toBe(id);
      expect(res.body.userId).toBe(regularUser.id);
    });

    it('rejects duplicate registration with 409', async () => {
      const id = await insertEvent({ title: `${TEST_EVENT_PREFIX}reg-dup` });
      const token = signToken(jwt, coordinator);

      await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('rejects registration after deadline with 400', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}reg-deadline`,
        registrationDeadline: PAST_DEADLINE,
      });
      const token = signToken(jwt, regularUser);

      await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('rejects when event is at full capacity', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}reg-capacity`,
        maxParticipants: 1,
      });
      const founderToken = signToken(jwt, founder);
      const coordToken = signToken(jwt, coordinator);

      await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .set('Authorization', `Bearer ${founderToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/events/${id}/register`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(400);
    });
  });

  describe('POST /events/:id/scores + GET /events/:id/leaderboard', () => {
    it('admin submits scores; leaderboard ranks highest first', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}scores-le`,
        type: EventType.LE,
      });
      await insertRegistration(id, regularUser.id);
      await insertRegistration(id, coordinator.id);
      const token = signToken(jwt, founder);

      await request(app.getHttpServer())
        .post(`/events/${id}/scores`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          scores: [
            { userId: regularUser.id, score: 80 },
            { userId: coordinator.id, score: 100 },
          ],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/events/${id}/leaderboard`)
        .expect(200);

      expect(res.body[0].rank).toBe(1);
      expect(res.body[0].score).toBe(100);
      expect(res.body[1].rank).toBe(2);
      expect(res.body[1].score).toBe(80);
    });

    it('rejects score submission for non-LE events with 400', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}scores-de`,
        type: EventType.DE,
      });
      const token = signToken(jwt, founder);

      await request(app.getHttpServer())
        .post(`/events/${id}/scores`)
        .set('Authorization', `Bearer ${token}`)
        .send({ scores: [{ userId: regularUser.id, score: 50 }] })
        .expect(400);
    });

    it('replaces existing scores on re-submission', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}scores-replace`,
        type: EventType.LE,
      });
      await insertRegistration(id, regularUser.id);
      await insertRegistration(id, coordinator.id);
      const token = signToken(jwt, founder);

      await request(app.getHttpServer())
        .post(`/events/${id}/scores`)
        .set('Authorization', `Bearer ${token}`)
        .send({ scores: [{ userId: regularUser.id, score: 50 }] })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/events/${id}/scores`)
        .set('Authorization', `Bearer ${token}`)
        .send({ scores: [{ userId: coordinator.id, score: 99 }] })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/events/${id}/leaderboard`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].userId).toBe(coordinator.id);
    });

    it('rejects score submission by regular user with 403', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}scores-auth`,
        type: EventType.LE,
      });
      const token = signToken(jwt, regularUser);

      await request(app.getHttpServer())
        .post(`/events/${id}/scores`)
        .set('Authorization', `Bearer ${token}`)
        .send({ scores: [{ userId: regularUser.id, score: 10 }] })
        .expect(403);
    });
  });

  describe('PATCH /events/:id/complete', () => {
    it('marks event as past and returns updated event', async () => {
      const id = await insertEvent({ title: `${TEST_EVENT_PREFIX}complete-ok` });
      const token = signToken(jwt, founder);

      const res = await request(app.getHttpServer())
        .patch(`/events/${id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          winners: [
            { userId: regularUser.id, sponsorId: randomUUID(), fanAmount: 10 },
          ],
        })
        .expect(200);

      expect(res.body.status).toBe(EventStatus.PAST);
    });

    it('rejects completing an already-past event with 403', async () => {
      const id = await insertEvent({
        title: `${TEST_EVENT_PREFIX}complete-past`,
        status: EventStatus.PAST,
      });
      const token = signToken(jwt, founder);

      await request(app.getHttpServer())
        .patch(`/events/${id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ winners: [{ userId: regularUser.id, sponsorId: randomUUID(), fanAmount: 5 }] })
        .expect(409);
      await request(app.getHttpServer())
        .patch(`/events/${id}/complete`)
        .send({ winners: [] })
        .expect(401);
    });
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function validCreatePayload(title = `${TEST_EVENT_PREFIX}default`) {
    return {
      title,
      type: EventType.LE,
      startDate: FUTURE_START,
      endDate: FUTURE_END,
      registrationDeadline: FUTURE_DEADLINE,
      needsLeaderboard: true,
    };
  }

  async function insertRegistration(eventId: string, userId: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO registrations (id, event_id, user_id, status)
       VALUES ($1, $2, $3, 'confirmed')
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [randomUUID(), eventId, userId],
    );
  }

  async function insertEvent(overrides: Record<string, unknown> = {}): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO events
         (id, title, type, status, start_date, end_date, registration_deadline, needs_leaderboard, max_participants, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        overrides.title ?? `${TEST_EVENT_PREFIX}${Date.now()}`,
        overrides.type ?? EventType.LE,
        overrides.status ?? EventStatus.UPCOMING,
        overrides.startDate ?? FUTURE_START,
        overrides.endDate ?? FUTURE_END,
        overrides.registrationDeadline ?? FUTURE_DEADLINE,
        false,
        overrides.maxParticipants ?? null,
        '{}',
        founder.id,
      ],
    );
    return id;
  }

  async function cleanup(): Promise<void> {
    await dataSource.query(
      `DELETE FROM event_scores WHERE event_id IN (SELECT id FROM events WHERE title LIKE $1)`,
      [`${TEST_EVENT_PREFIX}%`],
    );
    await dataSource.query(
      `DELETE FROM registrations WHERE event_id IN (SELECT id FROM events WHERE title LIKE $1)`,
      [`${TEST_EVENT_PREFIX}%`],
    );
    await dataSource.query(`DELETE FROM events WHERE title LIKE $1`, [
      `${TEST_EVENT_PREFIX}%`,
    ]);
  }
});
