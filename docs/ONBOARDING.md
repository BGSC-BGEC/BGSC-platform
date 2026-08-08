# Lead Developer Onboarding — BGSC Platform

**Goal:** Full codebase mastery in 2 days, starting with the backend. Immediate deliverable: wire the Event Bus. Learn everything else in parallel.

---

## Quick orientation (read first — 15 min)

| File | What it tells you |
|------|------------------|
| `README.md` | Phase status, who built what, what is left to build |
| `BGSC Platform — Complete Feature Specification & Architecture.md` | Full product spec — the source of truth for what every service must do |
| `BGSC Platform – Development Plan & Tasks (Beginner-Friendly).md` | Task breakdown with estimates, useful for knowing what is pending |
| `docker-compose.yml` | Every service, its port, env vars, and dependencies — the topology map |
| `docker-compose.override.yml` | Dev-only port exposure. Understand why it exists (prod locks everything behind :3000) |

---

## Day 1 — Backend deep dive (8 h)

### Block 1: Infrastructure & gateway (1.5 h)

Start here because every request in the system flows through the gateway before hitting any service.

**Read in this order:**

1. `docker-compose.yml` — understand the 8-container topology (postgres, redis, api-gateway + 7 services)
2. `backend/src/main.ts` — the gateway bootstrap: helmet → CORS → rate-limit middleware → JWT middleware → 7 proxy middlewares
3. `backend/src/gateway/routing.ts` — how URLs are classified and routed to services (path-prefix matching, no rewriting)
4. `backend/src/gateway/proxy.ts` — `createServiceProxy` wraps `http-proxy-middleware`, passes `xfwd` for real client IP
5. `backend/src/gateway/jwt-auth.middleware.ts` — verifies access token at the edge for protected routes
6. `backend/src/gateway/rate-limit.middleware.ts` — Redis sliding window, general (100/min) vs auth-attempt (5/15min)
7. `backend/src/config/gateway.config.ts` — Joi-validated config map; understand the `registerAs` pattern, you will copy it for every service

**Key things to lock in:**
- The gateway is `backend/src` (not `backend/apps`). It is the NestJS monorepo root app.
- Services never expose themselves to the internet — only the gateway does (port 3000).
- JWT is verified at the gateway edge AND again inside each downstream service. Belt-and-suspenders.
- `bodyParser: false` in the gateway — request bodies stream raw to the proxy so nothing gets corrupted.

---

### Block 2: Auth service — the identity foundation (1.5 h)

Everything else depends on auth. Understand it before touching any other service.

**Read in this order:**

1. `docs/authservice.md` — full API reference, read the whole thing (~30 min)
2. `apps/auth-service/src/auth.module.ts` — module wiring: TypeORM, PassportModule, JwtModule, all providers
3. `apps/auth-service/src/entities/user-credential.entity.ts` — what gets stored (password hash, refresh token hash, TOTP secret, deletion schedule)
4. `apps/auth-service/src/entities/login-audit-log.entity.ts` — every auth event is persisted
5. `apps/auth-service/src/services/auth.service.ts` — local login, Google OAuth, token pair generation; where `eventBusService.emit('UserRegistered', ...)` fires
6. `apps/auth-service/src/services/token.service.ts` — access + refresh token lifecycle, refresh rotation, breach detection
7. `apps/auth-service/src/services/session.service.ts` — Redis session store, `logout-all` flow
8. `apps/auth-service/src/services/account.service.ts` — disable/enable/delete/export; all fire domain events
9. `apps/auth-service/src/controllers/totp.controller.ts` — TOTP enable/verify/disable; fires `UserTOTPEnabled` etc.
10. `apps/auth-service/src/strategies/` — three Passport strategies: local, JWT, Google
11. `apps/auth-service/src/guards/rate-limit.guard.ts` — per-endpoint Redis rate limit inside the service (separate from the gateway limit)
12. `apps/auth-service/src/migrations/` — single migration file; read it to understand the DB schema

**Domain events emitted here:** `UserRegistered`, `UserLoggedIn`, `UserSessionBreach`, `UserAllSessionsRevoked`, `UserPasswordChanged`, `UserDisabled`, `UserEnabled`, `UserDeletionScheduled`, `UserDeletionCancelled`, `UserDeleted`, `UserDataExportRequested`, `UserTOTPEnabled`, `UserTOTPDisabled`

**Key thing:** All those events today go only to a logger. Your event bus task is to route them to real consumers (points-service, notification-service).

---

### Block 3: User service — profiles & RBAC (1 h)

