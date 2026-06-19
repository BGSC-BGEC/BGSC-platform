# Manual Testing — API Gateway

A step-by-step guide to manually verifying the API Gateway end-to-end. Everything is driven through the gateway on **`localhost:3000`** — that's the whole point: clients never hit the services directly.

**Prerequisites:** Docker + docker-compose, and ideally `jq` (`sudo pacman -S jq`) for readable output and token extraction.

---

## 1. Bring up the stack

From the repo root:

```bash
docker compose up --build           # DEV mode: services also exposed on :3001/:3002
```

> ⚠️ Use `--build` whenever a `Dockerfile`, `package.json`, or build config changed — otherwise Docker reuses a stale cached image. (See [Troubleshooting](#troubleshooting) if a container exits with `Cannot find module`.)

**Dev vs locked exposure.** The base `docker-compose.yml` is the locked-down, gateway-only topology. `docker-compose.override.yml` (auto-merged on a plain `docker compose up`) republishes the services to the host for direct debugging. To test the production-like locked topology where the services are unreachable except through the gateway:

```bash
docker compose -f docker-compose.yml up --build   # LOCKED: only :3000 is published
```

In locked mode, `curl localhost:3002/users/me` returns a connection error, while everything via `localhost:3000` still works.

This starts five containers:

| Container | Port | Role |
|---|---|---|
| `bgsc-postgres` | 5432 | Database |
| `bgsc-redis` | 6379 | Sessions + rate-limit counters |
| `bgsc-auth-service` | 3001 | Auth microservice |
| `bgsc-user-service` | 3002 | User microservice |
| `bgsc-api-gateway` | **3000** | **Public entry point** |

Keep this terminal open to watch logs; run the commands below in a second terminal. Wait until you see the gateway log a listen line (and Redis/Postgres healthy) before testing.

---

## 2. Health check (served by the gateway itself)

```bash
curl -s localhost:3000/health | jq
```

Expected:

```json
{ "status": "ok", "service": "api-gateway", "timestamp": "..." }
```

This route is handled locally by the gateway — it is **not** proxied or rate-limited.

---

## 3. Register a user (gateway → auth-service)

Password rules: **≥8 chars, 1 uppercase, 1 number, 1 special char**. `acceptedTos` must be `true`.

```bash
curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"test_user","email":"test@bgsc.in","password":"P@ssw0rd1","acceptedTos":true}' | jq
```

Expected: `{ "user": {...}, "accessToken": "...", "isNewUser": true }`. The request travelled `:3000 → auth-service:3001` and the user row was written to Postgres.

> Registration is limited to **3/hour per IP** by the auth-service. If you re-run tests a lot, see [Resetting rate limits](#resetting-rate-limits).

---

## 4. Log in and capture the access token

⚠️ The login field is **`usernameOrEmail`** (not `username`):

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usernameOrEmail":"test_user","password":"P@ssw0rd1"}' | jq -r .accessToken)

echo "$TOKEN"
```

---

## 5. The core gateway behaviors

### (a) Protected route blocked at the edge — no token → `401`

```bash
curl -s -i localhost:3000/users/me | head -1
# HTTP/1.1 401 Unauthorized
```

The gateway rejects this **before** it reaches user-service (verified by the `Unauthorized` body coming from the gateway, not a Nest validation error).

### (b) Protected route works with a valid token (gateway → user-service)

```bash
curl -s localhost:3000/users/me -H "Authorization: Bearer $TOKEN" | jq
```

Returns your user profile. The gateway verified the JWT at the edge, injected `x-user-id`/`x-user-role`/etc., and forwarded to user-service.

### (c) Public auth routes pass through

Already proven by steps 3 and 4 — `/auth/*` is not gated at the edge.

---

## 6. Rate limiting (Redis sliding window)

The gateway allows **5 `POST /auth/login` per 15 min per IP**. Fire 7 and watch the last ones flip to `429`:

```bash
for i in $(seq 1 7); do
  echo -n "attempt $i -> "
  curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"usernameOrEmail":"test_user","password":"wrong"}'
done
# 401, 401, 401, 401, 401, 429, 429
```

Inspect the limiter headers on a single call:

```bash
curl -s -i -X POST localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"usernameOrEmail":"test_user","password":"wrong"}' \
  | grep -i 'x-ratelimit-remaining\|retry-after'
```

General (non-auth) routes use the looser **100/min** bucket.

---

## 7. Upstream failure → `502 Bad Gateway`

```bash
docker stop bgsc-user-service
curl -s -i localhost:3000/users/me -H "Authorization: Bearer $TOKEN" | head -1
# HTTP/1.1 502 Bad Gateway
docker start bgsc-user-service
```

---

## 8. Resilience: gateway survives a Redis outage (fails open)

```bash
docker stop bgsc-redis
curl -s localhost:3000/health | jq -c .          # still 200 — gateway stays up
curl -s localhost:3000/users/me -H "Authorization: Bearer $TOKEN" | jq -c .   # still proxies
docker start bgsc-redis
```

Rate limiting is degraded (counters can't be written) but traffic is **not** blocked — the limiter calls `next()` on Redis errors. Downstream services still enforce their own limits.

---

## Resetting rate limits

The counters live in Redis. To clear them between test runs:

```bash
docker exec bgsc-redis redis-cli FLUSHALL
```

> This also clears auth-service sessions/blacklists — fine for local testing; you'll just need to log in again.

---

## Useful inspection commands

```bash
docker-compose ps                     # container status
docker-compose logs -f api-gateway    # gateway logs only
docker-compose logs -f auth-service   # auth logs
docker exec -it bgsc-postgres psql -U bgsc -d bgsc_dev -c 'SELECT id, username, email, role FROM users;'
docker exec bgsc-redis redis-cli KEYS 'gateway:rate:*'   # active rate-limit keys
```

To prove the gateway is actually proxying (not the services answering directly), compare the gateway path against the direct service port. **This only works in DEV mode** (`docker compose up`) — in locked mode the direct call is refused, which is itself the proof:

```bash
curl -s localhost:3000/auth/login -X POST -H 'Content-Type: application/json' -d '{"usernameOrEmail":"x","password":"y"}' -o /dev/null -w "via gateway: %{http_code}\n"
curl -s localhost:3001/auth/login -X POST -H 'Content-Type: application/json' -d '{"usernameOrEmail":"x","password":"y"}' -o /dev/null -w "direct:      %{http_code}\n"
```

Both respond, but only `:3000` applies the edge rate-limit + JWT layer. In production only `:3000` is exposed.

---

## Troubleshooting

### A container exits with `Cannot find module '/app/dist/...'`

This means the image's `CMD` points at a path the build didn't produce. It's almost always a **stale cached image** or a Dockerfile build-path mismatch. Fixes:

1. Rebuild without cache:
   ```bash
   docker-compose build --no-cache <service>
   docker-compose up
   ```
2. Confirm the build path matches the `CMD`. The output path of `nest build` depends on TypeScript's `rootDir` inference:
   - **Gateway (root app):** `npm run build` → `dist/main.js` (deterministic — `tsconfig.build.json` pins `rootDir: ./src` and `include: ["src/**/*"]`). Dockerfile `CMD` is `node dist/main.js`.
   - **A microservice:** `npm run build <service>` → `dist/apps/<service>/main.js`. Each app Dockerfile must build **with the project name** (e.g. `RUN npm run build user-service`) and run `node dist/apps/<service>/main.js`.

### `429` immediately on the first login

A previous test run filled the rate-limit window. Run `docker exec bgsc-redis redis-cli FLUSHALL`.

### `401` on `/users/me` with a token that looked valid

Access tokens expire after **15 minutes**. Re-run the login step (4) to get a fresh one. Also confirm `JWT_ACCESS_SECRET` / `JWT_ISSUER` are identical across the gateway, auth-service, and user-service in `docker-compose.yml`.

### Port already in use

Another process holds 3000/3001/3002/5432/6379. Stop it, or change the host-side port mapping in `docker-compose.yml`.

---

## Local (non-Docker) alternative

Run each piece in its own terminal. You need Postgres + Redis running locally and the env vars from `docker-compose.yml`:

```bash
# terminal 1
redis-server
# terminal 2 (backend/) — needs Postgres + auth env vars
npm run start:auth-service:dev
# terminal 3 (backend/) — needs Postgres + user env vars
npm run start:user-service:dev
# terminal 4 (backend/) — the gateway
PORT=3000 REDIS_URL=redis://localhost:6379 \
JWT_ACCESS_SECRET=dev_access_secret_change_in_prod_1234567890abcdef \
JWT_ISSUER=bgsc-auth-service \
AUTH_SERVICE_URL=http://localhost:3001 \
USER_SERVICE_URL=http://localhost:3002 \
npm run start:dev
```

Docker is far less fiddly since all of that is already wired in `docker-compose.yml`.
