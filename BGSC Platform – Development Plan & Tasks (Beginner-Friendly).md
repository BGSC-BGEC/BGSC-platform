> 	**Document Purpose**  
> This document translates the high‑level specification into actionable development phases, tasks, and milestones. It is written for developers of all skill levels – from juniors to leads.  
> **Key Deadline:** Backend MVP must be fully functional by **June 27, 2026**.

# Architecture and Dev timeline Overview:
Here's the **architecture overview** for the BGSC platform, broken down by layer and mapped to the development phase where each component is introduced. I'll keep it plain text but structured.

---

## 1. High‑Level Architecture Layers (Overall)

```
┌─────────────────────────────────────────────────┐
│               CLIENT LAYER (MVVM)               │
│  React Native (iOS/Android) + React Web (PWA)   │
│  - View (Components)                            │
│  - ViewModel (Observable state + commands)      │
│  - Model (Repositories, API clients, local cache)│
└─────────────────────┬───────────────────────────┘
                      │ HTTPS / WebSocket
┌─────────────────────┴───────────────────────────┐
│              API GATEWAY (Kong)                  │
│  JWT auth, rate limiting, request routing       │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│              EVENT BUS (Kafka)                  │
│  (Phase 2+; Phase 1 uses in‑memory emitter)    │
└─────────────────────┬───────────────────────────┘
                      │ Publish / Subscribe
┌─────────────────────┴───────────────────────────┐
│            MICROSERVICES (Domain‑Driven)        │
│  Auth, User, Event, Social, Union, Points,      │
│  Sponsor, Media, Notification, Search, Audit,   │
│  HallOfFame                                      │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│                 CACHE LAYER (Redis)             │
│  Sessions, rate limits, leaderboards, pub/sub   │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│                  DATA LAYER                     │
│  PostgreSQL (primary), MongoDB (logs/media meta)│
│  Elasticsearch (search – Phase 3+), S3 (files)  │
└─────────────────────────────────────────────────┘
```

---

## 2. Microservices – Full List & Responsibilities

| Service | Responsibility | Phase Introduced |
|---------|----------------|------------------|
| **Auth Service** | JWT issuance/refresh, Google OAuth2, logout | Phase 0 |
| **User Service** | CRUD for users, RBAC, profile, interests | Phase 0 |
| **Event Service** | Event CRUD, registration, status (upcoming/ongoing/past), leaderboard (MVP: manual) | Phase 1 (Backend) |
| **Points Service** | Award/spend points, transaction ledger, consume `RegistrationCreated`, `ChallengeCompleted` | Phase 1 (Backend) |
| **Sponsor Service** | Sponsor CRUD, user affiliation, fan counting, sponsor leaderboard, prize tracking | Phase 1 (Backend) |
| **Notification Service** | In‑app, push (FCM), email, WhatsApp – routes events to channels | Phase 1 (Backend) – basic; full in Phase 2 |
| **Social Service** | Friend requests, posts, likes, comments, feed aggregation | Phase 2 |
| **Challenge Service** | Challenge CRUD, accept/submit, completion | Phase 2 |
| **Search Service** | Elasticsearch indexing for users, events, posts | Phase 3 |
| **Union Service** | Tasks, project views (Kanban, Gantt), crew heatmap, calendar sync | Phase 3 |
| **Team Service** | Team creation, join/leave, captain management | Phase 3 |
| **Auction Service** | Live auction engine, bidding, purse management, WebSocket rooms | Phase 3 |
| **Media Service** | Upload, processing (resize, transcode), S3 + CDN, EXIF stripping | Phase 4 (but basic image upload in Phase 2) |
| **Audit Service** | Immutable logs for role changes, deletions, overrides | Phase 3 |
| **HallOfFame Service** | Store winners, sponsor champions, generate shareable cards | Phase 1 (basic) → Phase 3 (full) |
| **Analytics Service** | Aggregates metrics for dashboards (Coordinator/Founder) | Phase 4 |

