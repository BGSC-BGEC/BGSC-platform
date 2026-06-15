# User Service — Implementation Reference

**Milestone:** 0.2 – Backend Core Services  
**Phase:** 0 (Foundation)  
**Status:** Implemented

---

## Overview

The User Service manages the full lifecycle of platform users: creation, profile retrieval, self-editing, admin management, and soft deletion. It also owns the **RBAC** layer that protects every endpoint across the backend.

All files live under `backend/src/users/` and `backend/src/rbac/`.

---

## File Map

```
backend/src/
├── users/
│   ├── user.entity.ts          — TypeORM entity / DB schema
│   ├── user-role.enum.ts       — Role hierarchy enum
│   ├── user-status.enum.ts     — Account status enum
│   ├── users.module.ts         — NestJS module wiring
│   ├── users.controller.ts     — HTTP route handlers
│   ├── users.service.ts        — Business logic
│   ├── users.service.spec.ts   — Unit tests
│   └── dto/
│       ├── create-user.dto.ts  — Body shape for admin user creation
│       ├── update-user.dto.ts  — Body shape for admin user updates (all fields optional)
│       ├── update-me.dto.ts    — Body shape for self-edit (restricted fields only)
│       └── user-response.dto.ts — Public response shape (no password hash)
└── rbac/
    ├── roles.decorator.ts          — @Roles(...) decorator
    ├── roles.guard.ts              — RolesGuard (reads x-user-role / x-user-id headers)
    ├── current-user-id.decorator.ts — @CurrentUserId() param decorator
    └── roles.guard.spec.ts         — Unit tests
```

---

## Database Schema (`users` table)

Defined in `user.entity.ts` via TypeORM decorators. PostgreSQL table name: **`users`**.

| Column                    | Type              | Constraints              | Notes |
|---------------------------|-------------------|--------------------------|-------|
| `id`                      | `uuid`            | PK, auto-generated       | |
| `username`                | `varchar(50)`     | unique, not null         | 3–50 chars |
| `email`                   | `varchar(320)`    | unique, not null         | |
| `password_hash`           | `text`            | nullable, excluded from SELECTs | Set by Auth Service |
| `contact`                 | `varchar(30)`     | nullable                 | Phone/WhatsApp |
| `role`                    | `enum`            | default `user`           | See role hierarchy below |
| `avatar_url`              | `text`            | nullable                 | |
| `interests`               | `text[]`          | default `{}`             | Sports/esports tags |
| `socials`                 | `jsonb`           | default `{}`             | e.g. `{ "twitter": "..." }` |
| `strava_id`               | `varchar`         | nullable                 | Linked in Phase 4 |
| `steam_id`                | `varchar`         | nullable                 | Linked in Phase 4 |
| `points_balance`          | `integer`         | default `0`              | Managed by Points Service |
| `status`                  | `enum`            | default `active`         | See status values below |
| `settings`                | `jsonb`           | default `{}`             | User preferences |
| `newsletter_subscriptions`| `text[]`          | default `{}`             | Opted-in newsletter tags |
| `active_sponsor_id`       | `uuid`            | nullable                 | FK to sponsors (Phase 1.1) |
| `last_active`             | `timestamptz`     | nullable                 | Updated by Auth Service |
| `created_at`              | `timestamptz`     | auto                     | |
| `updated_at`              | `timestamptz`     | auto                     | |

> `password_hash` uses `select: false` so it is never returned in queries unless explicitly selected. The Auth Service is responsible for writing and verifying this field.

---

## Enums

### `UserRole` (`user-role.enum.ts`)

Ordered from least to most privileged:

| Value         | Description |
|---------------|-------------|
| `guest`       | Unauthenticated visitor — no write access |
| `user`        | Registered member, can view and register for events |
| `member`      | Active club member |
| `core`        | Core team member |
| `coordinator` | Event coordinator — can manage events, announcements, users |
| `founder`     | Full platform admin |

### `UserStatus` (`user-status.enum.ts`)

