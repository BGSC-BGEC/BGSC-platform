# Architecture Review — Meeting Agenda

**Status:** Pre-approval. Nothing is built until the decisions in §4 and §5 are made.
**Prepared:** 2026-09-05
**Duration:** 60 minutes
**Attendees:** Development team, Coordinators, Founder

---

## 0. Purpose

The current codebase was built against superseded specifications and undocumented decisions by team members no longer on the project. It is not the reference for this build.

The reference going forward is:

- `docs/SystemDesignDocs/BGSC Platform — Complete Feature Specification & Architecture.md` — the endpoint vision (2563 lines)
- `docs/MVP_Timeline_Plan.md` — the delivery plan (793 lines)
- The operational docs in `docs/` root — gateway, API, dev setup, deploy

This meeting validates the architecture in those documents **before** implementation begins. The cost of getting this wrong is a second rebuild.

**Output of this meeting:** signed-off answers to §7. Only then do the implementation documents get written.

---

## 1. What Is Already Decided

These are settled. They appear here so the meeting does not relitigate them, and so their real cost is on the record.

| Decision | Source | Rationale |
|---|---|---|
| Apache Kafka as event bus | Leadership | KRaft mode removed the Zookeeper dependency; demonstrates platform maturity to the department |
| WebSockets for real-time | Requirement | Auction bidding, live leaderboards, live scores |
| Media gallery | Requirement | Identified as the platform's primary differentiator |
| Gateway-first topology | `docs/api-gateway.md:12-27` | Single public entry point; already implemented and tested |
| NestJS microservices | `docs/ONBOARDING.md:116-141` | Already the shape of the codebase |
| MVVM on both clients | `docs/SystemDesignDocs/…Architecture.md:134-163` | Enforced in `docs/Frontend/UI-UX-Master-Doc.md` golden rule 7 |
| JWT access + rotating refresh | `docs/SystemDesignDocs/…Architecture.md:1858-1866` | 15 min access, 7 day refresh, rotation on use |

§3 specifies what the three non-negotiable items actually require in files, configuration, and hours. That is the part the meeting needs to absorb — not whether to do them, but what they cost.

---

## 2. Documented Inconsistencies

These contradictions exist in the current documentation set. Each needs a ruling; several are load-bearing.

### 2.1 Sponsor system — in MVP or not

| Document | Position |
|---|---|
| `docs/SystemDesignDocs/…Architecture.md:2303` | "Sponsor System v1 … **P0**" for MVP |
| `docs/MVP_Timeline_Plan.md:57` | "❌ EXCLUDED from MVP: Sponsors & Newsletter" |
| `docs/api-reference.md:78-91` | Nine `/sponsors` endpoints documented as live |
| `docs/frontend-api-wiring.md:83-89` | `SponsorRepository` — partially live, partially mock |
| `backend/apps/sponsor-service/` | Service exists, wired into `docker-compose.yml:167` |

The service is built and running. The MVP plan says it is out of scope. Both cannot be true.

**Ruling needed:** ship the simplified version (select sponsor, count fans on event win, leaderboard) or freeze the service and hide the UI.

### 2.2 Database technology — Postgres or NoSQL

| Document | Position |
|---|---|
| `docs/MVP_Timeline_Plan.md:64-68` | "Relational → Non-Relational (NoSQL)… Must complete early (Week 1-2)" |
| `docs/MVP_Timeline_Plan.md:87-92` | "Finalize database choice (MongoDB/Firestore/DynamoDB)" |
| `docs/ONBOARDING.md:143-145` | "All services share a single PostgreSQL database (`bgsc_dev`)" |
| `docs/local-dev-guide.md:41-51` | Nine separate PostgreSQL databases |
| `backend/apps/*/entities/` | TypeORM entities against PostgreSQL throughout |

Three different answers. Week 1-2 of the plan has already elapsed — today is 2026-09-05, the plan started 2026-08-24 (`docs/MVP_Timeline_Plan.md:3`).

**Ruling needed:** confirm PostgreSQL and strike the NoSQL migration from the plan, or commit to it and reset the timeline. See §5.2 for the recommended shape.

### 2.3 Phase numbering — three competing schemes

