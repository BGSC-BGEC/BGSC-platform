# Points Service — Implementation Reference

**Milestone:** 1.2 – Points Service (basic)  
**Phase:** 1 (Backend MVP)  
**Status:** Implemented, tested, and manually verified  
**Port:** 3005

---

## Overview

The Points Service owns the points ledger: awarding, spending (future), and balance calculation. All points history is stored as immutable `point_transactions` rows — the balance is always derived from the ledger, never stored as a separate column. It is a standalone NestJS microservice under `backend/apps/points-service/` and is exposed through the API Gateway at `/points/**`.

Current implementation covers the Milestone 1.2 points tasks:

- `POST /points/award` — admin-initiated point award (any source/amount)
- `POST /points/participation` — fixed 10-point participation award tied to an event registration
- `GET /points/balance/:userId` — real-time balance from the transaction ledger (self or admin only)
- TypeORM migration for the `point_transactions` table
- In-memory `EventBusService` stub emitting `PointsEarned` on every award
- Balance calculation handles `earn`, `spend`, and `refund` transaction types via parameterised SQL

---

## File Map

```text
backend/apps/points-service/
├── Dockerfile
├── tsconfig.app.json
├── src/
│   ├── main.ts                          — Bootstrap; binds port, sets ValidationPipe, mounts Swagger at /points/docs
│   ├── app.module.ts                    — Root module: ConfigModule + TypeORM + AuthModule + PointsModule
│   ├── config/
│   │   ├── points.config.ts             — Joi-validated config namespace (port, db, jwt)
│   │   └── points.config.spec.ts        — Config validation unit tests
│   ├── auth/
│   │   ├── auth.module.ts               — PassportModule + JwtModule wiring
│   │   ├── jwt-auth.guard.ts            — AuthGuard('jwt') — throws 401 on missing/invalid token
│   │   └── jwt.strategy.ts              — Validates Bearer token; maps sub → id, role → UserRole
│   ├── rbac/
│   │   ├── roles.decorator.ts           — @Roles(...) decorator
│   │   └── roles.guard.ts               — Reads request.user.role; throws 403 on insufficient role
│   ├── migrations/
│   │   └── 1765000000000-CreatePointTransactions.ts — Creates point_transactions table + indexes
│   └── points/
│       ├── points.controller.ts         — HTTP handlers; includes self/admin balance guard
│       ├── points.module.ts             — TypeORM entity, PointsService, RolesGuard, EventBusService
│       ├── points.service.ts            — Business logic and balance query
│       ├── event-bus.service.ts         — In-memory event emitter (Kafka stub)
│       ├── domain-events/
│       │   └── points-earned.event.ts
│       ├── dto/
│       │   ├── award-points.dto.ts      — AwardPointsDto + AwardParticipationDto
│       │   ├── points-balance-response.dto.ts
│       │   └── transaction-response.dto.ts
│       ├── entities/
│       │   └── point-transaction.entity.ts
│       └── enums/
│           ├── points-source.enum.ts    — event | challenge | store | leaderboard
│           ├── transaction-type.enum.ts — earn | spend | refund
│           └── user-role.enum.ts
└── test/
    ├── points.service.spec.ts           — 7 unit tests
    ├── points.e2e-spec.ts               — 12 e2e tests (requires PostgreSQL)
    └── jest-e2e.json
```

---

## Runtime Configuration

The service uses `ConfigModule` with Joi validation from `points.config.ts`.

| Variable | Required | Default | Notes |
|---|---:|---|---|
| `PORT` | No | `3005` | Points service listen port |
| `NODE_ENV` | No | `development` | Allowed: `development`, `production`, `test` |
| `DATABASE_URL` | Yes | none | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | none | Must match Auth Service and API Gateway |
| `JWT_ISSUER` | Yes | none | Must match Auth Service token issuer |

Config is namespaced as `points.*` and accessed via `ConfigService.get('points.jwt.accessSecret')`, etc.

---

## Database Schema

The service auto-runs migrations on startup (`migrationsRun: true`, `synchronize: false`). The table is created in migration `1765000000000-CreatePointTransactions`.

### `point_transactions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `uuid_generate_v4()` |
| `user_id` | `uuid` | External user reference, indexed |
| `amount` | `integer` | Points delta for this transaction |
| `type` | `varchar(20)` | `earn`, `spend`, `refund` |
| `source` | `varchar(30)` | `event`, `challenge`, `store`, `leaderboard` |
| `reference_id` | `uuid` | Optional — event ID, challenge ID, etc. Indexed. |
| `created_at` | `timestamptz` | Auto |

No unique constraints — the same user can have many transactions for the same event (e.g., participation + podium bonus). No update/delete semantics; the ledger is append-only.

**Balance derivation:**
- `earn` and `refund` rows count positively
- `spend` rows count negatively
- Balance = `SUM(CASE WHEN type IN ('earn','refund') THEN amount ELSE -amount END)`

---

## Enums

### `TransactionType`

