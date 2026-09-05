# Event Service — Implementation Reference

**Milestone:** 1.2 – Events & Registration  
**Phase:** 1 (Backend MVP)  
**Status:** Implemented, tested, and manually verified  
**Port:** 3004

---

## Overview

The Event Service owns the full event lifecycle: creation, registration, leaderboard management, and completion. It is a standalone NestJS microservice under `backend/apps/event-service/` and is exposed through the API Gateway at `/events/**`.

Current implementation covers all Milestone 1.2 tasks:

- `POST /events` — admin event creation (coordinator+)
- `GET /events` with status filter (upcoming / ongoing / past)
- `GET /events/:id` — event detail
- `POST /events/:id/register` — solo registration with deadline and capacity enforcement
- `POST /events/:id/scores` — admin score entry for LE events (participant-validated, transactional)
- `GET /events/:id/leaderboard` — ranked score list
- `PATCH /events/:id/complete` — mark event as past, emit `EventCompleted` domain event
- TypeORM migrations for `events`, `registrations`, and `event_scores` tables
- In-memory `EventBusService` stub emitting `RegistrationCreated` and `EventCompleted` events

---

## File Map

```text
backend/apps/event-service/
├── Dockerfile
├── tsconfig.app.json
├── src/
│   ├── main.ts                          — Bootstrap; binds port, sets ValidationPipe, mounts Swagger at /events/docs
│   ├── app.module.ts                    — Root module: ConfigModule + TypeORM + AuthModule + EventsModule
│   ├── config/
│   │   ├── event.config.ts              — Joi-validated config namespace (port, db, jwt)
│   │   └── event.config.spec.ts         — Config validation unit tests
│   ├── auth/
│   │   ├── auth.module.ts               — PassportModule + JwtModule wiring
│   │   ├── jwt-auth.guard.ts            — AuthGuard('jwt') — throws 401 on missing/invalid token
│   │   └── jwt.strategy.ts              — Validates Bearer token; maps sub → id, role → UserRole
│   ├── rbac/
│   │   ├── roles.decorator.ts           — @Roles(...) decorator
│   │   └── roles.guard.ts               — Reads request.user.role; throws 403 on insufficient role
│   ├── migrations/
│   │   └── 1764000000000-CreateEvents.ts — Creates events, registrations, event_scores tables + indexes
│   └── events/
│       ├── events.controller.ts         — HTTP handlers
│       ├── events.module.ts             — TypeORM entities, EventsService, RolesGuard, EventBusService
│       ├── events.service.ts            — Business logic
│       ├── event-bus.service.ts         — In-memory event emitter (Kafka stub)
│       ├── domain-events/
│       │   ├── event-completed.event.ts
│       │   └── registration-created.event.ts
│       ├── dto/
│       │   ├── create-event.dto.ts      — Includes cross-field date ordering validation
│       │   ├── complete-event.dto.ts    — WinnerEntryDto[] with userId, sponsorId, fanAmount
│       │   ├── event-response.dto.ts
│       │   ├── leaderboard-entry.dto.ts
│       │   ├── list-events-query.dto.ts
│       │   ├── register-event.dto.ts
│       │   ├── registration-response.dto.ts
│       │   └── submit-scores.dto.ts     — ScoreEntryDto[] with userId (UUID) + score (int >= 0)
│       ├── entities/
│       │   ├── event.entity.ts
│       │   ├── event-score.entity.ts
│       │   └── registration.entity.ts
│       └── enums/
│           ├── event-status.enum.ts     — upcoming | ongoing | past
│           ├── event-type.enum.ts       — LE | DE | ALL | DLL
│           ├── registration-status.enum.ts
│           └── user-role.enum.ts
└── test/
    ├── events.service.spec.ts           — 23 unit tests
    ├── events.e2e-spec.ts               — 21 e2e tests (requires PostgreSQL)
    └── jest-e2e.json
```

---

## Runtime Configuration

