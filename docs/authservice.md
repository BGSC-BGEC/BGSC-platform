# Auth Service — Implementation Reference

**Milestone:** 0.2 – Backend Core Services  
**Phase:** 0 (Foundation)  
**Status:** Implemented & tested  
**Port:** 3001

---

## Overview

The Auth Service owns **identity verification** and **credential management**. It is the only service that handles passwords, tokens, sessions, and 2FA. All other services trust the JWTs it issues.

It runs as a **standalone NestJS microservice** under `backend/apps/auth-service/`, with its own Redis connection for session storage and rate limiting.

### What it does

- User registration (credential creation + initial DB row)
- Local login (username/email + password) via Passport Local strategy
- Google OAuth2 login/auto-registration
- JWT access token issuance (short-lived, HS256)
- Refresh token issuance, storage, rotation, and revocation (stored in Redis, sent as HttpOnly cookie)
- Refresh token rotation with family-based breach detection
- Password change (authenticated)
- Password reset (forgot-password email flow)
- TOTP 2FA setup, verification, and disable
- Session tracking — list active devices, revoke individual sessions
- Account disable (coordinator action) and account deletion (30-day grace period)
- GDPR data export trigger
- Rate limiting on all public endpoints
- Emitting domain events: `UserRegistered`, `UserLoggedIn`, `UserDisabled`, `UserDeleted`, `UserSessionBreach`

### What it does NOT do

- Profile editing (bio, avatar, interests) → **User Service**
- Sponsor affiliation → **Sponsor Service**
- Points balance → **Points Service**

---

## File Map

```
backend/apps/auth-service/
├── src/
│   ├── main.ts                           — Bootstrap: Helmet, CORS, ValidationPipe, cookieParser
│   ├── auth.module.ts                    — Root module wiring
│   ├── config/
│   │   └── auth.config.ts                — Typed config from env vars (Joi validation)
│   ├── controllers/
│   │   ├── auth.controller.ts            — /auth/* routes
│   │   ├── account.controller.ts         — /account/* routes (disable, delete, export)
│   │   ├── session.controller.ts         — /auth/sessions routes
│   │   └── totp.controller.ts            — /auth/totp/* routes
│   ├── services/
│   │   ├── auth.service.ts               — Core logic: register, login, refresh, logout
│   │   ├── password.service.ts           — bcrypt hashing, reset token generation
│   │   ├── token.service.ts              — JWT signing, refresh token creation and rotation
│   │   ├── session.service.ts            — Redis session CRUD, device tracking, breach detection
│   │   ├── totp.service.ts               — TOTP secret generation, AES-256-GCM encryption, QR, verification
│   │   ├── email.service.ts              — Nodemailer password reset emails
│   │   ├── event-bus.service.ts          — Domain event emission (logger stub for MVP)
│   │   ├── account.service.ts            — Disable, delete, cancel-deletion, GDPR export
│   │   └── account-deletion.job.ts       — Daily cron: permanently delete past-grace-period users
│   ├── strategies/
│   │   ├── local.strategy.ts             — Passport Local: verifies username/password
│   │   ├── jwt.strategy.ts               — Passport JWT: validates access tokens
│   │   └── google.strategy.ts            — Passport Google OAuth2
│   ├── guards/
│   │   ├── local-auth.guard.ts
│   │   ├── jwt-auth.guard.ts
│   │   ├── google-auth.guard.ts
│   │   ├── roles.guard.ts                — RBAC role check (reads request.user from JWT)
│   │   └── rate-limit.guard.ts           — Redis sliding-window rate limiter
│   ├── decorators/
│   │   ├── roles.decorator.ts            — @Roles('coordinator', 'founder')
│   │   └── current-user.decorator.ts     — @CurrentUser() extracts user from JWT payload
│   ├── dto/                              — Request body shapes with class-validator
│   ├── entities/
│   │   ├── user-credential.entity.ts     — TypeORM entity for auth-owned columns
│   │   └── login-audit-log.entity.ts     — TypeORM entity for audit log
│   ├── migrations/
│   │   └── 1718520000000-AddTotpAndAccountLifecycleAndAuditLog.ts — Idempotent migration
│   ├── interfaces/                       — JwtPayload, TokenPair, Session interfaces
│   ├── exceptions/                       — InvalidCredentials, TokenReuseDetected, etc.
│   └── constants/
│       ├── roles.constant.ts             — UserRole and UserStatus enums
│       └── rate-limits.constant.ts
```

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | Signs access tokens — must match User Service |
| `JWT_REFRESH_SECRET` | Yes | Signs refresh tokens — **must differ** from access secret |
| `JWT_ISSUER` | No | Default `bgsc-auth-service` — validated by User Service |
| `AUTH_TOTP_ENCRYPTION_KEY` | Yes | 64-char hex (32 bytes) — AES-256-GCM key for TOTP secrets |
| `GOOGLE_CLIENT_ID` | Yes | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Yes | Must match the redirect URI registered with Google |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | Yes | Email for password reset |
| `CORS_ORIGINS` | Yes | Comma-separated list of allowed origins |
| `BCRYPT_SALT_ROUNDS` | No | Default `12` |
| `PORT` | No | Default `3001` |