| Value | Description |
|---|---|
| `earn` | Points added to the user's account |
| `spend` | Points deducted (store redemption, leaderboard investment) |
| `refund` | Reversal of a spend — counts positively toward balance |

### `PointsSource`

| Value | Description |
|---|---|
| `event` | Event participation or registration |
| `challenge` | Challenge completion (Phase 2) |
| `store` | Store redemption spend |
| `leaderboard` | Leaderboard podium bonus or investment |

---

## API Endpoints

All routes mounted under `/points`.

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/points/balance/:userId` | JWT | self or `core`+ | Get a user's current points balance |
| `POST` | `/points/award` | JWT | `coordinator`, `founder` | Award points (any amount, any source) |
| `POST` | `/points/participation` | JWT | `coordinator`, `founder` | Award fixed 10-point participation credit |

---

### `GET /points/balance/:userId`

Returns the computed balance for a user based on all their transactions.

**Authorization:**
- A user can read their own balance (`request.user.id === userId`)
- `core`, `coordinator`, and `founder` can read any user's balance
- Any other combination returns `403 Forbidden`

**Response (`PointsBalanceResponseDto`):**

```json
{ "userId": "uuid", "balance": 60 }
```

Returns `balance: 0` for users with no transactions (not a 404).

**Errors:**
- `401` — no or invalid JWT
- `403` — authenticated but reading another user's balance without sufficient role

---

### `POST /points/award`

Award points to a user with explicit amount and source.

**Body (`AwardPointsDto`):**

| Field | Required | Rules |
|---|---|---|
| `userId` | Yes | UUID v4 |
| `amount` | Yes | integer ≥ 1 |
| `source` | Yes | `event`, `challenge`, `store`, `leaderboard` |
| `referenceId` | No | UUID v4 — event ID, challenge ID, etc. |

Creates a `TransactionType.EARN` row. Always earns — use `source: 'store'` with negative intent when spending is added in Phase 2.

Emits `PointsEarned` domain event on success.

**Response:** `TransactionResponseDto` (201)

---

### `POST /points/participation`

Award the fixed 10-point participation credit for an event registration.

This endpoint exists as a temporary bridge until the Event Bus (Kafka, Phase 2) is wired. When `RegistrationCreated` is emitted by the Event Service, the Points Service will consume it automatically. Until then, this endpoint must be called manually by a coordinator or founder after registration.

**Body (`AwardParticipationDto`):**

| Field | Required | Rules |
|---|---|---|
| `userId` | Yes | UUID v4 — the registering user |
| `eventId` | Yes | UUID v4 — the event they registered for |

Internally calls `award()` with `amount: 10`, `source: PointsSource.EVENT`, `referenceId: eventId`.

**Response:** `TransactionResponseDto` (201)

```json
{
  "id": "uuid",
  "userId": "uuid",
  "amount": 10,
  "type": "earn",
  "source": "event",
  "referenceId": "uuid",
  "createdAt": "ISO timestamp"
}
```

**Errors:**
- `400` — missing or invalid UUID fields (full DTO validation)
- `401` / `403` — missing auth or insufficient role

---

## Balance Calculation

`getBalance()` uses a single aggregation query via TypeORM QueryBuilder:

```sql
SELECT
  COALESCE(
    SUM(CASE WHEN t.type IN (:earn, :refund) THEN t.amount ELSE -t.amount END),
    0
  ) AS balance