| Scheme | Source | Span |
|---|---|---|
| Phase 0 → Phase 5 | `docs/SystemDesignDocs/…Architecture.md:2259-2521` | 32 weeks |
| Phase 1 → Phase 5 | `docs/MVP_Timeline_Plan.md:78-631` | 5 weeks |
| Milestone 0.4, 1.2, 1.6, 1.7 | `docs/web.md:3`, `docs/mobile.md:4` | undefined anywhere |

"Phase 2" means Weeks 11-16 in one document and Week 2 in another. Milestone numbers are used in the frontend docs but defined in none.

**Ruling needed:** one scheme, applied everywhere. Recommend MVP Weeks 1-5, then Phase 2 / Phase 3 for post-launch.

### 2.4 Event bus — architecture versus reality

The specification devotes §8 (`docs/SystemDesignDocs/…Architecture.md:1577-1694`) to an event-driven architecture with a full domain event catalogue and a consumer matrix.

The implementation is four stub files that log and discard:

```
backend/apps/auth-service/src/services/event-bus.service.ts
backend/apps/event-service/src/events/event-bus.service.ts
backend/apps/points-service/src/points/event-bus.service.ts
backend/apps/sponsor-service/src/sponsors/event-bus.service.ts
```

`docs/ONBOARDING.md:577-579` states this plainly: "Each has an `emit<T>(eventType, payload)` method that logs the event and does nothing else. No subscribers. No delivery."

Since Kafka is confirmed (§3.1), this gap closes. It is listed here so the scale of the work is not underestimated — the spec describes 40+ event types across 7 domains, none of which are delivered today.

### 2.5 Broken document cross-references

| Reference | Location | Reality |
|---|---|---|
| `docs/screens.md` | `docs/ONBOARDING.md:648` | Does not exist |
| `docs/FrontendGuide/Screens Master Doc/` | `docs/Frontend/UI-UX-Master-Doc.md:5` | Does not exist; actual path is `docs/Frontend/` |
| `docs/BGSC Platform — Complete Feature Specification & Architecture.md` | `docs/ONBOARDING.md:416`, `:443`, `:749` | Lives in `docs/SystemDesignDocs/`, not `docs/` root |
| `docs/Future Feature Ideas.md` | — | Single line of content; effectively empty |
| Stray `x` before first heading | `docs/ONBOARDING.md:1` | Typo |

Low severity, five-minute fixes, but a new developer following ONBOARDING hits three dead links on day one.

### 2.6 Service inventory drift

| Service | `backend/apps/` | `nest-cli.json` | `docker-compose.yml` | Documented in `api-reference.md` |
|---|---|---|---|---|
| auth | yes | yes | yes | yes |
| user | yes | yes | yes | yes |
| sponsor | yes | yes | yes | yes |
| event | yes | yes | yes | yes |
| points | yes | yes | yes | yes |
| notification | yes | yes | yes | yes |
| announcement | yes | yes | yes | yes |
| social | yes | yes | **no** | yes (26 endpoints) |
| challenge | yes | yes | **no** | yes (11 endpoints) |
| **media** | **no** | **no** | **no** | **no** |

`docs/api-reference.md:150-193` documents 37 endpoints across social and challenge services that are scaffolds only, with no status marker distinguishing them from live endpoints.

Media — the confirmed primary differentiator — does not exist anywhere in the codebase.

---

## 3. Confirmed Requirements — Full Cost

### 3.1 Apache Kafka

**Status:** Confirmed, non-negotiable.

**Specification:** `docs/SystemDesignDocs/…Architecture.md:1577-1694`
**Domain event catalogue:** lines 1579-1668 (7 domains, 40+ event types)
**Consumer matrix:** lines 1670-1682

**Current state:** Not installed. `backend/package.json` contains no Kafka dependency. Four stub services log events into the void.

**Work required**

1. Shared publisher/consumer package — `backend/packages/event-bus/`

```
backend/packages/event-bus/
├── src/
│   ├── kafka-client.service.ts       # connection, retry, health
│   ├── event-publisher.service.ts    # emit<T>() with envelope + versioning
│   ├── event-consumer.service.ts     # @EventHandler decorator, consumer groups
│   ├── event-schema.registry.ts      # payload validation per event type
│   └── index.ts
├── package.json                       # @bgsc/event-bus
└── tsconfig.json
```

2. Enable npm workspaces — `backend/package.json` has **no** `workspaces` key today. Add:

```json
"workspaces": ["packages/*", "apps/*"]
```