> **Note:** In **Phase 1** we only implement Auth, User, Event, Points, Sponsor, Notification (in‑app), and a simplified HallOfFame. All others come later.

---

## 3. MVVM on the Client – Structure & Components

Each client (mobile & web) follows the same MVVM pattern:

### Model (Data Layer)
- **Repositories** – abstract API calls (e.g., `EventRepository`, `UserRepository`)
- **Local cache** – React Query / TanStack Query for server state; Zustand for global client state (auth, theme)
- **Client‑side event store** – for optimistic updates & offline support (Phase 2+)

### ViewModel (Presentation Logic)
- Exposes **observable state** (loading, data, error)
- Handles **user actions** (e.g., `registerForEvent()`)
- Calls repositories, updates state, emits commands to Model
- Implemented as custom hooks (React) or classes (React Native) with MobX / Zustand

### View (UI)
- React components that observe ViewModel state
- Re‑render automatically on state changes
- Dispatch actions (e.g., `onPress={() => vm.register()}`)

**Phase 0** builds the base MVVM classes (BaseViewModel, repository pattern, React Query integration).  
**Phase 1** uses them for auth, events, profile.  
**Phase 2** extends to posts, friends, challenges.

---

## 4. Caching Layers – Where & Why

| Cache | Purpose | Technology | Phase |
|-------|---------|------------|-------|
| **Session cache** | Store JWT refresh tokens, user session flags | Redis | Phase 0 |
| **Rate limit counters** | Per‑user/per‑IP request counts with sliding window | Redis | Phase 0 |
| **Event list cache** | Reduce DB load for public event browsing (5 min TTL) | Redis | Phase 1 |
| **Leaderboard cache** | Sorted sets for real‑time leaderboards (event scores, sponsor fans) | Redis | Phase 1 (basic) → Phase 3 (real‑time) |
| **Feed cache** | Pre‑aggregated posts for a user’s home feed (avoid N+1) | Redis | Phase 2 |
| **Online presence** | Track last active timestamp, online/offline status for friends | Redis | Phase 2 |
| **WebSocket pub/sub** | Distribute auction bids, live leaderboard updates across server instances | Redis + Socket.io | Phase 3 |
| **Query cache (React Query)** | Client‑side deduplication & stale‑while‑revalidate | In‑memory (browser) | Phase 0 |

---

## 5. Phase Mapping – Which Component Goes Live When

### Phase 0 (Foundation – Weeks 1‑2)
- **Infra:** Docker, GitHub Actions, staging env, Prometheus/Grafana
- **Backend:** Auth Service, User Service (basic), API Gateway (Express), in‑memory event bus
- **Cache:** Redis for sessions & rate limits
- **Client:** MVVM base classes, navigation shell, theme switching

### Phase 1 Backend (MVP – Weeks 3‑8, deadline June 26)
- **Add:** Event Service, Points Service, Sponsor Service, Notification Service (in‑app only), HallOfFame (basic)
- **Cache:** Event list cache, leaderboard cache (manual updates)
- **No Kafka yet** – in‑memory bus remains.

### Phase 1 Frontend (Weeks 9‑10)
- Mobile + Web consume the above APIs.

### Phase 2 (Community – Weeks 11‑16)
- **Add:** Social Service, Challenge Service
- **Upgrade:** Notification Service with FCM push + email digests
- **Cache:** Feed cache, online presence (Redis)
- **Event Bus:** Replace in‑memory with **Kafka** (event durability + replay)

### Phase 3 (Operations – Weeks 17‑24)
- **Add:** Union Service, Team Service, Auction Service, Audit Service, Search Service (Elasticsearch)
- **Cache:** WebSocket pub/sub via Redis, real‑time leaderboards (sorted sets)
- **MVVM:** Extended with client‑side event sourcing for auction UI

### Phase 4 (Integrations – Weeks 25‑28)
- **Add:** Media Service (full pipeline), Analytics Service
- **Integrations:** Strava, Steam, Google Calendar, WhatsApp API
- **Cache:** CDN for media (CloudFront), pre‑generated “Year in Review” snapshots

