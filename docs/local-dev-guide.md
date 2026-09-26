# BGSC Platform — Local Dev Guide

The backend is a set of services behind an API gateway. **Only the gateway is exposed** — frontends
talk to `http://localhost:3000` and nothing else.

## Prerequisites

- Node.js 22+
- Docker (for MongoDB and Redis; you can run the whole backend in it too)

## Quick start — everything in Docker

```bash
cd Backend
cp .env.example .env
docker compose up -d
curl localhost:3000/health          # {"status":"ok","service":"gateway",...}
```

That brings up MongoDB, Redis, the gateway and every service. `docker compose down` to stop,
`docker compose logs -f gateway` to watch one.

MongoDB (27017), Redis (6379) and mongo-express (8081, `--profile tools`) are published on
**127.0.0.1 only** — never the LAN. Redis runs with `--requirepass $REDIS_PASSWORD`, and every
service gets the same `REDIS_PASSWORD` next to a password-less `REDIS_URL` (any characters are
fine; a password pasted into the URL could not contain `/ # ? %`). Both passwords
(`MONGO_ROOT_PASSWORD`, `REDIS_PASSWORD`) fall back to dev values that a `NODE_ENV=production` boot
refuses. `CORS_ORIGIN` has no fallback: compose refuses to start without it.

First account with power: register it (and verify it, so it is active), then
`FOUNDER_EMAIL=you@example.com npm run seed:founder` (or set `FOUNDER_EMAIL` in `.env`). It is a
one-time bootstrap: it refuses an unregistered or inactive account, and refuses once a different
founder exists — promote everyone else through the app.

Uploaded files go to one named volume, `uploads`, mounted at `/app/uploads` in user, event,
registration and media services (`UPLOAD_DIR=/app/uploads`). media-service is the only one that
serves `/uploads`.

## Faster loop — infrastructure in Docker, services on the host

```bash
cd Backend
cp .env.example .env
npm install
docker compose up -d mongodb redis

npm run dev                                      # gateway        :3000
npm run dev --workspace @bgsc/user-service       # user-service   :3002
npm run dev --workspace @bgsc/auth-service       # auth-service   :3001
```

Each in its own terminal. The gateway routes to whichever services are running and returns `502`
for one that is down, so you only need to start the service you are working on.

On the host, uploads land in `Backend/uploads/` (`config.uploadDir`; override with `UPLOAD_DIR`),
and the services need `REDIS_PASSWORD` in `.env` (as in `.env.example`) to reach the compose Redis.
Without it every service is deaf to the others' events — look for `Event bus` errors in the log.

## Layout

```
Backend/
  src/                  gateway :3000  — routing, JWT verification, rate limiting. No database.
  packages/shared/      @bgsc/shared   — models, middleware, events, config, service bootstrap
  apps/auth-service/           :3001  BE-1
  apps/user-service/           :3002  BE-2
  apps/event-service/          :3003  BE-1
  apps/registration-service/   :3004  BE-2
  apps/announcement-service/   :3005  BE-2
  apps/points-service/         :3006  BE-2
  apps/leaderboard-service/    :3007  BE-1
  apps/challenge-service/      :3008  BE-2   (also serves /strava)
  apps/media-service/          :3009  BE-1   (also serves /uploads)
  apps/notification-service/   :3010  BE-2
  apps/feedback-service/       :3011  BE-2
  apps/bracket-service/        :3012  BE-2
```

| Port | Service | Owner · week | Status |
|---|---|---|---|
| 3000 | gateway | — | live |
| 3001 | auth-service | BE-1 · W1 | live |
| 3002 | user-service | BE-2 · W1 | live |
| 3003 | event-service | BE-1 · W2 | live — serves `/events` **and** `/auction` (BE-1 · W3) |
| 3004 | registration-service | BE-2 · W2 | live |
| 3005 | announcement-service | BE-2 · W2 | live |
| 3006 | points-service | BE-2 · W3 | live |
| 3007 | leaderboard-service | BE-1 · W3/W4 | live — event standings, global rank, points investment, `/hall-of-fame` |
| 3008 | challenge-service | BE-2 · W3 | live — serves `/challenges` **and** `/strava` |
| 3009 | media-service | BE-1 · W4 | live — asset upload, albums, moderation, unified `/uploads` delivery |
| 3010 | notification-service | BE-2 · W4 | live — inbox, announcement broadcast, WhatsApp |
| 3011 | feedback-service | BE-2 · W4 | live — `/feedback`, `/contact` |
| 3012 | bracket-service | BE-2 · W4 | live — `/brackets`, `/matches` |