3. Replace the four stub files listed in §2.4 with imports from `@bgsc/event-bus`.

4. Environment — add to `backend/.env` and extend `docs/variables.md` (currently auth-service only, 88 lines):

```
KAFKA_BROKERS=
KAFKA_CLIENT_ID=bgsc-platform
KAFKA_GROUP_ID_PREFIX=bgsc
```

5. Topics — five, three partitions each, 7-day retention for MVP:

| Topic | Events | Consumers |
|---|---|---|
| `user.events` | UserRegistered, UserProfileUpdated, UserDisabled, UserDeleted | user-service, notification-service |
| `event.events` | EventCreated, RegistrationCreated, EventCompleted | points-service, notification-service, sponsor-service |
| `points.events` | PointsEarned, PointsSpent, PointsRefunded | notification-service, user-service |
| `media.events` | MediaUploaded, MediaApproved, MediaDeleted | notification-service, event-service |
| `sponsor.events` | FanEarned, SponsorTenureEnded | points-service, notification-service |

6. Event envelope — version every payload from day one, or the first schema change breaks every consumer:

```json
{
  "eventType": "UserRegistered",
  "version": "v1",
  "timestamp": "2026-09-05T10:30:00Z",
  "payload": { "userId": "…", "email": "…", "username": "…" }
}
```

**Effort:** 16 hours
**Cost:** managed service — Confluent Cloud Basic ~$50/mo, AWS MSK Serverless ~$30/mo, Upstash free tier for development
**Recommendation:** managed only. Self-hosting Kafka with a 2-person backend team is how the timeline dies.

**Risk:** Kafka is on the critical path for Week 1. If broker setup slips, every downstream service is blocked. Mitigation: services publish to Kafka but also keep the direct HTTP call for the two flows that cannot wait (registration → profile creation, registration → points award). Remove the HTTP fallback once consumers are proven.

---

### 3.2 WebSockets

**Status:** Confirmed, non-negotiable.

**Specification:** `docs/SystemDesignDocs/…Architecture.md:2180-2212` (client synchronisation), `:1255-1258` (auction, "under 100ms")

**Current state:** Not installed. No `socket.io` dependency in `backend/package.json`. `docs/api-gateway.md` describes an HTTP-only gateway.

**Work required**

1. Dependencies:

```json
"@nestjs/websockets", "@nestjs/platform-socket.io", "socket.io", "@socket.io/redis-adapter"
```

2. Gateway module — `backend/src/gateway/websocket/`

```
websocket.module.ts        # module wiring
auction.gateway.ts         # /auction namespace, room per auction
leaderboard.gateway.ts     # /leaderboard namespace, room per event
websocket.guard.ts         # JWT verification on handshake
redis-adapter.config.ts    # cross-instance pub/sub
```

3. `backend/src/main.ts` — attach the Socket.io adapter. The gateway is currently created with `bodyParser: false` (`docs/api-gateway.md:140`); the WebSocket server must be attached without disturbing that, or proxied POST bodies corrupt.

4. Redis — reuse the existing instance. Rate-limit counters live under `gateway:rate:*` (`docs/api-gateway.md:189-192`) and auth sessions under `auth:*` (`docs/variables.md:45-56`). Namespace the adapter separately to avoid collision.

5. Client transport — `mobile/src/core/websocket/` and `web/src/core/websocket/`. Both `core/` directories are already intentionally duplicated (`docs/mobile.md:75-77`, `docs/web.md:76-78`); keep them in sync.

**Effort:** 12 hours

**Architectural consequence — flag this in the meeting.** WebSocket connections are stateful and pin a client to one gateway instance. The gateway is currently stateless and horizontally scalable. The Redis adapter preserves cross-instance broadcast, so sticky sessions are not required, but the gateway stops being trivially disposable. Load testing at 500 concurrent connections is mandatory before launch, not optional.

---

### 3.3 Media Gallery

**Status:** Confirmed, non-negotiable. Identified as the platform's primary draw.

**Specification:** `docs/SystemDesignDocs/…Architecture.md:1037-1099` (page spec), `:2114-2155` (media types, processing pipeline, retention)
**Screen spec:** `docs/Frontend/media/media-page.md`, `docs/Frontend/media/media-page-design.md`

