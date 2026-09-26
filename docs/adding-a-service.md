# Adding a Service — the shared wiring

Every domain service in `Backend/apps/` is built the same way: one workspace package, one
`createServiceApp` bootstrap from `@bgsc/shared`, one entry in the gateway, one block in compose.
The service-specific code is small; what gets missed is the wiring around it, because none of it
lives in the service's own directory.

This doc is the checklist and the templates. Verified against the tree on Sep 26, 2026 with
twelve live services built (auth, user, event, registration, announcement, points, leaderboard, challenge/strava, media, notification, feedback, bracket). Copy from `feedback-service`,
`bracket-service`, or `media-service` when in doubt — they are the most recent.

Related: `local-dev-guide.md` (running things), `handoff-to-be1.md` §2, §4, §5 (token contract,
middleware reference, error envelope), `typescript-toolchain.md` (why TypeScript is pinned to 6.x).

---

## 1. The checklist

Nine touch points. Seven are outside `apps/<name>/`. The last column is what you see when one is
missing, so a broken build can be traced back to the line you skipped.

| # | File | Edit | Missing it looks like |
|---|---|---|---|
| 1 | `apps/<name>/package.json` | new, from §2.1 | — |
| 2 | `apps/<name>/tsconfig.json` | new, from §2.2 | — |
| 3 | `apps/<name>/src/index.ts` | new, from §2.3 | — |
| 4 | `Backend/package-lock.json` | `npm install --package-lock-only` from `Backend/` | `docker build` fails at `npm ci`: `Missing: @bgsc/<name>@1.0.0 from lock file`. **Nothing local catches this** — `tsc`, `ts-node` and the selfchecks all pass |
| 5 | `Backend/tsconfig.json` | add `{ "path": "./apps/<name>" }` to `references[]` | `npx tsc --build` silently never compiles the app; `dist/` is empty; the container exits instantly with `Cannot find module` |
| 6 | `Backend/Dockerfile` | one `COPY` in the manifest layer, two `COPY --from=builder` in the runtime layer (§4.1) | manifest: `npm ci` does not know the workspace exists. runtime: image builds, container cannot find its entrypoint |
| 7 | `Backend/docker-compose.yml` | new service block (§4.2) **and** a `depends_on` line under `gateway` | compose has no container to route to; the gateway answers `502 bad_gateway` for the prefix |
| 8 | `Backend/src/gateway/routing.ts` | add the key to `LIVE_SERVICES` (§5) | the gateway answers `503 service_unavailable` naming the owner and week — the routing row exists, the service is just not marked live |
| 9 | `Backend/.env.example` + `config/env.ts` | usually **already done** for every planned service (§5) | only if the service is new to the plan |

Ports are pre-assigned by week in `packages/shared/src/config/env.ts` (`config.services`) and the
routing table already has a row for every planned service. For a planned service, #8 is one word
and #9 is nothing.

---

## 2. Scaffold — the three files inside `apps/<name>/`

### 2.1 `package.json`

Identical across services except the name and the selfcheck list. `uuid` only if you generate ids
outside a model (`_id` defaults to one already).

```json
{
  "name": "@bgsc/<name>",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --watch src --watch ../../packages/shared/src --ext ts --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "selfcheck": "ts-node src/selfcheck/<domain>.selfcheck.ts",
    "e2e": "ts-node src/<domain>/<domain>.e2e.ts"
  },
  "dependencies": {
    "@bgsc/shared": "1.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "mongoose": "^9.9.5",
    "uuid": "^14.0.2",
    "zod": "^4.5.4"
  }
}
```

`@bgsc/shared` is `1.0.0` exactly, not `^1.0.0`: it is a workspace link, and the lock file records
it as one. The root `package.json` `workspaces` glob (`apps/*`) picks the directory up on its own —
nothing to add there.

No `devDependencies`. `typescript`, `ts-node` and `nodemon` are hoisted from the root and pruned
out of the image by `npm prune --omit=dev`.

### 2.2 `tsconfig.json`

```jsonc
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
    "references": [{ "path": "../../packages/shared" }],
    "include": ["src/**/*"],
    // Test code must never reach dist, which is what ships in the image.
    "exclude": ["node_modules", "dist", "src/selfcheck/**", "**/*.e2e.ts"]
}
```