| Value       | Description |
|-------------|-------------|
| `active`    | Normal account |
| `suspended` | Temporarily blocked |
| `disabled`  | Admin-disabled |
| `deleted`   | Soft-deleted — record retained, functionally removed |

---

## RBAC System (`backend/src/rbac/`)

The RBAC layer is a **temporary bridge** until the Auth Service is complete. It reads role and identity from trusted headers injected by the API Gateway.

### How it works

1. `RolesGuard` reads two headers from every request:
   - `x-user-role` — the caller's role (must be a valid `UserRole` value)
   - `x-user-id` — the caller's UUID
2. It attaches `{ id, role }` to `request.user`.
3. It checks `request.user.role` against the roles declared on the handler via `@Roles(...)`.
4. If the role is not in the allowed list it throws `403 Forbidden`.
5. If no `@Roles(...)` is set the route is public.

### `@Roles(...roles)` decorator

```ts
// Example: restrict to coordinators and founders only
@Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
@Get()
findAll() { ... }
```

### `@CurrentUserId()` param decorator

Extracts `request.user.id` into a controller parameter. Returns `string | undefined`.

```ts
@Get('me')
findMe(@CurrentUserId() userId?: string) { ... }
```

> Once the Auth Service is wired up, `RolesGuard` will be updated to read from the verified JWT payload instead of raw headers. No controller or service changes are needed.

---

## API Endpoints

Base path: `/users`  
Guard: `RolesGuard` applied at controller level.

### `POST /users`

Create a new user (admin action).

- **Roles required:** `coordinator`, `founder`
- **Body:** `CreateUserDto`
- **Response:** `UserResponseDto`
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

- **Roles required:** `user`, `member`, `core`, `coordinator`, `founder`
- **Identity:** resolved from `x-user-id` header via `@CurrentUserId()`
- **Response:** `UserResponseDto`

---

### `PATCH /users/me`

Update the authenticated user's own profile. Only a safe subset of fields is editable.

- **Roles required:** `user`, `member`, `core`, `coordinator`, `founder`
- **Body:** `UpdateMeDto`
- **Response:** `UserResponseDto`

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

> Fields like `role`, `status`, `pointsBalance`, `email` are intentionally excluded — only admins can change those.

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
- **Body:** `UpdateUserDto` — same fields as `CreateUserDto`, all optional (`PartialType`)
- **Response:** `UserResponseDto`
- **Errors:** `404`, `409 Conflict`

---

### `DELETE /users/:id`

Soft-delete a user — sets `status` to `deleted`, retains the record.

- **Roles required:** `coordinator`, `founder`
- **Response:** `UserResponseDto` (with `status: "deleted"`)
- **Errors:** `404 Not Found`

---

## Response Shape (`UserResponseDto`)

All endpoints return this shape. `password_hash` is never included.

```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "contact": "string | null",
  "role": "user | member | core | coordinator | founder | guest",
  "avatarUrl": "string | null",
  "interests": ["string"],
  "socials": { "twitter": "...", "instagram": "..." },
  "stravaId": "string | null",
  "steamId": "string | null",
  "pointsBalance": 0,
  "status": "active | suspended | disabled | deleted",
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
- **Soft delete:** `remove()` sets `status = deleted` and saves — it does not call `DELETE` on the DB row.
- **`updateMe` vs `update`:** `updateMe` is a thin wrapper around `update` using the restricted `UpdateMeDto`. The separation keeps the controller intent clear and makes it easy to add self-edit-specific logic later (e.g., rate limiting field changes).
- **`UsersModule` exports `UsersService`** so other modules (e.g., Auth Service) can inject it without re-declaring the repository.

---

## Known Limitations / TODO (before Phase 1 Frontend)

- `RolesGuard` trusts raw HTTP headers — replace with JWT payload verification once Auth Service is connected.
- `password_hash` is not written by this service; the Auth Service must do so directly or via an internal method to be added to `UsersService`.
- No pagination on `GET /users` yet — add before the admin panel is wired up (Milestone 1.4).
- `activeSponsorId` is a bare UUID column with no FK constraint yet — the FK will be added when the Sponsor table is created in Milestone 1.1.
