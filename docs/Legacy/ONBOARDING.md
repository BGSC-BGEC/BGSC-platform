x# BGSC Platform — Developer Onboarding

This guide has two parts:

- **Part 1 — Quick Start** — get the stack running, understand the structure, start contributing. For any new dev.
- **Part 2 — Full Codebase Mastery** — a sequenced reading plan to know every file, every pattern, every service by heart. For devs who need to own the codebase.

Read Part 1 on day 1. Use Part 2 as a structured 2-day deep dive after.

---

# Part 1 — Quick Start

Welcome. This walks you through the full platform from zero: what it is, how to run it, and how each part works. Read top to bottom on your first day.

---

## What is this?

BGSC Platform is a community platform for BGSC/BGEC/FitSoc members. It has three clients:

- **Mobile app** (React Native + Expo) — the main member-facing app
- **Web admin** (React + Vite) — admin dashboard for coordinators
- **Backend** (NestJS microservices) — the API that both clients talk to

Everything lives in one repository (a monorepo):

```
BGSC-platform/
├── backend/          # NestJS API gateway + all microservices
├── web/              # React admin panel (Vite)
├── mobile/           # React Native app (Expo)
├── docs/             # All documentation (you are here)
├── docker-compose.yml
└── docker-compose.override.yml
```

---

## Prerequisites