1. `docs/user-service.md` — API reference
2. `apps/user-service/src/users/entities/user.entity.ts` — the main user row (display name, bio, interests, sponsor affiliation, custom tags, logo URL)
3. `apps/user-service/src/users/users.service.ts` — notice `HttpService` calls to sponsor-service for affiliation data (this is the inter-service HTTP pattern)
4. `apps/user-service/src/users/users.controller.ts` — public profile, own profile PATCH, player card, friend suggestions, event history, sponsor stats
5. `apps/user-service/src/rbac/roles.guard.ts` — JWT claim-based RBAC; the same pattern repeated in every service
6. `apps/user-service/src/migrations/` — 4 migration files; read them in timestamp order to see how the schema evolved

**Key thing:** The user row in user-service is separate from `user-credential` in auth-service. They share a `userId` UUID but live in different tables (same Postgres DB, different logical domains).

---

### Block 4: Sponsor + Event services — the business core (1.5 h)

These two services together represent the main product loop: users pick sponsors → attend events → earn fans/points.

**Sponsor service:**
1. `docs/sponsor-service.md`
2. `apps/sponsor-service/src/sponsors/entities/sponsor.entity.ts`
3. `apps/sponsor-service/src/sponsors/entities/user-sponsor-affiliation.entity.ts` — one row per (user, sponsor, semester)
4. `apps/sponsor-service/src/sponsors/sponsors.service.ts` — focus on `awardFans` (emits `FanEarned`) and `endAffiliation` (emits `SponsorTenureEnded`)
5. `apps/sponsor-service/src/sponsors/events/fan-earned.event.ts` — domain event shape

**Event service:**
1. `docs/event-service.md`
2. `apps/event-service/src/events/entities/event.entity.ts` — event types, status enum, capacity
3. `apps/event-service/src/events/entities/registration.entity.ts`
4. `apps/event-service/src/events/entities/event-score.entity.ts`
5. `apps/event-service/src/events/events.service.ts` — `registerUser` emits `RegistrationCreated`; `completeEvent` emits `EventCompleted`
6. `apps/event-service/src/events/domain-events/` — two interfaces: `RegistrationCreatedEvent`, `EventCompletedEvent`
7. `apps/event-service/src/hall-of-fame/hall-of-fame.service.ts` — calls sponsor-service via HTTP to enrich winner data

**Domain events emitted here:** `FanEarned`, `SponsorTenureEnded`, `RegistrationCreated`, `EventCompleted`

---

### Block 5: Points + Notification + Announcement services (1 h)

**Points service:**
1. `docs/points-service.md`
2. `apps/points-service/src/points/entities/point-transaction.entity.ts`
3. `apps/points-service/src/points/points.service.ts` — `awardPoints` emits `PointsEarned`
4. `apps/points-service/src/points/enums/points-source.enum.ts` — all the sources that award points

**Notification service:**
1. `apps/notification-service/src/notifications/notifications.service.ts` — create/list/mark-read/delete
2. `apps/notification-service/src/notifications/entities/notification.entity.ts`
3. Note: POST /notifications is blocked at the gateway edge (internal-only). Services call it directly on the Docker network.

**Announcement service:**
1. `apps/announcement-service/src/announcements/announcements.service.ts`
2. `apps/announcement-service/src/announcements/entities/announcement.entity.ts`
3. GET /announcements is public; POST/DELETE require admin role.

---

### Block 6: Event Bus — your first task (1.5 h)

This is what you need to build. Read all of this before writing a line.

**Current state (stubs — logs only, no consumers):**
- `apps/auth-service/src/services/event-bus.service.ts`
- `apps/event-service/src/events/event-bus.service.ts`
- `apps/points-service/src/points/event-bus.service.ts`
- `apps/sponsor-service/src/sponsors/event-bus.service.ts`

**All four are identical in structure:** `emit<T>(eventType, payload)` → logs the event envelope. No subscribers. No delivery.

**Domain events that need real consumers:**

| Event | Emitted by | Should trigger |
|-------|-----------|----------------|
| `RegistrationCreated` | event-service | points-service awards registration points; notification-service notifies user |
| `EventCompleted` | event-service | points-service awards placement points; notification-service notifies winners |
| `FanEarned` | sponsor-service | points-service awards fan-watching points |
| `PointsEarned` | points-service | notification-service notifies user |
| `UserRegistered` | auth-service | user-service creates the profile row |
| `UserDeleted` | auth-service | user-service removes the profile row |

**What to build:** An in-memory EventEmitter-based bus (Node `EventEmitter` or NestJS `EventEmitter2`) that lets services subscribe to typed events. Because services are isolated processes, the real solution is HTTP callbacks or a message broker. For now the spec says in-memory — so the bus lives inside each service and can only fan-out to subscribers within the same process. Cross-service delivery still happens via direct HTTP.