Two things this buys you:

- **`references`** makes `tsc --build` compile `@bgsc/shared` first and resolve the import through
  the `paths` mapping in `tsconfig.base.json`.

  **That mapping is compile-time only.** `ts-node` does not apply tsconfig `paths` at runtime, so
  a selfcheck or e2e resolves `@bgsc/shared` the way Node does: through the workspace symlink in
  `node_modules/`, to `packages/shared/dist/index.js`. **Every test in this repo runs against
  compiled shared code, not source.** Edit a shared model, run the suite without building, and you
  are testing the previous build — a changed invariant appears to pass before it exists. The root
  `preselfcheck` / `pree2e` hooks build `@bgsc/shared` first so `npm test` is correct by
  construction; a per-workspace `npm run selfcheck --workspace @bgsc/<name>` still skips them, so
  run `npx tsc --build` yourself after touching `packages/shared`.
- **`exclude`** keeps test code out of `dist/`. `tsconfig.check.json` at the root typechecks the
  whole tree, tests included, so nothing goes unchecked — it just does not ship.

If your seed helpers live in `src/selfcheck/`, the directory exclude covers them. If a test sits
beside its subject (`users/user.e2e.ts`), the `**/*.e2e.ts` pattern does.

### 2.3 `src/index.ts`

```ts
import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { thingRoutes } from './things/thing.routes';
import { initializeConsumers } from './events/consumers';

const NAME = '<name>';
const PORT = parseInt(process.env.PORT || '<port>', 10);

const options = {
    name: NAME,
    port: PORT,
    // The mongoose models this service OWNS (relationships.md §1). Only these get their indexes
    // built at boot — a bad index on someone else's collection must not stop you booting, and
    // yours must not stop theirs. Omitting it builds every registered model (the old behaviour).
    models: ['Thing'],
    routes(app: express.Express) {
        app.use('/things', thingRoutes);
        // Service-to-service only. The gateway refuses /internal from the edge; the router
        // must still mount requireServiceToken (§6.4).
        // app.use('/internal', internalRoutes);
    },
    async onReady() {
        // Runs after Mongo is connected, indexes are built and the event bus is up — before listen.
        initializeConsumers();
    },
};

export const app = createServiceApp(options);
export const start = () => startService(app, options);

if (require.main === module) {
    start().catch((err) => {
        console.error(`[${NAME}] Fatal: failed to start:`, err);
        process.exit(1);
    });
}
```

`app` is exported so a test can `app.listen(0)` without starting the service. What
`createServiceApp` + `startService` already do, so you do not:

| Concern | Where |
|---|---|
| `cors`, `express.json({ limit: '1mb' })`, `urlencoded` | `createServiceApp` |
| `{ success: true, data }` envelope on every `res.json` — handlers return bare objects | `successEnvelope` |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | `createServiceApp` |
| `GET /health` — `200 ok` only while Mongo is connected, else `503 degraded` | `createServiceApp` |
| 404 fallthrough, `ServiceError` → its status, body-parser 4xx passthrough, escaped `ZodError` → `422 validation_failed`, malformed URL (`URIError`) → `400 bad_request`, everything else → `500 internal_error` | `errorHandler` |
| Refuse to boot in production on a published secret, the committed Mongo password, or a `REDIS_URL` without a password | `assertInternalTokenConfigured` |
| `connectDB()` (with `autoIndex: false`), **`createIndexes()` on the `models:` you own and wait for it**, `connectEventBus()` | `startService` |
| `unhandledRejection` logged, `uncaughtException` exits | `installProcessGuards` |
| `SIGINT`/`SIGTERM` → close server → disconnect bus and DB | `startService` |

Source: `packages/shared/src/service.ts`.

---

## 3. Workspace wiring

From `Backend/`, in this order:

```bash
npm install --package-lock-only     # #4 — records the new workspace in package-lock.json
```