> `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` **must** be different values. If they are the same, a refresh token could be used as an access token and bypass expiry checks.

---

## Database Schema

The `users` table is **shared** between the Auth Service and User Service. Each service owns a subset of columns. Both migrations use `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` so they are safe to run in any order. `synchronize` is disabled to prevent either service from dropping the other's columns.

### Auth-Owned Columns on `users` Table

| Column                     | Type              | Notes |
|----------------------------|-------------------|-------|
| `id`                       | `uuid` PK         | Shared skeleton |
| `username`                 | `varchar(50)`     | Shared skeleton, unique |
| `email`                    | `varchar(320)`    | Shared skeleton, unique |
| `role`                     | `varchar(50)`     | Default `user` |
| `status`                   | `varchar(50)`     | Default `active` |
| `password_hash`            | `text`            | Nullable — OAuth-only users have no password |
| `google_id`                | `varchar(255)`    | Partial unique index (WHERE NOT NULL) |
| `totp_secret_enc`          | `varchar(512)`    | AES-256-GCM encrypted TOTP secret |
| `totp_enabled`             | `boolean`         | Default `false` |
| `totp_backup_codes_hash`   | `text`            | bcrypt-hashed backup codes (JSON) |
| `password_reset_token_hash`| `varchar(255)`    | SHA-256 hash of reset token |
| `password_reset_expires`   | `timestamptz`     | Reset token expiry |
| `disabled_at`              | `timestamptz`     | Set when account is disabled |
| `disabled_by`              | `uuid`            | Actor who disabled the account |
| `deletion_scheduled`       | `timestamptz`     | 30 days after deletion request |
| `created_at` / `updated_at`| `timestamptz`     | Shared skeleton |

### `login_audit_log` Table

Every login attempt (success or failure) is logged here.

| Column           | Type             | Notes |
|------------------|------------------|-------|
| `id`             | `uuid` PK        | |
| `user_id`        | `uuid`           | Nullable — null on failed username lookup |
| `ip_address`     | `varchar(45)`    | IPv4 or IPv6 |
| `user_agent`     | `text`           | |
| `method`         | `varchar(20)`    | `local`, `google`, `refresh` |
| `success`        | `boolean`        | |
| `failure_reason` | `varchar(100)`   | `invalid_password`, `account_disabled`, `rate_limited`, etc. |
| `created_at`     | `timestamptz`    | |

---

## Enums

### `UserRole` (`constants/roles.constant.ts`)

| Value         | Description |
|---------------|-------------|
| `guest`       | Unauthenticated visitor |
| `user`        | Registered member |
| `member`      | Active club member |
| `core`        | Core team member |
| `coordinator` | Can manage events, announcements, and users |
| `founder`     | Full platform admin |

### `UserStatus` (`constants/roles.constant.ts`)

| Value              | Description |
|--------------------|-------------|
| `active`           | Normal account |
| `disabled`         | Admin-disabled — login rejected with 403 |
| `pending_deletion` | User requested deletion — 30-day grace period |
| `deleted`          | Permanently removed by the deletion cron |

---

## JWT Token Design

### Access Token

- Algorithm: `HS256`, signed with `JWT_ACCESS_SECRET`
- Expiry: `15 minutes`
- Storage (client): in-memory only — never localStorage

**Payload (`JwtPayload`):**

```ts
{
  sub: string;       // User ID (UUID)
  username: string;
  email: string;
  role: UserRole;
  jti: string;       // UUIDv4 — used to blacklist on forced logout
  iat: number;
  exp: number;
  iss: string;       // 'bgsc-auth-service'
}
```

### Refresh Token

- Format: opaque string — `<userId>.<familyId>.<randomBytes64>`
- Expiry: `7 days`
- Storage (server): Redis hash at `auth:session:{userId}:{familyId}` — only the SHA-256 hash is stored
- Storage (client): `HttpOnly; Secure; SameSite=Strict` cookie named `bgsc_refresh_token`
- Rotated on every use