**How to build it (recommended approach):**
1. Replace the log-only `EventBusService` with one that wraps Node's `EventEmitter`
2. Add a `subscribe<T>(eventType: string, handler: (payload: T) => void)` method
3. Wire subscribers in each service's module `onModuleInit`
4. For cross-service events (e.g. `RegistrationCreated` in event-service → points-service), keep using direct HTTP POST for now and document the TODO for a real broker (Redis pub/sub or RabbitMQ)

**Read these tests before touching the services** — they spec the expected behavior and you must not break them:
- `apps/event-service/test/events.service.spec.ts`
- `apps/points-service/test/points.service.spec.ts`
- `apps/sponsor-service/test/sponsors.service.spec.ts`
- `apps/auth-service/test/auth.service.spec.ts`

---

### Block 7: Tests, CI/CD, and dev tooling (30 min)

1. `backend/package.json` scripts — know `start:dev`, `start:<service>:dev`, `test`, `test:e2e`, `seed`
2. `backend/nest-cli.json` — monorepo config, project roots
3. `.github/` — CI pipeline (check what runs on PR)
4. Skim one e2e spec (`apps/auth-service/test/app.e2e-spec.ts`) to understand the test setup pattern
5. `docs/manual-testing-gateway.md` — how to smoke-test locally without Postman

---

## Day 2 — Frontend + integration (8 h)

### Block 8: Design system and shared patterns (30 min)

1. `design-system.md` — typography, color tokens, spacing scale. Know this before touching any UI.
2. `variables.md` — product-level constants (semester limits, fan amounts, etc.)
3. `screens.md` — high-level screen inventory
4. `screens/` directory — each screen has a `.md` spec. Skim all 12.

---

### Block 9: Web admin (React + Vite) (2 h)

1. `docs/web.md` — purpose and current state of the admin panel
2. `web/src/main.tsx` + `web/src/app/router.tsx` — entry point and route tree
3. `web/src/core/api/ApiClient.ts` — base HTTP client (Axios wrapper, token injection, 401 handling)
4. `web/src/core/repositories/AuthRepository.ts` — login, logout calls
5. `web/src/core/repositories/EventRepository.ts` — CRUD calls
6. `web/src/core/repositories/UserRepository.ts` — user management calls
7. `web/src/core/stores/authStore.ts` — Zustand store for auth state
8. `web/src/core/viewmodel/BaseViewModel.ts` + `useViewModel.ts` — the MVVM pattern; understand it before writing any page
9. `web/src/pages/Login.tsx` — simplest full-stack flow example
10. `web/src/pages/Events.tsx` — table + repository + ViewModel wired together
11. `web/src/components/RequireAuth.tsx` — route guard

**Key patterns to know:** Repository pattern (API calls) → ViewModel (state + side effects) → React component (render only). No API calls inside components.

---

### Block 10: Mobile (React Native + Expo) (3 h)

1. `docs/mobile.md` — architecture overview and dev setup
2. `mobile/src/app/_layout.tsx` — root layout, auth gate, font loading
3. `mobile/src/app/(drawer)/_layout.tsx` — drawer navigation setup
4. `mobile/src/core/api/ApiClient.ts` — same pattern as web but uses `SecureStore` for tokens
5. `mobile/src/core/stores/authStore.ts` — auth state, token refresh logic
6. `mobile/src/core/repositories/` — one file per service domain (Auth, User, Event, Points, Announcement, HallOfFame)
7. `mobile/src/app/login.tsx` + `mobile/src/app/register.tsx` — auth screens
8. `mobile/src/app/(drawer)/index.tsx` — home screen (announcements + feed)
9. `mobile/src/app/(drawer)/events.tsx` — event list + registration
10. `mobile/src/app/(drawer)/points.tsx` — balance + transaction history
11. `mobile/src/app/(drawer)/sponsors.tsx` — sponsor selection flow
12. `mobile/src/app/(drawer)/profile.tsx` — own profile edit
13. `mobile/src/components/profile/PlayerCard.tsx` — shareable player card component
14. `mobile/src/app/event/[id].tsx` — event detail + register button
15. `mobile/src/components/home/` — all home tab sub-components (announcements, feed, intro)

**Key Expo Router patterns:** File-based routing, `(drawer)` group = drawer-protected routes, `auth/` group = unauthenticated screens.

---

### Block 11: Schemas, migrations, and DB understanding (1 h)

Walk through every migration file in timestamp order across all services. This gives you the full DB schema without needing a visual tool.

