# BGSC Platform

> **Backend MVP Deadline: June 26, 2026** — Non-negotiable.

Full-stack community platform for BGSC/BGEC/FitSoc. React Native (mobile) + React Web (admin) + NestJS microservices + API Gateway.

---

## 📊 Phase 0: Foundation (Apr 20 – May 3) — ✅ Mostly Complete

### Contribution — Completed Work Only

> Based on estimated task-days.

```
  Dhruvin   ████████████████████    ~13.0 days  (60%)
  Nikunj    ████████                 ~3.5 days  (16%)
  Kashyap   ██████                   ~3.0 days  (14%)
  Adit      ████                     ~2.0 days   (9%)
  ─────────────────────────────────────────────────
  Total done: ~21.5 days
```

```
Pie — Phase 0 Done
  ┌──────────────────────┐
  │       Dhruvin        │
  │        60%           │
  │  ┌────────────────┐  │
  │  │ Nikunj  16%    │  │
  │  │ Kashyap 14%    │  │
  │  │ Adit     9%    │  │
  │  └────────────────┘  │
  └──────────────────────┘
```

### Tasks Done

| ✅ | Task | Days | By |
|----|------|------|----|
| ✅ | Set up GitHub repository | 0.5 | Nikunj |
| ✅ | Configure CI/CD pipelines | 1.0 | Nikunj |
| ✅ | Staging environment | 1.0 | Nikunj |
| ✅ | Monitoring (Prometheus + Grafana + Sentry) | 1.0 | Nikunj |
| ✅ | Auth Service (JWT + Google OAuth2) | 3.0 | Kashyap |
| ✅ | User Service (CRUD + RBAC) | 2.0 | Dhruvin |
| ✅ | Integrate Auth & User Services | 3.0 | Dhruvin |
| ✅ | API Gateway (routing + JWT + rate limiting) | 2.0 | Dhruvin |
| ✅ | Basic seeding (users) | 0.5 | Dhruvin |
| ✅ | React Native shell (nav drawer, theme, status bar) | 3.0 | Dhruvin |
| ✅ | React Web Admin shell (Tailwind + Vite + router) | 2.0 | Dhruvin |
| ✅ | MVVM base classes + Repository pattern | 2.0 | Dhruvin |
| ✅ | Cleanup of AI-generated code & testing | 2.0 | Adit |

### Work Left

```
  Done  ████████████████████  ~21.5 days  (84%)
  Left  ████                   ~4.0 days  (16%)
  ──────────────────────────────────────────────
  Total: ~25.5 days
```

| ⬜ | Task | Est. |
|----|------|------|
| ⬜ | Event Bus (in-memory EventEmitter) | 1.0 day |
| ⬜ | PostgreSQL schema migrations | 2.0 days |
| ⬜ | Redis cache layer (sessions + event list TTL) | 1.0 day |

---

## 🚧 Phase 1: MVP (May 4 – Jun 26 backend / Jul 10 frontend) — IN PROGRESS

### Contribution — Completed Work Only

```
  Dhruvin   ████████████████████  ~15.0 days  (100%)
  ──────────────────────────────────────────────────
  Total done: ~15.0 days
```

### Tasks Done

| ✅ | Task | Days | By |
|----|------|------|----|
| ✅ | Sponsor CRUD service | 2.0 | Dhruvin |
| ✅ | Onboarding sponsor selection (semester limit) | 1.0 | Dhruvin |
| ✅ | Fan counting + `FanEarned` event | 1.0 | Dhruvin |
| ✅ | Sponsor leaderboard | 1.0 | Dhruvin |
| ✅ | Event service (CRUD + filters) | 3.0 | Dhruvin |
| ✅ | Registration flow + `RegistrationCreated` event | 2.0 | Dhruvin |
| ✅ | Points service (consume events, award points) | 2.0 | Dhruvin |
| ✅ | Event leaderboard (manual score entry) | 2.0 | Dhruvin |
| ✅ | Points balance + transaction history | 1.0 | Dhruvin |

### Work Left — Backend (due Jun 26)

```
  Done  ████████████          ~15 days  (60%)
  Left  ████████               ~10 days  (40%)
  ──────────────────────────────────────────────
  Backend total: ~25 days
```

| ⬜ | Milestone | Task | Est. |
|----|-----------|------|------|
| ⬜ | 1.2 Events | Post-event fan award to sponsors | 1 day |
| ⬜ | 1.3 Profile | Profile API (GET public + PATCH own) | 2 days |
| ⬜ | 1.3 Profile | Player card JSON endpoint | 1 day |
| ⬜ | 1.3 Profile | Interests CRUD | 1 day |
| ⬜ | 1.3 Profile | Sponsor stats on profile | 1 day |
| ⬜ | 1.4 Admin | Announcement service (CRUD + tags) | 2 days |
| ⬜ | 1.4 Admin | Admin users table (paginated, filtered) | 2 days |
| ⬜ | 1.4 Admin | Sponsor management (admin) | 1 day |
| ⬜ | 1.5 Points | Hall of Fame (event winners + sponsor champions) | 2 days |
| ⬜ | 1.5 Points | Notification service (in-app: store, read, unread count) | 2 days |

### Work Left — Frontend (Jun 27 – Jul 10)

```
  Done  (none yet)
  Left  ████████████████████  ~8.5 days  (100%)
```