Then add the reference to `Backend/tsconfig.json` (#5):

```jsonc
"references": [
    { "path": "./packages/shared" },
    { "path": "./apps/user-service" },
    { "path": "./apps/auth-service" },
    { "path": "./apps/registration-service" },
    { "path": "./apps/announcement-service" },
    { "path": "./apps/<name>" }
],
```

The lock diff should be two entries (`apps/<name>` and `node_modules/@bgsc/<name>` as a link) and
no dependency churn. If it is bigger, a version range in your `package.json` differs from the
sibling services — fix the range, not the lock.

---

## 4. Docker

One image for the whole workspace (`Dockerfile` header explains why). Adding a service is adding
its files to that image and giving it a container.

### 4.1 `Dockerfile` — three lines

Manifest layer, so `npm ci --workspaces` knows the package exists:

```dockerfile
COPY apps/registration-service/package.json ./apps/registration-service/
COPY apps/announcement-service/package.json ./apps/announcement-service/
COPY apps/<name>/package.json ./apps/<name>/          # add
RUN npm ci --workspaces --include-workspace-root
```

Runtime layer, so the container can find its entrypoint and its own `package.json` (Node resolves
`main` and the workspace link through it):

```dockerfile
COPY --from=builder --chown=app:app /app/apps/<name>/dist ./apps/<name>/dist
COPY --from=builder --chown=app:app /app/apps/<name>/package.json ./apps/<name>/package.json
```

`COPY apps ./apps` in the builder already picks up your source; only the two layers above are
per-service.

### 4.2 `docker-compose.yml` — the block, plus one line

```yaml
  <name>:
    build: { context: ., dockerfile: Dockerfile }
    image: bgsc-backend:local
    restart: unless-stopped
    command: ["node", "apps/<name>/dist/index.js"]
    # No host port: reachable only through the gateway and the internal network.
    expose:
      - "<port>"
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: <port>
      MONGO_URI: mongodb://bgsc_admin:${MONGO_ROOT_PASSWORD:-bgsc_password}@mongodb:27017/bgsc_dev?authSource=admin
      # Without this, publish() stays in-process and no other service hears your events. The
      # password travels separately (config/redis.ts) — never paste it into the URL.
      REDIS_URL: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-dev_redis_password_change_me}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?set JWT_ACCESS_SECRET in .env}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?set JWT_REFRESH_SECRET in .env}
      INTERNAL_API_TOKEN: ${INTERNAL_API_TOKEN:?set INTERNAL_API_TOKEN in .env}
      # config/env.ts refuses to boot in production without it — event-service once missed it and
      # took the whole stack down through the gateway's depends_on.
      CORS_ORIGIN: ${CORS_ORIGIN:?set CORS_ORIGIN in .env}
      # Only the services this one CALLS over HTTP, by container name. Reads of another
      # service's collection go through the shared model and need no URL (§6.5).
      # EVENT_SERVICE_URL: http://event-service:3003
    depends_on:
      mongodb: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:<port>/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
```

And under `gateway.depends_on`:

```yaml
      <name>: { condition: service_healthy }
```

Notes:

- `expose`, not `ports`. The gateway on `:3000` is the only published port.
- `INTERNAL_API_TOKEN` is required even with no `/internal` routes: `startService` always calls
  `assertInternalTokenConfigured()` (a no-op outside `NODE_ENV=production`, fatal inside it), and
  compose refuses to start without the three secrets by design. Production parity is the point.
  It is also the key every event-bus message is signed with, so it must be the same value in every
  service — a mismatch shows up as `Event bus: dropped a message with a bad signature`.
- If you call another service's `/internal` routes, add a `depends_on` on that service being
  healthy as well as the URL.
- The gateway block already carries `<NAME>_SERVICE_URL: http://<name>:<port>` for every planned
  service. Do not add it twice.
- A service that writes files uses `config.uploadDir` (never a path relative to `__dirname`), writes
  under its own prefix (`avatars/`, `events/`, `registrations/`, …), and gets the shared volume plus
  `UPLOAD_DIR: /app/uploads` — copy `user-service`'s entries. Do not mount `/uploads` statically:
  media-service is the only thing that serves it, and the gateway routes it there.
- The healthcheck is the same line as every other service with the port changed. `/health` is
  fail-closed (503 without Mongo), so `service_healthy` means "can serve", not "process is up".

---

## 5. Gateway and config

`Backend/src/gateway/routing.ts`:

```ts
export const LIVE_SERVICES = new Set(['auth', 'user', 'registration', 'announcement', 'event', 'auction', 'points', 'leaderboard', 'challenge', 'strava', 'notification', 'feedback', 'bracket', '<key>']);
```

That is the whole gateway change for a planned service. The `ROUTES` row (prefixes, target, owner)
already exists; the proxy forwards the same path prefix the service mounts, so there is no path
rewriting and nothing else to edit. Live services are mounted with `app.use(handler)` scoped by a
`pathFilter` so the full path survives — never `app.use(prefix, handler)`, which would strip it.

`GET localhost:3000/gateway/services` prints the table with `live: true/false`, which is the
quickest way to confirm the flag took.

Only for a service that is **not** on the plan (no row, no port):

| File | Add |
|---|---|
| `packages/shared/src/config/env.ts` | `<key>: process.env.<KEY>_SERVICE_URL \|\| 'http://localhost:<port>'` under `services` |
| `src/gateway/routing.ts` | a `ROUTES` row: `{ prefixes: ['/things'], target: config.services.<key>, owner: 'BE-x · Wn' }` |
| `.env.example` | `<KEY>_SERVICE_URL=http://localhost:<port>` |
| `docker-compose.yml` → `gateway.environment` | `<KEY>_SERVICE_URL: http://<name>:<port>` |

The ROUTES order matters when prefixes overlap; first match wins.

---

## 6. Conventions inside the service

These are what the existing services do. Matching them is what makes the gateway, the frontend and
the next person's review work without special cases.

### 6.1 Layout

```
src/
├── index.ts
├── <domain>/
│   ├── <domain>.routes.ts       middleware chain per route; literal paths before /:id
│   ├── <domain>.controller.ts   thin: parse → call service → res.json. No business logic
│   ├── <domain>.service.ts      data access, invariant guards, domain events
│   └── <domain>.schemas.ts      zod request schemas + inferred input types
├── events/consumers.ts          subscribe(...) handlers, wired in onReady
├── internal/internal.routes.ts  only if another service calls you (§6.4)
├── clients/<other>-client.ts    only if you call another service (§6.5)
└── selfcheck/
    ├── seed.ts                  fixtures + resetFixtures()
    └── <area>.selfcheck.ts
```

### 6.2 Routes and controllers

```ts
router.post('/', requireAuth, requireRole(UserRole.CORE), validate({ body: CreateSchema }), c.create);
router.get('/:id', optionalAuth, validate({ params: IdParams }), c.get);
```

- Every handler is `wrap(async (req, res) => ...)` so a rejection reaches the error handler.
- `validate({ body, query, params })` parses **and replaces** the part with the stripped, coerced
  value. Zod dropping unknown keys is the sanitization: a client cannot set `role` or `status` by
  adding the field. Failure is `422 { error: 'validation_failed', fields: [{ key, code }] }` and the
  handler never runs.
- `requireRole` after `requireAuth`. No token → 401; valid token, low rank → 403. An anonymous
  caller never sees a 403 (it confirms the endpoint exists).
- `requireRole` ranks the token's role claim, which stays valid for up to 15 minutes after a
  suspension or demotion. On writes, rank the live user document instead —
  `apps/announcement-service/src/announcements/actor.ts` (`requireActiveUser(floor)`) is the pattern.
- `optionalAuth` on reads whose response differs for a signed-in viewer. The gateway also runs it
  and never rejects; the service re-verifies, so it is correct with or without the gateway.
- Literal paths (`/heads`, `/me`, `/read-all`) are declared **before** `/:id`, or Express matches
  them as an id.
- Handlers return bare objects. The envelope is added centrally. `204` for a write with nothing
  to say; `201` for a create.

### 6.3 Services

- Refusals are `throw new ServiceError(status, 'snake_case_code', details?)`. Never
  `res.status(...)` in a service, never `err.message` in a response. The handler maps it; anything
  else is a `500 internal_error` with the real error logged server-side.
- Model `pre('validate')` hooks throw plain `Error`s, which surface as 500. **Every bad-input path
  must be refused with a `ServiceError` before `.save()`.** This is the single largest source of
  avoidable bugs.
- Query updates (`findOneAndUpdate`, `updateMany`) **do not run document middleware.** Anything a
  hook derives (`expires_at`, a raised `min_role`) has to be written explicitly on that path.
- `const alive = { deleted_at: null }` in every read filter on a soft-deleting collection. Put it
  inside your shared filter builder so no read path can forget.
- Keyset pagination, never skip/offset: sort on `(field, _id)` descending, opaque base64url cursor
  carrying `{ field, value, id }`, validate the decoded cursor's types (a non-string `value` is an
  operator document in disguise). `user-service/src/users/user.service.ts` and
  `announcement-service/src/announcements/audience.ts` are the two implementations.