**Current state:** Nothing exists. No `media-service` in `backend/apps/`, `nest-cli.json`, or `docker-compose.yml`. No `/media` route in the gateway. No endpoints in `docs/api-reference.md`. `docs/frontend-api-wiring.md:93` marks `MediaRepository` as mock, all methods.

This is the largest single gap between the specification and the codebase.

**Work required**

1. New service — `backend/apps/media-service/` on port 3010

```
src/
├── media/
│   ├── entities/media-item.entity.ts
│   ├── dto/{upload,query,update}-media.dto.ts
│   ├── media.service.ts
│   ├── media.controller.ts
│   └── media.module.ts
├── s3/
│   ├── s3.service.ts          # presigned URL generation
│   └── s3.module.ts
└── main.ts
```

2. Register in `backend/nest-cli.json` (currently 9 projects), `docker-compose.yml` (currently 8 services), and gateway routing (`backend/src/gateway/routing.ts`).

3. Upload flow — presigned URLs, never proxy file bytes through the backend:

```
Client → POST /media/upload          → presigned S3 PUT URL (5 min expiry)
Client → PUT  <presigned URL>        → S3 direct, bypasses backend
S3     → webhook                     → media-service creates the row
media-service → MediaUploaded        → Kafka → notification-service (moderation queue)
```