The service uses `ConfigModule` with Joi validation from `event.config.ts`.

| Variable | Required | Default | Notes |
|---|---:|---|---|
| `PORT` | No | `3004` | Event service listen port |
| `NODE_ENV` | No | `development` | Allowed: `development`, `production`, `test` |
| `DATABASE_URL` | Yes | none | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | none | Must match Auth Service and API Gateway |
| `JWT_ISSUER` | Yes | none | Must match Auth Service token issuer |

Config is namespaced as `event.*` and accessed via `ConfigService.get('event.jwt.accessSecret')`, etc.

---

## Database Schema

The service auto-runs migrations on startup (`migrationsRun: true`, `synchronize: false`). All three tables are created in migration `1764000000000-CreateEvents`.

### `events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `uuid_generate_v4()` |
| `title` | `varchar(200)` | Required |
| `description` | `text` | Optional |
| `type` | `varchar(10)` | `LE`, `DE`, `ALL`, `DLL` |
| `status` | `varchar(20)` | Defaults to `upcoming` |
| `start_date` | `timestamptz` | Required |
| `end_date` | `timestamptz` | Required |
| `registration_deadline` | `timestamptz` | Required; must be before `start_date` |
| `venue` | `varchar(200)` | Optional |
| `rules_pdf_url` | `text` | Optional |
| `max_participants` | `integer` | Optional — `null` means unlimited |
| `needs_leaderboard` | `boolean` | Defaults to `false` |
| `tags` | `text[]` | Defaults to `{}` |
| `created_by` | `uuid` | External reference to the creating user |
| `created_at` | `timestamptz` | Auto |
| `updated_at` | `timestamptz` | Auto |

### `registrations`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `event_id` | `uuid` | FK → `events.id` ON DELETE CASCADE |
| `user_id` | `uuid` | External user reference |
| `status` | `varchar(20)` | Defaults to `confirmed` |
| `registered_at` | `timestamptz` | Auto (creation time) |
| `updated_at` | `timestamptz` | Auto |

Unique constraint: `(event_id, user_id)` — prevents duplicate registrations at the DB level.  
Indexes: `event_id`, `user_id`.

### `event_scores`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `event_id` | `uuid` | FK → `events.id` ON DELETE CASCADE |
| `user_id` | `uuid` | External user reference |
| `score` | `integer` | Required |
| `submitted_by` | `uuid` | Admin who submitted the score |
| `submitted_at` | `timestamptz` | Auto (creation time) |

Unique constraint: `(event_id, user_id)` — one score row per user per event.  
Index: `event_id`.

---

## Event Types

| Type | Description |
|---|---|
| `LE` | Leaderboard Event — supports score submission and ranked leaderboard |
| `DE` | Direct Event — no scores; winner declared via `complete` endpoint |
| `ALL` | Auction Leaderboard League (Phase 3) |
| `DLL` | Direct Leaderboard League (Phase 3) |

Score submission (`POST /events/:id/scores`) is only allowed for `LE` events.

---

## API Endpoints