Install these before you do anything else:

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org) | 20 LTS | Backend, web, mobile |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Run all services locally |
| [Expo Go](https://expo.dev/go) | Latest | Preview mobile app on your phone |

**Optional but recommended:**
- VS Code with the ESLint and Prettier extensions
- [Obsidian](https://obsidian.md) for reading the `docs/` vault

---

## Getting the code running (15 minutes)

### 1. Clone and install

```bash
git clone <repo-url>
cd BGSC-platform

# Install dependencies for each workspace
cd backend && npm install && cd ..
cd web && npm install && cd ..
cd mobile && npm install && cd ..
```

### 2. Start everything with Docker

From the repo root:

```bash
docker compose up
```

This single command starts 10 containers:

| Container | Port | What it does |
|-----------|------|-------------|
| `bgsc-postgres` | 5432 | PostgreSQL database |
| `bgsc-redis` | 6379 | Redis (sessions + rate limiting) |
| `bgsc-api-gateway` | **3000** | The only public entry point |
| `bgsc-auth-service` | 3001 | Login, register, tokens |
| `bgsc-user-service` | 3002 | Profiles, RBAC |
| `bgsc-sponsor-service` | 3003 | Sponsor affiliations |
| `bgsc-event-service` | 3004 | Events + registrations |
| `bgsc-points-service` | 3005 | Points ledger |
| `bgsc-notification-service` | 3006 | In-app notifications |
| `bgsc-announcement-service` | 3007 | Announcements feed |

**All client requests go through port 3000 only.** The individual service ports (3001–3007) are only exposed locally for debugging; in production only 3000 is public.

### 3. Seed the database

```bash
cd backend
npm run seed
```

This creates some initial users and test data.

### 4. Verify it works

```bash
curl http://localhost:3000/health
```

You should get `{"status":"ok"}`. If you do, the stack is healthy.

---

## Understanding the architecture

### Why microservices?

Instead of one big server, this backend is split into small, focused services. Each service:
- Owns its own code and tables
- Runs as its own process (its own Docker container)
- Communicates with other services over HTTP on the internal Docker network

The **API gateway** (`backend/src/`) sits in front of all services. It is the only thing clients talk to. It handles:
1. JWT authentication — verifies your token before forwarding the request
2. Rate limiting — blocks abuse (100 req/min general, 5/15min for auth endpoints)
3. Routing — forwards `/auth/*` to auth-service, `/events/*` to event-service, etc.

```
Mobile / Web
     │
     ▼
API Gateway :3000
     │
     ├── /auth/*       → auth-service :3001
     ├── /users/*      → user-service :3002
     ├── /sponsors/*   → sponsor-service :3003
     ├── /events/*     → event-service :3004
     ├── /points/*     → points-service :3005
     ├── /notifications/* → notification-service :3006
     └── /announcements/* → announcement-service :3007
```

### The shared database

All services share a single PostgreSQL database (`bgsc_dev`), but each service only reads and writes its own tables. There are no cross-service foreign keys by design — if service A needs data from service B, it makes an HTTP request.

### Event bus (in-memory)

Services emit domain events (e.g. `RegistrationCreated`, `PointsEarned`) via an `EventBusService`. Right now these events are logged but not consumed across services. Cross-service coordination currently happens via direct HTTP calls.

---

## Backend deep dive

### Folder structure

```
backend/
├── src/                    # API Gateway (root NestJS app)
│   ├── main.ts             # Entry point, middleware setup
│   ├── gateway/            # Routing, proxy, JWT middleware, rate limiting
│   └── config/             # Joi-validated config
├── apps/
│   ├── auth-service/       # Login, register, Google OAuth, TOTP, refresh tokens
│   ├── user-service/       # User profiles, interests, RBAC
│   ├── sponsor-service/    # Sponsor CRUD, affiliations, fan counting
│   ├── event-service/      # Events, registrations, leaderboards, Hall of Fame
│   ├── points-service/     # Points ledger, transaction history
│   ├── notification-service/ # In-app notifications
│   ├── announcement-service/ # Announcements with tags
│   ├── social-service/     # Phase 2 — not in Docker yet
│   └── challenge-service/  # Phase 2 — not in Docker yet
└── package.json            # All scripts live here
```

Each service under `apps/` follows the same internal structure:

```
apps/<service-name>/src/
├── <domain>/
│   ├── entities/       # TypeORM entity = one DB table
│   ├── dto/            # Data Transfer Objects (request/response shapes)
│   ├── <domain>.service.ts
│   ├── <domain>.controller.ts
│   └── <domain>.module.ts
├── migrations/         # DB schema changes in chronological order
└── main.ts             # Starts this service on its port
```

### Running a single service in dev (hot reload)

For active development on one service, run it outside Docker with watch mode. First make sure Docker is up (for Postgres and Redis), then:

```bash
cd backend
npm run start:auth-service:dev      # auth on :3001
npm run start:user-service:dev      # user on :3002
npm run start:sponsor-service:dev   # sponsor on :3003
npm run start:event-service:dev     # event on :3004
npm run start:points-service:dev    # points on :3005
npm run start:notification-service:dev
npm run start:announcement-service:dev
```

The file watcher recompiles on every save.

### Swagger (interactive API docs)

When running with `docker compose up` (which includes `docker-compose.override.yml`), each service exposes a Swagger UI at its own port:

| Service | Swagger URL |
|---------|------------|
| Auth | http://localhost:3001/auth/docs |
| User | http://localhost:3002/docs |
| Sponsor | http://localhost:3003/docs |
| Events | http://localhost:3004/docs |
| Points | http://localhost:3005/docs |

Use Swagger to explore and test endpoints without writing curl commands. See `docs/manual-testing-gateway.md` for curl examples against the gateway.

### Running tests

```bash
cd backend

npm test                             # all unit tests
npm run test:cov                     # unit tests + coverage report
npm run test:e2e                     # auth-service e2e
npm run test:e2e:sponsor             # sponsor-service e2e
npm run test:e2e:event               # event-service e2e
npm run test:e2e:points              # points-service e2e
npm run test:e2e:notification
npm run test:e2e:announcement
```

E2e tests require a running Postgres and Redis. The CI pipeline sets these up automatically; locally you can use `docker compose up postgres redis` first.

### Key concepts in the backend

**JWT is verified twice.** The gateway verifies your access token before forwarding the request, and each downstream service verifies it again when it arrives. Never trust a request inside a service without the JWT guard.

**RBAC per service.** Each service has its own `roles.guard.ts`. The `UserRole` enum (`MEMBER`, `COORDINATOR`, `ADMIN`, `SUPER_ADMIN`) is duplicated across services intentionally so each can be deployed independently.

**No path rewriting.** The gateway forwards requests as-is. `/events/123` at the gateway hits `/events/123` at event-service.

**Configs are Joi-validated.** Each service has a `*.config.ts` that reads environment variables and throws at startup if anything is missing or wrong. You will never get a silent `undefined` env var.

---

## Web admin deep dive

The web admin is a React 19 + Vite app using Tailwind CSS. It is the coordinator/admin dashboard.

```
web/
├── src/
│   ├── main.tsx              # Entry point
│   ├── app/
│   │   └── router.tsx        # React Router route tree
│   ├── core/
│   │   ├── api/
│   │   │   └── ApiClient.ts  # Axios wrapper, token injection, 401 handling
│   │   ├── repositories/     # One file per API domain (Auth, Event, User…)
│   │   ├── stores/
│   │   │   └── authStore.ts  # Zustand auth state
│   │   └── viewmodel/        # BaseViewModel + useViewModel hook
│   ├── pages/                # One file per route
│   └── components/           # Shared UI components
└── package.json
```

### Running the web app

```bash
cd web
npm run dev       # starts on http://localhost:5173
npm run build     # production build
```

### Architecture pattern: MVVM

The web app (and mobile app) follow MVVM:

```
API call → Repository → ViewModel (state + logic) → React component (render only)
```

**Never make API calls inside a component.** Components only read from a ViewModel. This keeps UI code dumb and testable.

Example flow for loading events:
1. `EventRepository.getEvents()` — calls `ApiClient`, returns raw data
2. `EventsViewModel` — fetches, stores in state, handles loading/error
3. `Events.tsx` — renders whatever the ViewModel exposes

---

## Mobile deep dive

The mobile app is React Native 0.85 with Expo 56. It uses Expo Router for file-based navigation (similar to Next.js).

```
mobile/
├── src/
│   ├── app/                        # Every file here = a screen/route
│   │   ├── _layout.tsx             # Root layout, auth gate, font loading
│   │   ├── login.tsx               # Unauthenticated screen
│   │   ├── register.tsx            # Unauthenticated screen
│   │   └── (drawer)/               # Drawer-protected screens (requires login)
│   │       ├── _layout.tsx         # Drawer navigator setup
│   │       ├── index.tsx           # Home (announcements + feed)
│   │       ├── events.tsx
│   │       ├── points.tsx
│   │       ├── sponsors.tsx
│   │       └── profile.tsx
│   ├── core/
│   │   ├── api/
│   │   │   └── ApiClient.ts        # Same pattern as web, uses SecureStore for tokens
│   │   ├── repositories/           # Auth, User, Event, Points, Announcement, HallOfFame
│   │   └── stores/
│   │       └── authStore.ts        # Auth state, token refresh logic
│   └── components/                 # Shared UI components
└── package.json
```

### How Expo Router file-based routing works

The `(drawer)` folder is a **route group** — the parentheses mean it is a navigator wrapper, not a URL segment. Any screen inside `(drawer)/` requires the user to be logged in (the `_layout.tsx` enforces this).

```
/login            → app/login.tsx           (public)
/register         → app/register.tsx        (public)
/                 → app/(drawer)/index.tsx  (requires auth)
/events           → app/(drawer)/events.tsx (requires auth)
```

### Running the mobile app

```bash
cd mobile
npm start          # starts the Expo dev server

# Then choose:
#   Press 'a' to open Android emulator
#   Press 'i' to open iOS simulator (Mac only)
#   Scan QR code with Expo Go on your phone
```

Make sure the mobile `ApiClient.ts` points to your machine's local IP (not `localhost`) so the physical device can reach your Docker gateway. The IP is usually already set via `Constants.expoConfig.extra.apiUrl`.

### Same MVVM pattern

Mobile uses the same Repository → ViewModel → Component pattern as web. No direct API calls inside screen components.

---

## DevOps

### Docker Compose: dev vs production-like

| Command | Mode | Ports exposed |
|---------|------|--------------|
| `docker compose up` | Dev (override applied) | Gateway :3000 + all services :3001–:3007 |
| `docker compose -f docker-compose.yml up` | Locked (production-like) | Gateway :3000 only |

The `docker-compose.override.yml` is automatically merged in dev mode. It re-publishes service ports to your host so you can hit Swagger directly. In production, only :3000 is public.

### CI/CD pipelines

**`backend-ci.yml`** — runs on every PR targeting `main` or `dev` that touches `backend/`:
1. Starts real Postgres and Redis in CI
2. Installs deps, runs lint, runs tests with coverage
3. Builds the Docker image (no push on PRs — just validates it builds)

**`deploy-staging.yml`** — runs on every push to `dev` that touches `backend/`:
1. Sends a POST to Render's deploy hook (stored in `RENDER_DEPLOY_HOOK_URL` secret)
2. Render automatically pulls and redeploys the staging environment

There is no CI pipeline for the web app yet.

### Environment variables

The `docker-compose.yml` contains all env vars with safe development defaults. For production, never use the `dev_*_secret` JWT secrets — replace them with strong random values.

See `docs/variables.md` for the full reference of product-level constants (semester limits, fan amounts, etc.).

---

## How to contribute

### Branching

All PRs target the `dev` branch. Never push directly to `main`.

```
feature/XXX-short-description    # new feature
fix/XXX-short-description        # bug fix
chore/short-description          # tooling, docs, cleanup
```

Replace `XXX` with the issue/task number if one exists.

### PR checklist

- [ ] CI passes (lint + tests)
- [ ] No new `console.log` left in production code
- [ ] New features have at least one unit test
- [ ] If you changed any API shape, update the relevant `docs/Backend Documentation/*.md`
- [ ] 1 review required before merging

---

## Where to find things

| What you need | Where to look |
|---------------|--------------|
| Full product spec | `docs/BGSC Platform — Complete Feature Specification & Architecture.md` |
| API reference (backend) | `docs/Backend Documentation/<service>.md` |
| UI/UX spec | `docs/Frontend/UI-UX-Master-Doc.md` |
| Screen-by-screen specs | `docs/Frontend/` subfolders |
| Env vars reference | `docs/variables.md` |
| API gateway routing rules | `docs/api-gateway.md` |
| curl smoke-test examples | `docs/manual-testing-gateway.md` |
| Phase progress + task breakdown | `README.md` |
| DB schema | Walk the `migrations/` files in each service in timestamp order |

---

---

# Part 2 — Full Codebase Mastery

This section is for devs who need to own the entire codebase — able to navigate any file, debug any service, and extend any feature without asking where things are. It is a sequenced reading and doing plan across two days. Do Part 1 first.

**Goal:** By the end of Day 2 you can answer "where does X live, how does it work, and how would I change it?" for any part of the platform — backend, web admin, or mobile.

---

## Before you start

Read these three documents end-to-end before touching any code. They give you the mental model everything else builds on.

1. `README.md` — phase status, who built what, what is left. Know the roadmap.
2. `docs/BGSC Platform — Complete Feature Specification & Architecture.md` — the authoritative product spec (~90k characters, budget 1 hour). Every service, every feature, every rule lives here. This is the source of truth when code and requirements conflict.
3. `docker-compose.yml` — the complete topology. Every service, its port, its env vars, its dependencies. Read it once and you have the entire system in your head.

---

## Day 1 — Backend (8 hours)

### Session 1 — Gateway and infrastructure (1.5 h)

Every request in the system flows through the gateway first. Understand it before anything else.

**Read in this order:**

| File | What to understand |
|------|--------------------|
| `backend/src/main.ts` | Bootstrap order: helmet → CORS → rate-limit middleware → JWT middleware → 7 proxy middlewares → listen |
| `backend/src/gateway/routing.ts` | How URLs are classified and matched to a service. Path-prefix matching, no rewriting. |
| `backend/src/gateway/proxy.ts` | `createServiceProxy` wraps `http-proxy-middleware`. Note `bodyParser: false` — request bodies stream raw so nothing gets corrupted. |
| `backend/src/gateway/jwt-auth.middleware.ts` | Token verification at the edge. Which routes are skipped (public routes list). |
| `backend/src/gateway/rate-limit.middleware.ts` | Redis sliding-window algorithm. General limit (100/min) vs auth-attempt limit (5 attempts / 15 min). |
| `backend/src/config/gateway.config.ts` | Joi-validated config. Learn the `registerAs` pattern — every service copies it. |

**Lock these in:**
- The gateway (`backend/src`) is the NestJS monorepo root app. Services live in `backend/apps`.
- Services are never reachable from outside Docker — only the gateway is.
- `bodyParser: false` in the gateway — if you remove it, file uploads and large payloads will corrupt.
- JWT is verified at the gateway AND again inside each service. Both layers are required.

---

### Session 2 — Auth service (1.5 h)

Everything downstream depends on identity. Understand auth before anything else.

**Read in this order:**

| File | What to understand |
|------|--------------------|
| `docs/Backend Documentation/authservice.md` | Complete API reference. Read all of it (~30 min). |
| `apps/auth-service/src/auth.module.ts` | Module wiring: TypeORM, PassportModule, JwtModule, all providers registered. |
| `apps/auth-service/src/entities/user-credential.entity.ts` | What is stored: password hash, refresh token hash, TOTP secret (AES-encrypted), deletion schedule. |
| `apps/auth-service/src/entities/login-audit-log.entity.ts` | Every auth event is persisted here. |
| `apps/auth-service/src/services/auth.service.ts` | Local login, Google OAuth, token pair generation. Where `eventBusService.emit('UserRegistered', ...)` fires. |
| `apps/auth-service/src/services/token.service.ts` | Access + refresh token lifecycle. Refresh rotation on every use. Breach detection (old refresh token reuse = revoke all sessions). |
| `apps/auth-service/src/services/session.service.ts` | Redis session store. How `logout-all` works. |
| `apps/auth-service/src/services/account.service.ts` | Disable/enable/delete/export flows. All fire domain events. |
| `apps/auth-service/src/controllers/totp.controller.ts` | TOTP enable/verify/disable. Fires `UserTOTPEnabled` etc. |
| `apps/auth-service/src/strategies/` | Three Passport strategies: local (email+password), JWT (bearer token), Google (OAuth2). |
| `apps/auth-service/src/guards/rate-limit.guard.ts` | Per-endpoint Redis rate limit inside the service — separate from the gateway limit. |
| `apps/auth-service/src/migrations/` | The DB schema for this service. |

**Domain events emitted by auth-service** (currently logged, not consumed):
`UserRegistered`, `UserLoggedIn`, `UserSessionBreach`, `UserAllSessionsRevoked`, `UserPasswordChanged`, `UserDisabled`, `UserEnabled`, `UserDeletionScheduled`, `UserDeletionCancelled`, `UserDeleted`, `UserDataExportRequested`, `UserTOTPEnabled`, `UserTOTPDisabled`

**Key thing:** `user-credential` (auth-service) and `user` (user-service) are separate rows sharing a `userId` UUID. Same database, different tables, different domains.

---

### Session 3 — User service (1 h)

| File | What to understand |
|------|--------------------|
| `docs/Backend Documentation/user-service.md` | Full API reference. |
| `apps/user-service/src/users/entities/user.entity.ts` | The main user row: display name, bio, interests, sponsor affiliation, custom tags, logo URL. |
| `apps/user-service/src/users/users.service.ts` | Note `HttpService` calls to sponsor-service — this is the inter-service HTTP pattern used everywhere. |
| `apps/user-service/src/users/users.controller.ts` | Public profile, own profile PATCH, player card, friend suggestions, event history, sponsor stats. |
| `apps/user-service/src/rbac/roles.guard.ts` | JWT claim-based RBAC. This exact pattern is duplicated in every service — understand it once, recognize it everywhere. |
| `apps/user-service/src/migrations/` | 4 migration files. Read in timestamp order to see how the schema evolved. |

---

### Session 4 — Sponsor and event services (1.5 h)

These two services represent the main product loop: users pick sponsors → attend events → earn fans and points.

**Sponsor service:**

| File | What to understand |
|------|--------------------|
| `docs/Backend Documentation/sponsor-service.md` | Full API reference. |
| `apps/sponsor-service/src/sponsors/entities/sponsor.entity.ts` | Sponsor row. |
| `apps/sponsor-service/src/sponsors/entities/user-sponsor-affiliation.entity.ts` | One row per (user, sponsor, semester). The semester uniqueness constraint is enforced here. |
| `apps/sponsor-service/src/sponsors/sponsors.service.ts` | Focus on `awardFans` (emits `FanEarned`) and `endAffiliation` (emits `SponsorTenureEnded`). |
| `apps/sponsor-service/src/sponsors/events/fan-earned.event.ts` | Domain event shape. Learn this — it is the template for all domain events. |

**Event service:**

| File | What to understand |
|------|--------------------|
| `docs/Backend Documentation/event-service.md` | Full API reference. |
| `apps/event-service/src/events/entities/event.entity.ts` | Event types, status enum, capacity. |
| `apps/event-service/src/events/entities/registration.entity.ts` | Registration row. |
| `apps/event-service/src/events/entities/event-score.entity.ts` | Manual score entry for leaderboards. |
| `apps/event-service/src/events/events.service.ts` | `registerUser` emits `RegistrationCreated`; `completeEvent` emits `EventCompleted`. |
| `apps/event-service/src/events/domain-events/` | Two interfaces: `RegistrationCreatedEvent`, `EventCompletedEvent`. |
| `apps/event-service/src/hall-of-fame/hall-of-fame.service.ts` | Calls sponsor-service via HTTP to enrich winner data — cross-service HTTP pattern example. |

**Domain events emitted here:** `FanEarned`, `SponsorTenureEnded`, `RegistrationCreated`, `EventCompleted`

---

### Session 5 — Points, notifications, announcements (1 h)

**Points service:**

| File | What to understand |
|------|--------------------|
| `docs/Backend Documentation/points-service.md` | Full API reference. |
| `apps/points-service/src/points/entities/point-transaction.entity.ts` | Every points award/deduction is an immutable transaction row. |
| `apps/points-service/src/points/points.service.ts` | `awardPoints` emits `PointsEarned`. |
| `apps/points-service/src/points/enums/points-source.enum.ts` | All the sources that can award points. Add new sources here when extending. |

**Notification service:**

| File | What to understand |
|------|--------------------|
| `apps/notification-service/src/notifications/notifications.service.ts` | create / list / mark-read / delete. |
| `apps/notification-service/src/notifications/entities/notification.entity.ts` | Notification row. |

Note: POST `/notifications` is blocked at the gateway — only services on the internal Docker network can create notifications. The gateway returns 403 on any external attempt.

**Announcement service:**

| File | What to understand |
|------|--------------------|
| `apps/announcement-service/src/announcements/announcements.service.ts` | CRUD with tags. |
| `apps/announcement-service/src/announcements/entities/announcement.entity.ts` | Announcement row. |

GET `/announcements` is public. POST/DELETE require `ADMIN` or higher.

---

### Session 6 — Event bus (1 h)

This is what binds all services together — and it is currently a stub.

**Current state:** Four identical `EventBusService` stubs (one per service that emits events). Each has an `emit<T>(eventType, payload)` method that logs the event and does nothing else. No subscribers. No delivery.

**Files to read:**
- `apps/auth-service/src/services/event-bus.service.ts`
- `apps/event-service/src/events/event-bus.service.ts`
- `apps/points-service/src/points/event-bus.service.ts`
- `apps/sponsor-service/src/sponsors/event-bus.service.ts`

**Events that need real consumers:**

| Event | Emitted by | Should trigger |
|-------|-----------|----------------|
| `RegistrationCreated` | event-service | points-service awards registration points; notification-service notifies user |
| `EventCompleted` | event-service | points-service awards placement points; notification-service notifies winners |
| `FanEarned` | sponsor-service | points-service awards fan-watching points |
| `PointsEarned` | points-service | notification-service notifies user |
| `UserRegistered` | auth-service | user-service creates the profile row |
| `UserDeleted` | auth-service | user-service removes the profile row |

Because services run as separate processes, in-process EventEmitter only works for within-service events. Cross-service delivery uses direct HTTP POST today and will need a real broker (Redis pub/sub or RabbitMQ) later.

---

### Session 7 — Tests, CI, tooling (30 min)

| File / Command | What to understand |
|----------------|--------------------|
| `backend/package.json` scripts | Every `start:*`, `test:*`, and `seed` command. Know them all. |
| `backend/nest-cli.json` | Monorepo project roots. Tells NestJS CLI where each service lives. |
| `.github/workflows/backend-ci.yml` | Lint + test + Docker build on PRs. Real Postgres + Redis in CI. |
| `.github/workflows/deploy-staging.yml` | Push to `dev` triggers a Render deploy hook. |
| `apps/auth-service/test/app.e2e-spec.ts` | E2e test setup pattern — learn it once, every service follows it. |
| `docs/manual-testing-gateway.md` | Step-by-step curl commands against the gateway. |

---

### Database schema map

All services share `bgsc_dev`. Walk the migration files in timestamp order to get the full picture without a visual tool:

```
1718520000000  auth-service     AddTotpAndAccountLifecycleAndAuditLog
1750000000000  user-service     AddUserProfileColumns
1762000000000  sponsor-service  CreateSponsorsAndAffiliations
1762000001000  user-service     AddLastSponsorChange
1763000000000  sponsor-service  AddAffiliationUniqueness
1763000001000  sponsor-service  RemoveAffiliationUserForeignKey   ← deliberate decoupling
1764000000000  event-service    CreateEvents
1765000000000  points-service   CreatePointTransactions
1769000000000  user-service     AddBioColumn
1770000000000  user-service     AddDisplayNameCustomTagsLogoUrl
1771000000000  notification-service  CreateNotifications
1772000000000  announcement-service  CreateAnnouncements
```

The `RemoveAffiliationUserForeignKey` migration is intentional — no cross-service FK constraints by design.

---

## Day 2 — Frontend + integration (8 hours)

### Session 8 — Design system and specs (30 min)

Read these before touching any UI code. They define the visual language and screen inventory.

| File | What to understand |
|------|--------------------|
| `docs/Frontend/UI-UX-Master-Doc.md` | Typography, color tokens, spacing scale, component patterns. |
| `docs/variables.md` | Product-level constants: semester limits, fan amounts, points values. |
| `docs/screens.md` | High-level screen inventory — all screens in both mobile and web admin. |
| `docs/Frontend/` subfolders | Each subfolder has screen-specific specs. Skim all of them for awareness. |

---

### Session 9 — Web admin (React + Vite) (2 h)

**Goal:** understand every layer of the web admin, from API call to rendered pixel.

| File | What to understand |
|------|--------------------|
| `docs/web.md` | Purpose and current state of the admin panel. |
| `web/src/main.tsx` | Entry point. Providers, router mount. |
| `web/src/app/router.tsx` | Route tree. Which routes are guarded. |
| `web/src/core/api/ApiClient.ts` | Axios wrapper. Token injection in request interceptor. 401 handling in response interceptor (refresh + retry). |
| `web/src/core/repositories/AuthRepository.ts` | Login and logout calls. Simplest repository. |
| `web/src/core/repositories/EventRepository.ts` | Full CRUD repository. Use as the template pattern for new repositories. |
| `web/src/core/repositories/UserRepository.ts` | User management calls. |
| `web/src/core/stores/authStore.ts` | Zustand store. How auth state is persisted and hydrated. |
| `web/src/core/viewmodel/BaseViewModel.ts` | Base class: loading state, error state, common helpers. |
| `web/src/core/viewmodel/useViewModel.ts` | React hook that instantiates and binds a ViewModel to a component. |
| `web/src/pages/Login.tsx` | Simplest full-stack flow: Repository → ViewModel → component. Read this first. |
| `web/src/pages/Events.tsx` | Table + repository + ViewModel all wired together. The full pattern. |
| `web/src/components/RequireAuth.tsx` | Route guard. How it reads auth state and redirects. |

**The MVVM rule:** Repository handles API calls → ViewModel handles state and side effects → Component only renders. Never break this layering.

---

### Session 10 — Mobile (React Native + Expo) (3 h)

**Goal:** understand every screen, the navigation structure, and the data layer.

**Architecture first:**

| File | What to understand |
|------|--------------------|
| `docs/mobile.md` | Architecture overview, dev setup, known gotchas. |
| `mobile/src/app/_layout.tsx` | Root layout: font loading, splash screen, auth gate. The app starts here. |
| `mobile/src/app/(drawer)/_layout.tsx` | Drawer navigator: which tabs exist, icons, order. |
| `mobile/src/core/api/ApiClient.ts` | Same Axios pattern as web, but uses `expo-secure-store` for tokens (not localStorage). |
| `mobile/src/core/stores/authStore.ts` | Zustand auth state. Token refresh logic. How tokens survive app restarts. |

**Repositories — read all of them:**

| File | Covers |
|------|--------|
| `mobile/src/core/repositories/AuthRepository.ts` | Login, register, Google OAuth, refresh |
| `mobile/src/core/repositories/UserRepository.ts` | Profile fetch and update, player card |
| `mobile/src/core/repositories/EventRepository.ts` | Event list, filters, registration, leaderboard |
| `mobile/src/core/repositories/PointsRepository.ts` | Balance, transaction history |
| `mobile/src/core/repositories/AnnouncementRepository.ts` | Feed |
| `mobile/src/core/repositories/HallOfFameRepository.ts` | Hall of Fame data |

**Screens — read all of them:**

| File | Screen |
|------|--------|
| `mobile/src/app/login.tsx` | Login screen |
| `mobile/src/app/register.tsx` | Register screen |
| `mobile/src/app/(drawer)/index.tsx` | Home — announcements + feed |
| `mobile/src/app/(drawer)/events.tsx` | Event list + register button |
| `mobile/src/app/(drawer)/points.tsx` | Balance + transaction history |
| `mobile/src/app/(drawer)/sponsors.tsx` | Sponsor selection flow |
| `mobile/src/app/(drawer)/profile.tsx` | Own profile view + edit |
| `mobile/src/app/event/[id].tsx` | Event detail + register |

**Components — read the key ones:**

| File | What it does |
|------|-------------|
| `mobile/src/components/profile/PlayerCard.tsx` | Shareable player card — complex layout, worth understanding |
| `mobile/src/components/home/` | All home tab sub-components: announcements list, feed, intro banner |

**Expo Router rules to internalize:**
- `(drawer)` is a route group, not a URL segment. Parentheses = navigator wrapper.
- `_layout.tsx` at each level controls the navigator for that group.
- `[id].tsx` is a dynamic segment — `params.id` in the component.
- Screen components never call APIs directly. Always through a Repository.

---

### Session 11 — Phase 2 scaffolds (30 min)

Two services exist in `backend/apps/` but are not wired into Docker yet. Read them to understand what Phase 2 looks like.

| Folder | What it will do |
|--------|----------------|
| `apps/social-service/` | Friends, feed, posts, likes, comments |
| `apps/challenge-service/` | Challenges, acceptance, proof submission, auto-leaderboards |

These are scaffolds — module stubs with no logic yet. Understanding their shape now means you can wire them in without re-reading the full spec.

---

### Session 12 — Pending work and what to build next (30 min)

Read:
1. `README.md` Phase 0 "Work Left" — PostgreSQL migrations, Redis cache layer, Event Bus
2. `README.md` Phase 1 "Work Left" — Web admin screens
3. `README.md` Phase 2 full table — friends, feed, challenges
4. Re-read the full spec (`docs/BGSC Platform — Complete Feature Specification & Architecture.md`) if you have not already — this is the ground truth for all future work

---

## Time budget summary

| Session | Topic | Time |
|---------|-------|------|
| Pre-reading | README + full spec + docker-compose | 1.5 h |
| 1 | Gateway + infrastructure | 1.5 h |
| 2 | Auth service | 1.5 h |
| 3 | User service | 1 h |
| 4 | Sponsor + event services | 1.5 h |
| 5 | Points + notification + announcement | 1 h |
| 6 | Event bus | 1 h |
| 7 | Tests + CI + tooling + DB schema | 30 min |
| **Day 1** | | **~9.5 h** |
| 8 | Design system + screen specs | 30 min |
| 9 | Web admin | 2 h |
| 10 | Mobile | 3 h |
| 11 | Phase 2 scaffolds | 30 min |
| 12 | Pending work + spec re-read | 30 min |
| **Day 2** | | **~6.5 h** |

---

## Key decisions to internalize

These are the architectural choices that affect every line you write. Know them cold.

**No path rewriting at the gateway.** Services expose the same URL prefix the gateway routes. `/events/123` at the gateway becomes `/events/123` at event-service. Never strip or rewrite paths.

**JWT verified twice.** Gateway edge + inside each downstream service. Both layers are mandatory — downstream services should never trust a request without re-verifying the token.

**Event bus is fire-and-log only today.** All four `EventBusService` stubs emit a log line and nothing else. Cross-service coordination currently happens via direct HTTP (`HttpService`). The Phase 1 task is to replace this with a real bus.

**Single database, separate table domains.** All services share `bgsc_dev` but own their own tables. No cross-service FK constraints — see `RemoveAffiliationUserForeignKey`. If service A needs service B's data, it makes an HTTP request.

**RBAC is per-service.** `UserRole` enum and `roles.guard.ts` are duplicated in every service intentionally. Independent deployability > DRY.

**POST /notifications is gateway-blocked.** Only internal Docker network traffic can create notifications. External POST returns 403. This is by design — notifications are always system-initiated.

**Mobile tokens live in SecureStore.** Never `AsyncStorage` for auth tokens on mobile. The `ApiClient.ts` uses `expo-secure-store` — if you write new mobile auth code, keep it there.

**MVVM is enforced.** No API calls inside React components, anywhere — web or mobile. Repository → ViewModel → component. Breaking this pattern makes state management untestable.