4. Environment — `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `CDN_BASE_URL`. Extend `docs/variables.md`.

5. Frontend — replace the mock at `mobile/src/core/repositories/MediaRepository.ts`; build `mobile/src/app/(drawer)/media.tsx` and a moderation view in `web/src/pages/`.

**MVP scope (Week 3)** — images only, JPEG/PNG, 5 MB cap, simple grid, public/private toggle, event association, EXIF stripped on upload.

**Deferred to Phase 2** — video upload and transcoding, masonry layout, friends-only visibility, download permissions, "Year in Review" compilation.

The specification's §15.2 pipeline (`:2125-2140`) calls for virus scanning, three image sizes, and three video resolutions. That is a Phase 2 pipeline. Week 3 delivers upload, store, serve.

**Effort:** 20 hours building on S3 directly
**Cost:** ~$9/month at MVP scale (50 GB storage, 100 GB CDN transfer)

**Alternative worth raising:** Cloudinary or Uploadcare absorb transcoding, CDN, transformation, and moderation hooks. Reduces the build to ~8 hours. Free tier covers 25 GB storage and 25 GB bandwidth, which exceeds projected first-semester usage (~25 GB). Trade-off is vendor lock-in on the differentiating feature.

**Storage projection:** 1000 users × 10 images/semester × 2 MB = 20 GB, plus ~5 GB video = 25 GB/semester, 50 GB/year. Enforce a per-user quota from day one; without it this line item is unbounded.

---

## 4. Decisions Required — Feature Scope

### 4.1 Live Auction System

**Specification:** `docs/SystemDesignDocs/…Architecture.md:1240-1258` (admin console), `:778-791` (mobile spectator), `:1934-1943` (security), `:1660-1668` (domain events)

**Position:** Required by leadership. Presented here with the numbers so the trade-off is explicit and on the record.

**Usage against effort**

| Feature | Build effort | Annual usage | Ratio |
|---|---|---|---|
| Full live auction | ~80 h | 2 events × 50 users × 2 h = 200 user-hours | 1 : 2.5 |
| Event registration | ~40 h | 50 events × 200 users × 0.5 h = 5000 user-hours | 1 : 125 |

The auction costs twice the effort of event registration to serve 4% of the usage.

**Option A — full specification.** Real-time bidding over WebSockets, purse formula `Pool = K × Σ base prices`, the 3/7ths OC override matrix, server-authoritative countdown, bid finality.

Requires: `backend/apps/event-service/src/auction/` with `auction`, `bid`, and `captain-purse` entities; the auction WebSocket gateway from §3.2; admin console in `web/src/pages/`; spectator and captain views in `mobile/src/app/auction/`.

The hard part is not the UI. It is concurrency: `docs/SystemDesignDocs/…Architecture.md:1942` requires "atomic database operations with optimistic locking to prevent race conditions." Fifty captains bidding against a 5-second timer is the single highest-risk piece of logic in the platform, and it runs live in front of the whole campus twice a year. It needs a `version` column, atomic conditional updates, and load testing at 50 concurrent bidders.

**Effort:** 80 hours.

**Option B — deferred bidding.** Captains submit bids over plain HTTP; admin closes each round manually; flat budget per captain; no override matrix. Same outcome, no race conditions, no WebSocket dependency.

**Effort:** 24 hours.

**Option C — manual assignment.** Admin assigns captains before the season; players register to teams through the existing team registration flow. No new code.

**Effort:** 0 hours.

**Recommendation:** Option C for the September MVP, Option B in Phase 2, Option A only if the live experience is judged essential after one season of real use. If Option A is mandated for MVP, something of equivalent size must leave the plan — that trade is the decision, not the auction itself.

---

### 4.2 Challenge System

**Specification:** `docs/SystemDesignDocs/…Architecture.md:837-862`
**API:** `docs/api-reference.md:180-193` — 11 endpoints documented
**Current state:** `backend/apps/challenge-service/` is a scaffold. Absent from `docker-compose.yml`. `docs/frontend-api-wiring.md:91` — repository fully mocked.

**Breakdown**

| Component | Effort |
|---|---|
| Challenge CRUD (admin) | 2 days |
| Browse and filter (user) | 1 day |
| Proof submission (file upload) | 3 days |
| Moderation queue and review | 3 days |
| Automated points award | 1 day |
| **Total** | **10 days (~80 h)** |

**Dependency:** proof submission is media upload. This cannot start until §3.3 is stable, which lands Week 3 at the earliest. That leaves no room in a 5-week plan.

It also creates permanent operational load — every submission needs a human reviewer, indefinitely.

**MVP alternative — zero code.** Coordinators award achievement points through the existing points dashboard: select user, enter amount, set source to `Challenge: <name>`. `POST /points/award` already exists (`docs/api-reference.md:123`). Roughly two minutes per award, and it handles any achievement type rather than only pre-configured ones.

**Recommendation:** defer to Phase 3, after the media pipeline has a semester of real use behind it. Use manual awards for MVP.

---

### 4.3 Union Page

**Specification:** `docs/SystemDesignDocs/…Architecture.md:1140-1194`
**Document status:** the specification's own header (line 2) states the feature has been removed and all references should be ignored during implementation — yet ~55 lines of specification remain in the body, and `docs/SystemDesignDocs/…Architecture.md:2429` still lists it as Phase 3 scope.

Noted as "changing later." Recorded here so it is not silently built from the stale sections.

**Scope if it returns:** Kanban and Gantt views, task hierarchy with pathway tracking, crew allocation heatmaps, auto-generated per-task group chats, two-way Google Calendar sync with BITS timetable import. That is a project-management product, roughly 6 weeks, serving internal staff only.

**Recommendation:** keep it out of MVP. Use Trello or Notion for internal coordination. Revisit in Phase 3 with a decision on whether to build or continue buying. When the decision is made, strike the stale sections from the specification so no one implements from them by accident.

---

### 4.4 MongoDB and Elasticsearch

**Specification:** `docs/SystemDesignDocs/…Architecture.md:96-100` (data layer diagram), `:238` (Elasticsearch for search), `:2018-2027` (global search)

**Position for the meeting: drop both from MVP.**

**MongoDB — proposed for logs.** PostgreSQL handles this, or structured JSON to stdout shipped to the platform's log aggregator. A second database engine for log storage adds a backup target, a connection pool, and an operational skill requirement, in exchange for nothing PostgreSQL cannot do at this scale.

**Elasticsearch — proposed for search.** PostgreSQL full-text search covers the requirement at campus scale:

```sql
CREATE INDEX events_search_idx
  ON events.events
  USING GIN (to_tsvector('english', title || ' ' || description));
