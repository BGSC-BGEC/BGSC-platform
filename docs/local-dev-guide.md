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

That brings up MongoDB, Redis, the gateway and every built service. `docker compose down` to stop,
`docker compose logs -f gateway` to watch one.

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

## Layout

```
Backend/
  src/                  gateway :3000  — routing, JWT verification, rate limiting. No database.
  packages/shared/      @bgsc/shared   — models, middleware, events, config, service bootstrap
  apps/auth-service/    :3001  BE-1
  apps/user-service/    :3002  BE-2
```

| Port | Service | Owner · week | Status |
|---|---|---|---|
| 3000 | gateway | — | live |
| 3001 | auth-service | BE-1 · W1 | skeleton |
| 3002 | user-service | BE-2 · W1 | live |
| 3003 | event-service | BE-1 · W2 | not built |
| 3004 | registration-service | BE-2 · W2 | not built |
| 3005 | announcement-service | BE-2 · W2 | not built |
| 3006 | points-service | BE-2 · W3 | not built |
| 3007 | leaderboard-service | BE-1 · W3 | not built |
| 3008 | challenge-service | BE-2 · W3 | not built |
| 3009 | media-service | BE-1 · W4 | not built |
| 3010 | notification-service | W4 | not built |

Unbuilt services answer `503` through the gateway naming their owner and week, so a call to
`/events` today tells you who is writing it rather than hanging.

`GET localhost:3000/gateway/services` prints this table live.

## Commands

```bash
npm run build       # tsc --build across the workspace (project references)
npm run typecheck   # TypeScript 7 native compiler — actually checks, then rebuilds with 6
npm run selfcheck   # in-process assertions: model invariants, middleware, serializer, rating
npm run e2e         # real Mongo + real HTTP. Needs `docker compose up -d mongodb`
npm test            # selfcheck + e2e
```

`e2e` runs against throwaway databases (`bgsc_models_e2e`, `bgsc_e2e`) that it drops on exit — your
dev data is untouched.

## Adding a service

Around twenty lines; the bootstrap comes from `@bgsc/shared`:

```ts
import { createServiceApp, startService } from '@bgsc/shared';

const options = {
    name: 'event-service',
    port: parseInt(process.env.PORT || '3003', 10),
    routes: (app) => { app.use('/events', eventRoutes); },
};
export const app = createServiceApp(options);
if (require.main === module) startService(app, options).catch(...);
```

Health check, index building, security headers, the error envelope, process guards and graceful
shutdown are all handled. Then add the service to `src/gateway/routing.ts` and to `LIVE_SERVICES`.

## Gotchas

- **Never install TypeScript 7 as `node_modules/typescript`.** It ships no compiler API and
  `ts-node` dies at startup. See `docs/typescript-toolchain.md`.
- **One `.env`, at `Backend/`.** Every service reads it. `docker compose` overrides the service URLs
  with container names and refuses to start if the three secrets are unset.
- **Don't set `PORT` globally** — every service would try to bind the same port. Each sets its own.
- **Mongo here is standalone**, so there are no multi-document transactions. Cross-document
  consistency uses atomic conditional updates instead; see `docs/modeldocs/relationships.md` §5.

## Reference

- `docs/modeldocs/` — data models, invariants, indexes, event flows
- `docs/handoff-to-be1.md` — the shared contracts: token payload, error envelope, middleware
- `docs/typescript-toolchain.md` — why `typescript` is pinned to 6.x
