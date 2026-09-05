# User Service — Implementation Reference

**Milestone:** 0.2 – Backend Core Services  
**Phase:** 0 (Foundation)  
**Status:** Implemented & tested  
**Port:** 3002

---

## Overview

The User Service manages the full lifecycle of platform users: profile retrieval, self-editing, and admin management. It also owns the **RBAC** layer that protects every endpoint.

It runs as a **standalone NestJS microservice** under `backend/apps/user-service/`, independent of the root app. Authentication is handled by validating JWTs issued by the Auth Service — the User Service never touches passwords or credentials.

---

## File Map

```
backend/
├── apps/
│   └── user-service/
│       ├── src/
│       │   ├── main.ts                              — Bootstrap, listens on PORT (default 3002)
│       │   ├── app.module.ts                        — Root module: TypeORM + AuthModule + UsersModule
│       │   ├── auth/
│       │   │   ├── jwt.strategy.ts                  — Passport JWT strategy (validates Bearer tokens)
│       │   │   ├── jwt-auth.guard.ts                — AuthGuard('jwt') — throws 401 on bad/missing token
│       │   │   └── auth.module.ts                   — Wires PassportModule, JwtModule, JwtStrategy
│       │   ├── rbac/
│       │   │   ├── roles.decorator.ts               — @Roles(...) decorator
│       │   │   ├── roles.guard.ts                   — RolesGuard (reads request.user from JWT)
│       │   │   └── current-user-id.decorator.ts     — @CurrentUserId() param decorator
│       │   ├── migrations/
│       │   │   └── 1750000000000-AddUserProfileColumns.ts — Idempotent profile column migration
│       │   └── users/
│       │       ├── entities/
│       │       │   └── user.entity.ts               — TypeORM entity (profile columns only)
│       │       ├── enums/
│       │       │   ├── user-role.enum.ts            — Role hierarchy enum
│       │       │   └── user-status.enum.ts          — Account status enum
│       │       ├── dto/
│       │       │   ├── create-user.dto.ts           — Body shape for admin user creation
│       │       │   ├── update-user.dto.ts           — Body shape for admin updates (all fields optional)
│       │       │   ├── update-me.dto.ts             — Body shape for self-edit (restricted fields only)
│       │       │   └── user-response.dto.ts         — Public response shape
│       │       ├── users.module.ts                  — NestJS module wiring
│       │       ├── users.controller.ts              — HTTP route handlers
│       │       └── users.service.ts                 — Business logic
│       ├── test/
│       │   ├── users.service.spec.ts                — Unit tests for UsersService
│       │   └── roles.guard.spec.ts                  — Unit tests for RolesGuard
│       ├── tsconfig.app.json
│       └── Dockerfile
```

---

## Running the Service

### Via Docker Compose

```bash
docker compose up -d user-service
```

Starts `user-service` on port **3002**, connected to the shared `postgres` container.

### Locally (dev)

```bash
cd backend
JWT_ACCESS_SECRET=<secret> JWT_ISSUER=bgsc-auth-service DATABASE_URL=... PORT=3002 \
  npx nest start user-service
```

Requires a local Postgres reachable at `DATABASE_URL`.

### Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Must match the Auth Service's `JWT_ACCESS_SECRET` exactly |
| `JWT_ISSUER` | No | Defaults to `bgsc-auth-service` — must match Auth Service |
| `PORT` | No | Defaults to `3002` |

---

## Authentication & RBAC

### How it works

The User Service does not issue tokens — it only validates them.

1. Every request must carry `Authorization: Bearer <accessToken>` (except public routes, if any).
2. `JwtAuthGuard` runs `passport-jwt` to verify the token signature against `JWT_ACCESS_SECRET` and check expiry and issuer.
3. On success, Passport calls `JwtStrategy.validate()` which maps the JWT payload to `request.user`:
   ```ts
   // JWT payload → request.user
   { sub, username, email, role } → { id, username, email, role }
   ```
   The `sub` → `id` mapping means `@CurrentUserId()` works without any changes.
4. `RolesGuard` then reads `request.user.role` and checks it against `@Roles(...)` on the handler.
5. If no `@Roles(...)` is set, the route allows any authenticated user.

