# Sponsor Service Implementation Reference

**Milestone:** 1.1 - Sponsor System v1  
**Tasks:** Task 1 (Sponsor CRUD), Task 2 (Onboarding sponsor selection), Task 3 (Fan counting), Task 4 (Leaderboard)  
**Status:** All 4 tasks implemented and tested  
**Port:** 3003 (sponsor-service), 3002 (user-service sponsor endpoint)

---

## Overview

The Sponsor Service owns sponsor records and the initial sponsor affiliation schema for Milestone 1.1. It is a NestJS microservice under `backend/apps/sponsor-service` and is exposed through the API Gateway at `/sponsors/**`.

The current implementation covers:

- CRUD for `sponsors`
- `UserSponsorAffiliation` table
- Public `GET /sponsors/active`
- JWT authentication for write operations
- Role-based access for coordinator and founder sponsor management
- TypeORM migrations for sponsor and affiliation tables
- Docker Compose registration as `sponsor-service`
- **Onboarding sponsor selection** (`POST /users/me/sponsor`) with semester change limit (Task 2, implemented in user-service)
- **Fan counting** (`POST /sponsors/:id/fans`) with `FanEarned` event emission (Task 3)
- **Sponsor leaderboard** (`GET /sponsors/leaderboard`) with sortable ranking (Task 4)

---

## File Map

```text
backend/apps/sponsor-service/
├── Dockerfile
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── config/
    │   ├── sponsor.config.ts
    │   └── sponsor.config.spec.ts
    ├── auth/
    │   ├── auth.module.ts
    │   ├── jwt-auth.guard.ts
    │   └── jwt.strategy.ts
    ├── rbac/
    │   ├── roles.decorator.ts
    │   └── roles.guard.ts
    ├── migrations/
    │   ├── 1762000000000-CreateSponsorsAndAffiliations.ts
    │   ├── 1763000000000-AddAffiliationUniqueness.ts
    │   └── 1763000001000-RemoveAffiliationUserForeignKey.ts
    └── sponsors/
        ├── sponsors.controller.ts
        ├── sponsors.module.ts
        ├── sponsors.service.ts
        ├── event-bus.service.ts
        ├── dto/
        │   ├── award-fans.dto.ts
        │   ├── create-sponsor.dto.ts
        │   ├── leaderboard-entry.dto.ts
        │   ├── leaderboard-query.dto.ts
        │   ├── list-sponsors-query.dto.ts
        │   ├── sponsor-response.dto.ts
        │   └── update-sponsor.dto.ts
        ├── entities/
        ├── enums/
        └── events/
            └── fan-earned.event.ts
```

---

## Runtime Configuration

The service uses `ConfigModule` with Joi validation from `sponsor.config.ts`.

| Variable | Required | Default | Notes |
|---|---:|---|---|
| `PORT` | No | `3003` | Sponsor service listen port |
| `NODE_ENV` | No | `development` | Allowed: `development`, `production`, `test` |
| `DATABASE_URL` | Yes | none | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | none | Must match Auth Service and API Gateway |
| `JWT_ISSUER` | Yes | none | Must match Auth Service token issuer |

In Docker Compose, the service runs on the shared `bgsc-network`. The base compose file exposes port `3003` only inside Docker, while `docker-compose.override.yml` publishes `3003:3003` for local development.

---

## Database Schema

The service runs registered TypeORM migrations automatically on startup with `migrationsRun: true`.

### `sponsors`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `varchar(120)` | Unique, required |
| `logo_url` | `text` | Optional |
| `description` | `text` | Optional |
| `website_url` | `text` | Optional |
| `tenure_start` | `date` | Required |
| `tenure_end` | `date` | Optional |
| `status` | `varchar(50)` | Defaults to `active` |
| `total_fans` | `integer` | Defaults to `0` |
| `created_at` | `timestamptz` | Auto-created |
| `updated_at` | `timestamptz` | Auto-updated |

### `user_sponsor_affiliations`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | External user reference, indexed |
| `sponsor_id` | `uuid` | FK to `sponsors.id`, indexed |
| `affiliated_at` | `timestamptz` | Defaults to `now()` |
| `fan_count` | `integer` | Defaults to `0` |
| `events_won` | `text[]` | Defaults to empty array |
| `total_points_contributed` | `integer` | Defaults to `0` |
| `created_at` | `timestamptz` | Auto-created |
| `updated_at` | `timestamptz` | Auto-updated |

