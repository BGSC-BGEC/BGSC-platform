# Sponsor Service Implementation Reference

**Milestone:** 1.1 - Sponsor System v1  
**Task:** Sponsor service  
**Status:** Implemented and manually smoke-tested  
**Port:** 3003

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
    │   └── 1762000000000-CreateSponsorsAndAffiliations.ts
    └── sponsors/
        ├── sponsors.controller.ts
        ├── sponsors.module.ts
        ├── sponsors.service.ts
        ├── dto/
        ├── entities/
        └── enums/
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

The service runs `CreateSponsorsAndAffiliations1762000000000` automatically on startup with `migrationsRun: true`.

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
| `user_id` | `uuid` | FK to `users.id`, indexed |
| `sponsor_id` | `uuid` | FK to `sponsors.id`, indexed |
| `affiliated_at` | `timestamptz` | Defaults to `now()` |
| `fan_count` | `integer` | Defaults to `0` |
| `events_won` | `text[]` | Defaults to empty array |
| `total_points_contributed` | `integer` | Defaults to `0` |
| `created_at` | `timestamptz` | Auto-created |
| `updated_at` | `timestamptz` | Auto-updated |

The migration also creates a minimal `users` table if it does not already exist, allowing the affiliation foreign key to be created in a fresh database.

---

## API Endpoints

All routes are mounted under `/sponsors`.

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| `GET` | `/sponsors` | Public | none | List sponsors, optionally filtered by status |
| `GET` | `/sponsors/active` | Public | none | List active sponsors in the current tenure window |
| `GET` | `/sponsors/:id` | Public | none | Fetch one sponsor |
| `POST` | `/sponsors` | JWT | `coordinator`, `founder` | Create sponsor |
| `PATCH` | `/sponsors/:id` | JWT | `coordinator`, `founder` | Update sponsor |
| `DELETE` | `/sponsors/:id` | JWT | `coordinator`, `founder` | Soft-remove sponsor by setting inactive status and tenure end |

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

Existing tests cover:

- sponsor config validation
- sponsor service unit behavior

Recommended next test:

- sponsor-service e2e tests for HTTP behavior and guards

Suggested e2e coverage:

- `GET /sponsors/active` returns only active sponsors within tenure dates
- `GET /sponsors` supports `status` filtering
- `POST /sponsors` rejects unauthenticated callers with `401`
- `POST /sponsors` rejects non-coordinator/non-founder users with `403`
- `POST /sponsors` allows founder or coordinator tokens
- `PATCH /sponsors/:id` updates allowed fields
- `DELETE /sponsors/:id` soft-removes by setting `inactive` and `tenureEnd`

This is worth adding before marking the whole sponsor slice production-ready, but the current task can be marked implementation-complete if unit tests, manual Docker smoke tests, and docs are acceptable for Milestone 1.1 Task 1.
