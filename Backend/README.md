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
  apps/event-service/         :3003  events, auction (also serves /auction)
  apps/registration-service/  :3004  dynamic forms, registrations, teams
  apps/announcement-service/  :3005  announcements, read state
  apps/points-service/        :3006  points ledger, rules
  apps/leaderboard-service/   :3007  leaderboards, hall of fame
  apps/challenge-service/     :3008  challenges, participations, Strava linking (/strava)
  apps/media-service/         :3009  gallery, albums, and every /uploads file
  apps/notification-service/  :3010  in-app inbox, WhatsApp broadcast
  apps/feedback-service/      :3011  feedback + contact-us tickets
  apps/bracket-service/       :3012  brackets, matches
```

Services never import from each other — only from `@bgsc/shared`. Every service boots through
`createServiceApp`/`startService`, so health checks, the error envelope, index building and
graceful shutdown are identical by construction rather than by convention.

### What is built

All twelve services and the gateway are live. A service named in `ROUTES` but missing from
`LIVE_SERVICES` would answer `503` with its owner, rather than hang — none do today.

Services talk to each other two ways, and only these two:

- **`callInternal(baseUrl, path, { method, body })`** from `@bgsc/shared` for a synchronous
  `/internal/*` call. It sends the `X-Internal-Token`, unwraps the `{ success, data }` envelope, and
  throws `InternalCallError`: `status >= 400` is the other service refusing (never fall back),
  `outcomeUnknown` (no answer, or 5xx) means retry with the same idempotency key or fail 503 —
  never write the other service's collection yourself.
- **The event bus** (`publish` / `subscribe`) for everything asynchronous. See Notes.

---

## First run

```bash
cd Backend
cp .env.example .env          # compose refuses to start without the three secrets and CORS_ORIGIN
npm install
docker compose up -d mongodb redis
npm run build
```

Once the stack is up (either way below), register your account through the app or `POST /auth/register`, then make it founder once:

```bash
FOUNDER_EMAIL=you@example.com npm run seed:founder
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

npm run dev                                         # gateway  :3000
npm run dev --workspace @bgsc/auth-service          # auth     :3001
npm run dev --workspace @bgsc/<name>-service        # any other, on its own port
```

Mongo, Redis and mongo-express publish on **127.0.0.1 only**, and Redis requires a password.
The password is `REDIS_PASSWORD`, passed to the client on its own; `REDIS_URL` carries host, port
and db only. A password inside the URL still works but loses to `REDIS_PASSWORD`, and one with
`/ # ? %` in it cannot be parsed — the bus then logs `Event bus disabled` and the service runs
without it. If your `.env` predates this, add `REDIS_PASSWORD` or the services cannot hear each other.

`docker compose --profile tools up -d mongo-express` puts mongo-express on <http://localhost:8081>.

---

## Commands

Run from `Backend/`. Anything with `--workspace` also works without it, from that package's folder.

| Command | What it does |
|---|---|
| `npm run build` | Compiles every project in dependency order into `dist/`. Test files are excluded. |
| `npm run typecheck` | Full typecheck **including** tests, then a build. Stricter than `build`. |
| `npm run selfcheck` | Fast assertion checks across every workspace, then the gateway's. Needs MongoDB. |
| `npm run e2e` | End-to-end suites across every workspace. Needs MongoDB. |
| `npm test` | `selfcheck` then `e2e`. |
| `npm run smoke` | Gateway checks against a **running** stack. See below. |
| `npm run live-check` | Starts the whole stack on the host against a throwaway `bgsc_live` DB, calls every route through the gateway (auth refusals, 422 shapes, no 5xx) and runs the cross-service journeys (registration → seat → attendance → points → leaderboard, auction, challenges, notifications, media, brackets, deletion). ~3 min; needs compose `mongodb` + `redis`; report in `scripts/live-check/.run/report.txt`. |
| `npm run seed:founder` | One-time bootstrap: promotes the registered, active account `FOUNDER_EMAIL` to founder (audited; re-running for the same account is a no-op). Refuses an unknown or inactive account, or when a different founder already exists. In the image: `docker compose run --rm -e FOUNDER_EMAIL=you@example.com user-service node apps/user-service/dist/scripts/seed-founder.js`. |
| `npm run dev` | Gateway with reload. |
| `npm start` | Gateway from `dist/` (what the container runs). |

---

## The test suites

Four layers, each catching what the one below cannot. No test framework — everything is
`assert`-based and runs under `ts-node`, so there is nothing to configure and no runner to learn.

### 1. `npm run selfcheck` — units and invariants

Schema rules, model invariants, JWT middleware, the event bus (signing, listener isolation), the
production boot guard, the gateway's strict limiter (against a throwaway downstream, no stack
needed), and each service's own rules. Model-backed checks use a scratch database per suite
(`bgsc_selfcheck_<svc>` / `bgsc_e2e_<svc>`), never `bgsc_dev`, and drop it afterwards.

```bash
npm run selfcheck                                     # everything
npm run selfcheck --workspace @bgsc/registration-service
npx ts-node apps/registration-service/src/selfcheck/teams.selfcheck.ts   # one file
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
docker compose up -d          # or run the services by hand
npm run smoke
```

Two things to know:

- Every check in it was a real bug at least once. Treat a failure as a regression, not a flake.
- The last check deliberately spends the strict rate-limit bucket for anonymous `/account/reactivate`
  attempts from this machine. The limiter is in-memory per gateway process — **restart the gateway
  to clear it**.

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
| `/users` | user-service |
| `/events`, `/auction` | event-service |
| `/forms`, `/registrations`, `/teams` | registration-service |
| `/announcements` | announcement-service |
| `/points` | points-service |
| `/leaderboards`, `/hall-of-fame` | leaderboard-service |
| `/challenges`, `/strava` | challenge-service |
| `/media`, `/uploads` | media-service — serves every uploaded file |
| `/notifications` | notification-service |
| `/feedback`, `/contact` | feedback-service |
| `/brackets`, `/matches` | bracket-service |

`GET /gateway/services` lists the table live; it needs a coordinator-or-above token, because the
internal targets are nobody else's business.

**Rate limits** (`src/gateway/rateLimit.ts`): 100 requests/min per user (per IP when anonymous),
and a strict bucket on the auth paths in `routing.ts` — 5 per 15 min per IP *and target account*
(the submitted `login` / `email`, or the caller for phone OTP), under a 30 per 15 min per-IP
ceiling. Paths are matched the way Express matches them (any case, trailing slash). A successful
login does not count; the mail/SMS-sending paths count every call, because they answer 200
whatever happened. The gateway parses bodies for those paths only.

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
{ "error": "code" }
{ "error": "validation_failed", "fields": [{ "key": "email", "code": "invalid_format" }] }
```

A `422 validation_failed` always lists its per-field reasons under `fields`, whether zod or a
service rule (the form engine, which adds a `message`) refused. Other refusals may carry `details` when there is more to
say. `/health` is deliberately
unwrapped, because orchestrators parse it directly. The envelope is applied once in
`createServiceApp` — handlers return bare payloads and never wrap by hand. A body counts as already
wrapped only when `error` is a string or it is `{ success: true, data }`; a payload that merely
has a `success` or `error` key is wrapped like any other.

---

## Adding a service

1. `apps/<name>/` with a `package.json` and a `tsconfig.json` copied from an existing service —
   extend `tsconfig.base.json`, and keep the test-file `exclude` so tests stay out of `dist/`.
2. `src/index.ts` calling `createServiceApp`/`startService`, with `models: [...]` naming the models
   this service owns — only those get their indexes built at boot.
3. Add a row to `ROUTES` in `src/gateway/routing.ts`, and its name to `LIVE_SERVICES`.
4. Add it to `tsconfig.json` `references`, to `Dockerfile` (both the package copy and the dist
   copy), and to `docker-compose.yml`.
5. Add its URL to `packages/shared/src/config/env.ts` and to `.env.example`.

Miss step 3 and the gateway will keep answering 503 for a service that is running.

---

## Notes

- **Secrets.** `.env` is git-ignored; `.env.example` holds working dev defaults. A production boot
  refuses to start on any published default — see `assertInternalTokenConfigured`.
- **Production boot guard.** With `NODE_ENV=production` a service refuses to start on the published
  JWT/internal secrets, the committed Mongo root password, or a `REDIS_URL` without a password (or
  with the compose fallback). The gateway checks the secrets only — it has no database or bus.
- **Uploads** live under one root, `config.uploadDir` (`UPLOAD_DIR`; `Backend/uploads` on the host,
  the shared `uploads` volume at `/app/uploads` in compose). user and event write under `avatars/`
  and `events/`; media-service writes `media/` and is the only thing that serves `/uploads`.
  Registration files are private: they live under `.private/registrations/` (a dot-dir the static
  server never serves) and are read through `GET /registrations/:id/files/:field_key` — the owner,
  or an admin of the event (core+ for a challenge).
- **The event bus** is an in-process emitter, with Redis pub/sub carrying the same envelope between
  services when `REDIS_URL` is set. Every message on Redis is HMAC-SHA256-signed with
  `INTERNAL_API_TOKEN`, so all services must share that value; unsigned or tampered messages are
  dropped and logged. A process ignores its own echo by instance id. Each listener is isolated — one
  that throws or rejects does not stop the others. Call sites do not change when it becomes Kafka.
  **Rotating `INTERNAL_API_TOKEN`:** set the new value, put the old one in
  `INTERNAL_API_TOKEN_PREVIOUS` (accepted for verification only), and restart every service at once.
- **Replay sweeps, not an outbox.** Redis pub/sub loses what is published while a consumer is down.
  Every 5 minutes the producers re-publish (or re-apply) the last 7 days of what should have
  happened and is missing — challenge rewards, cancellation refunds, attendance credits,
  leaderboard finalization, `UserDeleted` / `UserRestored`, roster locks and waitlist promotion —
  keyed on the lifecycle timestamps (`started_at`, `completed_at`, `cancelled_at`, `deleted_at`,
  `restored_at`). Consumers are idempotent by their own keys, so a replay is harmless.
- **Event-admin scope.** Anything acting on one event's data (its forms, registrations, teams,
  scores, podium, albums) requires `isEventAdmin(event, actor)` from `@bgsc/shared` on the LIVE actor
  loaded by `requireActiveUser` — never the token's role claim. Challenge-owned data is core+.
- **Attendance** can be marked or revoked only while the event is running (`ongoing` and before
  `end_at`); otherwise `409 attendance_window_closed`.
- **Deferred to post-MVP / launch blockers.** Mail is a dev logger (verification, reset and feedback
  mail print to the log — a **launch blocker** until a provider is wired). WhatsApp broadcast and
  push are deferred: the code stays, and WhatsApp stays off unless `WHATSAPP_*` is configured —
  in-app delivery is the channel.
- **Indexes** are built at boot for the models a service owns (`models:`) and awaited before it
  listens — and only there: `autoIndex` is off. A failure is fatal on purpose: `form_submissions`
  relies on a unique partial index to reject duplicate registrations, and serving without it means
  serving without the guarantee. **A test that relies on a unique index must build it itself**
  (`await Model.syncIndexes()` in its scratch-DB setup), or the duplicate it expects to be refused
  is silently accepted.

---

## Databases created before the Sep 26 fixes

There is no migration: no production data exists yet. Wipe a dev database that predates them
(`docker compose down -v`, or drop `bgsc_dev`), then register and `seed:founder` again.