| ⬜ | Milestone | Task | Est. |
|----|-----------|------|------|
| ⬜ | 1.6 Mobile | Auth screens (login, register, Google OAuth) | 2 days |
| ⬜ | 1.6 Mobile | Home page (announcements + feed) | 2 days |
| ⬜ | 1.6 Mobile | Events page (browse + register) | 2 days |
| ⬜ | 1.6 Mobile | User profile (view + edit) | 1 day |
| ⬜ | 1.6 Mobile | Points & Hall of Fame screens | 1 day |
| ⬜ | 1.7 Web | Login + RBAC redirect | 0.5 days |
| ⬜ | 1.7 Web | Event management form | 1 day |
| ⬜ | 1.7 Web | Announcement creator | 1 day |
| ⬜ | 1.7 Web | Users table (view + filter) | 1 day |

---

## 👥 Phase 2: Community (Jul 11 – Aug 21) — ⬜ Pending

```
  Done  (none)
  Left  ████████████████████  ~25 days (100%)
```

| ⬜ | Milestone | Task | Est. |
|----|-----------|------|------|
| ⬜ | 2.1 Friends | Friend request API (send/accept/reject/block) | 3 days |
| ⬜ | 2.1 Friends | Friend suggestions | 2 days |
| ⬜ | 2.1 Friends | Friends UI (mobile) | 3 days |
| ⬜ | 2.1 Friends | Online presence (Redis) | 2 days |
| ⬜ | 2.2 Feed | Post creation (image + caption + visibility) | 3 days |
| ⬜ | 2.2 Feed | Like & comment | 2 days |
| ⬜ | 2.2 Feed | Feed aggregation endpoint | 2 days |
| ⬜ | 2.2 Feed | Privacy enforcement | 2 days |
| ⬜ | 2.3 Challenges | Challenge service CRUD | 2 days |
| ⬜ | 2.3 Challenges | Accept & submit (with proof) | 2 days |
| ⬜ | 2.3 Challenges | Points award on completion | 1 day |
| ⬜ | 2.3 Challenges | Auto-leaderboards for LE events (WebSocket) | 3 days |

---

## ⚙️ Phase 3: Operations (Aug 22 – Oct 16) — ⬜ Pending

```
  Done  (none)
  Left  ████████████████████  ~30 days (100%)
```

| ⬜ | Milestone | Task | Est. |
|----|-----------|------|------|
| ⬜ | 3.1 Union | Task service (types + status) | 3 days |
| ⬜ | 3.1 Union | Task views (list, Kanban, Gantt) | 5 days |
| ⬜ | 3.1 Union | Task assignments + group chat | 2 days |
| ⬜ | 3.1 Union | Crew heatmap | 2 days |
| ⬜ | 3.2 Teams | Team service (create, join, captain) | 3 days |
| ⬜ | 3.2 Teams | League registration + approval flow | 2 days |
| ⬜ | 3.2 Teams | Bracket generator (round-robin / elimination) | 4 days |
| ⬜ | 3.2 Teams | Match score entry | 2 days |
| ⬜ | 3.2 Teams | Spectator bracket view (mobile) | 3 days |
| ⬜ | 3.3 Auction | Player base price submission | 2 days |
| ⬜ | 3.3 Auction | Live auction engine (WebSocket + server timer) | 4 days |
| ⬜ | 3.3 Auction | Admin auction controller | 2 days |
| ⬜ | 3.3 Auction | Captain bidding interface (PWA) | 2 days |

---

## 🔌 Phase 4: Integrations (Oct 17 – Nov 13) — ⬜ Pending

```
  Done  (none)
  Left  ████████████████████  ~20 days (100%)
```

| ⬜ | Task | Est. |
|----|------|------|
| ⬜ | Strava OAuth2 + activity sync | 2 days |
| ⬜ | Steam OpenID + game data sync | 2 days |
| ⬜ | Google Calendar two-way sync | 2 days |
| ⬜ | WhatsApp Business API announcements | 2 days |
| ⬜ | Image processing pipeline (S3 + CDN) | 2 days |
| ⬜ | Video transcoding (FFmpeg) | 2 days |
| ⬜ | "Year in Review" script | 2 days |
| ⬜ | Coordinator analytics dashboard | 2 days |
| ⬜ | Performance audit (N+1, indexes, Redis) | 2 days |
| ⬜ | Security hardening (OWASP ZAP + rate limits) | 2 days |

---

## 🧪 Phase 5: Buffer (Nov 14 – Dec 11) — ⬜ Pending

| ⬜ | Activity |
|----|----------|
| ⬜ | Bug bash (all team) |
| ⬜ | Load testing with K6 (1000 concurrent users) |
| ⬜ | Finalise API docs + user guides + admin runbooks |
| ⬜ | Soft launch with 100 beta users |
| ⬜ | App store submission |

---

## 🗺️ Milestone Summary

| Milestone | Description | Deadline | Status |
|-----------|-------------|----------|--------|
| M0 | Foundation | May 3, 2026 | ✅ Done (partial) |
| M1 | **Backend MVP** | **Jun 26, 2026** | 🚧 In Progress |
| M2 | Frontend MVP | Jul 10, 2026 | ⬜ Pending |
| M3 | Community features | Aug 21, 2026 | ⬜ Pending |
| M4 | Operations | Oct 16, 2026 | ⬜ Pending |
| M5 | Integrations & Polish | Nov 13, 2026 | ⬜ Pending |
| M6 | Public launch ready | Dec 11, 2026 | ⬜ Pending |

---

See [`docs/api-gateway.md`](docs/api-gateway.md) for API routing and [`variables.md`](variables.md) for env vars.

---

## 🤝 Contributing

Branch naming: `feature/XXX-description` · `fix/XXX-description` · `chore/XXX`  
All PRs target `dev`. CI must pass + 1 review required.