The refresh token is **not a JWT** — it is an opaque string validated against Redis. This allows instant revocation without a blacklist.

---

## Refresh Token Rotation & Breach Detection

Every `POST /auth/refresh` call:

1. Parses `userId` and `familyId` from the token format
2. Fetches `auth:session:{userId}:{familyId}` from Redis
3. Compares `SHA-256(presentedToken)` against the stored hash
4. **If they match:** generates a new token, updates Redis, returns new access + refresh tokens
5. **If they don't match (reuse of a rotated-out token):** deletes ALL sessions for that user, emits `UserSessionBreach`, returns `401`

The `familyId` ties together a chain of rotations. Replaying an old token from anywhere in the chain triggers the breach response.

---

## Redis Key Architecture

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `auth:session:{userId}:{familyId}` | Hash | 7 days | One refresh session. Fields: `tokenHash`, `deviceIp`, `deviceUserAgent`, `createdAt`, `lastUsedAt` |
| `auth:session_index:{userId}` | Set | 7 days | All active family IDs for a user — used for session listing and logout-all |
| `auth:rate:login:{ip}` | Sorted Set | 15 min | Sliding window: max 5 per 15 min |
| `auth:rate:register:{ip}` | Sorted Set | 1 hour | Sliding window: max 3 per hour |
| `auth:rate:password_reset:{emailHash}` | Sorted Set | 1 hour | Sliding window: max 3 per hour |
| `auth:blacklist:{jti}` | String | 15 min | Blacklisted access token JTIs — TTL matches token lifetime |

---

## API Endpoints

### `POST /auth/register`

Public. Rate-limited: 3/hour/IP.

**Request body:** `username` (3–50, alphanumeric+underscore), `email`, `password` (min 8, requires uppercase + number + special char), `acceptedTos: true`

**Response (201):**
```json
{ "user": { "id", "username", "email", "role" }, "accessToken": "...", "isNewUser": true }
```
+ `Set-Cookie: bgsc_refresh_token=...`

**Errors:** `400` validation, `409` duplicate username/email, `429` rate limit

---

### `POST /auth/login`

Public. Rate-limited: 5/15min/IP. Accepts `username` or `email` in the `username` field.

**Response (200) — no TOTP:**
```json
{ "user": { "id", "username", "role" }, "accessToken": "...", "isNewUser": false }
```

**Response (200) — TOTP required:**
```json
{ "requiresTOTP": true, "tempToken": "..." }
```
The `tempToken` is a short-lived JWT (5 min, `purpose: "totp_verification"`) valid only for `POST /auth/totp/authenticate`.

**Errors:** `401` invalid credentials (generic — never reveals whether username or password was wrong), `403` account disabled or pending deletion, `429` rate limit

Every attempt (success or failure) is written to `login_audit_log`.

---

### `POST /auth/refresh`

Cookie-authenticated. Reads `bgsc_refresh_token` cookie. No request body.

**Response (200):**
```json
{ "accessToken": "..." }
```
+ `Set-Cookie: bgsc_refresh_token=<new-rotated-token>`

**Errors:** `401` missing/expired/invalid token, `401` + all sessions revoked on token reuse

---

### `POST /auth/logout`

JWT-authenticated. Revokes the current session family from Redis, blacklists the access token JTI, clears the cookie.

---

### `POST /auth/logout-all`

JWT-authenticated. Revokes every session for the current user.

---

### `POST /auth/change-password`

JWT-authenticated.

**Body:** `{ currentPassword?: string, newPassword: string }`

- `currentPassword` is required if the user has a password hash; optional for OAuth-only users setting a password for the first time.
- On success: revokes all OTHER sessions (current session stays alive).

---

### `POST /auth/forgot-password`

Public. Rate-limited: 3/hour/email hash.

Always returns `200` regardless of whether the email exists (prevents enumeration). Sends a reset link to the email if found.

---

### `POST /auth/reset-password`

Public. **Body:** `{ token: string, newPassword: string }`

Validates the raw token against the Redis-stored SHA-256 hash, updates the password, revokes all sessions.

---

### `GET /auth/sessions`

JWT-authenticated. Returns all active sessions for the current user:
```json
[{ "familyId", "deviceIp", "deviceUserAgent", "createdAt", "lastUsedAt", "isCurrent" }]
```

---

### `DELETE /auth/sessions/:familyId`

