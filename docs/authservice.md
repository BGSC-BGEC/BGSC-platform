# BGSC Platform — Auth Microservice: Complete Implementation Plan

> **Scope:** This document covers the Auth Service exclusively — every endpoint, every security decision, every token lifecycle edge case, and every byte of schema. Nothing is left to interpretation.
>
> **Deadline:** Backend MVP functional by **June 26, 2026**.
>
> **Framework:** NestJS (TypeScript) · `@nestjs/passport` · `@nestjs/jwt`

---

## Table of Contents

1. [Service Responsibilities & Boundaries](#1-service-responsibilities--boundaries)
2. [Technology Choices & Dependencies](#2-technology-choices--dependencies)
3. [Directory Structure](#3-directory-structure)
4. [Database Schema](#4-database-schema)
5. [Redis Key Architecture](#5-redis-key-architecture)
6. [Environment Variables](#6-environment-variables)
7. [Password Policy & Hashing](#7-password-policy--hashing)
8. [JWT Token Lifecycle](#8-jwt-token-lifecycle)
9. [Refresh Token Rotation (RTR)](#9-refresh-token-rotation-rtr)
10. [Google OAuth2 Flow](#10-google-oauth2-flow)
11. [TOTP Two-Factor Authentication](#11-totp-two-factor-authentication)
12. [Rate Limiting](#12-rate-limiting)
13. [RBAC Enforcement](#13-rbac-enforcement)
14. [API Endpoints — Full Specification](#14-api-endpoints--full-specification)
15. [Domain Events Emitted](#15-domain-events-emitted)
16. [Account Lifecycle (Disable, Delete, GDPR)](#16-account-lifecycle-disable-delete-gdpr)
17. [Session Management & Device Tracking](#17-session-management--device-tracking)
18. [Security Headers & Transport Security](#18-security-headers--transport-security)
19. [Error Handling Contract](#19-error-handling-contract)
20. [Testing Strategy](#20-testing-strategy)
21. [Implementation Steps (Ordered)](#21-implementation-steps-ordered)

---

## 1. Service Responsibilities & Boundaries

The Auth Service owns **identity verification** and **credential management**. It does NOT own user profiles, interests, or sponsor affiliations — those belong to the User Service.

### What the Auth Service DOES:

- User registration (credential creation + initial record)
- Local login (username/email + password)
- Google OAuth2 login/registration
- JWT access token issuance (short-lived)
- Refresh token issuance, storage, rotation, and revocation
- Password reset flow (forgot password → email token → reset)
- Password change (authenticated session)
- TOTP 2FA setup, verification, and reset
- Session tracking (which devices hold valid refresh tokens)
- Account disable (soft delete) and account deletion (hard delete with grace period)
- GDPR data export trigger
- Rate limiting on auth endpoints
- Emitting domain events: `UserRegistered`, `UserLoggedIn`, `UserRoleChanged`, `UserDisabled`, `UserDeleted`

### What the Auth Service does NOT do:

- Profile editing (bio, avatar, interests) → **User Service**
- Sponsor affiliation → **Sponsor Service**
- Points balance → **Points Service**
- Role promotion logic (business rules for who can promote whom) → **User Service**, though the Auth Service enforces TOTP verification gates when the User Service calls it

---

## 2. Technology Choices & Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `@nestjs/core` | `^10.x` | Framework core |
| `@nestjs/passport` | `^10.x` | Authentication strategies |
| `@nestjs/jwt` | `^10.x` | JWT signing/verification |
| `passport-local` | `^1.x` | Username/password strategy |
| `passport-google-oauth20` | `^2.x` | Google OAuth2 strategy |
| `bcrypt` | `^5.x` | Password hashing (cost factor 12) |
| `otplib` | `^12.x` | TOTP generation/verification (RFC 6238) |
| `qrcode` | `^1.x` | QR code generation for TOTP setup |
| `ioredis` | `^5.x` | Redis client for sessions & rate limiting |
| `typeorm` | `^0.3.x` | ORM for PostgreSQL |
| `class-validator` | `^0.14.x` | DTO validation |
| `class-transformer` | `^0.5.x` | DTO transformation |
| `helmet` | `^7.x` | Security headers |
| `uuid` | `^9.x` | Token family IDs |
| `nodemailer` | `^6.x` | Password reset emails |
| `crypto` (Node built-in) | — | Secure random token generation |

---

## 3. Directory Structure

```
backend/apps/auth-service/
├── src/
│   ├── main.ts                           # Bootstrap, Helmet, CORS, global pipes
│   ├── auth.module.ts                    # Root module wiring
│   ├── config/
│   │   └── auth.config.ts                # Typed config from env vars
│   ├── controllers/
│   │   ├── auth.controller.ts            # /auth/* routes
│   │   └── account.controller.ts         # /account/* routes (disable, delete, export)
│   ├── services/
│   │   ├── auth.service.ts               # Core auth logic (register, login, refresh, logout)
│   │   ├── password.service.ts           # Hashing, validation, reset token generation
│   │   ├── token.service.ts              # JWT signing, refresh token creation, rotation
│   │   ├── session.service.ts            # Redis session CRUD, device tracking
│   │   ├── totp.service.ts               # TOTP secret generation, QR, verification
│   │   ├── oauth.service.ts              # Google OAuth2 callback handling
│   │   └── account.service.ts            # Disable, delete, GDPR export
│   ├── strategies/
│   │   ├── local.strategy.ts             # Passport Local strategy
│   │   ├── jwt.strategy.ts               # Passport JWT strategy (access token)
│   │   └── google.strategy.ts            # Passport Google OAuth2 strategy
│   ├── guards/
│   │   ├── local-auth.guard.ts
│   │   ├── jwt-auth.guard.ts
│   │   ├── google-auth.guard.ts
│   │   ├── roles.guard.ts                # RBAC role check guard
│   │   ├── totp.guard.ts                 # Requires valid TOTP code in request
│   │   └── rate-limit.guard.ts           # Redis sliding-window rate limiter
│   ├── decorators/
│   │   ├── roles.decorator.ts            # @Roles('coordinator', 'founder')
│   │   ├── current-user.decorator.ts     # @CurrentUser() extracts user from JWT
│   │   └── public.decorator.ts           # @Public() marks route as unauthenticated
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   ├── refresh-token.dto.ts
│   │   ├── forgot-password.dto.ts
│   │   ├── reset-password.dto.ts
│   │   ├── change-password.dto.ts
│   │   ├── totp-setup.dto.ts
│   │   ├── totp-verify.dto.ts
│   │   └── disable-account.dto.ts
│   ├── entities/
│   │   └── user-credential.entity.ts     # TypeORM entity for auth-owned fields
│   ├── interfaces/
│   │   ├── jwt-payload.interface.ts
│   │   ├── token-pair.interface.ts
│   │   └── session.interface.ts
│   ├── exceptions/
│   │   ├── invalid-credentials.exception.ts
│   │   ├── token-reuse-detected.exception.ts
│   │   ├── account-disabled.exception.ts
│   │   └── rate-limit-exceeded.exception.ts
│   └── constants/
│       ├── roles.constant.ts
│       └── rate-limits.constant.ts
└── test/
    ├── auth.controller.spec.ts
    ├── auth.service.spec.ts
    ├── token.service.spec.ts
    ├── password.service.spec.ts
    ├── session.service.spec.ts
    ├── totp.service.spec.ts
    └── e2e/
        └── auth.e2e-spec.ts
```

---

## 4. Database Schema

The Auth Service owns a subset of columns on the `users` table. In a monorepo setup, all services share one PostgreSQL database but each service only reads/writes its owned columns.

### Auth-Owned Columns on `users` Table

```sql
-- This migration is owned by the Auth Service
-- Other services MUST NOT write to these columns directly

CREATE TYPE user_role AS ENUM ('guest', 'user', 'member', 'core', 'coordinator', 'founder');
CREATE TYPE user_status AS ENUM ('active', 'disabled', 'pending_deletion', 'deleted');

CREATE TABLE users (
    -- Identity (Auth-owned)
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username            VARCHAR(50)  NOT NULL,
    email               VARCHAR(255) NOT NULL,
    password_hash       VARCHAR(255),          -- NULL for OAuth-only users
    role                user_role    NOT NULL DEFAULT 'user',
    status              user_status  NOT NULL DEFAULT 'active',

    -- OAuth
    google_id           VARCHAR(255) UNIQUE,   -- Google OAuth subject ID
    
    -- 2FA
    totp_secret_enc     VARCHAR(512),          -- AES-256-GCM encrypted TOTP secret
    totp_enabled        BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Password Reset
    password_reset_token_hash  VARCHAR(255),   -- SHA-256 hash of reset token
    password_reset_expires     TIMESTAMPTZ,

    -- Account Lifecycle
    disabled_at         TIMESTAMPTZ,
    disabled_by         UUID REFERENCES users(id),
    deletion_scheduled  TIMESTAMPTZ,           -- 30 days after deletion request
    
    -- Timestamps
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email    UNIQUE (email)
);

-- Partial index: only active users need fast username/email lookups
CREATE INDEX idx_users_username_active ON users (username) WHERE status = 'active';
CREATE INDEX idx_users_email_active    ON users (email)    WHERE status = 'active';
CREATE INDEX idx_users_google_id       ON users (google_id) WHERE google_id IS NOT NULL;

-- Audit: every login attempt (successful or failed) is logged
CREATE TABLE login_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,                      -- NULL for failed lookups
    ip_address      INET         NOT NULL,
    user_agent      TEXT         NOT NULL,
    method          VARCHAR(20)  NOT NULL,      -- 'local', 'google', 'refresh'
    success         BOOLEAN      NOT NULL,
    failure_reason  VARCHAR(100),               -- 'invalid_password', 'account_disabled', 'rate_limited', etc.
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_audit_user    ON login_audit_log (user_id, created_at DESC);
CREATE INDEX idx_login_audit_ip      ON login_audit_log (ip_address, created_at DESC);
```

### Why `password_hash` is nullable

Users who register exclusively via Google OAuth2 have no password. They can later set one via the "change password" flow (which, for OAuth-only users, becomes a "set password" flow with no "current password" required).

### Why `totp_secret_enc` is encrypted

The TOTP secret is a long-lived credential. If the database is compromised, raw TOTP secrets would let an attacker generate valid OTPs. We encrypt it with AES-256-GCM using a key derived from `AUTH_TOTP_ENCRYPTION_KEY` (env var), which is NOT stored in the database.

```typescript
// Encryption format stored in DB:
// <iv_hex>:<auth_tag_hex>:<ciphertext_hex>

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptTotpSecret(secret: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptTotpSecret(stored: string, key: Buffer): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  // Note: createDecipheriv needs the iv parameter
  // Corrected: use the iv in createDecipheriv
  const iv = Buffer.from(ivHex, 'hex');
  const decipherCorrect = createDecipheriv(ALGORITHM, key, iv);
  decipherCorrect.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipherCorrect.update(Buffer.from(ciphertextHex, 'hex')),
    decipherCorrect.final(),
  ]);
  return decrypted.toString('utf8');
}
```

---

## 5. Redis Key Architecture

Every Redis key used by the Auth Service follows a strict namespace to prevent collisions with other services.

### Key Map

| Key Pattern | Type | TTL | Contents | Purpose |
|---|---|---|---|---|
| `auth:session:{userId}:{familyId}` | Hash | 7 days | `{ tokenHash, deviceIp, deviceUserAgent, createdAt, lastUsedAt }` | One hash per refresh token family per user. The `familyId` is a UUIDv4 assigned at login and stays constant through rotations within that session. |
| `auth:session_index:{userId}` | Set | 7 days | `{ familyId1, familyId2, ... }` | Index of all active session families for a user. Used for "logout all devices" and session listing. |
| `auth:rate:login:{ip}` | Sorted Set (ZSET) | 15 min | Timestamps of login attempts | Sliding window: max 5 per 15 minutes per IP |
| `auth:rate:register:{ip}` | Sorted Set (ZSET) | 1 hour | Timestamps of registration attempts | Sliding window: max 3 per hour per IP |
| `auth:rate:password_reset:{email_hash}` | Sorted Set (ZSET) | 1 hour | Timestamps of reset requests | Sliding window: max 3 per hour per email |
| `auth:blacklist:{jti}` | String | 15 min (= access token max age) | `"1"` | Blacklisted access token JTI after forced logout. Short TTL because access tokens expire anyway. |
| `auth:password_reset:{token_hash}` | Hash | 1 hour | `{ userId, createdAt }` | Password reset token. SHA-256 hash of the raw token sent to user's email. |

### Why `familyId`?

The family ID ties together a chain of refresh token rotations. If a rotated-out (old) token is ever presented, we know the family has been compromised — we delete the entire family, invalidating all tokens in the chain. This is the core of **Refresh Token Rotation (RTR)** breach detection.

---

## 6. Environment Variables

```ini
# ── Server ──
PORT=3001
NODE_ENV=development

# ── Database ──
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=bgsc
DATABASE_USER=bgsc_auth
DATABASE_PASSWORD=<strong-random-password>

# ── Redis ──
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<strong-random-password>

# ── JWT ──
JWT_ACCESS_SECRET=<64-char-hex-random>       # openssl rand -hex 32
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=<64-char-hex-random>      # Different from access secret
JWT_REFRESH_EXPIRY=7d
JWT_ISSUER=bgsc-auth-service

# ── Google OAuth2 ──
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
GOOGLE_CALLBACK_URL=https://api.bgsc-platform.in/auth/google/callback

# ── TOTP ──
AUTH_TOTP_ENCRYPTION_KEY=<32-byte-hex>       # openssl rand -hex 32
AUTH_TOTP_ISSUER=BGSC Platform

# ── Email (Password Reset) ──
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM=noreply@bgsc-platform.in

# ── CORS ──
CORS_ORIGINS=https://admin.bgsc-platform.in,https://bgsc-platform.in

# ── Bcrypt ──
BCRYPT_SALT_ROUNDS=12
```

> [!CAUTION]
> `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` **MUST** be different values. If they are the same, a refresh token could be used as an access token and bypass expiry checks.

---

## 7. Password Policy & Hashing

### Validation Rules

```typescript
import { IsString, Matches, MinLength } from 'class-validator';

export class PasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least 1 special character' })
  password!: string;
}
```

### Hashing

```typescript
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // From env: BCRYPT_SALT_ROUNDS

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

**Why cost factor 12?** It takes ~250ms on modern hardware — slow enough to frustrate brute-force attacks, fast enough to not degrade UX. Adjust upward as hardware improves.

### Password Reset Token Generation

```typescript
import { randomBytes, createHash } from 'crypto';

export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex'); // 64-char hex string sent to user
  const hash = createHash('sha256').update(raw).digest('hex'); // Stored in Redis + DB
  return { raw, hash };
}
```

We store the **hash**, not the raw token. If Redis or the DB is compromised, the attacker cannot use the stored hash to reset passwords.

---

## 8. JWT Token Lifecycle

### Access Token

| Property | Value |
|---|---|
| Algorithm | `HS256` |
| Expiry | `15 minutes` |
| Signed with | `JWT_ACCESS_SECRET` |
| Storage (client) | In-memory only (JavaScript variable). **Never** in localStorage or sessionStorage. |
| Payload | See below |

### Access Token Payload (`JwtPayload`)

```typescript
export interface JwtPayload {
  sub: string;        // User ID (UUID)
  username: string;
  email: string;
  role: UserRole;     // 'user' | 'member' | 'core' | 'coordinator' | 'founder'
  jti: string;        // Unique token ID (UUIDv4) — for blacklisting on forced logout
  iat: number;        // Issued at (epoch seconds, auto by @nestjs/jwt)
  exp: number;        // Expiry (epoch seconds, auto by @nestjs/jwt)
  iss: string;        // 'bgsc-auth-service'
}
```

### Refresh Token

| Property | Value |
|---|---|
| Format | Opaque UUIDv4 string (NOT a JWT) |
| Expiry | `7 days` |
| Storage (server) | Redis hash at `auth:session:{userId}:{familyId}` |
| Storage (client) | `HttpOnly`, `Secure`, `SameSite=Strict` cookie named `bgsc_refresh_token` |
| Rotation | Every use generates a new token and invalidates the old one |

### Why the refresh token is NOT a JWT

JWTs are self-contained — you cannot revoke them without maintaining a blacklist. By making the refresh token an opaque string validated against Redis, we get:
- Instant revocation (delete the Redis key)
- No need for a blacklist
- Smaller cookie size
- The access token is still a JWT for stateless validation on every request

---

## 9. Refresh Token Rotation (RTR)

This is the most security-critical flow. Get it wrong and you have a session hijacking vulnerability.

### The Flow

```
           Client                        Auth Service                     Redis
             │                                │                             │
             │ 1. POST /auth/refresh           │                             │
             │    Cookie: bgsc_refresh_token=T1│                             │
             ├───────────────────────────────►  │                             │
             │                                 │ 2. Hash T1 → H1             │
             │                                 │ 3. HGET session:{uid}:{fam}  │
             │                                 │    → stored hash             │
             │                                 ├────────────────────────────► │
             │                                 │                             │
             │                                 │ 4a. H1 matches stored hash?  │
             │                                 │     YES → continue           │
             │                                 │                             │
             │                                 │ 5. Generate new token T2     │
             │                                 │    Hash T2 → H2              │
             │                                 │ 6. HSET session:{uid}:{fam}  │
             │                                 │    tokenHash=H2, lastUsed=now│
             │                                 ├────────────────────────────► │
             │                                 │                             │
             │                                 │ 7. Sign new access token     │
             │ 8. Set-Cookie: bgsc_refresh=T2  │                             │
             │    Body: { accessToken: AT2 }   │                             │
             │ ◄───────────────────────────────┤                             │
             │                                 │                             │
             │ ─ ─ ─ ─ BREACH SCENARIO ─ ─ ─ ─│                             │
             │                                 │                             │
             │ 9. Attacker replays T1          │                             │
             ├───────────────────────────────►  │                             │
             │                                 │ 10. Hash T1 → H1            │
             │                                 │ 11. HGET → H2 (not H1!)     │
             │                                 ├────────────────────────────► │
             │                                 │                             │
             │                                 │ 12. MISMATCH DETECTED       │
             │                                 │     → BREACH: Delete ALL     │
             │                                 │       sessions for this user │
             │                                 ├────────────────────────────► │
             │                                 │     → Emit UserSessionBreach │
             │ 13. 401 + clear cookie          │                             │
             │ ◄───────────────────────────────┤                             │
```

### Implementation

```typescript
async refreshTokens(rawToken: string, ip: string, userAgent: string) {
  const tokenHash = this.hashToken(rawToken);
  
  // 1. Find which user+family this token belongs to
  //    We need a reverse lookup: token_hash → (userId, familyId)
  //    Option: encode userId:familyId in the token itself
  //    Format: <userId>.<familyId>.<randomBytes>
  const parts = rawToken.split('.');
  if (parts.length !== 3) throw new InvalidCredentialsException();
  
  const [userId, familyId, _random] = parts;
  const sessionKey = `auth:session:${userId}:${familyId}`;
  
  // 2. Get stored session from Redis
  const session = await this.redis.hgetall(sessionKey);
  if (!session || !session.tokenHash) {
    // Session doesn't exist — token is expired or never existed
    throw new InvalidCredentialsException();
  }
  
  // 3. Compare hashes
  if (session.tokenHash !== tokenHash) {
    // BREACH DETECTED: This token was already rotated out
    // Someone is replaying an old token
    await this.revokeAllUserSessions(userId);
    this.eventBus.emit('UserSessionBreach', { userId, ip, userAgent });
    throw new TokenReuseDetectedException();
  }
  
  // 4. Verify user still exists and is active
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user || user.status !== 'active') {
    await this.redis.del(sessionKey);
    throw new AccountDisabledException();
  }
  
  // 5. Generate new refresh token (same family, new random)
  const newRawToken = `${userId}.${familyId}.${randomBytes(32).toString('hex')}`;
  const newTokenHash = this.hashToken(newRawToken);
  
  // 6. Atomically update Redis
  await this.redis.hset(sessionKey, {
    tokenHash: newTokenHash,
    lastUsedAt: Date.now().toString(),
    deviceIp: ip,
    deviceUserAgent: userAgent,
  });
  await this.redis.expire(sessionKey, 7 * 24 * 60 * 60); // Reset TTL to 7 days
  
  // 7. Sign new access token
  const accessToken = this.signAccessToken(user);
  
  return { accessToken, refreshToken: newRawToken };
}

private hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

---

## 10. Google OAuth2 Flow

### Sequence

```
   Browser/App                 Auth Service              Google OAuth2            Redis
       │                           │                          │                     │
       │ 1. GET /auth/google       │                          │                     │
       ├──────────────────────────►│                          │                     │
       │                           │ 2. Generate `state` param│                     │
       │                           │    (CSRF token = random) │                     │
       │                           │    Store in Redis        │                     │
       │                           ├──────────────────────────┼────────────────────►│
       │ 3. 302 Redirect to Google │                          │                     │
       │    with state, scope,     │                          │                     │
       │    client_id, redirect_uri│                          │                     │
       │◄──────────────────────────┤                          │                     │
       │                           │                          │                     │
       │ 4. User authenticates     │                          │                     │
       │    with Google            │                          │                     │
       ├───────────────────────────┼─────────────────────────►│                     │
       │                           │                          │                     │
       │ 5. Google redirects back  │                          │                     │
       │    /auth/google/callback  │                          │                     │
       │    ?code=XXX&state=YYY    │                          │                     │
       ├──────────────────────────►│                          │                     │
       │                           │ 6. Verify `state` param  │                     │
       │                           │    matches Redis stored  │                     │
       │                           ├──────────────────────────┼────────────────────►│
       │                           │    (delete after verify) │                     │
       │                           │                          │                     │
       │                           │ 7. Exchange code for     │                     │
       │                           │    tokens with Google    │                     │
       │                           ├─────────────────────────►│                     │
       │                           │◄─────────────────────────┤                     │
       │                           │    (id_token, profile)   │                     │
       │                           │                          │                     │
       │                           │ 8. Lookup google_id in DB│                     │
       │                           │    EXISTS? → Login        │                     │
       │                           │    NOT EXISTS? → Register │                     │
       │                           │                          │                     │
       │ 9. Set-Cookie + redirect  │                          │                     │
       │    to frontend with       │                          │                     │
       │    access token in URL    │                          │                     │
       │    fragment (#token=...)  │                          │                     │
       │◄──────────────────────────┤                          │                     │
```

### Critical Security Rules

1. **State parameter:** A cryptographically random 32-byte hex string stored in Redis with a 10-minute TTL. If the callback's `state` doesn't match, reject with `403 Forbidden`. This prevents CSRF attacks.

2. **Access token delivery:** The access token is passed via URL **fragment** (`#access_token=...`), NOT as a query parameter. Fragments are not sent to the server in HTTP requests, so they don't leak in server logs or referrer headers.

3. **Auto-registration:** If the Google user's `sub` (subject ID) is not found in the `google_id` column, create a new user automatically:
   - `username` = email prefix + random 4 digits (e.g., `john.doe.3847`)
   - `email` = Google email (verified by Google)
   - `password_hash` = `NULL` (OAuth-only user)
   - `google_id` = Google `sub` claim
   - `role` = `'user'`
   - **Sponsor selection:** The user is redirected to the onboarding flow after first OAuth login. The frontend handles this — the auth service returns a flag `isNewUser: true` in the response.

4. **Email collision:** If a user already exists with the same email but no `google_id`, we do NOT auto-link. Instead, return an error asking the user to log in with their password first, then link their Google account from settings. This prevents account takeover via email enumeration.

---

## 11. TOTP Two-Factor Authentication

### When TOTP is Required

Per the specification, TOTP is required for:
- Coordinator promotion (Founder must verify their own TOTP before promoting someone to Coordinator)
- Founder actions (sensitive system-wide changes)

Any user CAN enable TOTP for their own login flow via account settings.

### TOTP Setup Flow

```
POST /auth/totp/setup
→ Requires: Authenticated session (JWT)
→ Response: { secret, qrCodeDataUrl, backupCodes }
→ Status: TOTP is NOT enabled yet — user must verify first

POST /auth/totp/verify-setup
→ Requires: Authenticated session + { token: "123456" }
→ Action: If token is valid against the secret from setup, enable TOTP
→ Response: { enabled: true }
```

### TOTP on Login

If `totp_enabled = true` for a user, the login flow becomes two-step:

1. `POST /auth/login` with username+password → Returns `{ requiresTOTP: true, tempToken: "..." }` (short-lived 5-min JWT with limited claims, only valid for the TOTP verification endpoint)
2. `POST /auth/totp/authenticate` with `{ tempToken, totpCode }` → Returns full access+refresh tokens

### Backup Codes

On TOTP setup, generate **10 single-use backup codes** (8-character alphanumeric). Store them bcrypt-hashed in a `totp_backup_codes` JSONB column (or separate table). Each code can only be used once.

```typescript
function generateBackupCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () => 
    randomBytes(4).toString('hex').toUpperCase() // 8-char hex
  );
}
```

---

## 12. Rate Limiting

All rate limits use the **Redis sorted-set sliding window** algorithm. This is more accurate than fixed windows and doesn't suffer from the boundary burst problem.

### Rate Limit Rules

| Endpoint Pattern | Limit | Window | Key |
|---|---|---|---|
| `POST /auth/login` | 5 requests | 15 minutes | `auth:rate:login:{ip}` |
| `POST /auth/register` | 3 requests | 1 hour | `auth:rate:register:{ip}` |
| `POST /auth/forgot-password` | 3 requests | 1 hour | `auth:rate:password_reset:{sha256(email)}` |
| `POST /auth/totp/authenticate` | 5 requests | 15 minutes | `auth:rate:totp:{ip}` |
| `POST /auth/refresh` | 30 requests | 1 minute | `auth:rate:refresh:{userId}` |
| All other auth endpoints | 60 requests | 1 minute | `auth:rate:general:{userId or ip}` |

### Implementation (NestJS Guard)

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const config = this.reflector.get<RateLimitConfig>('rateLimit', context.getHandler());
    
    if (!config) return true; // No rate limit configured

    const key = this.buildKey(config.keyPrefix, request);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);  // Prune expired entries
    pipeline.zadd(key, now, `${now}:${randomBytes(4).toString('hex')}`); // Unique member
    pipeline.zcard(key);                              // Count in window
    pipeline.expire(key, Math.ceil(config.windowMs / 1000)); // Auto-cleanup

    const results = await pipeline.exec();
    const count = results![2][1] as number;

    if (count > config.max) {
      const oldestInWindow = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const retryAfterMs = oldestInWindow.length >= 2 
        ? config.windowMs - (now - parseInt(oldestInWindow[1], 10))
        : config.windowMs;

      throw new RateLimitExceededException(Math.ceil(retryAfterMs / 1000));
    }

    return true;
  }

  private buildKey(prefix: string, request: any): string {
    const identifier = request.user?.sub || request.ip;
    return `${prefix}:${identifier}`;
  }
}
```

### Response on Rate Limit Hit

```
HTTP/1.1 429 Too Many Requests
Retry-After: 540
Content-Type: application/json

{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 540 seconds.",
  "retryAfter": 540
}
```

---

## 13. RBAC Enforcement

### Role Hierarchy

```
founder > coordinator > core > member > user > guest
```

### Guard Implementation

```typescript
// roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  private static readonly HIERARCHY: Record<UserRole, number> = {
    guest: 0,
    user: 1,
    member: 2,
    core: 3,
    coordinator: 4,
    founder: 5,
  };

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // User's role level must be >= the minimum required role level
    const userLevel = RolesGuard.HIERARCHY[user.role] ?? 0;
    const minRequired = Math.min(
      ...requiredRoles.map(r => RolesGuard.HIERARCHY[r] ?? 999),
    );
    return userLevel >= minRequired;
  }
}
```

### Usage on Endpoints

```typescript
@Post('admin/promote')
@Roles('coordinator', 'founder')  // Only coordinator and above can hit this
@UseGuards(JwtAuthGuard, RolesGuard)
async promoteUser(@Body() dto: PromoteUserDto) { ... }
```

---

## 14. API Endpoints — Full Specification

### 14.1 `POST /auth/register`

| Field | Value |
|---|---|
| **Access** | Public (unauthenticated) |
| **Rate Limit** | 3 / hour / IP |
| **Content-Type** | `application/json` |

**Request Body:**

```typescript
export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username may only contain letters, numbers, and underscores' })
  username!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least 1 special character' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact?: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms of Service' })
  acceptedTos!: boolean;
}
```

**Success Response** (`201 Created`):

```json
{
  "user": {
    "id": "d748f219-5509-410a-ba53-6a9788f8d55c",
    "username": "athlete_goa",
    "email": "athlete@bits-goa.ac.in",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "isNewUser": true
}
```

**Set-Cookie Header:**

```
Set-Cookie: bgsc_refresh_token=<userId>.<familyId>.<random>; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=604800
```

**Error Responses:**

| Status | Condition |
|---|---|
| `400` | Validation failure (weak password, invalid email, etc.) |
| `409` | Username or email already exists |
| `429` | Rate limit exceeded |

**Domain Event Emitted:** `UserRegistered`

---

### 14.2 `POST /auth/login`

| Field | Value |
|---|---|
| **Access** | Public (unauthenticated) |
| **Rate Limit** | 5 / 15 min / IP |

**Request Body:**

```typescript
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  usernameOrEmail!: string;  // Accept either

  @IsString()
  @IsNotEmpty()
  password!: string;
}
```

**Success Response — No TOTP** (`200 OK`):

```json
{
  "user": {
    "id": "d748f219-...",
    "username": "athlete_goa",
    "role": "user"
  },
  "accessToken": "eyJ...",
  "isNewUser": false
}
```

+ `Set-Cookie: bgsc_refresh_token=...`

**Success Response — TOTP Required** (`200 OK`):

```json
{
  "requiresTOTP": true,
  "tempToken": "eyJ..."
}
```

The `tempToken` is a JWT with:
- `exp`: 5 minutes
- `sub`: user ID
- `purpose`: `"totp_verification"` (MUST be checked — prevents use as access token)

**Error Responses:**

| Status | Condition |
|---|---|
| `401` | Invalid credentials (generic message — do NOT reveal whether username or password was wrong) |
| `403` | Account disabled |
| `429` | Rate limit exceeded |

**Audit:** Every login attempt (success or failure) is logged in `login_audit_log`.

**Domain Event Emitted:** `UserLoggedIn` (on success only)

---

### 14.3 `POST /auth/refresh`

| Field | Value |
|---|---|
| **Access** | Cookie-authenticated (refresh token in `bgsc_refresh_token` cookie) |
| **Rate Limit** | 30 / min / userId |

**Request:** No body. The refresh token is read from the cookie.

**Success Response** (`200 OK`):

```json
{
  "accessToken": "eyJ..."
}
```

+ `Set-Cookie: bgsc_refresh_token=<new-rotated-token>; ...`

**Error Responses:**

| Status | Condition |
|---|---|
| `401` | Missing, malformed, expired, or invalid refresh token |
| `401` + all sessions revoked | Reuse of a previously rotated token (breach detection) |

---

### 14.4 `POST /auth/logout`

| Field | Value |
|---|---|
| **Access** | Authenticated (JWT) |

**Action:**
1. Delete the session family from Redis (`auth:session:{userId}:{familyId}`)
2. Remove `familyId` from `auth:session_index:{userId}`
3. Blacklist the current access token's `jti` in `auth:blacklist:{jti}` with TTL = remaining token lifetime
4. Clear the `bgsc_refresh_token` cookie

**Success Response** (`200 OK`):

```json
{ "message": "Logged out successfully" }
```

+ `Set-Cookie: bgsc_refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/auth; Max-Age=0`

---

### 14.5 `POST /auth/logout-all`

| Field | Value |
|---|---|
| **Access** | Authenticated (JWT) |

**Action:**
1. Get all family IDs from `auth:session_index:{userId}`
2. Delete every `auth:session:{userId}:{familyId}` key
3. Delete the index set
4. Blacklist current access token's `jti`
5. Clear cookie

**Domain Event Emitted:** `UserAllSessionsRevoked`

---

### 14.6 `POST /auth/forgot-password`

| Field | Value |
|---|---|
| **Access** | Public |
| **Rate Limit** | 3 / hour / email hash |

**Request Body:**

```typescript
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
```

**Action:**
1. Look up user by email
2. If not found, **still return 200** (do not reveal whether email exists)
3. If found: generate reset token (64-char hex), store SHA-256 hash in Redis with 1-hour TTL, store hash + expiry in DB as fallback
4. Send email with reset link: `https://bgsc-platform.in/reset-password?token=<raw_token>`

**Success Response** (`200 OK` — always, regardless of whether email exists):

```json
{ "message": "If an account with that email exists, a reset link has been sent." }
```

---

### 14.7 `POST /auth/reset-password`

| Field | Value |
|---|---|
| **Access** | Public (token-authenticated) |

**Request Body:**

```typescript
export class ResetPasswordDto {
  @IsString()
  token!: string;  // The raw 64-char hex token from the email link

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/)
  @Matches(/[0-9]/)
  @Matches(/[^A-Za-z0-9]/)
  newPassword!: string;
}
```

**Action:**
1. SHA-256 hash the provided token
2. Look up `auth:password_reset:{hash}` in Redis
3. If not found or expired → `400 Bad Request`
4. Update `password_hash` in DB
5. Delete the Redis key (single-use)
6. Revoke ALL active sessions for this user (force re-login with new password)
7. Clear `password_reset_token_hash` and `password_reset_expires` in DB

---

### 14.8 `POST /auth/change-password`

| Field | Value |
|---|---|
| **Access** | Authenticated (JWT) |

**Request Body:**

```typescript
export class ChangePasswordDto {
  @IsOptional()  // Not required for OAuth-only users setting password for first time
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/)
  @Matches(/[0-9]/)
  @Matches(/[^A-Za-z0-9]/)
  newPassword!: string;
}
```

**Logic:**
- If `user.password_hash` is NOT null → `currentPassword` is **required** and must verify
- If `user.password_hash` IS null (OAuth-only user) → `currentPassword` is not needed (they're setting a password for the first time)
- `newPassword` must not equal `currentPassword`

**After success:** Revoke all OTHER sessions (keep current session alive). Emit notification: "Password changed successfully."

---

### 14.9 `GET /auth/google`

Redirects to Google's OAuth2 consent screen. Generates and stores a CSRF `state` parameter.

### 14.10 `GET /auth/google/callback`

Handles the OAuth2 callback. Validates `state`, exchanges `code` for tokens, creates or finds user, issues tokens.

### 14.11 `POST /auth/totp/setup`

**Access:** Authenticated (JWT)

Generates a TOTP secret, encrypts it, stores it temporarily (not yet enabled), returns QR code data URL and backup codes.

### 14.12 `POST /auth/totp/verify-setup`

**Access:** Authenticated (JWT) + `{ token: "123456" }`

Verifies the code against the pending secret. If valid, sets `totp_enabled = true`, stores encrypted secret and hashed backup codes permanently.

### 14.13 `POST /auth/totp/authenticate`

**Access:** Temp token from login + `{ totpCode: "123456" }`

Validates the TOTP code (or a backup code). On success, issues full access + refresh tokens.

### 14.14 `POST /auth/totp/disable`

**Access:** Authenticated (JWT) + `{ totpCode: "123456" }` (must verify current TOTP to disable)

Sets `totp_enabled = false`, clears `totp_secret_enc`.

### 14.15 `GET /auth/sessions`

**Access:** Authenticated (JWT)

Returns a list of all active sessions (devices) for the current user. Each entry includes: `familyId`, `deviceIp`, `deviceUserAgent`, `createdAt`, `lastUsedAt`, `isCurrent`.

### 14.16 `DELETE /auth/sessions/:familyId`

**Access:** Authenticated (JWT)

Revokes a specific session by family ID. Cannot revoke current session (use `/auth/logout` for that).

---

## 15. Domain Events Emitted

All events follow the envelope format:

```typescript
interface DomainEvent<T> {
  eventId: string;       // UUIDv4
  eventType: string;     // Event name
  timestamp: string;     // ISO 8601
  producer: 'auth-service';
  payload: T;
}
```

| Event | Payload | Consumers |
|---|---|---|
| `UserRegistered` | `{ userId, email, username, timestamp }` | User Service (creates profile), Notification Service (welcome email) |
| `UserLoggedIn` | `{ userId, device, ip, method, timestamp }` | Notification Service (new device alert if IP is new) |
| `UserPasswordChanged` | `{ userId, timestamp }` | Notification Service (security alert) |
| `UserDisabled` | `{ userId, reason, disabledBy, timestamp }` | Notification Service, all services (reject requests from this user) |
| `UserDeleted` | `{ userId, timestamp }` | All services (cascade cleanup) |
| `UserTOTPEnabled` | `{ userId, timestamp }` | Audit Service |
| `UserTOTPDisabled` | `{ userId, timestamp }` | Audit Service |
| `UserSessionBreach` | `{ userId, ip, userAgent, timestamp }` | Notification Service (urgent alert), Audit Service |
| `UserAllSessionsRevoked` | `{ userId, reason, timestamp }` | Audit Service |

---

## 16. Account Lifecycle (Disable, Delete, GDPR)

### Disable Account (Soft Delete)

```
POST /account/disable
Access: Authenticated (own account) OR Coordinator/Founder (any account)
```

- Sets `status = 'disabled'`, `disabled_at = NOW()`, `disabled_by = actor_id`
- Revokes all active sessions
- Emits `UserDisabled`
- User can be re-enabled by Coordinator/Founder via `POST /account/:userId/enable`

### Delete Account (Hard Delete with Grace Period)

```
POST /account/delete
Access: Authenticated (own account only)
```

- Sets `status = 'pending_deletion'`, `deletion_scheduled = NOW() + 30 days`
- Revokes all active sessions
- A scheduled job (cron) runs daily and permanently deletes users where `deletion_scheduled < NOW()`
- During the 30-day grace period, user can cancel by logging in → `POST /account/cancel-deletion`

### GDPR Data Export

```
POST /account/export
Access: Authenticated (own account only)
```

- Triggers an async job that collects all user data across services
- Emits `UserDataExportRequested` event → each service compiles its data
- Result is emailed as a ZIP file to the user's registered email
- Rate limited: 1 export per 24 hours

---

## 17. Session Management & Device Tracking

### "Keep Me Logged In" Toggle

- **If ON:** Refresh token TTL = 7 days (standard)
- **If OFF:** Refresh token TTL = 24 hours, AND the `bgsc_refresh_token` cookie is set **without** `Max-Age` (making it a session cookie that's deleted when the browser closes)

### Device Fingerprinting

Each session stores the IP address and User-Agent. When a refresh token is used from a significantly different context (new IP from a different country, or completely different User-Agent), emit a `UserLoggedIn` event with `isNewDevice: true` so the Notification Service can alert the user.

### Maximum Concurrent Sessions

Limit: **5 active sessions** per user. If a 6th login occurs, the oldest session (by `lastUsedAt`) is automatically revoked.

---

## 18. Security Headers & Transport Security

Applied globally in `main.ts`:

```typescript
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,  // Required for cookies
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Remaining', 'Retry-After'],
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // Strip unknown properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true,            // Auto-transform to DTO types
    transformOptions: { enableImplicitConversion: false },
  }));

  // Cookie parser
  app.use(cookieParser());

  await app.listen(process.env.PORT || 3001);
}
```

---

## 19. Error Handling Contract

All error responses follow a consistent shape. Auth errors intentionally reveal minimal information to prevent enumeration attacks.

```typescript
interface AuthErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  retryAfter?: number;  // Only on 429
}
```

### Security-Critical Error Messages

| Scenario | Status | Message |
|---|---|---|
| Wrong username/email | `401` | `"Invalid credentials"` (NOT "user not found") |
| Wrong password | `401` | `"Invalid credentials"` (NOT "wrong password") |
| Account disabled | `403` | `"Account is disabled. Contact support."` |
| Account pending deletion | `403` | `"Account is scheduled for deletion. Log in to cancel."` |
| Expired access token | `401` | `"Token expired"` |
| Invalid access token | `401` | `"Invalid token"` |
| Refresh token reuse | `401` | `"Session invalidated for security. Please log in again."` |
| TOTP required | `200` | `{ requiresTOTP: true, tempToken: "..." }` (NOT a 401) |
| Rate limited | `429` | `"Rate limit exceeded. Try again in {N} seconds."` |

> [!IMPORTANT]
> **Never** return different error messages for "user not found" vs "wrong password". This leaks whether an email/username is registered.

---

## 20. Testing Strategy

### Unit Tests (Jest)

| Test File | Coverage Target |
|---|---|
| `password.service.spec.ts` | Hash/verify round-trip, reject weak passwords, null hash (OAuth users) |
| `token.service.spec.ts` | Access token signing/verification, refresh token generation, rotation logic |
| `session.service.spec.ts` | Redis CRUD, session limit enforcement, breach detection |
| `totp.service.spec.ts` | Secret generation, encrypt/decrypt round-trip, code verification, backup codes |
| `auth.service.spec.ts` | Register (happy path + duplicate), login (valid + invalid + disabled), refresh (valid + reuse) |

### Integration Tests (Jest + Supertest)

| Scenario | Validates |
|---|---|
| Full registration → login → refresh → logout | Token lifecycle works end-to-end |
| Register with duplicate email | Returns 409, not 500 |
| Login 6 times in 15 min from same IP | 6th attempt returns 429 |
| Refresh with old (rotated) token | Returns 401, all sessions for user are revoked |
| Forgot password → reset → login with new password | Reset flow works, old password rejected |
| TOTP setup → login with TOTP → disable TOTP → login without TOTP | 2FA lifecycle |
| OAuth login (mocked Google) → auto-register → second OAuth login | First creates user, second reuses |
| Login with disabled account | Returns 403 |
| 6th concurrent session | Oldest session auto-revoked |

### Coverage Target: **>80%** on all auth service files.

---

## 21. Implementation Steps (Ordered)

Execute these in sequence. Each step produces a testable, deployable artifact.

### Step 1: Project Scaffold & Config (Day 1)

- [x] Initialize NestJS app at `backend/apps/auth-service/` using `@nestjs/cli`
- [x] Install all dependencies listed in Section 2
- [x] Create `auth.config.ts` with typed env validation using `@nestjs/config` and `Joi`
- [x] Configure TypeORM connection to PostgreSQL
- [x] Configure `ioredis` connection to Redis
- [x] Apply `helmet`, CORS, `ValidationPipe`, and `cookieParser` in `main.ts` (Section 18)
- [x] Write the Docker Compose service entry for the auth service

### Step 2: Database Schema & Entities (Day 1-2)

- [x] Create TypeORM migration for the `users` table (Section 4)
- [x] Create TypeORM migration for the `login_audit_log` table
- [x] Create `UserCredential` entity mapping to the `users` table
- [x] Create `LoginAuditLog` entity
- [x] Run migration, verify tables exist

### Step 3: Password Service (Day 2)

- [x] Implement `hashPassword()` and `verifyPassword()` using bcrypt with cost factor 12
- [x] Implement `generateResetToken()` returning `{ raw, hash }`
- [x] Write unit tests: hash round-trip, timing consistency, weak password rejection

### Step 4: Token Service (Day 2-3)

- [x] Implement `signAccessToken(user): string` — signs a JWT with the payload from Section 8
- [x] Implement `verifyAccessToken(token): JwtPayload` — verifies signature + expiry
- [x] Implement `generateRefreshToken(userId): { raw, hash, familyId }` — creates `userId.familyId.random`
- [x] Implement `hashToken(raw): string` — SHA-256
- [x] Write unit tests: signing, verification, expiry, different secrets for access/refresh

### Step 5: Session Service (Day 3)

- [x] Implement `createSession(userId, tokenHash, familyId, ip, userAgent, keepMeLoggedIn)`
  - Stores hash in `auth:session:{userId}:{familyId}`
  - Adds familyId to `auth:session_index:{userId}`
  - Enforces max 5 sessions (evicts oldest)
- [x] Implement `validateAndRotateSession(userId, familyId, oldTokenHash, newTokenHash, ip, userAgent)`
  - Breach detection logic from Section 9
- [x] Implement `revokeSession(userId, familyId)`
- [x] Implement `revokeAllSessions(userId)`
- [x] Implement `listSessions(userId)`
- [x] Write unit tests with mocked Redis

### Step 6: Registration Endpoint (Day 3-4)

- [x] Create `RegisterDto` with all validations (Section 14.1)
- [x] Implement `AuthService.register()`:
  1. Check username uniqueness (case-insensitive)
  2. Check email uniqueness (case-insensitive, normalized)
  3. Hash password
  4. Insert user record
  5. Create session (token service + session service)
  6. Set refresh token cookie
  7. Emit `UserRegistered` event
  8. Return access token + user info
- [x] Create `auth.controller.ts` with `POST /auth/register`
- [x] Add rate limit decorator: 3/hour/IP
- [x] Write integration test

### Step 7: Login Endpoint (Day 4)

- [x] Create `LoginDto`
- [x] Implement `LocalStrategy` (Passport) — looks up user by username OR email, verifies password
- [x] Implement `AuthService.login()`:
  1. Verify credentials via LocalStrategy
  2. Check `user.status === 'active'`
  3. Log attempt in `login_audit_log`
  4. If `totp_enabled` → return `{ requiresTOTP: true, tempToken }`
  5. Else → create session, set cookie, return access token
  6. Emit `UserLoggedIn`
- [x] Write integration tests: valid login, wrong password, disabled account, TOTP required

### Step 8: Refresh & Logout Endpoints (Day 4-5)

- [x] Implement `POST /auth/refresh` — reads cookie, calls session service rotation
- [x] Implement `POST /auth/logout` — revokes current session, clears cookie, blacklists access token JTI
- [x] Implement `POST /auth/logout-all` — revokes all sessions
- [x] Write integration tests including breach detection scenario

### Step 9: Password Reset Flow (Day 5)

- [x] Implement `POST /auth/forgot-password` — always returns 200
- [x] Implement email sending via nodemailer (or queue via event bus for notification service)
- [x] Implement `POST /auth/reset-password` — validates token, updates hash, revokes all sessions
- [x] Implement `POST /auth/change-password` — handles both password-having and OAuth-only users
- [x] Write integration tests

### Step 10: Google OAuth2 (Day 5-6)

- [x] Implement `GoogleStrategy` with state parameter CSRF protection
- [x] Implement `GET /auth/google` redirect
- [x] Implement `GET /auth/google/callback`:
  - Validate state parameter against Redis
  - Exchange code for profile
  - Find or create user
  - Handle email collision (existing user with same email but no google_id)
  - Create session, redirect with fragment token
- [x] Write integration tests with mocked Google responses

### Step 11: TOTP 2FA (Day 6-7)

- [ ] Implement `TotpService`:
  - `generateSecret()` using `otplib`
  - `encryptSecret()` / `decryptSecret()` using AES-256-GCM
  - `generateQRCode()` using `qrcode` library
  - `verifyCode(secret, code)` with 1-step window tolerance
  - `generateBackupCodes()` — 10 codes, bcrypt-hashed
- [ ] Implement endpoints: `/totp/setup`, `/totp/verify-setup`, `/totp/authenticate`, `/totp/disable`
- [ ] Write unit and integration tests

### Step 12: Session Management Endpoints (Day 7)

- [ ] Implement `GET /auth/sessions` — list all devices
- [ ] Implement `DELETE /auth/sessions/:familyId` — revoke specific session
- [ ] Write integration tests

### Step 13: Account Lifecycle (Day 7-8)

- [ ] Implement `POST /account/disable` (self and admin paths)
- [ ] Implement `POST /account/:userId/enable` (admin only)
- [ ] Implement `POST /account/delete` (sets 30-day grace period)
- [ ] Implement `POST /account/cancel-deletion`
- [ ] Implement `POST /account/export` (emits event for async processing)
- [ ] Write scheduled job stub for deletion cron
- [ ] Write integration tests

### Step 14: Rate Limiting Guard (Day 8)

- [ ] Implement `RateLimitGuard` (Section 12)
- [ ] Create `@RateLimit()` decorator
- [ ] Apply to all auth endpoints with correct limits
- [ ] Write integration tests: verify 429 is returned after threshold

### Step 15: Login Audit Logging (Day 8)

- [ ] Ensure every login attempt (success + failure) writes to `login_audit_log`
- [ ] Include: IP, User-Agent, method (local/google/refresh), success boolean, failure reason
- [ ] Write test verifying audit rows are created

### Step 16: End-to-End Integration Test Suite (Day 9)

- [ ] Write the full lifecycle E2E test:
  `Register → Login → Refresh → Change Password → Logout → Login with new password → Enable TOTP → Login with TOTP → Disable TOTP → Forgot Password → Reset → Login → Delete Account`
- [ ] Write breach detection E2E test
- [ ] Write rate limit E2E test
- [ ] Verify all tests pass in CI

### Step 17: Swagger Documentation (Day 9)

- [ ] Add `@nestjs/swagger` decorators to all controllers and DTOs
- [ ] Configure Swagger UI at `/auth/docs`
- [ ] Verify all endpoints are documented with request/response schemas

### Step 18: Security Audit Checklist (Day 10)

Before marking the auth service as complete, verify:

- [ ] No secrets in code (scan with `trufflehog` or `gitleaks`)
- [ ] `JWT_ACCESS_SECRET` ≠ `JWT_REFRESH_SECRET`
- [ ] Refresh token stored as SHA-256 hash in Redis, never raw
- [ ] Password reset token stored as SHA-256 hash, never raw
- [ ] TOTP secret encrypted with AES-256-GCM, not stored in plaintext
- [ ] All auth error messages are generic (no enumeration leaks)
- [ ] Rate limiting active on all public endpoints
- [ ] CORS restricted to known origins
- [ ] Cookies set with `HttpOnly`, `Secure`, `SameSite=Strict`
- [ ] `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true`
- [ ] No raw SQL queries (TypeORM parameterized queries only)
- [ ] Test coverage > 80%
- [ ] Swagger docs complete

---

> **Estimated total effort:** 10 developer-days for a single developer, or 5 days with a pair.