- **Combine filters with `$and`, never by spreading.** Two builders that each return a top-level
  `$or` collide under `{ ...a, ...b }` and the first is silently dropped.
- Status transitions that must happen once are a compare-and-swap:
  `findOneAndUpdate({ _id, status: { $in: from } }, { $set }, { returnDocument: 'after' })`. The
  loser matches nothing. Read-then-save lets a double-click through twice.
- Domain events: `publish('ThingHappened', '<name>', payload)`. Envelope and naming per
  `docs/modeldocs/relationships.md` §6. Fire after the write commits; the bus is fire-and-forget.

### 6.4 `/internal` routes

Service-to-service only. Two layers, both required:

- the gateway 404s any `/internal*` path at the edge (`isInternalPath`);
- the router mounts `requireServiceToken`, which checks `x-internal-token` against
  `INTERNAL_API_TOKEN` in constant time.

"Not exposed on the gateway" is a deployment assumption, not an access control. Build an internal
route only when there is a caller for it — a contract with no second party is a guess.

### 6.5 Crossing a service boundary

The ownership table in `docs/modeldocs/relationships.md` §1 decides this:

| Need | How |
|---|---|
| **Read** another service's collection | Import the model from `@bgsc/shared` and query it. No HTTP, no client, no URL in compose. Same database, same replica — a read is a read |
| **Write** to a document another service owns | `callInternal(config.services.<other>, '/internal/...', { method, body })` from `@bgsc/shared` — never a hand-rolled `fetch`. It sends `X-Internal-Token`, unwraps the `{ success, data }` envelope (a hand-written client once read `result.reserved` off the wrapper and rejected every registration), and throws `InternalCallError`. `status >= 400` is a refusal: surface it, never fall back. `outcomeUnknown` (no answer / 5xx) means the write may have landed: retry with the SAME idempotency key or fail `503`, and never write the other service's collection yourself. Add `<OTHER>_SERVICE_URL` and a `depends_on` to your compose block |
| Keep a display snapshot fresh (`{ user_id, display_name, avatar_url }`) | Consume `UserProfileUpdated { user_id, changed_fields }` and `updateMany`. Gate on `changed_fields` containing `full_name` or `avatar_url`. Best-effort: a miss costs a stale name, never a broken record. Copy `registration-service/src/events/consumers.ts` |