```

| | Elasticsearch | PostgreSQL FTS |
|---|---|---|
| Fuzzy matching | excellent | good (`pg_trgm` for typo tolerance) |
| Query latency at 5K users | <50 ms | <100 ms |
| Operational cost | cluster to run and tune | already running |
| Index sync | needs a consumer per entity | none |

Elasticsearch also needs an indexing consumer per searchable entity — `docs/SystemDesignDocs/…Architecture.md:1678` lists five. That is five more Kafka consumers to build and keep correct in Week 1.

**Recommendation:** PostgreSQL full-text for MVP. Revisit when search quality becomes a user complaint backed by evidence, not before. This keeps the data layer at PostgreSQL + Redis + Kafka, which the team can actually operate.

---

## 5. Decisions Required — Technical

### 5.1 Shared RBAC Package

**The problem, measured.** Nineteen duplicated files across nine services:

```
apps/announcement-service/src/rbac/roles.guard.ts
apps/announcement-service/src/rbac/user-role.enum.ts
apps/auth-service/src/guards/roles.guard.ts
apps/challenge-service/src/rbac/roles.guard.ts
apps/challenge-service/src/rbac/user-role.enum.ts
apps/event-service/src/events/enums/user-role.enum.ts
apps/event-service/src/rbac/roles.guard.ts
apps/points-service/src/points/enums/user-role.enum.ts
apps/points-service/src/rbac/roles.guard.ts
apps/social-service/src/rbac/roles.guard.ts
apps/social-service/src/rbac/user-role.enum.ts
apps/sponsor-service/src/rbac/roles.guard.ts
apps/sponsor-service/src/sponsors/enums/user-role.enum.ts
apps/user-service/src/rbac/roles.guard.ts
apps/user-service/src/users/enums/user-role.enum.ts
```

Note the inconsistent placement — `src/rbac/`, `src/guards/`, `src/<domain>/enums/`. Three conventions for the same concept.

`docs/ONBOARDING.md:242` frames this as deliberate: "duplicated across services intentionally so each can be deployed independently."

That reasoning does not hold. A shared npm workspace package is compiled into each service's build output. Independent deployability is preserved. What is actually being traded away is correctness: a role added to the hierarchy today requires eight correct edits, and the failure mode of missing one is a silent authorization gap.

**Proposal**

```
backend/packages/rbac/
├── src/
│   ├── roles.enum.ts           # UserRole — single definition
│   ├── permissions.ts          # hierarchy weights
│   ├── has-permission.util.ts  # comparison logic
│   ├── roles.guard.ts          # NestJS guard
│   ├── roles.decorator.ts      # @Roles(...)
│   └── index.ts
├── package.json                # @bgsc/rbac
└── tsconfig.json
```

Hierarchy per `docs/SystemDesignDocs/…Architecture.md:1548-1555` and `docs/api-reference.md:209`:

```
guest < user < member < core < coordinator < founder
```

```typescript
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  MEMBER = 'member',
  CORE = 'core',
  COORDINATOR = 'coordinator',
  FOUNDER = 'founder',
}

const weight: Record<UserRole, number> = {
  [UserRole.GUEST]: 0,
  [UserRole.USER]: 1,
  [UserRole.MEMBER]: 2,
  [UserRole.CORE]: 3,
  [UserRole.COORDINATOR]: 4,
  [UserRole.FOUNDER]: 5,
};

export const hasPermission = (actual: UserRole, required: UserRole): boolean =>
  weight[actual] >= weight[required];
