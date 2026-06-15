# BGSC Platform — Auth Microservice Variable Register

This document tracks all environment variables, system constants, database tables/columns, Redis keys, and configuration constants used throughout the authentication microservice.

---

## 1. Environment Variables (`.env`)

| Variable Name | Type | Allowed Values / Default | Sensitive? | Purpose / Description |
|---|---|---|---|---|
| `PORT` | Number | `3001` | No | Port on which the auth service listens |
| `NODE_ENV` | String | `development`, `production`, `test` | No | Environment mode |
| `DATABASE_HOST` | String | e.g. `localhost` | No | PostgreSQL database host |
| `DATABASE_PORT` | Number | `5432` | No | PostgreSQL database port |
| `DATABASE_NAME` | String | `bgsc` | No | PostgreSQL database name |
| `DATABASE_USER` | String | `bgsc_auth` | No | PostgreSQL user for auth service |
| `DATABASE_PASSWORD`| String | (Strong password) | Yes | PostgreSQL password |
| `REDIS_HOST` | String | `localhost` | No | Redis server host |
| `REDIS_PORT` | Number | `6379` | No | Redis server port |
| `REDIS_PASSWORD` | String | (Strong password) | Yes | Redis server password |
| `JWT_ACCESS_SECRET`| String | 64-char hex string | Yes | Secret key used to sign JWT Access Tokens |
| `JWT_ACCESS_EXPIRY`| String | `15m` | No | Validity duration of access tokens |
| `JWT_REFRESH_SECRET`| String | 64-char hex string | Yes | Secret key used to sign JWT Temp Tokens / verify Refresh Tokens |
| `JWT_REFRESH_EXPIRY`| String | `7d` | No | Validity duration of refresh sessions in Redis |
| `JWT_ISSUER` | String | `bgsc-auth-service` | No | Token issuer claim |
| `GOOGLE_CLIENT_ID` | String | OAuth client ID | Yes | Google client ID for OAuth2 |
| `GOOGLE_CLIENT_SECRET`| String | OAuth client secret | Yes | Google client secret for OAuth2 |
| `GOOGLE_CALLBACK_URL`| String | Callback URL | No | OAuth2 callback redirect URL |
| `AUTH_TOTP_ENCRYPTION_KEY`| String | 32-byte hex string | Yes | Key used to encrypt/decrypt TOTP secrets in the DB |
| `AUTH_TOTP_ISSUER` | String | `BGSC Platform` | No | TOTP app issuer label |
| `SMTP_HOST` | String | SMTP host | No | Mail server host for forgot password |
| `SMTP_PORT` | Number | e.g. `587` | No | Mail server port |
| `SMTP_USER` | String | SMTP username | No | Mail server credential |
| `SMTP_PASSWORD` | String | SMTP password | Yes | Mail server credentials |
| `SMTP_FROM` | String | Sender email | No | From email address |
| `CORS_ORIGINS` | String | Comma-separated list | No | Allowed CORS origin URLs |
| `BCRYPT_SALT_ROUNDS`| Number | `12` | No | Hashing salt rounds cost factor |

---

## 2. Redis Key Architecture

All Redis keys are namespaced with the `auth:` prefix to prevent collision.

| Redis Key / Pattern | Type | TTL | Purpose / Description |
|---|---|---|---|
| `auth:session:{userId}:{familyId}` | Hash | 7 days | Holds session metadata (`tokenHash`, `deviceIp`, `deviceUserAgent`, `createdAt`, `lastUsedAt`) |
| `auth:session_index:{userId}` | Set | 7 days | Set of active `familyId` values for the user. Supports max session limit of 5 and session listing. |
| `auth:rate:login:{ip}` | Sorted Set (ZSET) | 15 mins | Timestamps of login attempts for rate limiting (max 5/15m) |
| `auth:rate:register:{ip}` | Sorted Set (ZSET) | 1 hour | Timestamps of registration attempts for rate limiting (max 3/h) |
| `auth:rate:password_reset:{email_hash}` | Sorted Set (ZSET) | 1 hour | Timestamps of password reset requests (max 3/h) |
| `auth:rate:totp:{ip}` | Sorted Set (ZSET) | 15 mins | Timestamps of TOTP authentication attempts (max 5/15m) |
| `auth:rate:refresh:{userId}` | Sorted Set (ZSET) | 1 minute | Timestamps of token refresh requests (max 30/m) |
| `auth:rate:general:{userId or ip}`| Sorted Set (ZSET) | 1 minute | Timestamps of other endpoints' requests (max 60/m) |
| `auth:blacklist:{jti}` | String | 15 mins | Blacklisted access token JTI value (revoked tokens) |
| `auth:password_reset:{token_hash}` | Hash | 1 hour | Holds `{ userId, createdAt }` for password reset. Single use. |

---

## 3. Database Schema Variables (PostgreSQL)

### Table `users` (Auth-Owned Columns)
- `id` (UUID): Primary key, default `gen_random_uuid()`
- `username` (VARCHAR(50)): Unique, case-insensitive
- `email` (VARCHAR(255)): Unique, case-insensitive, normalized
- `password_hash` (VARCHAR(255)): Nullable (null for Google OAuth-only users)
- `role` (enum `user_role`): `guest` < `user` < `member` < `core` < `coordinator` < `founder`
- `status` (enum `user_status`): `active`, `disabled`, `pending_deletion`, `deleted`
- `google_id` (VARCHAR(255)): Unique google ID (nullable)
- `totp_secret_enc` (VARCHAR(512)): AES-256-GCM encrypted TOTP secret (nullable)
- `totp_enabled` (BOOLEAN): Defaults to `false`
- `password_reset_token_hash` (VARCHAR(255)): SHA-256 hash of reset token (nullable)
- `password_reset_expires` (TIMESTAMPTZ): Nullable
- `disabled_at` (TIMESTAMPTZ): Nullable
- `disabled_by` (UUID): Reference to `users(id)`
- `deletion_scheduled` (TIMESTAMPTZ): Nullable
- `created_at` (TIMESTAMPTZ): Default `NOW()`
- `updated_at` (TIMESTAMPTZ): Default `NOW()`

### Table `login_audit_log`
- `id` (UUID): Primary key, default `gen_random_uuid()`
- `user_id` (UUID): Nullable (for failed attempts)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `method` (VARCHAR(20)): `local`, `google`, `refresh`
- `success` (BOOLEAN)
- `failure_reason` (VARCHAR(100))
- `created_at` (TIMESTAMPTZ): Default `NOW()`
