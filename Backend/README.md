# BGSC Platform — Backend

API gateway plus domain services, one npm workspace. Express 5, Mongoose 9, MongoDB, Redis.

---

## Layout

```
Backend/
  src/                        API Gateway (:3000) — routing, rate limiting, JWT at the edge
  packages/shared/            @bgsc/shared — models, middleware, event bus, config, bootstrap
  apps/auth-service/          :3001  credentials, sessions, OAuth, account reactivation
  apps/user-service/          :3002  profiles, roles, avatars, account deletion
  apps/registration-service/  :3004  dynamic forms, registrations, teams
```

Services never import from each other — only from `@bgsc/shared`. Every service boots through
`createServiceApp`/`startService`, so health checks, the error envelope, index building and
graceful shutdown are identical by construction rather than by convention.

### What is built

| Service | Port | Status |
|---|---|---|
| gateway | 3000 | live |
| auth-service | 3001 | live |
| user-service | 3002 | live |
| registration-service | 3004 | live |
| event, announcement, points, leaderboard, challenge, media, notification | 3003, 3005–3010 | not built — the gateway answers `503` with which service and who owns it |

---

## First run

```bash
cd Backend
cp .env.example .env          # compose refuses to start without the three secrets
npm install
docker compose up -d mongodb redis
npm run build
```

Then either run everything in Docker:

```bash
docker compose up -d          # gateway + all live services + mongo + redis
docker compose logs -f gateway
docker compose down
```

…or run the infrastructure in Docker and the services on the host, which is what you want while
writing code (`dev` reloads on change):

```bash
docker compose up -d mongodb redis

npm run dev                                       # gateway  :3000
npm run dev --workspace @bgsc/auth-service        # auth     :3001
npm run dev --workspace @bgsc/user-service        # user     :3002
npm run dev --workspace @bgsc/registration-service # registration :3004
```

`mongo-express` is on <http://localhost:8081> if you want to look at the data.

---

## Commands

Run from `Backend/`. Anything with `--workspace` also works without it, from that package's folder.

| Command | What it does |
|---|---|
| `npm run build` | Compiles every project in dependency order into `dist/`. Test files are excluded. |
| `npm run typecheck` | Full typecheck **including** tests, then a build. Stricter than `build`. |
| `npm run selfcheck` | Fast assertion checks across every workspace. Needs MongoDB. |
| `npm run e2e` | End-to-end suites across every workspace. Needs MongoDB. |
| `npm test` | `selfcheck` then `e2e`. |
| `npm run smoke` | Gateway checks against a **running** stack. See below. |
| `npm run dev` | Gateway with reload. |
| `npm start` | Gateway from `dist/` (what the container runs). |

---

## The test suites

Four layers, each catching what the one below cannot. No test framework — everything is
`assert`-based and runs under `ts-node`, so there is nothing to configure and no runner to learn.

### 1. `npm run selfcheck` — units and invariants

Schema rules, model invariants, JWT middleware, the form validation engine, form versioning, team
lifecycle. Hits MongoDB for the model-backed ones and cleans up after itself.

```bash
npm run selfcheck                                     # everything
npm run selfcheck --workspace @bgsc/registration-service
npx tsx apps/registration-service/src/selfcheck/teams.selfcheck.ts   # one file
```

### 2. `npm run e2e` — services over HTTP and across collections

Boots the service in-process and drives it over real HTTP: auth's account lifecycle, user-service's
full route surface, and the cross-collection model checks.

```bash
npm run e2e
npm run e2e --workspace @bgsc/auth-service
```

registration-service has no `e2e` script — its selfchecks are already database-backed and cover the
same ground, so the root `npm run e2e` simply skips it (`--if-present`).

### 3. `npm run smoke` — the gateway, against a live stack

Everything the other layers structurally cannot see: that requests actually reach the right
service, that `/internal/*` is sealed from the edge, that path prefixes match on segment
boundaries, that uploads route to the service holding the file, that forged identity headers are
stripped, and that brute-forceable endpoints sit in the strict rate-limit bucket.

**Needs the stack up.** It exits 0 and skips if the gateway is not listening, so it is safe to
chain after the others.

```bash
docker compose up -d          # or run the four services by hand
npm run smoke
```

Two things to know:

- Every check in it was a real bug at least once. Treat a failure as a regression, not a flake.
- The last check deliberately spends the strict rate-limit bucket (5 per 15 min per IP), so a
  `login` or `register` from the same machine will `429` afterwards. The limiter is in-memory per
  gateway process — **restart the gateway to clear it**.

### 4. `npm run typecheck`

`build` skips test files. This does not, so a broken selfcheck still fails the build gate.

### Before pushing

```bash
npm run build && npm run typecheck && npm test && npm run smoke
```

---

## Gateway routing

The gateway is the only published port. It forwards the same path prefix the service already
serves, so there is no rewriting to get wrong — one row in `src/gateway/routing.ts` per service.

| Prefix | Service |
|---|---|
| `/auth`, `/account` | auth-service |
| `/users`, `/uploads/avatars` | user-service |
| `/forms`, `/registrations`, `/teams`, `/uploads/registrations` | registration-service |
| `/events`, `/auction` | event-service *(503)* |
| `/announcements`, `/points`, `/leaderboards`, `/challenges` | *(503)* |
| `/media`, `/uploads/*` | media-service *(503)* — Week 4 takes the whole upload tree |

`GET /gateway/services` lists the table live, including which targets are up.

`/internal/*` is **404 from the edge, always** — even with a valid service token. Those routes are
service-to-service only and are additionally guarded by `X-Internal-Token` at each service.

---

## Response shape

Success, from every service:

```json
{ "success": true, "data": { } }
```

Failure, from every service:

```json
{ "error": "code", "details": [] }
```

`details` appears only when there is something per-field to say. `/health` is deliberately
unwrapped, because orchestrators parse it directly. The envelope is applied once in
`createServiceApp` — handlers return bare payloads and never wrap by hand.

---

## Adding a service

1. `apps/<name>/` with a `package.json` and a `tsconfig.json` copied from an existing service —
   extend `tsconfig.base.json`, and keep the test-file `exclude` so tests stay out of `dist/`.
2. `src/index.ts` calling `createServiceApp`/`startService`.
3. Add a row to `ROUTES` in `src/gateway/routing.ts`, and its name to `LIVE_SERVICES`.
4. Add it to `tsconfig.json` `references`, to `Dockerfile` (both the package copy and the dist
   copy), and to `docker-compose.yml`.
5. Add its URL to `packages/shared/src/config/env.ts` and to `.env.example`.

Miss step 3 and the gateway will keep answering 503 for a service that is running.

---

## Notes

- **Secrets.** `.env` is git-ignored; `.env.example` holds working dev defaults. A production boot
  refuses to start on any published default — see `assertInternalTokenConfigured`.
- **Uploads** are local disk today, served by the service that owns them. Week 4's Media Service
  replaces the storage layer behind one `putObject` call and takes over `/uploads`.
- **The event bus** is an in-process emitter, with Redis pub/sub carrying the same envelope between
  services when `REDIS_URL` is set. Call sites do not change when it becomes Kafka.
- **Indexes** are built at boot and awaited before the service listens. A failure is fatal on
  purpose: `form_submissions` relies on a unique partial index to reject duplicate registrations,
  and serving without it means serving without the guarantee.