The sponsor service does not own the `users` table and does not create it. `user_id` is indexed and stored as an external reference to the user domain, while `sponsor_id` remains an enforced foreign key to `sponsors.id`.

Affiliations enforce one row per `(user_id, sponsor_id)` through `AddAffiliationUniqueness1763000000000`. Existing duplicate rows are deduplicated by keeping the newest affiliation before the unique index is added.

---

## API Endpoints

All routes are mounted under `/sponsors`.

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/sponsors` | Public | none | List sponsors, optionally filtered by status |
| `GET` | `/sponsors/active` | Public | none | List active sponsors in the current tenure window |
| `GET` | `/sponsors/leaderboard` | Public | none | Ranked leaderboard of active sponsors |
| `GET` | `/sponsors/:id` | Public | none | Fetch one sponsor |
| `POST` | `/sponsors` | JWT | `coordinator`, `founder` | Create sponsor |
| `PATCH` | `/sponsors/:id` | JWT | `coordinator`, `founder` | Update sponsor |
| `DELETE` | `/sponsors/:id` | JWT | `coordinator`, `founder` | Soft-remove sponsor by setting inactive status and tenure end |
| `POST` | `/sponsors/:id/fans` | JWT | `coordinator`, `founder` | Award fans to a user for a sponsor (Task 3) |

### Query Parameters

`GET /sponsors`

| Parameter | Values | Notes |
|---|---|---|
| `status` | `active`, `inactive` | Optional |

### Create or Update Body

```json
{
  "name": "Example Sponsor",
  "logoUrl": "https://example.com/logo.png",
  "description": "Optional sponsor description",
  "websiteUrl": "https://example.com",
  "tenureStart": "2026-01-01",
  "tenureEnd": "2026-12-31",
  "status": "active"
}
```

Required for create:

- `name`
- `tenureStart`

Optional:

- `logoUrl`
- `description`
- `websiteUrl`
- `tenureEnd`
- `status`, defaults to `active`

Validation uses `class-validator`, with URL validation allowing local or non-public hostnames via `require_tld: false`.

---

## Active Sponsor Rules

`GET /sponsors/active` returns sponsors where:

- `status = active`
- `tenureStart <= today`
- `tenureEnd IS NULL OR tenureEnd >= today`

Results are ordered by:

1. `tenureStart DESC`
2. `createdAt DESC`

---

## Fan Counting (Task 3)

### `POST /sponsors/:id/fans`

Award fans to a user affiliated with a sponsor. Emits a `FanEarned` domain event.

- **Roles required:** `coordinator`, `founder`
- **Body:** `AwardFansDto`

**`AwardFansDto` fields:**

| Field | Type | Rules |
|---|---|---|
| `userId` | UUID | User to award fans to |
| `eventId` | string | Event that earned the fans |
| `amount` | integer | Fan count to award (>= 1) |
| `reason` | string | e.g. `event_win`, `challenge_complete` |

**Behavior:**
1. Validates sponsor is active
2. Checks user has an affiliation with the sponsor
3. Increments `fanCount` on the affiliation
4. Adds `eventId` to `eventsWon` array (deduplicated)
5. Recalculates `sponsors.totalFans` from all affiliations
6. Emits `FanEarned` event via the in-memory event bus

**Errors:**
- `400` if sponsor is inactive
- `400` if user is not affiliated with this sponsor

### Event Bus

The `EventBusService` is an in-memory event emitter (stub for Kafka in Phase 2). It logs events as JSON:

```json
{
  "eventId": "uuid",
  "eventType": "FanEarned",
  "timestamp": "ISO timestamp",
  "producer": "sponsor-service",
  "payload": { "userId": "...", "sponsorId": "...", "eventId": "...", "amount": 5, "reason": "event_win" }
}
```

The `FanEarnedEvent` interface is defined in `events/fan-earned.event.ts`.

---

## Sponsor Leaderboard (Task 4)

### `GET /sponsors/leaderboard`

Public endpoint returning a ranked list of all active sponsors.

- **Query params:**
  - `sort` — `fans` (default), `events`, or `users`

**Response:** `LeaderboardEntryDto[]`

```json
[
  {
    "rank": 1,
    "sponsorId": "uuid",
    "name": "Red Bull Campus",
    "logoUrl": "https://...",
    "totalFans": 150,
    "eventsWonCount": 12,
    "affiliatedUserCount": 45
  }
]
```

**Sort options:**

| Value | Sorts by |
|---|---|
| `fans` (default) | `totalFans` descending |
| `events` | `eventsWonCount` (deduplicated events won across all affiliations) descending |
| `users` | Number of affiliated users descending |

**Computation:**
- `eventsWonCount` is the sum of `array_length(eventsWon)` across all affiliations for the sponsor
- `affiliatedUserCount` is the count of `user_sponsor_affiliations` rows for the sponsor
- Ranks are assigned sequentially (1-based) after sorting

---

## Onboarding Sponsor Selection (Task 2)

The `POST /users/me/sponsor` endpoint lives in the **user-service** (port 3002) but is documented here as part of the sponsor system. It allows users to select or change their affiliated sponsor during onboarding and later, with a semester-based change limit.

### Endpoint

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `POST` | `/users/me/sponsor` | JWT | `user`+ | Select or change the authenticated user's sponsor |

**Request body (`SelectSponsorDto`):**

```json
{
  "sponsorId": "uuid"
}
```

- `sponsorId` — UUID of the sponsor to affiliate with (required)

**Response:** `UserResponseDto` with updated `activeSponsorId` and `lastSponsorChange`.

### Validation Rules

The endpoint enforces the following checks in order:

1. **Sponsor exists** — `404 Not Found` if the sponsor ID does not match any record
2. **Sponsor is active** — `400 Bad Request` if `sponsor.status !== 'active'`
3. **Tenure in effect** — `400 Bad Request` if `tenureStart > today` or `tenureEnd < today`
4. **Same sponsor** — no-op if `user.activeSponsorId === sponsorId`, returns current user unchanged
5. **Semester change limit** — `400 Bad Request` if the user already changed sponsors this semester

### Semester Change Limit

A user can only change their sponsor **once per semester**. Semesters are defined as:

- **Semester 1:** January 1 – June 30
- **Semester 2:** July 1 – December 31

The limit is tracked via the `users.last_sponsor_change` column. If the user's last sponsor change falls within the current semester, the change is rejected with:

> "You can only change your sponsor once per semester"

First-time sponsor selection (no existing `activeSponsorId`) is always allowed and does not count as a "change."

### What Happens on Success

1. `users.active_sponsor_id` is set to the new sponsor ID
2. `users.last_sponsor_change` is set to the current timestamp
3. A new `user_sponsor_affiliations` row is created with `userId`, `sponsorId`, and `affiliatedAt`

### User-Service Changes for Task 2

The following files were added or modified in `backend/apps/user-service/`:

**New files:**

| File | Purpose |
|---|---|
| `src/users/entities/sponsor.entity.ts` | Read-only Sponsor entity for validation queries |
| `src/users/entities/user-sponsor-affiliation.entity.ts` | Affiliation entity for creating affiliation records |
| `src/users/dto/select-sponsor.dto.ts` | `{ sponsorId: UUID }` request body |
| `src/migrations/1762000001000-AddLastSponsorChange.ts` | Adds `last_sponsor_change` column to `users` |

**Modified files:**

| File | Change |
|---|---|
| `src/users/entities/user.entity.ts` | Added `lastSponsorChange` column |
| `src/users/dto/user-response.dto.ts` | Added `lastSponsorChange` field to response |
| `src/users/users.controller.ts` | Added `POST me/sponsor` route |
| `src/users/users.service.ts` | Added `selectSponsor()` method with semester logic |
| `src/users/users.module.ts` | Registered `Sponsor` and `UserSponsorAffiliation` entities |
| `src/app.module.ts` | Registered `AddLastSponsorChange` migration |

### Test Coverage

7 new tests added in `test/users.service.spec.ts` under `describe('selectSponsor', ...)`:

- Selects a sponsor for the first time (creates affiliation)
- Returns user unchanged when selecting the same sponsor
- Throws `NotFoundException` for a missing sponsor
- Throws `BadRequestException` for an inactive sponsor
- Throws `BadRequestException` when tenure has not started
- Throws `BadRequestException` when tenure has ended
- Throws `BadRequestException` when changing sponsor twice in the same semester

All 21 tests in the user-service suite pass (13 service tests + 4 roles guard tests + 4 config tests).

### Example Calls

```bash
# Select a sponsor (requires valid JWT)
curl -X POST http://localhost:3000/users/me/sponsor \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"sponsorId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'