The agreed exceptions (`users.points_balance`, `users.announcements.*`) are listed in
`relationships.md` §1; do not add a third without writing it down there.

**Event-scoped authority.** Anything that acts on one event's data — its forms, registrations,
teams, scores, podium, albums — checks `isEventAdmin(event, actor)` (or `requireEventAdmin(eventId,
actor)`: 404 for a missing or invisible draft, 403 for a visible non-admin) from `@bgsc/shared`,
with the LIVE actor `{ id: req.actor._id, role: req.actor.role }` from `requireActiveUser`, never
the token claim. Challenge-owned data is core+ by design. Escape user text before putting it in a
`$regex` (`escapeRegex`).

### 6.6 Error envelope

```
401  { "error": "unauthorized" }
403  { "error": "forbidden" }
404  { "error": "<thing>_not_found" }
409  { "error": "<specific_conflict>" }
422  { "error": "validation_failed", "fields": [...] }   or a specific 422 code from the service
500  { "error": "internal_error" }
```

Snake_case code, no human message; the frontend owns wording. Auth failures never say why. A viewer
who may not see a document gets 404, not 403 — they should not learn that it exists.

---

## 7. Tests

Every service ships two test layers: selfchecks cover the service-layer functions; e2e covers the
HTTP service (routes, middleware, envelope, mass-assignment via zod stripping, audit log on the
write path). Selfchecks catch logic bugs; e2e catches wiring bugs, and a service needs both.
Today auth, user and announcement have both; **registration-service has no e2e yet** and owes one.

