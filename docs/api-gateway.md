# API Gateway — Implementation Reference

**Milestone:** 0.2 – Backend Core Services  
**Phase:** 0 (Foundation)  
**Status:** Implemented & tested  
**Port:** 3000

---

## Overview

The API Gateway is the **single entry point** for all client traffic (mobile + web). It sits in front of the microservices and is the only service exposed publicly — clients never talk to the Auth or User services directly.

It is the **root backend application** — it lives in `backend/src/` (not under `backend/apps/`, which holds the downstream microservices). It is the `api-gateway` service in `docker-compose.yml` (built from `backend/`'s root Dockerfile → `dist/main.js`) and listens on port 3000. It has its own Redis connection for edge rate limiting, owns no database, and holds no business logic. It routes, verifies, and meters — nothing else.

> **Tech choice:** The plan suggested `express-gateway` "for simplicity, later replaced with Kong." I implemented it as the root NestJS app instead, reusing the existing JWT/Redis/config/Docker conventions from the Auth and User services with far less glue. The reverse proxying is done with [`http-proxy-middleware`](https://github.com/chimurai/http-proxy-middleware) v3. Kong remains the long-term target per the architecture diagram.

### What it does

- **Reverse proxy** — routes requests to the correct downstream service by path prefix
- **Edge JWT verification** — rejects unauthenticated requests to protected routes before they ever reach a service
- **Identity forwarding** — injects verified claims as `x-user-*` headers for downstream services
- **Rate limiting** — Redis sliding-window limiter at the edge (100 req/min general, 5/15min on auth attempts)
- **Client IP forwarding** — propagates `X-Forwarded-For` so downstream rate limiters and audit logs see the real origin
- **Security headers + CORS** — Helmet + a single CORS policy for all services
- **Health check** — `GET /health` for liveness probes

### What it does NOT do

- Issue, refresh, or revoke tokens → **Auth Service**
- Store sessions, blacklists, or refresh tokens → **Auth Service** (the gateway's Redis is used only for rate-limit counters)
- Enforce per-route RBAC roles → still done by each downstream service (the gateway only checks token validity, not roles)
- Parse or transform request bodies → bodies stream through untouched
- Terminate TLS → handled by the deployment platform (Railway/Render) or a future Kong/ingress layer

---

## File Map

The gateway is the **root app**, so it lives directly under `backend/src/` (the `backend/apps/*` folders are the downstream microservices it proxies to).

```
backend/
├── src/                                 — THE GATEWAY (root app)
│   ├── main.ts                          — Bootstrap + edge pipeline wiring (Helmet, CORS, rate limit, JWT, proxy)
│   ├── app.module.ts                    — Root module: ConfigModule + AppController
│   ├── app.controller.ts                — Local (non-proxied) routes: GET /health and GET /
│   ├── app.controller.spec.ts           — Health controller tests
│   ├── config/
│   │   └── gateway.config.ts            — Typed config from env vars (Joi validation)
│   ├── gateway/
│   │   ├── routing.ts                   — Path classification: which service, protected?, auth-attempt?
│   │   ├── routing.spec.ts              — Path classification unit tests
│   │   ├── rate-limit.middleware.ts     — Redis sliding-window limiter (factory)
│   │   ├── rate-limit.middleware.spec.ts — Bucket selection + limit enforcement (mocked Redis)
│   │   ├── jwt-auth.middleware.ts       — Edge JWT verification + claim forwarding (factory)
│   │   ├── jwt-auth.middleware.spec.ts  — Edge auth: enforce, reject, forward headers
│   │   └── proxy.ts                     — http-proxy-middleware reverse-proxy factory
│   └── interfaces/
│       └── jwt-payload.interface.ts     — JwtPayload shape (mirrors auth-service)
├── test/
│   └── app.e2e-spec.ts                  — e2e: gateway local routes (/health, /)
├── Dockerfile                           — Root image → node dist/main.js
├── nest-cli.json                        — Monorepo: root app + apps/* projects
└── apps/                                — Downstream microservices (auth-service, user-service)
```

---

## Running the Service

The gateway is the root app, so it uses the **default** Nest scripts (no project name):

```bash
# from backend/
npm run start                      # one-off (root app)
npm run start:dev                  # watch mode
npm run build                      # compile root app -> dist/main.js

# or the whole stack
docker-compose up                  # gateway on :3000, auth on :3001, user on :3002
```

The gateway boots even if Redis or the downstream services are unavailable: rate limiting **fails open** when Redis is down, and unreachable upstreams return `502 Bad Gateway` per request.

---

## Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | No | `3000` | Gateway listen port |
| `NODE_ENV` | No | `development` | |
| `REDIS_URL` | Yes | — | Redis for rate-limit counters |
| `JWT_ACCESS_SECRET` | Yes | — | **Must match** the Auth Service's access secret |
| `JWT_ISSUER` | No | `bgsc-auth-service` | Validated against the token's `iss` claim |
| `AUTH_SERVICE_URL` | No | `http://localhost:3001` | Upstream for `/auth/**` and `/account/**` |
| `USER_SERVICE_URL` | No | `http://localhost:3002` | Upstream for `/users/**` |
| `CORS_ORIGINS` | No | `` (empty → reflect any) | Comma-separated allowed origins |
| `RATE_LIMIT_GENERAL_MAX` | No | `100` | General requests per window |
| `RATE_LIMIT_GENERAL_WINDOW_MS` | No | `60000` | General window (1 min) |
| `RATE_LIMIT_AUTH_MAX` | No | `5` | Auth attempts per window |
| `RATE_LIMIT_AUTH_WINDOW_MS` | No | `900000` | Auth window (15 min) |
| `PROXY_TIMEOUT_MS` | No | `30000` | Upstream request/response timeout |

> `JWT_ACCESS_SECRET` and `JWT_ISSUER` must be identical across the gateway, Auth Service, and User Service — otherwise edge verification rejects tokens the services would have accepted (or vice versa).

In Docker, upstream URLs use container names (`http://auth-service:3001`, `http://user-service:3002`) on the shared `bgsc-network`.

---

## Routing Table

The gateway preserves the incoming path as-is — downstream services expose the same prefixes, so there is **no path rewriting**.

| Path prefix | Upstream service | Port |
|---|---|---|
| `/auth/**` | auth-service | 3001 |
| `/account/**` | auth-service | 3001 |
| `/users/**` | user-service | 3002 |
| `/health`, `/` | gateway (local) | 3000 |

Classification lives in `gateway/routing.ts`. Prefix matching is exact-segment aware: `/users` and `/users/me` match the user service, but `/users-export` does **not**.

---

## Request Pipeline

Every proxied request flows through this ordered middleware chain (`main.ts`):

```
            ┌─────────┐   ┌──────┐   ┌────────────┐   ┌──────────────┐   ┌────────────┐
request ──▶ │ Helmet  │──▶│ CORS │──▶│ Rate limit │──▶│ JWT verify   │──▶│ Reverse    │──▶ upstream
            │         │   │      │   │ (Redis)    │   │ (protected)  │   │ proxy      │
            └─────────┘   └──────┘   └────────────┘   └──────────────┘   └────────────┘
```

- The app is created with `bodyParser: false` so request bodies stream straight to the upstream untouched (required for correct proxying of POST/PATCH payloads).
- `/health` and `/` are handled by Nest controllers; the proxy middlewares use a `pathFilter`, so unmatched paths fall through to them and are **not** rate-limited or auth-checked.

---

## Edge JWT Verification

`gateway/jwt-auth.middleware.ts` verifies access tokens **only on protected routes**. Everything else passes through and is enforced downstream — this avoids breaking flows that use non-access tokens (e.g. the TOTP login temp token).

### Protected routes (require a valid access token at the edge)

- `/users/**`
- `/account/**`
- `/auth/logout`, `/auth/logout-all`, `/auth/change-password`, `/auth/sessions/**`

### Public routes (pass through, enforced downstream if needed)

`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/google`, `/auth/google/callback`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/totp/**`, `/health`, `/`

### Behavior on a protected route

1. Extracts the `Bearer` token from the `Authorization` header → `401` if missing/malformed.
2. Verifies signature, expiry, and `iss` against `JWT_ACCESS_SECRET` / `JWT_ISSUER` → `401` if invalid or expired.
3. On success, injects the verified claims as headers and calls the upstream:

| Header | Source claim |
|---|---|
| `x-user-id` | `sub` |
| `x-user-role` | `role` |
| `x-user-email` | `email` |
| `x-username` | `username` |

The original `Authorization` header is preserved — downstream services still verify the JWT independently as **defense-in-depth**. The gateway check is an early-rejection optimization, not the sole gate.

> The gateway verifies token **validity** but not **roles**. Per-route RBAC (e.g. coordinator-only endpoints) remains the responsibility of each downstream service's `RolesGuard`.

---

## Rate Limiting

`gateway/rate-limit.middleware.ts` reuses the Auth Service's **Redis sorted-set sliding-window** algorithm, metered **per client IP** at the edge. It selects a bucket per request:

| Bucket | Applies to | Limit | Window |
|---|---|---|---|
| `auth` | `POST /auth/login`, `POST /auth/register` | 5 | 15 min |
| `general` | everything else proxied | 100 | 1 min |

### Redis keys

| Key pattern | Type | TTL | Purpose |
|---|---|---|---|
| `gateway:rate:auth:{ip}` | Sorted Set | 15 min | Strict auth-attempt window |
| `gateway:rate:general:{ip}` | Sorted Set | 1 min | General request window |

### Response

- Under the limit: sets `X-RateLimit-Remaining`.
- Over the limit: `429 Too Many Requests` with `Retry-After` (seconds until the oldest in-window request expires) and `X-RateLimit-Remaining: 0`.

```json
{ "statusCode": 429, "error": "Too Many Requests", "message": "Rate limit exceeded. Please try again later.", "retryAfter": 42 }
```

> **Fail-open:** if the Redis pipeline errors or returns nothing, the limiter calls `next()` rather than blocking traffic. A gateway-wide Redis outage degrades rate limiting but does not take the platform down. The downstream services still enforce their own stricter limits.

> The gateway limit is intentionally a coarse edge guard. The Auth Service applies its own finer-grained limits (e.g. register 3/hour, password reset 3/hour/email) behind it.

---

## Upstream Proxying

`gateway/proxy.ts` wraps `http-proxy-middleware` v3:

- `changeOrigin: true` — sets the `Host` header to the upstream.
- `xfwd: true` — appends the client IP to `X-Forwarded-For` so downstream rate limiters and `login_audit_log` see the real origin.
- `pathFilter` — a function gate so each proxy only handles its own prefixes; the full path is forwarded unchanged.
- `proxyTimeout` / `timeout` — bounded by `PROXY_TIMEOUT_MS`.
- On connection error → `502 Bad Gateway`:

```json
{ "statusCode": 502, "error": "Bad Gateway", "message": "Upstream service is unavailable." }
```

---

## Health Check

### `GET /health`

```json
{ "status": "ok", "service": "api-gateway", "timestamp": "2026-06-19T08:39:51.448Z" }
```

### `GET /`

```json
{ "service": "api-gateway", "status": "ok" }
```

Neither is rate-limited or auth-checked.

---

## Tests

```bash
npx jest src/      # gateway unit + controller tests
```

| Suite | Covers |
|---|---|
| `gateway/routing.spec.ts` | Protected vs public classification, auth-attempt detection, service selection, lookalike-prefix rejection |
| `gateway/jwt-auth.middleware.spec.ts` | Public passthrough, missing/invalid/wrong-issuer rejection, valid-token claim forwarding |
| `gateway/rate-limit.middleware.spec.ts` | General + strict bucket selection and `429` enforcement against an in-memory Redis fake |
| `app.controller.spec.ts` | Health + root route responses |
| `test/app.e2e-spec.ts` | e2e boot of the gateway's local routes |

The rate-limit and JWT logic are exposed as **factory functions** specifically so they can be unit-tested without a live Redis or Nest DI container. `package.json`'s `jest.roots` includes both `src/` and `apps/` so root-app and microservice tests run together.

---

## Docker

The root `backend/Dockerfile` is a two-stage build: `npm ci` → `npm run build` → `npm prune --omit=dev` → slim runtime running `node dist/main.js`.

In `docker-compose.yml` the gateway is the `api-gateway` service (built from `./backend`'s root Dockerfile), the public entrypoint on host port **3000**. It depends on `redis` (healthy) plus `auth-service` and `user-service` (started) and reaches them by container name on `bgsc-network`. It has no `DATABASE_URL` — the gateway owns no database.

### Service exposure — locked-down (gateway-only) vs dev

The gateway is meant to be the **only public entry point** — clients should never reach `auth-service` or `user-service` directly. That is the *final* topology. During development, though, it's convenient to hit the services directly (debugging, Swagger at `/auth/docs`). Both are supported via a Docker Compose **base + override** split, so switching between them is just a matter of which command you run — no file edits.

#### How it works

Two files:

- **`docker-compose.yml`** — the **base**, and the canonical/production topology. It is **locked down**: only `api-gateway` publishes a host port (`3000:3000`). `auth-service` and `user-service` use `expose` instead of `ports`, so they are reachable **only inside** the `bgsc-network` (by container name, e.g. `http://auth-service:3001`) — never from the host.

  ```yaml
  # docker-compose.yml (base = locked)
  auth-service:
    expose: ['3001']      # internal-only, no host mapping
  user-service:
    expose: ['3002']      # internal-only, no host mapping
  api-gateway:
    ports: ['3000:3000']  # the only public door
  ```

- **`docker-compose.override.yml`** — a **dev-only overlay**. Docker Compose auto-merges a file named `docker-compose.override.yml` on every plain `docker compose up`. It re-adds host port mappings for the two services:

  ```yaml
  # docker-compose.override.yml (dev overlay, auto-merged)
  services:
    auth-service:
      ports: ['3001:3001']
    user-service:
      ports: ['3002:3002']
  ```

`ports` and `expose` are additive on merge, so in dev the services end up published to the host; with the base alone they stay internal.

#### How to trigger each mode

| Goal | Command | `:3001` / `:3002` |
|---|---|---|
| **Dev** (direct access to services) | `docker compose up` | published to host — direct access works |
| **Locked** (gateway-only, production-like) | `docker compose -f docker-compose.yml up` | internal-only — direct access **refused** |

The `-f docker-compose.yml` flag tells Compose to use **only** that file, which suppresses the auto-merge of the override. Add `--build` after a code/Dockerfile change, `-d` to run detached. Examples:

```bash
docker compose up --build                          # dev, rebuild, foreground
docker compose -f docker-compose.yml up -d         # locked, detached
```

> In CI/CD or a server deploy, always run with `-f docker-compose.yml` (or simply don't ship the override file) so the locked topology is what actually runs.

#### How to verify

```bash
# Inspect which ports are published in the current mode:
docker compose ps --format 'table {{.Name}}\t{{.Ports}}'
#   LOCKED -> auth/user show only "3001/tcp", "3002/tcp" (no 0.0.0.0:->)
#   DEV    -> auth/user show "0.0.0.0:3001->3001/tcp", etc.

# Functional proof in LOCKED mode:
curl -s -o /dev/null -w '%{http_code}\n' localhost:3002/users/me   # 000 (connection refused)
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/health     # 200 (gateway still serves)
```

Verified live: in locked mode `localhost:3001` / `localhost:3002` refuse the connection, while everything through `localhost:3000` proxies normally.

> **Note:** `postgres` (`5432`) and `redis` (`6379`) are still published to the host in *both* modes for local DB/cache inspection. In a real production deploy, drop their host mappings too (and point the services at managed instances).

---

## Security Notes

- The gateway is the only publicly exposed service. In the base (locked) compose topology the downstream services are internal-only (`expose`, not `ports`); the dev override republishes them for convenience. See [Service exposure — locked-down (gateway-only) vs dev](#service-exposure--locked-down-gateway-only-vs-dev).
- Edge JWT verification rejects unauthenticated traffic before it reaches a service, reducing attack surface and load.
- `X-Forwarded-For` is appended (not trusted blindly) so downstream IP-based limiting and audit logging remain accurate. If deployed behind another proxy/load balancer, configure `trust proxy` accordingly before treating XFF as authoritative.
- Rate-limit counters are isolated under the `gateway:rate:*` namespace — they never collide with the Auth Service's `auth:*` keys even on a shared Redis.
- Helmet sets baseline security headers; CORS is centralized so every service shares one allow-list.

---

## Known Limitations / TODO

- **No role enforcement at the edge** — only token validity is checked; downstream `RolesGuard`s remain the source of truth for RBAC. Acceptable for MVP; revisit if centralizing authorization in Kong.
- **Rate limiting is per-IP, not per-user** — a logged-in user behind a shared NAT shares a bucket. Phase 4 (per-user rate limiting) will key authenticated requests by `sub`.
- **No request/response logging or tracing** — add structured access logs + a correlation/request-id header before Phase 1 frontend integration.
- **No circuit breaker / retry** — a slow upstream times out at `PROXY_TIMEOUT_MS` with a `502`; no backoff or breaker yet.
- **`express-gateway` → Kong** — current implementation is a NestJS app; migrate to Kong when the architecture calls for declarative config, plugins, and horizontal scaling.
- **No aggregated Swagger** — each service documents itself; a unified gateway-level OpenAPI spec is not yet generated.