```
apps/auth-service/src/migrations/1718520000000-AddTotpAndAccountLifecycleAndAuditLog.ts
apps/user-service/src/migrations/1750000000000-AddUserProfileColumns.ts
apps/sponsor-service/src/migrations/1762000000000-CreateSponsorsAndAffiliations.ts
apps/sponsor-service/src/migrations/1762000001000-AddAffiliationUniqueness.ts  (wait — wrong order)
apps/user-service/src/migrations/1762000001000-AddLastSponsorChange.ts
apps/sponsor-service/src/migrations/1763000000000-AddAffiliationUniqueness.ts
apps/sponsor-service/src/migrations/1763000001000-RemoveAffiliationUserForeignKey.ts
apps/event-service/src/migrations/1764000000000-CreateEvents.ts
apps/points-service/src/migrations/1765000000000-CreatePointTransactions.ts
apps/user-service/src/migrations/1769000000000-AddBioColumn.ts
apps/user-service/src/migrations/1770000000000-AddDisplayNameCustomTagsLogoUrl.ts
apps/notification-service/src/migrations/1771000000000-CreateNotifications.ts
apps/announcement-service/src/migrations/1772000000000-CreateAnnouncements.ts
```

Note: all services share a single Postgres database (`bgsc_dev`) but use separate table namespaces. Cross-service FK references are avoided by design (the `RemoveAffiliationUserForeignKey` migration is evidence of a deliberate decoupling).

---

### Block 12: Remaining pending work (30 min)

Read `README.md` Phase 0 "Work Left" section and Phase 1 "Tasks Left" section. These are your future tasks after the event bus:

- PostgreSQL schema migrations for remaining tables
- Redis cache layer (sessions already use Redis; event list TTL caching is not wired yet)
- Frontend screens listed as pending in `screens/`

Also read `BGSC Platform — Complete Feature Specification & Architecture.md` end-to-end (it is 91k characters — budget ~1 hour for it on Day 2 evening). This is the authoritative spec for everything you will build in Phase 1 and beyond.

---

## Time budget summary

| Block | Topic | Time |
|-------|-------|------|
| Quick orientation | README + spec docs | 15 min |
| 1 | Gateway + infrastructure | 1.5 h |
| 2 | Auth service | 1.5 h |
| 3 | User service | 1 h |
| 4 | Sponsor + Event services | 1.5 h |
| 5 | Points + Notification + Announcement | 1 h |
| 6 | Event bus (read + implement) | 1.5 h |
| 7 | Tests + CI + tooling | 30 min |
| **Day 1 total** | | **~8.75 h** |
| 8 | Design system + screen specs | 30 min |
| 9 | Web admin (React) | 2 h |
| 10 | Mobile (React Native + Expo) | 3 h |
| 11 | Migrations + DB schema | 1 h |
| 12 | Remaining pending work + full spec doc | 1.5 h |
| **Day 2 total** | | **~8 h** |

---

## How to run everything locally

```bash
# Start all infrastructure + services
docker compose up

# Run a single service in watch mode (outside Docker, for dev)
cd backend
npm run start:auth-service:dev
npm run start:user-service:dev
# etc.

# Seed the database
npm run seed

# Run unit tests
npm test

# Run e2e tests for a specific service
npm run test:e2e              # auth-service
npm run test:e2e:sponsor      # sponsor-service
npm run test:e2e:event        # event-service
npm run test:e2e:points       # points-service
```

**Swagger docs:** When running locally with the override file, each service exposes Swagger at its own port:
- Auth: http://localhost:3001/auth/docs
- User: http://localhost:3002/docs
- Sponsor: http://localhost:3003/docs
- Events: http://localhost:3004/docs
- Points: http://localhost:3005/docs

Read `docs/manual-testing-gateway.md` for step-by-step curl commands against the gateway.

---

## Key architectural decisions to internalize

1. **No path rewriting at the gateway.** Services expose the same URL prefixes the gateway routes. `/events/123` at the gateway becomes `/events/123` at event-service.

2. **JWT verified twice.** At the gateway edge (for protected routes) and again inside each service. Downstream services never trust a request without re-verifying the token.

3. **Event bus is currently fire-and-log only.** All four `EventBusService` stubs emit a log line and nothing else. No subscribers exist anywhere. Cross-service coordination today happens via direct HTTP (`HttpService`). Your task is to change this.

4. **Single database, multiple schemas.** All services share `bgsc_dev` on Postgres but treat their tables as owned domains. No cross-service FK constraints (see the migration that removed the affiliation FK).

5. **RBAC is per-service.** Each service has its own `roles.guard.ts` and `roles.decorator.ts`. The `UserRole` enum is duplicated across services intentionally to keep them independently deployable.

6. **POST /notifications is gateway-blocked.** Only services on the internal Docker network can create notifications. The gateway returns 403 on any external POST to `/notifications`.

7. **Mobile uses Expo Router (file-based routing).** `(drawer)` is a route group, not a folder. `_layout.tsx` at each level controls the navigator. Screen components never make direct API calls — everything goes through a Repository.