### 7.1 Selfchecks

`ts-node` scripts with `assert`, one per area, run against the local Mongo
(`docker compose up -d mongodb redis`). No framework.

- Give them a scratch database of their own and drop it **at the start** (a run that dies mid-way
  never reaches the end) — `openScratchDb()` in `apps/announcement-service/src/selfcheck/seed.ts`.
  Never point them at `bgsc_dev`: anything that acts on a whole collection (a scheduler tick, a
  retention sweep) rewrites real dev data, and audit rows are append-only, so every run's rows
  stay forever. Older services still `connectDB()` + `resetFixtures()` against dev; move them over
  when you next touch them.
- Test the service layer directly (`svc.create(...)`, `svc.list(...)`) for logic. Test the model's
  invariants nowhere — `packages/shared/src/models/models.selfcheck.ts` already does, and a second
  copy is a second place to update.
- Test as a query what is enforced as a query: a filter that is right on page one can leak on
  page two.
- Register each file in the `selfcheck` script of the service's `package.json`. The root
  `npm run selfcheck` runs every workspace's.

### 7.2 e2e

One file per service, `src/<domain>/<domain>.e2e.ts`. Boots the real Express app against a
scratch Mongo and hits routes over `fetch()` with signed JWTs. Pattern copied from
`apps/user-service/src/users/user.e2e.ts`:

- `import { app } from '../index'` — `createServiceApp` already exports it.
- scratch DB of its own: `const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_<name>$2')`.
  Never the shared `bgsc_e2e` (suites running side by side wipe each other) and never `bgsc_dev`.
- `await mongoose.connect(TEST_DB); await mongoose.connection.dropDatabase(); await Model.syncIndexes();`
  **Not optional since audit #2:** `autoIndex` is off, so a scratch DB has no unique indexes until
  you build them — a test expecting a duplicate to be refused would pass it silently.
- ephemeral port: `server = app.listen(0); base = http://127.0.0.1:${port}`. Never collides.
- inline JWT: `const token = (id, role) => jwt.sign({sub:id, role}, config.jwt.accessSecret, {expiresIn:'5m'})`.
- `call(method, path, {as?, body?})` helper builds Bearer header, unwraps the `{success, data}`
  envelope on success, keeps the `{error}` shape on failure, returns `{status, body}`.
- teardown: `await mongoose.connection.dropDatabase(); server?.close(); mongoose.disconnect()`.
  Run in a `finally` so a mid-run failure does not leak the DB or the port.

**Cases worth pinning (adapt per service):** `/health` 200 + `db:'connected'` + the
`X-Content-Type-Options: nosniff` security header; happy + sad paths for every route (401 anon,
403 wrong rank, 404 not-found, 422 validation, 409 conflict, 500 unhandled); mass-assignment
guard (zod strips `{status:'published'}` from a POST body and the response shows `status:'draft'`);
double-click race on a status transition (exactly one 200, one 409, one audit row);
audit-failure regression (monkey-patch `AuditLog.create` to throw, mirroring
`user.e2e.ts:488-505`, and assert whichever audit ordering the service documents — e.g. announcement
audits first on create, so it rejects with nothing written, but audits after a compare-and-swap
publish, so the publish still answers 200 and still emits); audit-read endpoint returns the rows the
writes created.

**Register the file** in the service's `package.json` `e2e` script. The root `npm test` chains
`selfcheck && e2e` over every workspace, so passing both flips the merge gate.

The teardown drops `bgsc_e2e_<name>`. Because every suite owns its database, suites never share
state and their order is unconstrained.

---

## 8. Verify before handing over

From `Backend/`:

```bash
npx tsc --build                                 # compiles; dist/ appears under apps/<name>/
npx tsc -p tsconfig.check.json --noEmit         # typechecks tests too
npm run selfcheck --workspace @bgsc/<name>      # against local Mongo
git diff --stat package-lock.json               # two entries, no churn

docker compose build                            # catches #4 and #6
docker compose up -d
docker compose ps                               # <name> shows (healthy)
curl -s localhost:3000/gateway/services | grep -o '"key":"<key>"[^}]*'   # live: true
curl -s localhost:3000/<prefix>                 # reaches the service, not 502/503
```

`npm run typecheck` at the root runs the first two with the TypeScript 7 native compiler (the one
that actually finds errors), then rebuilds `dist/` with the pinned 6.x. See `typescript-toolchain.md`
for why both exist.

---

## 9. Gotchas collected so far

- **The lock file.** Nothing local fails when it is stale; only `npm ci` in Docker does. Run
  `npm install --package-lock-only` every time a workspace `package.json` changes.
- **The root `tsconfig.json` reference.** Without it the build is green and the app is empty.
- **Never install TypeScript 7 as `node_modules/typescript`.** No compiler API; `ts-node` dies.
- **One `.env`, at `Backend/`.** `config/env.ts` walks up to find it, so it works from `src/` and
  from `dist/`. Do not set `PORT` in it — every service would bind the same port; each service
  defaults its own.
- **`REDIS_URL` in compose.** Without it every `publish()` stays inside the process. Fine for one
  service in dev; wrong the moment a second service is supposed to hear it — and refused at a
  production boot. The password is `REDIS_PASSWORD`, not part of the URL. A Redis client of your own
  (a cache) must be built from `redisOptions()` in `@bgsc/shared` — `new Redis(config.redisUrl)`
  would connect without the password, and ioredis lets a URL password beat an options one.
- **Rotating `INTERNAL_API_TOKEN`:** old value into `INTERNAL_API_TOKEN_PREVIOUS` (verify-only),
  new one in `INTERNAL_API_TOKEN`, restart every service at once.
- **Pub/sub loses messages published while you are down.** There is no outbox: if your service
  produces an event whose loss would leave data wrong (a reward, a refund, a deletion), add a replay
  sweep — every 5 min, a 7-day window keyed on a lifecycle timestamp, a bounded page, re-publishing
  what is missing. Consumers must therefore be idempotent by a key derived from the data, never the
  envelope's `message_id`.
- **The bus is signed and isolated (Sep 26, 2026).** Every message on Redis is
  `{ v, sig, body }`, `sig` = HMAC-SHA256 of `body` keyed by `INTERNAL_API_TOKEN`; unsigned or
  tampered messages are dropped and logged, because points-service credits what a
  `ChallengeCompleted` payload says. A process skips its own echo by a per-process instance id. Each
  `subscribe()` listener is isolated: one that throws or rejects is logged and the rest still run —
  but still wrap your handlers so a failure says which one.
- **An unreachable Redis is not fatal (changed Sep 20, 2026).** `connectEventBus()` used to await
  its first connect, so a Redis outage crash-looped every service in the platform — the HTTP API
  down because the *event bus* was down. It now wires the transport, connects in the background and
  retries every 10s, logging `Event bus unreachable at startup` until it lands. Two consequences for
  a new service: `startService()` resolving no longer means the bus is connected, only that it is
  wired; and events published during the gap are dropped, exactly as they are during any later
  outage. Neither changes a call site — `publish()` and `subscribe()` are unchanged, and
  fire-and-forget was always their contract.