All routes mounted under `/events`.

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/events` | Public | none | List all events; optional `?status=` filter |
| `GET` | `/events/:id` | Public | none | Get a single event by UUID |
| `POST` | `/events` | JWT | `coordinator`, `founder` | Create an event |
| `POST` | `/events/:id/register` | JWT | any authenticated | Register for an event |
| `POST` | `/events/:id/scores` | JWT | `coordinator`, `founder` | Submit or replace scores for an LE event |
| `GET` | `/events/:id/leaderboard` | Public | none | Ranked leaderboard for an event |
| `PATCH` | `/events/:id/complete` | JWT | `coordinator`, `founder` | Mark event as past and emit EventCompleted |

---

### `POST /events`

Create a new event.

**Body (`CreateEventDto`):**

| Field | Required | Rules |
|---|---|---|
| `title` | Yes | max 200 chars |
| `description` | No | free text |
| `type` | Yes | `LE`, `DE`, `ALL`, `DLL` |
| `startDate` | Yes | ISO date string; must be after `registrationDeadline` |
| `endDate` | Yes | ISO date string; must be after `startDate` |
| `registrationDeadline` | Yes | ISO date string; must be before `startDate` |
| `venue` | No | max 200 chars |
| `rulesPdfUrl` | No | URL (TLD not required) |
| `maxParticipants` | No | integer ≥ 1 |
| `needsLeaderboard` | No | boolean, defaults to `false` |
| `tags` | No | string array |

Date ordering is enforced via a custom `@IsBeforeField` cross-field class-validator decorator — the DTO itself rejects invalid orderings with a `400` before the service is called.

**Response:** `EventResponseDto` (201)

---

### `GET /events`

**Query params:**

| Parameter | Values | Notes |
|---|---|---|
| `status` | `upcoming`, `ongoing`, `past` | Optional; no filter returns all |

Results ordered by `startDate ASC`.

---

### `POST /events/:id/register`

Register the authenticated user for an event.

**Validation (in order):**

1. Event exists — `404` if not
2. Registration deadline has passed — `400`
3. Event status is not `upcoming` or `ongoing` — `400`
4. Event is at capacity (`maxParticipants` reached) — `400`
5. User already registered — `409 Conflict`

On success:
- Creates a `registrations` row with `status = confirmed`
- Emits `RegistrationCreated` domain event via `EventBusService`

**Response:** `RegistrationResponseDto` (201)

---

### `POST /events/:id/scores`

Submit (or replace) scores for an LE event. Idempotent — re-submission replaces all existing scores for the event.

**Body (`SubmitScoresDto`):**

```json
{
  "scores": [
    { "userId": "uuid", "score": 100 },
    { "userId": "uuid", "score": 80 }
  ]
}
```

`scores` must have at least one entry. Each `userId` must be a valid UUID v4 and must belong to a confirmed registrant for the event — unregistered user IDs return `400` listing the offending UUIDs.

**Execution (wrapped in a single DB transaction):**

1. Validates event is type `LE` — `400` if not
2. Deletes all existing `event_scores` rows for the event
3. Validates all submitted `userId` values are confirmed registrants
4. Inserts new score rows
5. Transaction rollback on any failure — no partial state

**Response:** `LeaderboardEntryDto[]` (201) — sorted by score descending, ranks assigned 1-based.

---

### `GET /events/:id/leaderboard`

Returns current scores ranked by score descending.

**Response:**

```json
[
  { "rank": 1, "userId": "uuid", "score": 100, "submittedAt": "ISO timestamp" },
  { "rank": 2, "userId": "uuid", "score": 80,  "submittedAt": "ISO timestamp" }
]
```

Returns `[]` if no scores have been submitted. Available for all event types (will simply be empty for DE events).

---

### `PATCH /events/:id/complete`

Mark an event as completed (status → `past`).

**Body (`CompleteEventDto`):**

```json
{
  "winners": [
    { "userId": "uuid", "sponsorId": "uuid", "fanAmount": 10 }
  ]
}
```

`winners` must have at least one entry. Each winner entry specifies which user won, which sponsor they represent, and how many fans to award — this data is forwarded via the `EventCompleted` domain event for the Sponsor Service to process when the event bus is wired.

**Errors:**
- `409 Conflict` if the event is already `past`
- `401` / `403` for missing or insufficient auth

**Response:** `EventResponseDto` (200) with `status: "past"`.

---

## Business Logic Notes

**Registration race condition:** The capacity check (`count >= maxParticipants`) and the duplicate check are two separate queries. Concurrent requests near capacity may both pass the count check. The database-level `UNIQUE (event_id, user_id)` constraint guarantees no true duplicate registrations are ever stored; capacity overflow by one request is theoretically possible under extreme concurrency but is acceptable at current scale.

**Score submission atomicity:** The full delete + validate + insert cycle runs inside a single `DataSource.transaction()`. If the unregistered-user check or the insert fails, the previous scores remain intact.

**`complete()` is idempotent on retries but not on status:** Calling complete twice returns `409` on the second call. The endpoint is not safe to retry without checking current status first.

---

## Domain Events

The `EventBusService` is an in-memory stub (log-only). It will be replaced by a Kafka producer in Phase 2. It logs the full event envelope to the NestJS logger:

```json
{
  "eventId": "uuid",
  "eventType": "RegistrationCreated",
  "timestamp": "ISO timestamp",
  "producer": "event-service",
  "payload": {
    "registrationId": "uuid",
    "eventId": "uuid",
    "userId": "uuid",
    "timestamp": "ISO timestamp"
  }
}
```

Events emitted:

| Event | When | Payload |
|---|---|---|
| `RegistrationCreated` | User successfully registers | `registrationId`, `eventId`, `userId`, `timestamp` |
| `EventCompleted` | Admin marks event past | `eventId`, `winners[]`, `timestamp` |

In Phase 2, `RegistrationCreated` will trigger the Points Service to award participation points automatically. Until then, participation points must be awarded manually via `POST /points/participation`.

---

## Authentication and Authorization

JWT tokens are verified using `passport-jwt` with `JwtStrategy`:

- `secretOrKey` from `event.jwt.accessSecret`
- `issuer` from `event.jwt.issuer`
- `ignoreExpiration: false`

Token payload mapped to `request.user`:

```ts
{ id: payload.sub, role: payload.role, email: payload.email, username: payload.username }
```

Public routes (`GET /events`, `GET /events/:id`, `GET /events/:id/leaderboard`) have no guards. All write routes and registration require `JwtAuthGuard`. Score submission and event creation/completion additionally require `RolesGuard` with `coordinator` or `founder`.

---

## API Gateway Integration

The API Gateway proxies `/events/**` to the event service.

Docker Compose sets:

```text
EVENT_SERVICE_URL=http://event-service:3004
```

Gateway routing (`backend/src/gateway/routing.ts`):

```ts
export const EVENT_SERVICE_PREFIXES = ['/events'];
```

`/events` and `/events/:id` are not in `PROTECTED_PREFIXES` — the gateway passes them through unauthenticated. Auth is enforced downstream per-endpoint.

Local development hits either:

```text
http://localhost:3000/events    # through gateway
http://localhost:3004/events    # direct service
```

---

## Docker Compose

`docker-compose.yml`:

- `event-service` built from `backend/apps/event-service/Dockerfile`
- Multi-stage build: compiles with `npm run build event-service`, prunes dev deps, runs `dist/apps/event-service/main.js`
- Depends on healthy `postgres`
- Internal exposure on port `3004`
- Shared `bgsc-network`

`docker-compose.override.yml` publishes `3004:3004` for local dev.

---

## Swagger

Available at `http://localhost:3004/events/docs` when running directly, or `http://localhost:3000/events/docs` through the gateway.

---

## Test Coverage

### Unit tests (`test/events.service.spec.ts` — 23 tests)

| Group | Tests |
|---|---|
| `create` | Creates with provided fields; defaults `needsLeaderboard` and `tags` |
| `findAll` | Returns all; filters by status |
| `findOne` | Returns by id; throws 404 for missing |
| `register` | Registers and emits event; rejects past deadline; rejects full capacity; rejects duplicate; rejects past-status event |
| `submitScores` | Replaces scores + returns ranked leaderboard; rejects non-LE events; rejects unregistered users |
| `getLeaderboard` | Returns ranked scores; throws 404 for missing event |
| `complete` | Marks past + emits EventCompleted; rejects already-past (409) |

`DataSource.transaction` is mocked with an inline EntityManager stub that runs callbacks synchronously. `registrationsRepository` includes `find` for the participant membership check.

### E2E tests (`test/events.e2e-spec.ts` — 21 tests, requires PostgreSQL)

| Group | Tests |
|---|---|
| `POST /events` | 401 unauthenticated; 403 regular user; 201 founder; 201 coordinator; 400 bad payload |
| `GET /events` | Returns all; filters by `status=upcoming`; filters by `status=past` |
| `GET /events/:id` | Returns by id; 404 for unknown |
| `POST /events/:id/register` | 401 unauthenticated; 201 open event; 409 duplicate; 400 past deadline; 400 at capacity |
| `POST /events/:id/scores + GET leaderboard` | Leaderboard ranked highest first; 400 for non-LE; scores replaced on re-submission; 403 regular user |
| `PATCH /events/:id/complete` | 200 marks past; 409 already past; 401 unauthenticated |

Tests use `dataSource.query` for setup helpers (`insertEvent`, `insertRegistration`) and a prefix-based `cleanup` to avoid cross-test contamination.

Run with:

```bash
npm run test:e2e:event
# or
npx jest --config apps/event-service/test/jest-e2e.json
```

Requires `postgres` container running (`docker compose up -d postgres`).

---

## Manual Smoke Test Results

Tested with `postgres` running via Docker Compose and both services started directly via `ts-node`.

| # | Endpoint | Expected | Result |
|---|---|---|---|
| 1 | `GET /events` (public) | 200 `[]` | ✅ |
| 2 | `POST /events` (no auth) | 401 | ✅ |
| 3 | `POST /events` (USER role) | 403 | ✅ |
| 4 | `POST /events` (FOUNDER) | 201 with full event object | ✅ |
| 5 | `GET /events` after create | 200 `[event]` | ✅ |
| 6 | `GET /events/:id` | 200 full object | ✅ |
| 7 | `POST /events/:id/register` (user) | 201 `status: confirmed` | ✅ |
| 8 | Register again (same user) | 409 Conflict | ✅ |
| 9 | Register second user | 201 | ✅ |
| 10 | Register at capacity | 400 "Event is at full capacity" | ✅ |
| 11 | `POST /events/:id/scores` (USER) | 403 | ✅ |
| 12 | Scores with unregistered userId | 400 listing the UUID | ✅ |
| 13 | Scores (both registered, FOUNDER) | 201 leaderboard ranked descending | ✅ |
| 14 | `GET /events/:id/leaderboard` | rank 1 = highest score | ✅ |
| 15 | `PATCH /events/:id/complete` | 200 `status: past` | ✅ |
| 16 | Complete already-past event | 409 Conflict | ✅ |
| 17 | `GET /events?status=past` | returns only past events | ✅ |
| 18 | `POST /events` with deadline > startDate | 400 with field validation message | ✅ |
| 19 | `GET /events/:unknown-id` | 404 "Event not found" | ✅ |

Example curl commands:

```bash
# Create an event (replace TOKEN with a FOUNDER JWT)
curl -X POST http://localhost:3004/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Airball 5v5",
    "type": "LE",
    "startDate": "2027-09-01T10:00:00Z",
    "endDate": "2027-09-01T18:00:00Z",
    "registrationDeadline": "2027-08-25T23:59:59Z",
    "needsLeaderboard": true
  }'

# Register for an event
curl -X POST http://localhost:3004/events/<event-id>/register \
  -H "Authorization: Bearer $USER_TOKEN"

# Submit scores
curl -X POST http://localhost:3004/events/<event-id>/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FOUNDER_TOKEN" \
  -d '{"scores": [{"userId": "<uuid>", "score": 100}, {"userId": "<uuid>", "score": 80}]}'

# Get leaderboard
curl http://localhost:3004/events/<event-id>/leaderboard

# Complete an event
curl -X PATCH http://localhost:3004/events/<event-id>/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FOUNDER_TOKEN" \
  -d '{"winners": [{"userId": "<uuid>", "sponsorId": "<uuid>", "fanAmount": 10}]}'
```