JWT-authenticated. Revokes a specific session by family ID. Cannot revoke the current session (use `/auth/logout` for that).

---

### `POST /auth/totp/setup`

JWT-authenticated. Generates and encrypts a TOTP secret, returns `{ secret, qrCodeDataUrl, backupCodes }`. TOTP is **not** enabled yet — user must verify first.

### `POST /auth/totp/verify-setup`

JWT-authenticated. **Body:** `{ token: "123456" }`. If valid against the setup secret, sets `totp_enabled = true`.

### `POST /auth/totp/authenticate`

Temp-token-authenticated. **Body:** `{ totpCode: "123456" }`. Validates code (or backup code). On success, issues full access + refresh tokens.

### `POST /auth/totp/disable`

JWT-authenticated. **Body:** `{ totpCode: "123456" }`. Must verify current TOTP before disabling.

---

### `POST /account/disable`

JWT-authenticated. Coordinators and founders can disable any account; any user can disable their own.

Sets `status = disabled`, `disabled_at`, `disabled_by`. Revokes all active sessions. Emits `UserDisabled`.

### `POST /account/:userId/enable`

JWT-authenticated. **Roles:** `coordinator`, `founder`. Reverses a disable.

### `POST /account/delete`

JWT-authenticated (own account only). Sets `status = pending_deletion`, `deletion_scheduled = NOW() + 30 days`. Revokes all sessions. A daily cron permanently deletes rows past the grace period.

### `POST /account/cancel-deletion`

JWT-authenticated. Cancels a pending deletion and restores `status = active`.

### `POST /account/export`

JWT-authenticated (own account only). Emits `UserDataExportRequested` for async GDPR data collection. Rate-limited: 1/24h.

---

## Google OAuth2

### `GET /auth/google`

Redirects to Google's consent screen. Generates a cryptographically random `state` parameter (CSRF token) stored in Redis with a 10-minute TTL.

### `GET /auth/google/callback`

Validates `state`, exchanges the code for a Google profile, then:
- **If `google_id` found in DB:** logs in the existing user
- **If `google_id` not found but email matches an existing account:** returns an error asking the user to log in with password first (prevents account takeover)
- **If neither:** auto-registers a new user (`password_hash = null`, `role = user`)

Returns access token in a URL fragment (`#access_token=...`) — fragments are not sent in HTTP requests, so they don't leak in server logs or referrer headers.

---

## Domain Events

All events use the envelope:
```ts
{ eventId: uuid, eventType: string, timestamp: ISO8601, producer: 'auth-service', payload: {} }
```

| Event | When | Key payload fields |
|---|---|---|
| `UserRegistered` | Registration success | `userId`, `email`, `username` |
| `UserLoggedIn` | Login success | `userId`, `device`, `ip`, `method` |
| `UserPasswordChanged` | Password change/reset | `userId` |
| `UserDisabled` | Account disabled | `userId`, `reason`, `disabledBy` |
| `UserDeleted` | Hard deletion by cron | `userId` |
| `UserSessionBreach` | Refresh token reuse detected | `userId`, `ip`, `userAgent` |
| `UserAllSessionsRevoked` | Logout-all or breach response | `userId`, `reason` |

For MVP, `EventBusService` logs events — no message broker is wired yet. The interface is ready for Kafka/RabbitMQ in a later phase.

---

## Security Notes

- Refresh tokens are stored as SHA-256 hashes in Redis — raw tokens are never persisted
- Password reset tokens are stored as SHA-256 hashes — raw tokens only travel in the email
- TOTP secrets are encrypted with AES-256-GCM using `AUTH_TOTP_ENCRYPTION_KEY` — not stored in plaintext
- All auth error messages are generic to prevent username/email enumeration
- Rate limiting uses Redis sorted-set sliding windows to avoid fixed-window boundary bursts
- Refresh token cookie: `HttpOnly; Secure; SameSite=Strict; Path=/auth`
- Max 5 concurrent sessions per user — 6th login evicts the oldest by `lastUsedAt`

---

## Known Limitations / TODO (before Phase 1 Frontend)

- `EventBusService` is a logger stub — wire Kafka/RabbitMQ in Phase 1 when the Notification Service is built.
- GDPR export (`POST /account/export`) emits an event but no consumer exists yet.
- Google OAuth `state` is stored in Redis but the current `GoogleStrategy` uses Passport's built-in state handling — verify this matches the Redis-based approach before Phase 1.
- No Swagger UI configured yet — add `@nestjs/swagger` decorators before the API is opened to frontend integration.