### Guard order on the controller

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
```

`JwtAuthGuard` always runs first. If it fails (missing or invalid token) the request is rejected with `401` before `RolesGuard` is reached.

### `@Roles(...roles)` decorator

```ts
@Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
@Get()
findAll() { ... }
```

### `@CurrentUserId()` param decorator

Extracts `request.user.id` (the `sub` claim from the JWT) into a controller parameter.

```ts
@Get('me')
findMe(@CurrentUserId() userId: string) { ... }
```

---

## Database Schema (`users` table)

The `users` table is **shared** between the Auth Service and the User Service. Each service owns a subset of columns.

- **Auth Service owns:** `password_hash`, `google_id`, `totp_*`, `password_reset_*`, `disabled_at`, `disabled_by`, `deletion_scheduled`
- **User Service owns:** the profile columns below plus the shared identity columns

Migrations run on startup (`migrationsRun: true`). Both migrations use `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` so they are safe to run in any order. `synchronize` is disabled to prevent either service from dropping the other's columns.

### User Service — Managed Columns

| Column                    | Type              | Constraints              | Notes |
|---------------------------|-------------------|--------------------------|-------|
| `id`                      | `uuid`            | PK, auto-generated       | Shared skeleton |
| `username`                | `varchar(50)`     | unique, not null         | Shared skeleton |
| `email`                   | `varchar(320)`    | unique, not null         | Shared skeleton |
| `role`                    | `varchar(50)`     | default `user`           | Shared — written by Auth, read here |
| `status`                  | `varchar(50)`     | default `active`         | Shared — written by Auth, read here |
| `contact`                 | `varchar(30)`     | nullable                 | Phone/WhatsApp |
| `avatar_url`              | `text`            | nullable                 | |
| `interests`               | `text[]`          | default `{}`             | Sports/esports tags |
| `socials`                 | `jsonb`           | default `{}`             | `{ "discord": "...", "instagram": "..." }` |
| `strava_id`               | `varchar`         | nullable                 | Linked in Phase 4 |
| `steam_id`                | `varchar`         | nullable                 | Linked in Phase 4 |
| `points_balance`          | `integer`         | default `0`              | Managed by Points Service |
| `settings`                | `jsonb`           | default `{}`             | User preferences |
| `newsletter_subscriptions`| `text[]`          | default `{}`             | Opted-in newsletter tags |
| `active_sponsor_id`       | `uuid`            | nullable                 | FK to sponsors (Phase 1.1) |
| `last_active`             | `timestamptz`     | nullable                 | Updated by Auth Service |
| `created_at`              | `timestamptz`     | auto                     | |
| `updated_at`              | `timestamptz`     | auto                     | |

> The User Service entity does **not** declare `password_hash` or any other auth-owned column — TypeORM simply ignores those extra DB columns at query time.

---

## Enums

### `UserRole` (`enums/user-role.enum.ts`)

Ordered from least to most privileged:

| Value         | Description |
|---------------|-------------|
| `guest`       | Unauthenticated visitor — no write access |
| `user`        | Registered member, can view and register for events |
| `member`      | Active club member |
| `core`        | Core team member |
| `coordinator` | Event coordinator — can manage events, announcements, users |
| `founder`     | Full platform admin |

### `UserStatus` (`enums/user-status.enum.ts`)

| Value              | Description |
|--------------------|-------------|
| `active`           | Normal account |
| `disabled`         | Admin-disabled |
| `pending_deletion` | User requested deletion — 30-day grace period before permanent removal |
| `deleted`          | Soft-deleted — record retained, functionally removed |

These values match the Auth Service exactly. The Auth Service is the only writer of the `status` column.

---

## API Endpoints

Base path: `/users`  
All routes: `@UseGuards(JwtAuthGuard, RolesGuard)` at controller level.

### `POST /users`

Create a new user (admin action).

- **Roles required:** `coordinator`, `founder`
- **Body:** `CreateUserDto`
- **Response:** `UserResponseDto` (201)
- **Errors:** `409 Conflict` if username or email already exists

**`CreateUserDto` fields:**

| Field                    | Required | Rules |
|--------------------------|----------|-------|
| `username`               | Yes      | 3–50 chars |
| `email`                  | Yes      | valid email, max 320 chars |
| `contact`                | No       | max 30 chars |
| `role`                   | No       | `UserRole` enum, defaults to `user` |
| `avatarUrl`              | No       | string |
| `interests`              | No       | string array |
| `socials`                | No       | `Record<string, string>` |
| `stravaId`               | No       | string |
| `steamId`                | No       | string |
| `pointsBalance`          | No       | integer ≥ 0 |
| `status`                 | No       | `UserStatus` enum, defaults to `active` |
| `settings`               | No       | `Record<string, unknown>` |
| `newsletterSubscriptions`| No       | string array |
| `activeSponsorId`        | No       | UUID |

---

### `GET /users`

List all users, optionally filtered.

- **Roles required:** `coordinator`, `founder`
- **Query params:**
  - `role` — filter by `UserRole`
  - `status` — filter by `UserStatus`
- **Response:** `UserResponseDto[]`, ordered newest first

---

### `GET /users/me`

Get the authenticated user's own profile.

- **Roles required:** any authenticated user (`user` and above)
- **Identity:** resolved from the JWT `sub` claim via `@CurrentUserId()`
- **Response:** `UserResponseDto`
- **Errors:** `401` if token is missing or invalid

---

### `PATCH /users/me`

Update the authenticated user's own profile. Only a safe subset of fields is editable.

- **Roles required:** any authenticated user
- **Body:** `UpdateMeDto`
- **Response:** `UserResponseDto`
- **Errors:** `400` if a disallowed field (e.g. `role`, `email`) is sent

**`UpdateMeDto` fields** (all optional):

| Field                    | Rules |
|--------------------------|-------|
| `username`               | 3–50 chars |
| `contact`                | max 30 chars |
| `avatarUrl`              | string |
| `interests`              | string array |
| `socials`                | `Record<string, string>` |
| `settings`               | `Record<string, unknown>` |
| `newsletterSubscriptions`| string array |

> `role`, `status`, `pointsBalance`, `email` are intentionally excluded — only admins can change those via `PATCH /users/:id`.

---

### `GET /users/:id`

Get any user by UUID.

- **Roles required:** `coordinator`, `founder`
- **Response:** `UserResponseDto`
- **Errors:** `404 Not Found`

---

### `PATCH /users/:id`

Update any user by UUID (admin action).

- **Roles required:** `coordinator`, `founder`
- **Body:** `UpdateUserDto` — same fields as `CreateUserDto`, all optional
- **Response:** `UserResponseDto`
- **Errors:** `404 Not Found`, `409 Conflict`

---

### `DELETE /users/:id`

Soft-delete a user — sets `status` to `deleted`, retains the record.

- **Roles required:** `coordinator`, `founder`
- **Response:** `UserResponseDto` (with `status: "deleted"`)
- **Errors:** `404 Not Found`

---

## Response Shape (`UserResponseDto`)

All endpoints return this shape.

```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "contact": "string | null",
  "role": "user | member | core | coordinator | founder | guest",
  "avatarUrl": "string | null",
  "interests": ["string"],
  "socials": { "discord": "...", "instagram": "..." },
  "stravaId": "string | null",
  "steamId": "string | null",
  "pointsBalance": 0,
  "status": "active | disabled | pending_deletion | deleted",
  "settings": {},
  "newsletterSubscriptions": ["string"],
  "activeSponsorId": "uuid | null",
  "lastActive": "ISO timestamp | null",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