### Phase 5 (Buffer – Weeks 29‑32)
- No new components – only hardening, load testing, bug fixes.

---

## 6. Data Flow Example (Event Registration across phases)

### Phase 1 (MVP, in‑memory bus)
1. Mobile → API Gateway → Event Service
2. Event Service writes to PostgreSQL, emits `RegistrationCreated` to in‑memory bus
3. Points Service (same process) consumes, awards points → `PointsEarned`
4. Notification Service stores in‑app notification

### Phase 3 (Full event‑driven with Kafka)
1. Same first two steps, but `RegistrationCreated` published to Kafka topic `event.registration`
2. Points Service (separate container) consumes from Kafka, does its work
3. Sponsor Service consumes same event, updates fan count for event winner (if event completed)
4. Notification Service consumes → FCM push + email
5. Search Service consumes → updates Elasticsearch index for user’s event history
6. All services are decoupled; Kafka retains events for replay.

---

# Dev Timeline
---

## Timeline Overview

| Phase | Focus | Duration | Start Date | End Date |
|-------|-------|----------|------------|----------|
| **Phase 0** | Foundation (infra, design system, auth) | 2 weeks | April 20, 2026 | May 3, 2026 |
| **Phase 1 (Backend MVP)** | All backend APIs for MVP features | 6 weeks | May 4, 2026 | **June 26, 2026** |
| **Phase 1 (Frontend MVP)** | Mobile + Web frontend & integration | 2 weeks | June 27, 2026 | July 10, 2026 |
| **Phase 2** | Community & Engagement (friends, posts, challenges) | 6 weeks | July 11, 2026 | August 21, 2026 |
| **Phase 3** | Operations & League Management (Union Page, auctions, teams) | 8 weeks | August 22, 2026 | October 16, 2026 |
| **Phase 4** | Integrations & Polish (Strava, Steam, WhatsApp, etc.) | 4 weeks | October 17, 2026 | November 13, 2026 |
| **Phase 5** | Buffer & Contingency (bug fixes, load testing, launch prep) | 4 weeks | November 14, 2026 | December 11, 2026 |

> **Note:** The **Backend MVP** milestone (June 27) is **non‑negotiable**. All tasks under Phase 1 (Backend) must be done by June 26.

---

## Phase 0: Foundation (April 20 – May 3)

**Goal:** Build the skeleton – nothing user‑facing yet, but every service can start, communicate, and pass basic tests.

### Milestone 0.1 – Infrastructure & CI/CD