A service in `ROUTES` but not `LIVE_SERVICES` answers `503` naming its owner, rather than hanging.

`GET localhost:3000/gateway/services` prints this table live (coordinator token or above).

## Commands

```bash
npm run build       # tsc --build across the workspace (project references)
npm run typecheck   # TypeScript 7 native compiler — actually checks, then rebuilds with 6
npm run selfcheck   # in-process assertions: model invariants, middleware, event bus, gateway limiter
npm run e2e         # real Mongo + real HTTP. Needs `docker compose up -d mongodb`
npm test            # selfcheck + e2e
```

Suites run against throwaway databases (`bgsc_models_e2e`, `bgsc_selfcheck_<svc>`, `bgsc_e2e_<svc>`)
that they drop on exit — your dev data in `bgsc_dev` is untouched.

## Adding a service

Around twenty lines; the bootstrap comes from `@bgsc/shared`:

```ts
import { createServiceApp, startService } from '@bgsc/shared';

const options = {
    name: 'event-service',
    port: parseInt(process.env.PORT || '3003', 10),
    // The models this service OWNS — only their indexes are built at boot.
    models: ['Event', 'AuctionLot'],
    routes: (app) => { app.use('/events', eventRoutes); },
};
export const app = createServiceApp(options);
if (require.main === module) startService(app, options).catch(...);
```

Health check, index building, security headers, the error envelope, process guards and graceful
shutdown are all handled. The rest is wiring outside the service — lock file, root `tsconfig.json`
references, two `Dockerfile` layers, a compose block, `LIVE_SERVICES` — and every one of them has
a silent failure mode. **Follow `docs/adding-a-service.md`**; it is the checklist plus templates.

## Gotchas

- **Never install TypeScript 7 as `node_modules/typescript`.** It ships no compiler API and
  `ts-node` dies at startup. See `docs/typescript-toolchain.md`.
- **One `.env`, at `Backend/`.** Every service reads it. `docker compose` overrides the service URLs
  with container names and refuses to start if the three secrets are unset.
- **Don't set `PORT` globally** — every service would try to bind the same port. Each sets its own.
- **Mongo here is standalone**, so there are no multi-document transactions. Cross-document
  consistency uses atomic conditional updates instead; see `docs/modeldocs/relationships.md` §5.
- **Calling another service** is `callInternal(config.services.x, '/internal/...', { body })` from
  `@bgsc/shared`, never a hand-rolled `fetch` and never a write to the other service's collection.
  A refusal (`status >= 400`) is final; `outcomeUnknown` means retry with the same idempotency key.
- **Every service must share `INTERNAL_API_TOKEN`.** It also signs event-bus messages; a service
  with a different value drops everyone's events as "bad signature" (and logs it). To rotate it, set
  the old value as `INTERNAL_API_TOKEN_PREVIOUS` and restart everything at once.
- **Indexes are built only by `startService`** (`autoIndex` is off), for the `models:` a service
  owns. A selfcheck or e2e on a scratch DB that expects a unique index to refuse a duplicate must
  `await Model.syncIndexes()` first.
- **Event-scoped writes** use `isEventAdmin(event, actor)` / `requireEventAdmin(eventId, actor)` from
  `@bgsc/shared` with the live actor from `requireActiveUser`, never the token's role.
- **Attendance** is only markable while an event is `ongoing` and before `end_at`
  (`409 attendance_window_closed` otherwise) — seed an ongoing event to test it.
- **Mail is a dev logger** (verify/reset/feedback links print to the service log). WhatsApp and push
  are deferred to post-MVP; in-app notifications are the only channel.
- **Upgrading a database that was not wiped:** `npm run migrate:audit2` (dry run, then
  `-- --apply`); see the README's "Upgrading" section and audit-2 §6.

## Reference

- `docs/adding-a-service.md` — checklist and templates for standing up a new service
- `docs/modeldocs/` — data models, invariants, indexes, event flows
- `docs/handoff-to-be1.md` — the shared contracts: token payload, error envelope, middleware
- `docs/typescript-toolchain.md` — why `typescript` is pinned to 6.x