FROM point_transactions t
WHERE t."userId" = :userId
```

The `earn` and `refund` values are bound via `:...creditTypes` parameter using the `TransactionType` enum — not hardcoded strings. This ensures the SQL stays correct if enum values are ever renamed.

The result is cast from the raw Postgres `string` to `Number()` before returning.

---

## Domain Events

The `EventBusService` is an in-memory stub (log-only). It will be replaced by a Kafka producer in Phase 2.

```json
{
  "eventId": "uuid",
  "eventType": "PointsEarned",
  "timestamp": "ISO timestamp",
  "producer": "points-service",
  "payload": {
    "transactionId": "uuid",
    "userId": "uuid",
    "amount": 10,
    "source": "event",
    "referenceId": "uuid",
    "timestamp": "ISO timestamp"
  }
}
```

`PointsEarned` is emitted on every successful `award()` call (which includes the `awardParticipation()` path).

---

## Authentication and Authorization

JWT tokens are verified using `passport-jwt` with `JwtStrategy`:

- `secretOrKey` from `points.jwt.accessSecret`
- `issuer` from `points.jwt.issuer`
- `ignoreExpiration: false`

Token payload mapped to `request.user`:

```ts
{ id: payload.sub, role: payload.role, email: payload.email, username: payload.username }
```

The balance endpoint enforces an explicit self-or-admin check in the controller before the service is called:

```ts
if (req.user.id !== userId && !ADMIN_ROLES.includes(req.user.role)) {
  throw new ForbiddenException("Cannot view another user's balance");
}
```

`ADMIN_ROLES = [UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER]`

Award and participation endpoints use `JwtAuthGuard + RolesGuard` with `@Roles(UserRole.COORDINATOR, UserRole.FOUNDER)`.

---

## API Gateway Integration

The API Gateway proxies `/points/**` to the points service.

Docker Compose sets:

```text
POINTS_SERVICE_URL=http://points-service:3005
```

Gateway routing (`backend/src/gateway/routing.ts`):

```ts
export const POINTS_SERVICE_PREFIXES = ['/points'];
```

`/points/**` is not in `PROTECTED_PREFIXES` at the gateway — the gateway passes all requests through and auth is enforced by the service itself. This is intentional: the balance endpoint requires auth at the service level, not the gateway edge.

Local development hits either:

```text
http://localhost:3000/points/balance/<userId>   # through gateway
http://localhost:3005/points/balance/<userId>   # direct service
```

---

## Docker Compose

`docker-compose.yml`:

- `points-service` built from `backend/apps/points-service/Dockerfile`
- Multi-stage build: compiles with `npm run build points-service`, prunes dev deps, runs `dist/apps/points-service/main.js`
- Depends on healthy `postgres`
- Internal exposure on port `3005`
- Shared `bgsc-network`

`docker-compose.override.yml` publishes `3005:3005` for local dev.

---

## Swagger

Available at `http://localhost:3005/points/docs` when running directly, or `http://localhost:3000/points/docs` through the gateway.

---

## Phase 2 Integration Notes

The `POST /points/participation` endpoint is a **temporary shim**. In Phase 2, when Kafka replaces the in-memory EventBus:

1. The Points Service will subscribe to the `event.registration` Kafka topic
2. On receiving `RegistrationCreated`, it will call `awardParticipation()` internally
3. `POST /points/participation` can then be removed or locked to service-to-service auth only

The `EventCompleted` event (from the Event Service) will similarly trigger podium bonus awards in Phase 2, replacing manual `POST /points/award` calls for leaderboard bonuses.

---

## Test Coverage

### Unit tests (`test/points.service.spec.ts` — 7 tests)

| Group | Tests |
|---|---|
| `award` | Creates earn transaction and emits PointsEarned; sets referenceId to null when not provided |
| `awardParticipation` | Awards exactly 10pts with source=event and referenceId=eventId |
| `getBalance` | Returns computed balance; returns 0 when no transactions exist |

The `createQueryBuilder` mock includes `setParameter` to match the parameterised balance query.

### E2E tests (`test/points.e2e-spec.ts` — 12 tests, requires PostgreSQL)

| Group | Tests |
|---|---|
| `GET /points/balance/:userId` | 401 unauthenticated; 200 own user (zero balance); 403 reading another user as USER; 200 FOUNDER reading any user; correct balance after earn transactions |
| `POST /points/award` | 401 unauthenticated; 403 regular user; 201 founder awards; 201 coordinator awards; 400 invalid payload |
| `POST /points/participation` | 201 awards 10pts + reflects in balance; 401 unauthenticated |

Run with:

```bash
npm run test:e2e:points
# or
npx jest --config apps/points-service/test/jest-e2e.json
```

Requires `postgres` container running (`docker compose up -d postgres`).

---

## Manual Smoke Test Results

Tested with `postgres` running via Docker Compose and both services started directly via `ts-node`.

| # | Endpoint | Expected | Result |
|---|---|---|---|
| 1 | `GET /points/balance/:id` (no auth) | 401 | ✅ |
| 2 | `GET /points/balance/:id` (own user) | 200 `{balance:0}` | ✅ |
| 3 | `GET /points/balance/:otherId` (USER role) | 403 | ✅ |
| 4 | `GET /points/balance/:otherId` (FOUNDER) | 200 | ✅ |
| 5 | `POST /points/award` (USER role) | 403 | ✅ |
| 6 | `POST /points/award` (invalid payload) | 400 with per-field errors | ✅ |
| 7 | `POST /points/award` (FOUNDER, 50pts) | 201 `type:earn` | ✅ |
| 8 | `POST /points/participation` (10pts) | 201 `amount:10, source:event` | ✅ |
| 9 | `POST /points/participation` (bad UUIDs) | 400 validates both fields | ✅ |
| 10 | `GET /points/balance` after 50+10 awards | 200 `{balance:60}` | ✅ |

Example curl commands:

```bash
# Get own balance
curl http://localhost:3005/points/balance/<your-user-id> \
  -H "Authorization: Bearer $TOKEN"

# Award points (coordinator/founder only)
curl -X POST http://localhost:3005/points/award \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FOUNDER_TOKEN" \
  -d '{
    "userId": "<target-uuid>",
    "amount": 50,
    "source": "leaderboard",
    "referenceId": "<event-uuid>"
  }'

# Award participation (temporary — remove when Kafka wired)
curl -X POST http://localhost:3005/points/participation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FOUNDER_TOKEN" \
  -d '{
    "userId": "<user-uuid>",
    "eventId": "<event-uuid>"
  }'
```