| Status | Task                      | Sub‑tasks                                                                                                                 | Est. (person‑days) | Beginner notes                                                                                       | Done By |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- | ------- |
| [x]    | Set up GitHub repository  | – Create `bgsc-platform` repo <br> – Branch protection: `main`, `dev` <br> – Add `.gitignore` (Node, React Native, env)   | 0.5                | Use GitHub UI; protect `main` so no direct pushes.                                                   | Nikunj  |
| [x]    | Configure CI/CD pipelines | – GitHub Actions workflow for backend lint/test <br> – Docker build on each PR <br> – Deploy to staging on merge to `dev` | 1                  | Starter template: `node.js` workflow. For Docker, use `docker/build-push-action`.                    | Nikunj  |
| [x]    | Staging environment       | – Set up Railway / Render account <br> – Provision PostgreSQL, Redis, S3‑compatible storage                               | 1                  | Follow Railway’s “New Project” → PostgreSQL, Redis.                                                  | Nikunj  |
| [x]    | Monitoring basics         | – Prometheus + Grafana (Docker‑compose) <br> – Sentry (create project, get DSN)                                           | 1                  | Use [Prometheus node_exporter](https://prometheus.io/docs/guides/node-exporter/) for server metrics. | Nikunj  |

### Milestone 0.2 – Backend Core Services

| Status | Task | Sub‑tasks | Est. | Notes | Done By |
|--------|------|-----------|------|-------|---------|
| [x]    | Auth Service (NestJS) | – JWT issuance (access/refresh) <br> – Google OAuth2 flow <br> – `/register`, `/login`, `/refresh`, `/logout` | 3 | Use `@nestjs/jwt` and `@nestjs/passport`. Store refresh tokens in Redis. | Kashyap |
| [x]    | User Service | – CRUD for users (PostgreSQL) <br> – RBAC middleware (roles: guest, user, member, core, coordinator, founder) | 2 | Create `users` table with `role` enum. Integration between auth and user in the next task | Dhruvin |
| [x]    | Integrate auth and user service | Integrate the two services to make sure they go hand in hand and no issues come up | 3 | integrate | Dhruvin |
| [x]    | API Gateway (Kong / Express Gateway) | – Route requests to services <br> – JWT verification <br> – Rate limiting (5 auth attempts/15min, 100 req/min for general) | 2 | Implemented as the **root backend app** (`backend/src`) that proxies to the `apps/*` microservices, using `http-proxy-middleware` + Redis sliding-window limiter. See `docs/api-gateway.md`. | Dhruvin |
| [ ]    | Event Bus (MVP: in‑memory) | – Simple `EventEmitter` based bus <br> – Define domain events (`UserRegistered`, `EventCreated`) | 1 | We will replace with Kafka in Phase 2. For MVP, this is enough. | — |

### Milestone 0.3 – Database & Cache

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [ ]    | PostgreSQL schema | – Run migrations for `users`, `events`, `registrations`, `sponsors`, `points_transactions`, `announcements` | 2 | — |
| [ ]    | Redis cache layer | – Cache user sessions (refresh tokens) <br> – Cache event list (5 min TTL) | 1 | — |
| [x]    | Basic seeding | – Script to insert dummy users, sponsors, events | 0.5 | Dhruvin (only Users for now to be maintianed when other tables come in) |

### Milestone 0.4 – Frontend Shell (Mobile + Web)

| Status | Task                    | Sub‑tasks                                                                                                 | Est. | Done By |
|--------|-------------------------|-----------------------------------------------------------------------------------------------------------|------|---------|
| [x]    | React Native (Expo) app | – Navigation drawer (Side Drawer) <br> – Dynamic status bar component <br> – Theme switching (dark/light) | 3    | Dhruvin |
| [x]    | React Web (Admin PWA)   | – Tailwind CSS + Vite <br> – Router (login, basic event table)                                            | 2    | Dhruvin |
| [x]    | MVVM base classes       | – `BaseViewModel` with observable state <br> – Repository pattern for API calls                           | 2    | Dhruvin |
| [x]| Cleaup of AI gen code and testing | Clean up web/ and mobile/ | 2 | Adit |

**Phase 0 Success Criteria**
- [x] `docker-compose up` starts all services (auth, user, gateway, postgres, redis)
- [x] User can register via API (POST `/register`) and receive JWT
- [x] The mobile app shows the status bar and navigation drawer (even if empty)
- [x] Unit test coverage > 50% for auth & user services
- [ ] Pending tasks on event bus and cache layer

---

## Phase 1: MVP – Public Platform (Backend First!)

### Critical Deadline: Backend MVP complete by **June 26, 2026**

We split Phase 1 into **Backend (6 weeks)** and **Frontend (2 weeks)** so the backend team can work independently.

### Part A – Backend MVP (May 4 – June 26)

#### Milestone 1.1 – Sponsor System v1 (Week 1 of Phase 1)

| Status | Task                         | Sub‑tasks                                                                                                                          | Est. | Done By |
|--------|------------------------------|------------------------------------------------------------------------------------------------------------------------------------|------|---------|
| [x]    | Sponsor service              | – CRUD for `sponsors` (name, logo, tenure_start/end) <br> – `UserSponsorAffiliation` table <br> – Endpoint: `GET /sponsors/active` | 2    | Dhruvin       |
| [x]    | Onboarding sponsor selection | – `POST /users/me/sponsor` (with semester change limit) <br> – Validate that user can change only once per semester                | 1    | Dhruvin       |
| [x]    | Basic fan counting           | – `POST /sponsors/:id/fans` to award fans <br> – Emit `FanEarned` event via in-memory event bus (stub for Kafka)                     | 1    | Dhruvin       |
| [x]    | Sponsor leaderboard          | – `GET /sponsors/leaderboard?sort=fans|events|users` – aggregate fan counts, events won, affiliated users                         | 1    | Dhruvin       |

#### ✅ Milestone 1.2 – Events & Registration (Weeks 2‑3)

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [x]    | Event service | – `POST /events` (admin only) <br> – `GET /events` (with filters: upcoming/ongoing/past) <br> – `GET /events/:id` | 3 | Dhruvin |
| [x]    | Registration flow | – `POST /events/:id/register` (solo only, no teams in MVP) <br> – Check registration deadline, capacity <br> – Emit `RegistrationCreated` event | 2 | Dhruvin |
| [x]    | Points service (basic) | – Consume `RegistrationCreated` → award participation points <br> – Emit `PointsEarned` | 2 | Dhruvin |
| [x]    | Event leaderboard (MVP) | – For `LE` events: admin can manually enter scores via `POST /events/:id/scores` <br> – `GET /events/:id/leaderboard` | 2 | Dhruvin |
| [ ]    | Post‑event fan award | – When `EventCompleted` is emitted, award fans to winners’ sponsors | 1 | — |

#### ✅ Milestone 1.3 – User Profile & Player Card (Week 4)

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [x]    | Profile API | – `GET /users/:id` (public fields) <br> – `PATCH /users/me` (bio, interests, social links) | 2 | Dhruvin |
| [ ]    | Player card generation | – Endpoint that returns a JSON with avatar, username, sponsor badge, stats | 1 | — |
| [ ]    | Interest fields | – `GET /interests` (list of sports/esports) <br> – `PATCH /users/me/interests` | 1 | — |
| [ ]    | Sponsor stats on profile | – `GET /users/me/sponsor-stats` (personal fan count, events won) | 1 | — |

#### ✅ Milestone 1.4 – Announcements & Admin Panel (Week 5)

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [ ]    | Announcement service | – `POST /announcements` (coordinator+) <br> – `GET /announcements` (public, last 4 months) <br> – Announcement types & tags | 2 | — |
| [ ]    | Basic users table (admin) | – `GET /admin/users` (paginated, filter by role/status) – coordinator+ | 2 | — |
| [ ]    | Sponsor management (admin) | – `POST /admin/sponsors` <br> – `PATCH /admin/sponsors/:id/tenure-end` (manual for MVP) | 1 | — |

#### ✅ Milestone 1.5 – Points & Hall of Fame v1 (Week 6)

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [x]    | Points balance | – `GET /users/me/points` <br> – Transaction history (`GET /points/transactions`) | 1 | Dhruvin |
| [ ]    | Hall of Fame | – `GET /hall-of-fame/event-winners` <br> – `GET /hall-of-fame/sponsor-champions` (hardcoded or manually seeded) | 2 | — |
| [ ]    | Notification service (in‑app) | – Store notifications in DB <br> – `GET /notifications` (unread count) <br> – `PATCH /notifications/:id/read` | 2 | — |

**Final Backend MVP Checklist (June 26)**
- [ ] All endpoints above are implemented, documented (Swagger), and tested.
- [ ] The event bus (in‑memory) passes events between services correctly.
- [ ] PostgreSQL schema is fully migrated; Redis caches session and event lists.
- [ ] Postman/Newman collection runs without error.
- [ ] Backend deployed to staging environment (Railway/Render).
- [ ] Security: JWT expires after 15 min, refresh token rotation works.

### Part B – Frontend MVP (June 27 – July 10)

Now the frontend team consumes the ready APIs.

#### ✅ Milestone 1.6 – Mobile App (React Native)

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [ ]    | Auth screens | – Login / Register (email + Google OAuth) <br> – Sponsor selection during onboarding <br> – Interest selection | 2 | — |
| [ ]    | Home page | – Landing intro (static) <br> – Announcements list (from API) <br> – Public social feed (read‑only) | 2 | — |
| [ ]    | Events page | – Browse events (upcoming/ongoing/past) <br> – Solo registration flow <br> – Event details view | 2 | — |
| [ ]    | User profile | – View own profile (player card, sponsor badge) <br> – Edit bio/interests | 1 | — |
| [ ]    | Points & Hall of Fame | – Display points balance <br> – Hall of Fame screen (winners + sponsor champions) | 1 | — |

#### ✅ Milestone 1.7 – Web Admin Console (React + Tailwind)

| Status | Task | Sub‑tasks | Est. | Done By |
|--------|------|-----------|------|---------|
| [ ]    | Login & RBAC | – Coordinator/Founder login redirects to admin dashboard | 0.5 | — |
| [ ]    | Event management | – Create/edit events (form with title, dates, type, etc.) | 1 | — |
| [ ]    | Announcement creator | – Make Announcement Popup (rich text, tag selection) | 1 | — |
| [ ]    | Users table | – View users, filter by role/sponsor | 1 | — |

**Frontend MVP Success Criteria**
- [ ] A user can complete the full onboarding (interests → sponsor → add friends suggestion skip) and see the home feed.
- [ ] Registration for an event works end‑to‑end, and points appear in the user’s balance.
- [ ] A coordinator can log into the web admin and create a new event + announcement.
- [ ] The mobile app works on both iOS (simulator) and Android (emulator).

---

## 👥 Phase 2: Community & Engagement (July 11 – August 21)

Now we add social features, challenges, and richer gamification.

### ✅ Milestone 2.1 – Friends System (2 weeks)

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Friend request API | Send/accept/reject/block, list friends, mutual friends | 3 days | — |
| [ ]    | Friend suggestions | Based on shared interests + sponsor affiliation + mutual events | 2 days | — |
| [ ]    | Friends UI (mobile) | Friend list tab, request inbox, add friend button | 3 days | — |
| [ ]    | Online status | Redis‑based presence tracking (last active, online/offline) | 2 days | — |

### ✅ Milestone 2.2 – Social Feed v2 (2 weeks)

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Post creation | Image upload (camera/gallery), caption, tags, visibility (public/protected/private) | 3 days | — |
| [ ]    | Like & comment | Like/unlike, create comment, delete own comment | 2 days | — |
| [ ]    | Feed aggregation | `GET /feed` – posts from friends + public posts, paginated | 2 days | — |
| [ ]    | Privacy enforcement | Backend filters posts based on visibility & friendship | 2 days | — |

### ✅ Milestone 2.3 – Challenges & Leaderboards v2 (2 weeks)

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Challenge service | CRUD for challenges (title, domain, difficulty, award points) | 2 days | — |
| [ ]    | Accept & submit | `POST /challenges/:id/accept`, `POST /submissions` (with proof media) | 2 days | — |
| [ ]    | Points award on completion | Consume `ChallengeCompleted` event → award points | 1 day | — |
| [ ]    | Auto‑leaderboards for LE events | Scores entered by admin → leaderboard auto‑updates via WebSockets | 3 days | — |

**Phase 2 Success Criteria**
- [ ] Users can send 10+ friend requests, and see mutual friends.
- [ ] At least 20% of active users create a post.
- [ ] Challenge completion rate > 25% among those who accept.

---

## ⚙️ Phase 3: Operations & League Management (August 22 – October 16)

**Target audience:** BGSC/BGEC/FitSoc crew. This phase makes the platform indispensable for the organisers.

### ✅ Milestone 3.1 – Union Page (Tasks & Project Management)

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Task service | Task types: quick, standard, pathway, event_task. Status: active/abandoned/completed | 3 days | — |
| [ ]    | Task views (Web) | List view, Kanban board, Gantt chart (using `dhtmlx-gantt` or similar) | 5 days | — |
| [ ]    | Task assignments | Assign multiple users, auto‑create group chat (via internal messaging) | 2 days | — |
| [ ]    | Crew heatmap | Visual grid showing workload per member (Redis + cron) | 2 days | — |

### ✅ Milestone 3.2 – Teams & Leagues (3 weeks)

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Team service | Create team, join with invite code, captain role, open/closed status | 3 days | — |
| [ ]    | League registration flow | Captain application (with review by Core), approval endpoint | 2 days | — |
| [ ]    | Bracket generator | Round‑robin, single/double elimination. Store match tree in JSONB | 4 days | — |
| [ ]    | Match score entry | Admin form to enter scores (custom parameters e.g., goals, kills) | 2 days | — |
| [ ]    | Spectator bracket view (mobile) | Read‑only tree with match details | 3 days | — |

### ✅ Milestone 3.3 – Auction System (2 weeks)

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Player base price submission | Captains submit base price for each player, OC override (3/7ths quota) | 2 days | — |
| [ ]    | Live auction engine | WebSocket rooms, server‑authoritative timer, bid validation (purse check) | 4 days | — |
| [ ]    | Admin auction controller | Start/stop block, override sold/unsold, adjust timers | 2 days | — |
| [ ]    | Captain bidding interface (PWA) | Real‑time wallet, place bid button, bid log | 2 days | — |

**Phase 3 Success Criteria**
- [ ] 100% of Core team uses Union Page for task tracking.
- [ ] A complete league (e.g., Offside) can be set up – from team registration to final bracket – without touching the database directly.
- [ ] Auction handles 50+ concurrent bidders with < 200 ms latency.

---

## 🔌 Phase 4: Integrations & Polish (October 17 – November 13)

Make the platform “smart” and connected.

### ✅ Milestone 4.1 – External Integrations

| Status | Integration | Tasks | Est. | Done By |
|--------|-------------|-------|------|---------|
| [ ]    | Strava | OAuth2, webhook to pull activities, display on profile | 2 days | — |
| [ ]    | Steam | OpenID login, fetch owned games & playtime (daily sync) | 2 days | — |
| [ ]    | Google Calendar | Two‑way sync for Union tasks (create/update events) | 2 days | — |
| [ ]    | WhatsApp Business API | Auto‑post announcements to community groups based on tag | 2 days | — |

### ✅ Milestone 4.2 – Media & Memories

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Image processing pipeline | Upload → resize to thumbnails (150x150, 800x800) → store in S3 → CDN | 2 days | — |
| [ ]    | Video transcoding | Transcode to 480p/720p using FFmpeg (serverless or worker) | 2 days | — |
| [ ]    | “Year in Review” | Script that collects user’s top moments (events, posts, fans) | 2 days | — |

### ✅ Milestone 4.3 – Advanced Analytics & Hardening

| Status | Task | Details | Est. | Done By |
|--------|------|---------|------|---------|
| [ ]    | Coordinator dashboard | Graphs: registrations over time, popular events, sponsor ranking | 2 days | — |
| [ ]    | Performance audit | Identify N+1 queries, add indexes, enable Redis caching for feed | 2 days | — |
| [ ]    | Security hardening | Run penetration test (OWASP ZAP), fix findings, add rate limiting per user | 2 days | — |

**Phase 4 Success Criteria**
- [ ] 30% of users connect at least one external integration (Strava/Steam).
- [ ] P95 API latency < 200 ms under load (500 concurrent users).
- [ ] No high‑severity security vulnerabilities.

---

## 🧪 Phase 5: Buffer & Contingency (November 14 – December 11)

**Do not schedule new features in this phase.** Use it to stabilise and prepare for launch.

| Status | Activity | Who | Duration | Done By |
|--------|----------|-----|----------|---------|
| [ ]    | Bug bash (all team members) | Everyone | 1 week | — |
| [ ]    | Load testing with K6 (target 1000 concurrent users) | Backend + QA | 3 days | — |
| [ ]    | Finalise documentation (API docs, user guides, admin runbooks) | Tech writers + leads | 1 week | — |
| [ ]    | Soft launch with 100 beta users (campus ambassadors) | Product + Marketing | 1 week | — |
| [ ]    | App store submission (if releasing publicly) | Mobile lead | 3 days | — |

---

## 🗺️ Beginner-Friendly Developer Setup

### 1. Clone & Install

```bash
git clone https://github.com/bgsc/bgsc-platform.git
cd bgsc-platform
# Backend
cd backend && npm install
# Mobile app
cd ../mobile && npm install
# Web admin
cd ../web && npm install
```

### 2. Environment Variables (example `.env`)

```ini
# Backend
DATABASE_URL=postgresql://postgres:password@localhost:5432/bgsc
REDIS_URL=redis://localhost:6379
JWT_SECRET=super-secret-change-me
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

### 3. Run with Docker Compose (easiest)

```bash
docker-compose up -d
# Services: postgres, redis, backend (NestJS), gateway, prometheus, grafana
```

### 4. Code Quality Tools

- **Linting:** ESLint + Prettier (backend & frontend)
- **Formatting:** `npm run format`
- **Testing:** Jest (backend), React Testing Library (frontend)
- **Git hooks:** Husky + lint-staged

### 5. How to Contribute (Branch Naming)

- `feature/XXX-short-description` – new feature
- `fix/XXX-bug-description` – bug fix
- `chore/XXX` – maintenance (dependencies, config)

Always open a Pull Request to `dev`. Required checks: CI passes, at least one review.

---

## 📊 Milestone Tracking Table (Executive Summary)

| Milestone | Description | Due Date | Dependencies |
|-----------|-------------|----------|--------------|
| **M0** | Foundation complete (infra, auth, shell) | May 3, 2026 | – |
| **M1** | **Backend MVP – all APIs ready** | **June 26, 2026** | M0 |
| **M2** | Frontend MVP – mobile + web integrated | July 10, 2026 | M1 |
| **M3** | Community features (friends, posts, challenges) | August 21, 2026 | M2 |
| **M4** | Operations (Union Page, leagues, auctions) | October 16, 2026 | M3 |
| **M5** | Integrations & Polish | November 13, 2026 | M4 |
| **M6** | Buffer completed – ready for public launch | December 11, 2026 | M5 |

---

## 🆘 Common Beginner Questions

**Q: I’ve never used Kafka. How do I start?**  
A: In Phase 1 we use an **in‑memory event emitter**. Kafka is only introduced in Phase 2. When that happens, we’ll provide a Docker‑compose file with Zookeeper + Kafka, and a short tutorial.

**Q: What if I don’t know Kubernetes?**  
A: For MVP we deploy to simple cloud services (Railway, Render). Kubernetes is only needed for large‑scale Phase 4. The DevOps team will handle it.

**Q: How do I test event‑driven flows locally?**  
A: Use the in‑memory bus: it’s a Node.js `EventEmitter`. You can listen to events in tests and assert that side‑effects (e.g., point award) happen.

**Q: Where do I log bugs?**  
A: Use GitHub Issues with labels: `bug`, `frontend`, `backend`, `phase1`, etc.

---

## ✅ Final Checklist Before Each Release

- [ ] All automated tests pass (jest, react‑testing‑library)
- [ ] Manual test of critical paths (registration, event creation, points earning)
- [ ] Database migrations are idempotent (can run twice without error)
- [ ] API documentation (Swagger) is up to date
- [ ] No secrets in code (checked with `trufflehog` or similar)

**Let’s build something legendary.**  
If you are stuck, ask in the `#dev-help` channel. Happy coding! 🚀