- **Changing an index's OPTIONS on a collection that already exists is a migration, not a schema
  edit — and it fails the boot.** `startService` builds indexes with `createIndexes()`, which
  refuses to alter an index that already exists under the same auto-generated name:

  ```
  Failed to build indexes for StravaCredential: An existing index has the same name as the
  requested index... Requested: { unique: true, key: { athlete_id: 1 }, name: "athlete_id_1" },
  existing: { key: { athlete_id: 1 }, name: "athlete_id_1" }
  ```

  The container then crash-loops on every database that has the old index. **The test suite will
  not catch this**: selfchecks and e2e open a scratch DB and call `syncIndexes()`, which *can* drop
  and recreate, so they pass against a green field while the real stack cannot start. Adding a new
  index is safe; adding `unique`, `partialFilterExpression` or a TTL to an existing one is not.

  There is no migration runner in this repo, and while the dev database is wiped regularly this
  mostly resolves itself: a wipe rebuilds every index from the current schema. It matters when a
  database is **not** wiped — a long-lived staging or production one, or a colleague who pulls
  mid-week. The procedure there is: drop the old index (`db.<coll>.dropIndex('<name>')`), let the
  next boot build the new one, and **check for duplicates first** — a unique index cannot build
  over existing violations, which turns a crash-loop into a crash-loop you also have to clean data
  for. Say so in the PR either way.

  Note this is the index half only. The stale-`dist` trap in §2.2 is a different animal: a database
  wipe does nothing for it, because the stale artefact is `packages/shared/dist`, not data. That one
  is handled by the root `preselfcheck` / `pree2e` hooks.
- **mongod needs a raised `nofile` limit, or the test suite kills it (found Sep 26, 2026).**
  WiredTiger opens a file per collection and per index, and every selfcheck and e2e in this repo
  creates a scratch database and drops it — thousands of files churned per full run. Docker's
  default soft limit (1024-2048) is not enough: mongod hits `Too many open files`, WiredTiger
  panics, and the process **aborts**:

  ```
  WT_PANIC: WiredTiger library panic ... __posix_directory_sync: Too many open files
  Fatal assertion 50853 ... Got signal: 6 (Aborted).
  ```

  What you actually see is a random `MongoNetworkError: connection N to [::1]:27017 closed` in
  whichever selfcheck happened to be running — a different one each time, which reads exactly like
  test flakiness. It is not; the database died under it, restarted, and logged
  `Detected unclean shutdown`. `docker-compose.yml` now sets `nofile` to 64000 on the mongodb
  service (MongoDB's own documented minimum). If you run mongod some other way, raise it there too:
  `docker inspect backend-mongodb-1` will not tell you, but
  `docker compose exec mongodb sh -c 'cat /proc/1/limits'` will.
- **A computed event name is invisible to a `publish('` search (found Sep 27, 2026).** Most
  services publish with a literal — `publish('EventCompleted', …)` — but `points-service` maps a
  transaction type to its event name and publishes `EVENT_FOR[tx.type]`. Grepping for `publish('` to
  find out what a service emits therefore reported that the Points Service emits **nothing**, and a
  Week-4 feature was dropped on that false premise. When you need the real producer list, grep for
  `publish(` without the quote, and read `relationships.md §6` — which was right.
- **A keyset sort needs `_id` IN the index, or Mongo sorts the whole match in memory.** Every list
  in this repo sorts on `(field, _id)` — the tiebreaker is what stops rows straddling a page
  boundary — and an index of `{ status: 1, published_at: -1 }` cannot serve a sort of
  `{ published_at: -1, _id: -1 }`. The query is still *correct*, so nothing fails: it is a
  `SORT <- FETCH <- IXSCAN` that works at a few hundred rows and aborts at 32MB. Three services had
  it (announcement, challenge, feedback), found Sep 27 by measuring rather than reading. Check a new
  list endpoint the same way — seed a scratch DB with a couple of thousand rows and ask the planner:

  ```ts
  const plan = await Model.find(filter).sort(sortObj).limit(20).explain('queryPlanner');
  console.log(JSON.stringify(plan.queryPlanner.winningPlan, null, 2));   // want no SORT stage
  ```

  A filter key that sits *between* the filter and the sort breaks it too: `{ status, severity,
  created_at }` cannot order a query that filters on `status` alone.
- **Mongo is standalone**: no multi-document transactions. Use conditional atomic updates
  (`relationships.md` §5).
- **`req.query` is a getter in Express 5.** `validate` writes the parsed value through
  `defineProperty`; do not assign `req.query = ...` yourself.
- **String enums sort alphabetically in Mongo.** A `priority` of `normal | important | urgent`
  sorted with `-1` gives `urgent > normal > important`. Order such sets in memory or store a rank.
- **`setInterval`'s first fire is a full period away.** A scheduler that only runs on the interval
  never runs in a process that restarts more often than the period. Run once at start, then on
  the timer, and `unref()` it.