```

Call sites change from a local import to `import { RolesGuard, Roles, UserRole } from '@bgsc/rbac'`.

**Prerequisite:** `backend/package.json` has no `workspaces` key. Add it — the same change §3.1 needs for `@bgsc/event-bus`. Build packages before apps.

**Migration:** extract from `apps/user-service/src/rbac/` (the most complete implementation), point all nine services at the package, delete the nineteen files, update tests.

**Effort:** 4 hours.

**Defence in depth is unchanged.** The gateway verifies token validity but explicitly not roles (`docs/api-gateway.md:174`). Downstream services keep verifying the JWT independently (`docs/api-gateway.md:172`) and now enforce roles through shared code rather than eight divergent copies. Both layers remain; only the duplication goes.

**Recommendation:** approve. Four hours in Week 1 against a permanent correctness risk.

---

### 5.2 Database Topology

**Current documented state:** contradictory. `docs/local-dev-guide.md:41-51` creates nine databases; `docs/ONBOARDING.md:143` describes one shared database; `docs/MVP_Timeline_Plan.md:64` calls for NoSQL.

**Proposal: one PostgreSQL instance, one schema per service.**

```
bgsc_platform
├── auth           users, sessions, login_audit_log
├── users          profiles, interests, player_cards
├── events         events, registrations, leaderboards, scores
├── sponsors       sponsors, affiliations, fan_counts
├── points         transactions
├── notifications  notifications
├── announcements  announcements
├── media          media_items
└── social         posts, comments, friendships        [Phase 2]
```

| | Nine databases | One database, nine schemas |
|---|---|---|
| Logical isolation | complete | strong — schema boundary, enforced by grants |
| Connection pools | nine | one |
| Backup | nine dumps, nine restores | one |
| Local setup | nine `CREATE DATABASE`, nine migration histories | one |
| Cross-service FK | impossible | impossible (by grant) |
| Later split | n/a | change `DATABASE_URL` and `schema`; no code change |

Isolation is enforced at the grant level, not by convention:

```sql
CREATE USER auth_service WITH PASSWORD '…';
GRANT USAGE ON SCHEMA auth TO auth_service;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO auth_service;
REVOKE ALL ON SCHEMA users, events, points FROM auth_service;
```

TypeORM needs one addition per entity — `@Entity('users', { schema: 'auth' })` — and `schema` in each service's datasource config.

The existing decision to avoid cross-service foreign keys stays. `docs/ONBOARDING.md:625` records the deliberate `RemoveAffiliationUserForeignKey` migration; that principle is correct and is preserved by schema grants.

**Split to separate databases when** one service's IOPS profile diverges sharply, or compliance requires physical separation. Neither applies at campus scale. The migration path stays open at zero cost.

**Recommendation:** single instance, schema per service. Strike the NoSQL migration from `docs/MVP_Timeline_Plan.md`.

---

### 5.3 Synchronous versus Asynchronous Communication

With Kafka confirmed, the boundary needs to be explicit or every service ends up doing both inconsistently.

| Situation | Mechanism | Reason |
|---|---|---|
| Caller needs the result to respond | HTTP | Kafka gives no return value |
| Caller needs confirmation of completion | HTTP with retry | explicit error handling |
| Downstream reaction, eventual consistency acceptable | Kafka | decoupled, survives consumer downtime |
| Fan-out to several consumers | Kafka | one publish, N reactions |
| Real-time push to a connected client | WebSocket | see §3.2 |

Concretely — registration → profile creation is Kafka; event card needing a display name is HTTP; points awarded on registration is Kafka; a bid needing immediate accept/reject is HTTP, with the resulting broadcast over WebSocket.

The existing HTTP pattern stays where it belongs. `docs/ONBOARDING.md:507` and `:538` document `HttpService` calls between user-service and sponsor-service, and event-service to sponsor-service. Those are correct as synchronous calls and should not be converted.

**Recommendation:** adopt the table as written; record it in the implementation document.

---

### 5.4 Timeline Reality Check

`docs/MVP_Timeline_Plan.md:2-4` sets: start 2026-08-24, deadline 2026-09-28, ten weekend days at 8 hours = 80 hours per person.

Today is 2026-09-05. Weeks 1 and 2 of the plan are gone. The plan's Week 1 called for the NoSQL migration, which §2.2 shows never happened and §5.2 recommends abandoning.

Against 80 hours per person, the confirmed work in §3 alone is 48 hours of backend time (Kafka 16, WebSockets 12, media 20), before any feature work, and before the 4 hours in §5.1.

**Recommendation:** re-baseline the schedule at the meeting against the actual remaining weekends, with §4.1 and §4.2 resolved. A plan whose first two weeks are already spent on work that did not happen cannot be the plan of record.

**Decision gates worth setting now:**

- End of Week 2 — if Kafka consumers are not delivering, auction drops to Option C without further discussion.
- End of Week 3 — if media upload is not working end to end, challenge system is confirmed out for the year.
- End of Week 4 — feature freeze; remaining time is integration and bug fixing only.

---

## 6. Cost

**MVP, managed services**

| Item | Monthly |
|---|---|
| Kafka (MSK Serverless / Confluent Basic) | $30 – $50 |
| PostgreSQL (2 GB managed) | $15 – $20 |
| Redis (512 MB managed) | $10 – $13 |
| Backend compute | $40 – $50 |
| S3 storage (50 GB) | $1 |
| CDN (100 GB transfer) | $8 |
| Domain and TLS | $2 |
| **Total** | **~$110 – $145** |

Free-tier development configuration (Upstash Kafka and Redis, Supabase Postgres, Cloudflare R2, Railway Hobby) lands near $5/month with limits suitable only for development.

`docs/vps-deploy.md` documents a full manual Azure VM deployment as an alternative — single `Standard_B2s` instance running everything behind nginx with Let's Encrypt. That trades roughly $30/month for self-managed Postgres, Redis, and, if chosen, Kafka. Not recommended for Kafka.

**Projection at 1000 active users:** ~$360/month.

---

## 7. Decisions Required

Every item below blocks implementation.

| # | Decision | Recommendation | §  |
|---|---|---|---|
| 1 | Auction — full, deferred bidding, or manual | Manual for MVP; Option B in Phase 2 | 4.1 |
| 2 | Challenge system — build now or defer | Defer to Phase 3; manual point awards for MVP | 4.2 |
| 3 | Sponsor system — in MVP or frozen | Simplified version in; resolve the contradiction | 2.1 |
| 4 | MongoDB and Elasticsearch | Drop both; PostgreSQL covers logs and search | 4.4 |
| 5 | Database topology | One instance, schema per service | 5.2 |
| 6 | NoSQL migration | Strike from the plan; confirm PostgreSQL | 2.2 |
| 7 | Shared `@bgsc/rbac` package | Approve; 4 hours in Week 1 | 5.1 |
| 8 | Media — build on S3 or use Cloudinary | Raise the lock-in trade-off explicitly | 3.3 |
| 9 | Infrastructure budget | Approve ~$130/month | 6 |
| 10 | Phase numbering | One scheme across all documents | 2.3 |
| 11 | Timeline re-baseline | Reset against remaining weekends | 5.4 |
| 12 | Union Page | Confirm out; strike stale spec sections | 4.3 |

---

## 8. After the Meeting

Once §7 is answered, these get written. Not before.

| Document | Contents |
|---|---|
| `docs/APPROVED_ARCHITECTURE.md` | The ruling on every item in §7, with rationale |
| `docs/IMPLEMENTATION_PLAN.md` | Week-by-week tasks, named owners, dependencies |
| `docs/DEFERRED_FEATURES.md` | What is out, why, and what it would cost later |
| `docs/CURRENT_STATE.md` | Live / stub / not-built, per service — the answer to §2.6 |
| `docs/RISK_REGISTER.md` | Risks, owners, decision gates from §5.4 |

Documentation fixes to fold in at the same time:

- Add a status column to `docs/api-reference.md` — 37 endpoints across social and challenge are documented as if live (§2.6)
- Repair the broken cross-references in §2.5
- Extend `docs/variables.md` beyond auth-service — it is titled "Auth Microservice Variable Register" but is cited as the platform-wide reference in `docs/ONBOARDING.md:384` and `:647`
- Add a scope banner to `docs/SystemDesignDocs/…Architecture.md` distinguishing the endpoint vision from MVP scope
- Refresh the mock/live markers in `docs/frontend-api-wiring.md`

---

## Appendix — Source Documents

| Document | Lines | Role |
|---|---|---|
| `docs/SystemDesignDocs/BGSC Platform — Complete Feature Specification & Architecture.md` | 2563 | Endpoint vision; source of truth for intent |
| `docs/MVP_Timeline_Plan.md` | 793 | Delivery plan; needs re-baselining |
| `docs/ONBOARDING.md` | 793 | Developer onboarding; accurate on current code |
| `docs/vps-deploy.md` | 587 | Manual Azure deployment |
| `docs/api-gateway.md` | 352 | Gateway implementation reference; high quality |
| `docs/manual-testing-gateway.md` | 245 | Gateway smoke tests |
| `docs/api-reference.md` | 214 | Endpoint catalogue; needs status markers |
| `docs/local-dev-guide.md` | 209 | Local setup; conflicts on database topology |
| `docs/frontend-api-wiring.md` | 144 | Screen-to-endpoint map; markers stale |
| `docs/web.md` | 142 | Web admin reference |
| `docs/mobile.md` | 137 | Mobile app reference |
| `docs/variables.md` | 88 | Auth-service variables only despite platform-wide citation |
| `docs/Future Feature Ideas.md` | 1 | Effectively empty |
| `docs/Frontend/UI-UX-Master-Doc.md` | — | Design system; broken path in header |
| `docs/SystemDesignDocs/strava-integration.md` | — | Marked DRAFT, pre-implementation |
| `docs/Backend Documentation/*.md` | — | Per-service API references (5 files) |
| `docs/Frontend/*/` | — | Per-screen specifications (14 folders) |

Subfolders outside `docs/` root and `docs/SystemDesignDocs/` predate this planning cycle and are referenced, not authoritative.