---

## Service Behaviour Notes

- **Unique constraint handling:** Both `create` and `update` catch PostgreSQL error code `23505` and re-throw as `409 Conflict` with a human-readable message.
- **Soft delete:** `remove()` sets `status = deleted` and saves — it does not call `DELETE` on the DB row. Deleted users remain filterable via `GET /users?status=deleted`.
- **Whitelist validation:** `ValidationPipe` is configured with `whitelist: true` and `forbidNonWhitelisted: true` globally — any unknown field in the request body returns `400`.
- **`updateMe` vs `update`:** `updateMe` is a thin wrapper around `update` using the restricted `UpdateMeDto`. The separation keeps controller intent clear and makes it easy to add self-edit-specific logic later.
- **Shared DB, no cross-service HTTP calls:** The Auth Service creates the user row on registration; the profile columns have DB-level defaults so they are populated immediately. The User Service reads them on the first `GET /users/me` with no inter-service call needed.

---

## Known Limitations / TODO (before Phase 1 Frontend)

- No pagination on `GET /users` yet — add before the admin panel is wired up (Milestone 1.4).
- `activeSponsorId` is a bare UUID column with no FK constraint — the FK will be added when the Sponsor table is created in Milestone 1.1.
- `points_balance` is written only by this service's admin endpoints for now — the Points Service will take ownership in Phase 2.