# Response: UserResponseDto with updated activeSponsorId and lastSponsorChange
```

---

## Authentication and Authorization

The service verifies JWT access tokens using `passport-jwt`.

Token requirements:

- Bearer token in the `Authorization` header
- Signature verified with `JWT_ACCESS_SECRET`
- Issuer verified with `JWT_ISSUER`
- Token must not be expired

The JWT strategy maps token claims into:

```ts
{
  id: payload.sub,
  role: payload.role,
  email: payload.email,
  username: payload.username
}
```

Write routes use `JwtAuthGuard` and `RolesGuard`. Only `coordinator` and `founder` can create, update, or delete sponsors. Public read routes do not require authentication.

---

## API Gateway Integration

The API Gateway proxies `/sponsors/**` to the sponsor service.

Docker Compose sets:

```text
SPONSOR_SERVICE_URL=http://sponsor-service:3003
```

Gateway routing is configured in `backend/src/gateway/routing.ts`:

```ts
export const SPONSOR_SERVICE_PREFIXES = ['/sponsors'];
```

Local development can hit either:

```text
http://localhost:3000/sponsors/active   # through gateway
http://localhost:3003/sponsors/active   # direct service
```

Production-style traffic should use the gateway.

---

## Docker Compose Service

`docker-compose.yml` includes:

- `sponsor-service` built from `backend/apps/sponsor-service/Dockerfile`
- dependency on healthy `postgres`
- internal exposure on port `3003`
- shared `bgsc-network`

`docker-compose.override.yml` publishes:

```yaml
sponsor-service:
  ports:
    - '3003:3003'
```

---

## Manual Smoke Test Results

The current implementation was manually tested with Docker Compose running.

Confirmed:

- `sponsor-service` container starts successfully
- TypeORM connects to PostgreSQL and runs migrations
- `GET /sponsors/active` through gateway returns `200`
- `GET /sponsors/active` direct service returns `200`
- unauthenticated write requests return `401`
- seeded founder login works through the gateway
- founder-authenticated sponsor create, read, update, and delete work through the gateway
- protected user routes and seeded-user RBAC checks still work after adding sponsor routing

Example calls:

```bash
curl http://localhost:3000/sponsors/active
curl http://localhost:3003/sponsors/active

curl -X POST http://localhost:3000/sponsors \
  -H "Authorization: Bearer <founder-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Sponsor",
    "tenureStart": "2026-01-01",
    "status": "active"
  }'
```

---

## Current Test Coverage

### Unit tests (`test/sponsors.service.spec.ts` — 14 tests)

Existing tests cover:

- sponsor config validation
- sponsor service unit behavior (CRUD, active filtering, soft delete, conflict handling)
- `addFans` (award fans, inactive sponsor, non-affiliated user, event dedup)
- `getLeaderboard` (default sort by fans, sort by events, sort by users, empty result)

### E2E tests (`test/sponsors.e2e-spec.ts` — 15 tests, requires PostgreSQL)

- `GET /sponsors/active` — returns only active sponsors within tenure dates
- `GET /sponsors` — filters by status (active/inactive)
- `POST /sponsors` — rejects unauthenticated (401), rejects non-admin (403), allows founder, allows coordinator
- `PATCH /sponsors/:id` — updates allowed fields
- `DELETE /sponsors/:id` — soft-removes by setting inactive and tenureEnd
- `POST /sponsors/:id/fans` — awards fans, rejects inactive sponsor, rejects non-affiliated user
- `GET /sponsors/leaderboard` — default sort by fans, active-tenure exclusion, sort by events, sort by users

Run e2e tests with:
```bash
npx jest --config apps/sponsor-service/test/jest-e2e.json
```

Requires a running PostgreSQL instance (the Docker Compose `postgres` service is sufficient).
