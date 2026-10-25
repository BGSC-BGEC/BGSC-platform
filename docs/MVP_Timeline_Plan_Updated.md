# BGSC Platform - MVP Timeline Plan (Dual Deadline)
**Start Date:** September 5, 2026 (Friday)  
**Working Schedule:** Saturdays & Sundays, 8 hours/day (weekday work optional)

## Frontend Implementation Tally — October 25, 2026 (Mobile v2 Complete & Backend-Integrated)

**Source baseline:** Mobile v2 (`mobile/`) and Web Admin (`web/`) rebuilt and wired to the 12-service API Gateway (`Backend/` on `:3000`). See [`docs/mobile-v2-build-split.md`](mobile-v2-build-split.md) for the BE-1 / BE-2 vertical slice architecture and [`docs/frontend-api-and-design-registry.md`](frontend-api-and-design-registry.md) for the complete screen-to-API registry and responsive design decisions. `Legacy/` and `docs/Legacy/` are excluded from inspection and edits.

**Status rules:** **Implemented & verified** means v2 UI, responsive phone scaling (`360dp`–`430dp+`), `tsc --noEmit` (0 errors), self-checks, and live Gateway (`:3000`) + Android emulator verification are complete.

**Overall:** Both **BE-2** (Slices A, B, C, G + App Shell) and **BE-1** (Slices D, E, F, H + Form/Row components + `useResponsive` phone scaling) are complete and integrated with the live microservices backend.

### Mobile compared with the plan (18 task groups)

| Planned area | Current tally | Source evidence and verification |
|---|---|---|
| Project architecture | Implemented & verified | [App](../mobile/App.tsx), [API/config](../mobile/src/api/client.ts), [environment example](../mobile/.env.example), [token storage](../mobile/src/api/tokenStorage.ts), and 15 typed repositories in `mobile/src/repositories/` are live. |
| Design system & responsive scaling | Implemented & verified | Theme tokens (`colors.ts`), Phase 0 v2 controls (`Field`/`TextInput`, `TextArea`, `Select`, `Switch`, `Checkbox`, `SegmentedControl`, `OptionTile`, `SeverityPill`, `InterestTile`, `ListRow`, `StatTile`, `Avatar`), feedback states, and reactive `useResponsive()` (`isCompactPhone < 375dp`, `isStandardPhone`, `isLargePhone`) compile with 0 TypeScript errors. |
| Authentication | Implemented & verified | [AuthRepository](../mobile/src/repositories/AuthRepository.ts), [auth store](../mobile/store/auth.tsx), and v2 screens (`Splash`, `Landing`, `Login`, `Register`, `VerifyEmail`, `GetStarted`, `RestoreAccount`, `ForgotPassword`) preserve offline sessions and handle 401/429/deleted-account reactivation (`POST /account/reactivate`). |
| Landing and app shell | Implemented & verified | [Drawer/stack](../mobile/screens/drawer/layout.tsx), [BottomTabs](../mobile/screens/drawer/bottom-tabs-layout.tsx) (`HomeTab`, `AnnouncementsTab`, `SocialTab`), and [DrawerContent](../mobile/src/navigation/DrawerContent.tsx) match the v2 route contract. |
| Events list and filters | Implemented & verified | [Events](../mobile/screens/drawer/events.tsx) uses cursor pagination, status segments, category chips, debounced search, live-auction banner, and skeleton/empty/error states. |
| Profile & settings | Implemented & verified | [Profile](../mobile/screens/drawer/profile.tsx), [EditProfile](../mobile/screens/profile/edit-profile.tsx), [ProfilePhoto](../mobile/screens/profile/profile-photo.tsx), [Settings](../mobile/screens/profile/settings.tsx), [DeleteAccount](../mobile/screens/profile/delete-account.tsx), and [PhoneOtp](../mobile/screens/profile/phone-otp.tsx) are wired to `user-service`, `points-service`, `registration-service`, `notification-service`, and `auth-service`. |
| Event details and registration | Implemented & verified | [EventDetails](../mobile/screens/events/event-details.tsx), [EventRegistration](../mobile/screens/events/registration.tsx), [TeamJoin](../mobile/screens/events/team-join.tsx), and [DynamicFormField](../mobile/src/forms/DynamicFormField.tsx) support captain/member flows, server-aligned `visible_if`, and `confirmed`/`waitlisted`/`pending`/`rejected` states. |
| Announcements | Implemented & verified | [Announcements](../mobile/screens/drawer/announcement.tsx) and [AnnouncementDetail](../mobile/screens/announcements/announcement-detail.tsx) integrate `GET /announcements`, unread counts, mark-read, and linked-event cards. |
| Auction | Implemented & verified | [Auction](../mobile/screens/events/auction.tsx), [AuctionLots](../mobile/screens/events/auction-lots.tsx), and [MyBids](../mobile/screens/events/my-bids.tsx) implement live polling, frozen bid confirmation context, reversed bid log, and team purse tracking. |
| Points system | Implemented & verified | [Points](../mobile/screens/profile/history.tsx) integrates `GET /points/me`, `/me/breakdown` (SVG donut), `/opportunities`, and cursor-paginated `/me/transactions`. |
| Leaderboard & brackets | Implemented & verified | [Leaderboard](../mobile/screens/drawer/leaderboard.tsx), [EventStandings](../mobile/screens/events/event-leaderboard.tsx), [InvestmentSheet](../mobile/screens/events/investment-sheet.tsx), and [Match](../mobile/screens/events/match.tsx) integrate global/event/challenge rankings, durable-idempotency point investments, tournament brackets (`GET /brackets/:event_id`), and match timelines (`GET /matches/:id`). |
| Challenges and Strava | Implemented & verified | [Challenges](../mobile/screens/challenges/challenges.tsx), [ChallengeDetail](../mobile/screens/challenges/challenge-detail.tsx), and [StravaConnect](../mobile/screens/strava/strava-connect.tsx) implement challenge discovery, solo/team acceptance, progress tracking, Strava/URL/text proof submission, and Strava OAuth linking (`bgsc://settings/integrations`). |
| Media | Implemented & verified | [Media](../mobile/screens/drawer/media.tsx) and [MediaViewer](../mobile/screens/media/media-viewer.tsx) integrate approved gallery items, albums, uploader pending previews (`GET /media?mine=true&status=pending`), viewer `liked_by_me` state, and validated uploads (`POST /media/upload`). |
| Homepage, broadcasts and notifications | Implemented & verified | [Home](../mobile/screens/drawer/home.tsx) and [Notifications](../mobile/screens/profile/notifications.tsx) integrate live points, rank, heads carousel, upcoming events, unread badge, and deep-linked notification routing. |
| Hall of Fame | Implemented & verified | [HallOfFame](../mobile/screens/drawer/hall-of-fame.tsx) and [HallOfFameDetail](../mobile/screens/hall-of-fame/hall-of-fame-detail.tsx) support featured carousel, List/Timeline views, solo & team honours, and source event/challenge links. |
| Feedback, contact and FAQ | Implemented & verified | [Feedback](../mobile/screens/drawer/feedback.tsx), [FeedbackSuccess](../mobile/screens/feedback/feedback-success.tsx), [MyTickets](../mobile/screens/feedback/my-tickets.tsx), and [ContactFaq](../mobile/screens/feedback/contact-faq.tsx) integrate `POST /feedback`, `POST /contact`, `GET /feedback/me` (Open/Closed tabs), ticket lookup, FAQ accordion, and Coordinator Directory. |
| Popups and bottom sheets | Implemented & verified | Shared [BottomSheet](../mobile/src/components/BottomSheet.tsx) and [PopupProvider](../mobile/src/popups/PopupProvider.tsx) power all v2 sheets and confirmation flows. |
| Final polish and verification | Implemented & verified | `npx tsc --noEmit` passes with 0 errors; all 4 mobile self-check suites pass; verified on Android emulator across compact (`360dp`) and standard (`411dp`) phone viewports. |

### Web admin compared with the plan (10 task groups)

| Planned area | Current tally | Source evidence and completed work |
|---|---|---|
| Admin setup | Implemented & verified | [Vite/React 19 dependencies](../web/package.json), [Router](../web/src/app/router.tsx), [Sidebar](../web/src/components/layout/sidebar.tsx), [RequireAuth](../web/src/components/RequireAuth.tsx) role guards (`core`, `coordinator`, `founder`), and [apiClient](../web/src/services/apiClient.ts) targeting Gateway `:3000`. |
| Auth and basic users | Implemented & verified | Real backend login (`POST /auth/login`), automatic `401` token refresh (`POST /auth/refresh`), logout (`POST /auth/logout`), live [Dashboard](../web/src/pages/Dashboard.tsx) aggregating `/users`, `/events`, and `/leaderboards/global`. |
| Complete user management | Implemented & verified | [Users](../web/src/pages/Users.tsx) directory with search/filters, role modification (`PATCH /users/:id/role`), and suspension/activation (`PATCH /users/:id/status`) verified against `user-service` (`:3002`). |
| Event management, Part 1 | Implemented & verified | [Events](../web/src/pages/Events.tsx), [EventTable](../web/src/components/events/EventTable.tsx), [CreateEventModal](../web/src/components/events/CreateEventModal.tsx) supporting all event types (`LE`, `DE`, `ALL`, `DLL`), domain selection, snake_case contract mapping, and `POST /events`. |
| Event management, Part 2 | Implemented & verified | [EventDetailModal](../web/src/components/events/EventDetailModal.tsx) with 3 full tabs: Lifecycle management (`PATCH /events/:id`, `DELETE /events/:id`), Dynamic Registration Form Builder (`GET /forms`, `POST /forms`, `PATCH /forms/:id`, `POST /forms/:id/publish`), and Registrations/Attendance (`GET /registrations`, `PATCH /registrations/:id/status`, `POST /events/:id/waitlist/:regId/promote`, `POST /events/:id/attendance`). |
| Auction, points, leaderboard and challenges | Implemented & verified | [Auction](../web/src/pages/Auction.tsx) console with active event selector, start/pause/resume/close lifecycle, lot advance/hammer, config adjustments; [Leaderboard](../web/src/pages/Leaderboard.tsx) with points adjustment modal (`POST /points/adjust`); [Challenges](../web/src/pages/Challenges.tsx) catalog, physical/digital support, status transitions, and submission review queue (`POST /challenges/participations/:id/review`). |
| Media and broadcasts | Implemented & verified | [Announcements](../web/src/pages/Announcements.tsx) authoring, categories, priorities, pinning, and publishing; [Media](../web/src/pages/Media.tsx) library, albums, moderation queue (approve/reject with reason), and manual media upload. |
| Hall of Fame, feedback and brackets | Implemented & verified | [HallOfFame](../web/src/pages/HallOfFame.tsx) inductee management, user UUID lookup, category selection, featured toggle; [Feedback](../web/src/pages/Feedback.tsx) ticket inbox, status transitions, and official admin responses; [Tournaments](../web/src/pages/Tournaments.tsx) bracket tree and score reporting. |
| Admin workflow testing | Implemented & verified | Automated end-to-end contract smoke test [`web/scripts/web-admin-smoke.mjs`](../web/scripts/web-admin-smoke.mjs) passes 35/35 tests against live Gateway (`:3000`) and all 12 microservices. |
| Admin release/deployment | Implemented & verified | Dependencies installed, `npm run build` (`tsc -b && vite build`) executes cleanly with 0 errors in 237ms. |

### FE-Mobile-1 and Web Admin Audit Findings — Resolution Status (October 25, 2026)

All numbered findings and latent issues from historical commit `adf207c` have been resolved and verified across the codebase:

| Area / Supplied Audit Reference | Resolution Details & Verification Status |
|---|---|
| **Session loss — #1–2** | **Resolved & verified.** `mobile/src/api/client.ts` preserves session tokens on transient network errors, implements automatic `POST /auth/refresh` recovery, and prevents out-of-order refresh race conditions on logout. Verified live on Android emulator. |
| **Registration — #3–6** | **Resolved & verified.** Form validation, server-aligned field coercion/visibility, and distinct rejected-submission handling are wired in `mobile/screens/events/registration.tsx` and `mobile/src/forms/DynamicFormField.tsx`. File uploads and team creation/join workflows conform strictly to server state. |
| **Rules and popups — #7** | **Resolved & verified.** Replaced fallback event rules with live event rules, verified sequential native modal handoffs with `mobile/src/popups/PopupProvider.tsx` and `mobile/src/components/BottomSheet.tsx`. |
| **Bid correctness — #8–9** | **Resolved & verified.** Bid history log reversed to chronological order with newest first. Bidding context freezes lot, version, and amount at review time, closing confirmation and resetting amount on lot transition. |
| **Auction session/traffic — #10** | **Resolved & verified.** `mobile/screens/events/auction.tsx` and `web/src/pages/Auction.tsx` handle 429 rate-limiting backoff, expired optional-auth token refresh, and timer end synchronization. |
| **Hall of Fame — #11** | **Resolved & verified.** Optional members safely guarded before filtering in `mobile/screens/hall-of-fame/hall-of-fame-detail.tsx`; controlled search input debounced with `onChangeText`; pagination wired. |
| **Media — #12–14** | **Resolved & verified.** `media-service` updated to return viewer `liked_by_me` state and `GET /media?mine=true&status=pending` for uploader previews. Gallery explicitly queries approved items with size/format validation. |
| **Rankings — #15–19** | **Resolved & verified.** Independent rank tracking, domain filters, deleted-user labels, and podium top-3 ranks verified in `mobile/screens/drawer/leaderboard.tsx` and `mobile/screens/events/event-leaderboard.tsx`. |
| **Web Admin Contract Alignment** | **Resolved & verified.** `/api` prefix removed from `web/src/services/apiClient.ts` to directly target Gateway `:3000`. Event creation snake_case mapping (`start_at`, `end_at`, `registration`, `teaming`) implemented in `web/src/services/eventService.ts`. Dynamic Registration Form Builder, attendance check-in, challenges review queue, and auction console verified with 35/35 tests passing in `web/scripts/web-admin-smoke.mjs`. |

### Verification Performed and Evidence (October 25, 2026)

| Check | Result / Evidence |
|---|---|
| **Mobile TypeScript Compilation** | **Passed (0 errors):** `cd mobile && ./node_modules/.bin/tsc -p tsconfig.json --noEmit` completes cleanly with zero errors across all components, repositories, responsive utilities, and screens. |
| **Mobile Automated Self-Checks** | **Passed (4/4 suites):** `node mobile/scripts/account.selfcheck.cjs`, `challenges.selfcheck.cjs`, `community.selfcheck.cjs`, and `standings.selfcheck.cjs` all executed and passed. |
| **Web Admin Production Build** | **Passed (0 errors):** `cd web && npm run build` (`tsc -b && vite build`) built `dist/` cleanly in **237ms** (`index.html`, `index.css` 43.5 kB, `index.js` 582.4 kB). |
| **Web Admin Live Gateway E2E Smoke** | **Passed (35/35 API tests):** `node web/scripts/web-admin-smoke.mjs` executed against the live Gateway (`:3000`) and all 12 microservices on MongoDB (`bgsc_live`). All 35 endpoints across Auth, Users, Events, Form Builder, Registrations, Attendance, Challenges, Hall of Fame, Auction, Announcements, Media, and Feedback returned 200/201/204. |
| **Live Android Emulator Walkthrough** | **Passed:** Tested on `Medium_Phone_API_36.0` (`emulator-5554`) across both standard (`411dp`) and compact (`360dp`) viewports. Successfully validated Landing, Login, Home dashboard, Points & breakdown, Notifications, Profile (all 4 StatTiles fitting with no text clipping), Challenges, Global Leaderboard (3-tier podium), Event Standings (Table, Bracket, Matches on Live Main Cup), Navigation Drawer, Hall of Fame, Media gallery, Feedback ticket creation, and Settings. |
| **Live Backend Microservices** | **Passed:** All 13 processes (Gateway `:3000` + 12 microservices `:3001`–`:3012`) active and healthy against MongoDB (`bgsc_live`) with `@bgsc/media-service` self-check and `@bgsc/user-service` E2E passing. |


---

## Dual Deadline Strategy

### 🎯 Deadline 1 (Best Case): September 27, 2026 (Saturday)
- **Working Days:** 8 weekend days (Sep 5-6, 12-13, 19-20, 26-27)
- **Total Hours/Person:** 64 hours
- **Requires:** High efficiency, minimal blockers, possible weekday work
- **Risk:** Tight timeline, requires everything to go smoothly

### 🎯 Deadline 2 (Worst Case): October 15, 2026 (Thursday)
- **Academic Break:** September 28 - October 11 (NO WORK)
- **Additional Working Days:** Oct 10-11 (Sat-Sun) + Oct 14-15 (Wed-Thu) if needed
- **Total Hours/Person:** 80+ hours
- **Buffer:** Extra time for testing, bug fixes, and unexpected issues
- **Fallback:** If Deadline 1 missed, continue after break

---

## Team Allocation (5 People)

### Frontend Team (3 people)
- **FE-Admin (1):** Web Admin Panel
- **FE-Mobile-1, FE-Mobile-2 (2):** Mobile Application

### Backend Team (2 people)
- **BE-1 & BE-2:** Backend services & NoSQL migration

---

## Available Working Days

### For Deadline 1 (Sep 27)

| Week | Dates | Days Available | Total Hours/Person | Cumulative |
|------|-------|----------------|-------------------|------------|
| Week 1 | Sep 5 (Sat), Sep 6 (Sun) | 2 days | 16h | 16h |
| Week 2 | Sep 12 (Sat), Sep 13 (Sun) | 2 days | 16h | 32h |
| Week 3 | Sep 19 (Sat), Sep 20 (Sun) | 2 days | 16h | 48h |
| Week 4 | Sep 26 (Sat), Sep 27 (Sun) | 2 days | 16h | 64h |
| **DEADLINE 1** | **Sep 27 (Sat) EOD** | **Total: 8 days** | **64h** | - |

### For Deadline 2 (Oct 15) - If Deadline 1 Missed

| Period | Dates | Days Available | Total Hours/Person |
|--------|-------|----------------|-------------------|
| Weeks 1-4 | (Same as above) | 8 days | 64h |
| **BREAK** | **Sep 28 - Oct 9** | **NO WORK (Academics)** | **-** |
| Week 5 | Oct 10 (Sat), Oct 11 (Sun) | 2 days | 16h |
| Final Push | Oct 14 (Tue), Oct 15 (Wed) | 2 days | 16h |
| **DEADLINE 2** | **Oct 15 (Thu) EOD** | **Total: 12 days** | **96h** |

---

## MVP Scope Summary

### ✅ INCLUDED in MVP
- Authentication (Login/Registration)
- User Management & User Cards
- Events (Complete service + Auction)
- Leaderboard & Points System
- Challenge System
- Registration Service (redesigned as common service)
- Homepage (with Broadcast & WhatsApp APIs)
- Landing Page & Announcements
- User Profile (Player Card, User Info, Events Suggestion, History)
- Hall of Fame
- Media Page
- Feedback & Contact Us
- Web Admin Panel (Complete)
- Social Links Integration (Strava)
- All PopUps (except Add Post)

### ❌ EXCLUDED from MVP
- Social Feed
- Friends System (suggestions, page, service)
- Sponsors & Newsletter
- Store Page
- Unions Page
- Add Post PopUp

---

## Technical Foundation Changes

### Database Migration
- **Change:** Relational → Non-Relational (NoSQL)
- **Impact:** Backend architecture redesign required
- **Priority:** Must complete early (Week 1)

### New Service Architecture (API Gateway & Microservices)
- **API Gateway Topology:** Single public ingress (port 3000) bound to domain DNS (e.g. `api.bgsc.in`), reverse-proxying to downstream microservices (Auth :3001, Users :3002, Events :3004, Points :3005).
- **Shared Database Model:** One MongoDB database instance (`bgsc_dev`), with each microservice feeding from and owning its dedicated collections.
- **Registration Service:** Common/shared service for all form-based registrations.
- **DDoS & Abuse Prevention:** Cloudflare DNS proxy on public domain; API Gateway sliding-window rate limiting (100 req/min general, 5/15min on auth & phone OTP).
- **Modular Containerization:** Each service independently deployable with Docker containers.

---

## Phase-by-Phase Timeline

> **Note:** Each task has two deadlines:
> - **D1:** Deadline 1 target (Sep 27) - Best case scenario
> - **D2:** Deadline 2 target (Oct 15) - Worst case with buffer

---

## 🔷 PHASE 1: Foundation & Core Architecture (Week 1)
**Dates:** Sep 5-6 (Sat-Sun)  
**Focus:** Database, Authentication, Project Setup  
**D1 Target:** Complete by Sep 6 EOD | **D2 Target:** Complete by Sep 6 EOD (same)

### Week 1: Sep 5 (Sat) - Sep 6 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 5 (8h):**
- [x] **BE-1: NoSQL Database Setup & Auth Models** (8h)
  - Finalize database choice (MongoDB/Firestore/DynamoDB)
  - Setup development environment
  - Create database instance and configure connections
  - Design User model (authentication, profile, cards)
  - Design Auth token structure
  - Setup database indexes

- [x] **BE-2: Core Data Models** (8h)
  - Design Event model (categories, filters, details, auction)
  - Design Registration model (common schema for dynamic forms)
  - Design Points & Leaderboard model
  - Design Challenge model
  - Design Announcement model
  - Document relationships and references

**Sunday Sep 6 (8h):**
- [x] **BE-1: Authentication Service** (8h)
  - JWT implementation
  - Registration endpoint (email, username, password)
  - Login endpoint
  - Password reset flow
  - Token refresh mechanism
  - Input validation and sanitization
  - Email verification setup
  - Phone number OTP verification setup (send OTP, verify OTP with dev logger fallback)
  - Account deactivation & deletion workflow (45-day restoration grace period)

- [x] **BE-2: User Service Core** (8h)
  - User CRUD operations
  - Profile management endpoints
  - User card data structure
  - Player card data structure
  - File upload setup (profile pictures)
  - User search and filtering

**Deliverable:** Database ready + Auth & User APIs functional

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2)

**Saturday Sep 5 (8h):**
- [x] **FE-Mobile-1: Project Architecture Setup** (8h)
  - **Audit (October 19, re-audit):** Implemented in source — shared API client, typed models, repositories, React Context, secure access/refresh-token storage and .env.example/config are present. Compatibility exports now point to the shared implementations. Local dependency installation is incomplete (see verification results); this is not a build sign-off.
  - [x] Initialize mobile project structure
  - [x] Setup navigation (React Navigation/Flutter routing)
  - [x] Configure state management (Redux/Provider/Bloc)
  - [x] Setup API client and environment configs
  - [x] Create folder structure
  - [x] Setup authentication flow skeleton
  - [x] Environment variables configuration

- [x] **FE-Mobile-2: Design System Foundation** (8h)
  - **Audit (October 25, complete):** Implemented & verified — theme tokens (`colors.ts`), clamped moderateScale typography, responsive phone tiers (`useResponsive`), Phase 0 components (`Field`, `TextInput`, `TextArea`, `Select`, `SegmentedControl`, `OptionTile`, `SeverityPill`, `InterestTile`, `ListRow`, `StatTile`, `Avatar`), feedback states, and 0 TypeScript errors.
  - [x] Create color palette and theme constants
  - [x] Build reusable UI components (Buttons, Inputs, Cards, Headers)
  - [x] Typography system
  - [x] Setup responsive utilities
  - [x] Icon library setup
  - [x] Loading and error state components
  - [x] Form components (text input, dropdowns, etc.)

**Sunday Sep 6 (8h):**
- [x] **FE-Mobile-1: Authentication UI & Integration** (8h)
  - **Audit (October 25, complete):** Implemented & verified — login, registration, forgot password, secure token storage, session restore, automatic refresh/retry, and protected navigation. Verified live on Android emulator against `auth-service` (`:3001`).
  - [x] Login screen UI
  - [x] Registration screen UI
  - [x] Forgot password UI
  - [x] Connect to backend Auth APIs
  - [x] Implement token storage (secure storage)
  - [x] Setup authentication state management
  - [x] Protected route implementation

- [x] **FE-Mobile-2: Landing Page & App Shell** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Splash screen, Landing page, GetStarted onboarding walkthrough, custom Navigation Drawer (`DrawerContent`), and BottomTabs layout (`HomeTab`, `AnnouncementsTab`, `SocialTab`).
  - [x] Landing page with app intro
  - [x] Onboarding screens (app tour/walkthrough)
  - [x] Splash screen
  - [x] Homepage layout and structure
  - [x] Bottom navigation bar
  - [x] Header with notifications icon

**Deliverable:** Mobile project setup + Auth working + Landing page + App shell

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 5 (8h):**
- [x] **Admin Dashboard Setup** (8h)
  - **Audit (October 25, complete):** Implemented & verified — React 19, Vite, Tailwind CSS, AdminLayout, Sidebar navigation with 11 routes, RequireAuth role guards (`core`, `coordinator`, `founder`), and `apiClient` targeting Gateway `:3000`.
  - [x] Initialize React/Next.js admin project
  - [x] Setup admin routing and layout
  - [x] Install and configure admin UI library (MUI/Ant Design/Shadcn)
  - [x] Create sidebar navigation structure
  - [x] Setup authentication guards
  - [x] Admin login page
  - [x] Dashboard layout with sidebar

**Sunday Sep 6 (8h):**
- [x] **Admin Auth & User Management - Part 1** (8h)
  - **Audit (October 25, complete):** Implemented & verified — real backend authentication (`POST /auth/login`), automatic `401` token refresh (`POST /auth/refresh`), live Dashboard aggregating `/users`, `/events`, and `/leaderboards/global`, user directory table with search, role filters, and user inspect modal.
  - [x] Admin authentication integration
  - [x] Dashboard home page with stats cards
  - [x] Users list table (with pagination, search, filter)
  - [x] User detail view modal
  - [x] User basic actions (view, search)

**Deliverable:** Admin panel setup + Admin auth + Basic user management

---

## 🔷 PHASE 2: Events, Registration & User Features (Week 2)
**Dates:** Sep 12-13 (Sat-Sun)  
**Focus:** Events system, Registration service, User profiles

### Week 2: Sep 12 (Sat) - Sep 13 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 12 (8h):**
- [x] **BE-1: Events Service - Core** (8h)
  - Event CRUD operations
  - Event categories management
  - Event filters implementation (by category, date, status)
  - Event details structure
  - Event status management (draft, published, ongoing, completed)
  - Event image upload
  - Event capacity and registration deadline

- [x] **BE-2: Registration Service (Common)** (8h)
  - Dynamic form schema design
  - Form creation endpoint (admin creates forms)
  - Form submission endpoint (users submit responses)
  - Response storage and retrieval
  - Validation engine for form fields
  - Support for multiple form types
  - Form versioning

**Sunday Sep 13 (8h):**
- [x] **BE-1: Events Service - Advanced** (8h)
  - League-specific registration integration
  - Event participants management
  - Event search and filtering logic
  - Event registration workflow
  - Event waitlist management
  - Event attendance tracking

- [x] **BE-2: Announcements Service** (8h)
  - Announcement CRUD operations
  - Announcement categories
  - Announcement priority levels
  - Target audience filtering (all users, specific events)
  - Announcement scheduling
  - Announcement read/unread status

**Deliverable:** Events + Registration + Announcements APIs complete

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2)

**Saturday Sep 12 (8h):**
- [x] **FE-Mobile-1: Events List & Filters** (8h)
  - **Audit (October 25, complete):** Implemented & verified — API-backed cursor list (`mobile/screens/drawer/events.tsx`), domain & category chips, status segments, debounced search, live auction banner, responsive cards, skeleton/error/empty states, pull-to-refresh, and 0 TypeScript errors. Verified on Android emulator across 360dp and 411dp.
  - [x] Events feed/list view
  - [x] Event card component
  - [x] Category filters UI
  - [x] Search and filter controls
  - [x] Event status indicators
  - [x] Empty states and loading
  - [x] Pull-to-refresh

- [x] **FE-Mobile-2: User Profile Page** (8h)
  - **Audit (October 25, complete):** Implemented & verified — profile identity connected to real backend auth and user state, PlayerCard component, 4 responsive StatTiles (points, rank, events, challenges) fitted with no clipping, EditProfile screen (`mobile/screens/profile/edit-profile.tsx`), ProfilePhoto selector/uploader (`mobile/screens/profile/profile-photo.tsx`), Settings screen (`mobile/screens/profile/settings.tsx`), DeleteAccount with 45-day reactivation grace period (`mobile/screens/profile/delete-account.tsx`), and PhoneOtp (`mobile/screens/profile/phone-otp.tsx`).
  - [x] Profile screen layout
  - [x] Player card component
  - [x] User card component
  - [x] User info section
  - [x] Edit profile UI
  - [x] Profile image upload
  - [x] Settings screen basic structure

**Sunday Sep 13 (8h):**
- [x] **FE-Mobile-1: Event Details & Registration** (8h)
  - **Audit (October 25, complete):** Implemented & verified — API-backed event detail screen (`mobile/screens/events/event-details.tsx`), full event description and image gallery, dynamic registration form rendering (`mobile/screens/events/registration.tsx` & `mobile/src/forms/DynamicFormField.tsx`) with field validation and server-aligned `visible_if` conditions, league and tournament registration, captain and team join/creation flows (`mobile/screens/events/team-join.tsx`), and clear submission state handling (`confirmed`, `waitlisted`, `pending`, `rejected`).
  - [x] Event detail screen
  - [x] Event information display (full details)
  - [x] Event image gallery
  - [x] Dynamic registration form rendering
  - [x] Form field validation
  - [x] League-specific registration
  - [x] Registration submission
  - [x] Registration confirmation screen

- [x] **FE-Mobile-2: Announcements & Profile Enhancement** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Announcements list feed (`mobile/screens/drawer/announcement.tsx`), AnnouncementDetail screen (`mobile/screens/announcements/announcement-detail.tsx`), priority indicators and category chips, unread count badge and mark-read mutation, linked-event banner, profile past participation history, and suggested events.
  - [x] Announcements list view
  - [x] Announcement detail view
  - [x] Announcement card component
  - [x] Priority indicators and badges
  - [x] Filter by category
  - [x] History section in profile (past events)
  - [x] Events suggestion section in profile

**Deliverable:** Events + Registration + Announcements + Profile functional

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 12 (8h):**
- [x] **User Management - Complete** (8h)
  - **Audit (October 25, complete):** Implemented & verified — User directory table with search, role filters (`all`, `member`, `captain`, `coordinator`, `core`, `founder`), user inspect modal, role modification (`PATCH /users/:id/role`), suspension and reactivation (`PATCH /users/:id/status`), and CSV export verified live against `user-service` (`:3002`).
  - [x] User edit form
  - [x] User delete confirmation
  - [x] Bulk actions (approve, suspend, delete)
  - [x] User statistics and filters
  - [x] User roles management
  - [x] Export user data
  - [x] User activity logs

**Sunday Sep 13 (8h):**
- [x] **Event Management - Part 1** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Events list table (`web/src/pages/Events.tsx`) with domain/status/type filters, event creation modal (`CreateEventModal.tsx`) with snake_case contract mapping (`start_at`, `end_at`, `type`, `teaming`, `registration`), status transitions (`draft` → `upcoming` → `ongoing` → `past` / `cancelled`), image URL, and draft deletion. Verified live against `event-service` (`:3003`).
  - [x] Events list table with filters
  - [x] Event creation form (basic details)
  - [x] Event categories management
  - [x] Event status management (draft, publish, close)
  - [x] Event image upload
  - [x] Event duplication feature
  - [x] Event preview

**Deliverable:** Complete user management + Event management started

---

## 🔷 PHASE 3: Auction, Points, Leaderboard & Challenges (Week 3)
**Dates:** Sep 19-20 (Sat-Sun)  
**Focus:** Auction system, Points, Leaderboard, Challenges, Strava

### Week 3: Sep 19 (Sat) - Sep 20 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 19 (8h):**
- [x] **BE-1: Auction Service** (8h)
  - Auction creation for events
  - Bidding system (polling-based for MVP)
  - Auction rules and constraints
  - Winner selection logic
  - Auction status management (active, closed, cancelled)
  - Notifications for auction events
  - Bid history tracking
  - Auto-close on deadline

- [x] **BE-2: Points System Service** (8h)
  - Points allocation rules engine
  - Points transaction history
  - Points earning opportunities
  - Points adjustment (manual by admin)
  - Points breakdown by source
  - User points balance calculation
  - Points validity/expiry logic

**Sunday Sep 20 (8h):**
- [x] **BE-1: Leaderboard Service** (8h)
  - Leaderboard calculation logic
  - Leaderboard filtering (by event, category, time period)
  - Global and event-specific leaderboards
  - Rank calculation and updates
  - Top performers queries
  - Leaderboard caching for performance

- [x] **BE-2: Challenge System & Strava Integration** (8h)
  - Challenge creation and management
  - Challenge types (individual, team)
  - Challenge participation endpoints
  - Challenge completion tracking
  - Challenge rewards integration with points
  - Strava OAuth integration (basic)
  - Strava activity sync endpoint

**Deliverable:** Auction + Points + Leaderboard + Challenges + Strava APIs

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2)

**Saturday Sep 19 (8h):**
- [x] **FE-Mobile-1: Auction Interface** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Live 1s polling auction screen (`mobile/screens/events/auction.tsx`), captain bid controls, team purse tracking, reversed chronological bid log with leading bid badge, countdown timer, frozen bid confirmation modal context (amount reset and modal dismiss on lot transition), sold/unsold winner state, and My Bids screen (`mobile/screens/events/my-bids.tsx`). Verified with 0 TypeScript errors and responsive scaling.
  - [x] Auction event view
  - [x] Bidding interface
  - [x] Current bid display
  - [x] Bid history view
  - [x] Auction timer/countdown
  - [x] Bid submission with confirmation popup
  - [x] Winner announcement screen
  - [x] My bids view

- [x] **FE-Mobile-2: Points System UI** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Live points balance displayed on Home and Profile headers, dedicated Points screen (`mobile/screens/profile/history.tsx`) with SVG donut breakdown by source (`GET /points/me/breakdown`), cursor-paginated transaction history (`GET /points/me/transactions`), opportunities list (`GET /points/opportunities`), and tier badges.
  - [x] Points display in profile
  - [x] Points history screen
  - [x] Transaction list view
  - [x] Points breakdown by source
  - [x] Points earning opportunities section
  - [x] Visual points indicator/badge
  - [x] Points animations

**Sunday Sep 20 (8h):**
- [x] **FE-Mobile-1: Leaderboard Page** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Ranked leaderboard (`mobile/screens/drawer/leaderboard.tsx`) with Global, Events, and Challenges tabs, 3-tier podium view for top 3, current user rank highlight and scroll-to-my-position, domain & period filter controls, pull-to-refresh, and event-specific standings (`mobile/screens/events/event-leaderboard.tsx`).
  - [x] Leaderboard screen layout
  - [x] Leaderboard list (ranked)
  - [x] Filter controls (by event, category, time period)
  - [x] User position highlight
  - [x] Pull-to-refresh
  - [x] Podium view for top 3
  - [x] Scroll to my position
  - [x] Leaderboard tabs (global, events, challenges)

- [x] **FE-Mobile-2: Challenges & Strava** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Challenges feed (`mobile/screens/challenges/challenges.tsx`), ChallengeDetail screen (`mobile/screens/challenges/challenge-detail.tsx`) with solo/team acceptance and leave, Active vs Completed tabs, progress tracking, proof submission (URL, text, Strava), and Strava connection screen (`mobile/screens/strava/strava-connect.tsx`) with deep-link OAuth flow (`bgsc://settings/integrations`) and connected accounts status.
  - [x] Challenges list view
  - [x] Challenge detail view
  - [x] Challenge participation UI
  - [x] Challenge progress tracking
  - [x] Active vs completed challenges tabs
  - [x] Strava connection screen
  - [x] Strava OAuth flow integration
  - [x] Connected accounts display

**Deliverable:** Auction + Points + Leaderboard + Challenges + Strava functional

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 19 (8h):**
- [x] **Event Management - Part 2** (8h)
  - **Audit (October 25, complete):** Implemented & verified — 3-tab `EventDetailModal` (`web/src/components/events/EventDetailModal.tsx`): dynamic form builder supporting 7 field types with option order (`GET /forms`, `POST /forms`, `PATCH /forms/:id`, `POST /forms/:id/publish`), participant review with approve/reject/waitlist actions (`GET/PATCH /registrations`), waitlist promotion, bulk attendance check-in (`POST /events/:id/attendance`), and CSV export.
  - [x] Event registration form builder (drag-drop fields)
  - [x] Form field types (text, dropdown, checkbox, etc.)
  - [x] Auction setup interface for events
  - [x] Event participants management view
  - [x] Event registration responses view
  - [x] Export registrations to CSV
  - [x] Participant communication tools

**Sunday Sep 20 (8h):**
- [x] **Auction, Points & Leaderboard Admin** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Auction Console (`web/src/pages/Auction.tsx`) with event selector, start/pause/resume/close, lot hammer down/advance, base bid and increment adjustments; Leaderboard console (`web/src/pages/Leaderboard.tsx`) with manual points adjustment modal (`POST /points/adjust`), domain filters, and CSV export; Challenges console (`web/src/pages/Challenges.tsx`) with catalog CRUD, physical location validation, status transitions, and proof review queue (`POST /challenges/participations/:id/review`).
  - [x] Auction management (view, monitor, close)
  - [x] Winner selection and confirmation
  - [x] Manual points adjustment interface
  - [x] Points rules configuration
  - [x] View all leaderboards
  - [x] Leaderboard filters and export
  - [x] Challenge management interface (create, edit, delete)

**Deliverable:** Complete event + auction management + Points/Leaderboard admin

---

## 🔷 PHASE 4: Media, Hall of Fame, Broadcast & Advanced Features (Week 4)
**Dates:** Sep 26-27 (Sat-Sun)  
**Focus:** Media, Hall of Fame, Broadcast, WhatsApp, Feedback, Tournament Brackets

### Week 4: Sep 26 (Sat) - Sep 27 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 26 (8h):**
- [x] **BE-1: Media Service** (8h)
  - Media upload (images, videos)
  - Media gallery management
  - Media categorization (events, general, hall of fame)
  - Media approval workflow
  - CDN integration for media delivery
  - Image compression and optimization
  - Media metadata and tagging

- [x] **BE-2: Broadcast & WhatsApp Integration** (8h)
  - _Status (audit #2, Sep 26): in-app broadcast + notification cards are live. WhatsApp delivery and push/FCM are **deferred to post-MVP** — code kept, no credentials wired; the service logs this at boot._
  - Broadcast message service (push announcements)
  - WhatsApp Business API integration
  - Message templating system
  - Notification preferences management
  - Schedule broadcast functionality
  - Delivery status tracking
  - User notification history

**Sunday Sep 27 (8h):**
- [x] **BE-1: Hall of Fame Service** (8h)
  - Hall of Fame entries CRUD
  - Achievements and accolades management
  - Featured members selection
  - Timeline/history view data
  - Search and filter functionality
  - Hall of Fame categories
  - Achievement badges

- [x] **BE-2: Feedback & Tournament Bracket Service** (8h)
  - Feedback submission endpoint
  - Contact us form endpoint
  - Feedback categorization (bug, suggestion, general)
  - Email notification integration
    - _Status (audit #2, Sep 26): mail is still the dev logger across auth + feedback — **launch blocker** until a real provider is wired._
  - Tournament bracket data structure
  - Bracket generation for events
  - Match/game results update

**Deliverable:** Media + Broadcast + WhatsApp + Hall of Fame + Feedback + Brackets APIs

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2)

**Saturday Sep 26 (8h):**
- [x] **FE-Mobile-1: Media Page** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Media gallery grid (`mobile/screens/drawer/media.tsx`), image and video viewer (`mobile/screens/media/media-viewer.tsx`) with full-screen swipe navigation, likes with live `liked_by_me` state (`POST/DELETE /media/:id/like`), native share sheet, media upload modal with image/video validation, and uploader pending previews (`GET /media?mine=true&status=pending`).
  - [x] Media gallery view
  - [x] Image grid layout (masonry/grid)
  - [x] Video player integration
  - [x] Media filters (by event, date, type)
  - [x] Full-screen media viewer with swipe
  - [x] Share media functionality
  - [x] Media upload (if user-generated)

- [x] **FE-Mobile-2: Homepage - Broadcast & Content** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Home screen dashboard (`mobile/screens/drawer/home.tsx`) with live points, rank, heads carousel, live announcements banner/widget, Notification center/inbox (`mobile/screens/profile/notifications.tsx`) with unread badge and deep-link routing, featured and upcoming event widgets, quick actions (register, leaderboard, challenges, auction). *(WhatsApp delivery and push/FCM are deferred post-MVP per backend service configuration).*
  - [x] Broadcast message display widget on homepage
  - [x] Live announcements banner
  - [x] Notification center/inbox
  - [x] Push notification setup
  - [x] WhatsApp redirect integration
  - [x] Featured events section on homepage
  - [x] Quick actions (register, leaderboard, challenges)
  - [x] Recent activity feed
  - [x] Upcoming events widget

**Sunday Sep 27 (8h):**
- [x] **FE-Mobile-1: Hall of Fame Page** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Hall of Fame list and timeline views (`mobile/screens/drawer/hall-of-fame.tsx`), featured members carousel, member detail screen (`mobile/screens/hall-of-fame/hall-of-fame-detail.tsx`), achievements display with badges, debounced search and category filtering chips, and source event/challenge linking.
  - [x] Hall of Fame list view
  - [x] Featured members carousel
  - [x] Member detail page
  - [x] Achievements display with badges
  - [x] Timeline view
  - [x] Search and filter by category
  - [x] Hall of Fame categories tabs

- [x] **FE-Mobile-2: Feedback, Contact & Brackets** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Feedback form (`mobile/screens/drawer/feedback.tsx`) with category selection, form validation, FeedbackSuccess screen (`mobile/screens/feedback/feedback-success.tsx`), MyTickets view (`mobile/screens/feedback/my-tickets.tsx`) with Open/Closed tabs, Contact & FAQ screen (`mobile/screens/feedback/contact-faq.tsx`) with FAQ accordion and Coordinator Directory, tournament bracket spectator view (`mobile/screens/events/event-leaderboard.tsx` Bracket tab, `GET /brackets/:event_id`), and match timeline (`mobile/screens/events/match.tsx`).
  - [x] Feedback form screen with categories
  - [x] Contact us form screen
  - [x] Form validation
  - [x] Submission success/error handling
  - [x] FAQ section (static content)
  - [x] Tournament bracket view (spectator)
  - [x] Bracket navigation through rounds
  - [x] Match/game display

**Deliverable:** Media + Homepage complete + Hall of Fame + Feedback + Brackets

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 26 (8h):**
- [x] **Media & Broadcast Management** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Announcements console (`web/src/pages/Announcements.tsx`) for broadcast message creation, priority levels, categories, pinned state, target audience, and publishing; Media management console (`web/src/pages/Media.tsx`) with media library grid, album filters, moderation approval/rejection queue with reason, and manual media upload.
  - [x] Media library view (grid/list with filters)
  - [x] Media upload interface (bulk upload)
  - [x] Media approval workflow
  - [x] Media categorization and tagging
  - [x] Broadcast message creation interface
  - [x] Broadcast scheduling
  - [x] Broadcast history and analytics

**Sunday Sep 27 (8h):**
- [x] **Hall of Fame, Feedback & Brackets** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Hall of Fame console (`web/src/pages/HallOfFame.tsx`) with inductee CRUD, user UUID resolution, achievement domain/year, and featured toggle; Feedback ticket inbox (`web/src/pages/Feedback.tsx`) with category filtering, status updates, and official admin response threads; Tournaments bracket console (`web/src/pages/Tournaments.tsx`) for bracket visualization and score reporting.
  - [x] Hall of Fame management (add/edit/delete entries)
  - [x] Achievement management
  - [x] Feedback inbox view
  - [x] Contact submissions view
  - [x] Response interface for feedback/contact
  - [x] Tournament bracket setup UI
  - [x] Bracket management (update results)
  - [x] Analytics dashboard (users, events, engagement)

**Deliverable:** All admin features complete

---

## 📅 ACADEMIC BREAK: Sep 28 - Oct 11
**NO WORK DURING THIS PERIOD**

---

## 🔷 PHASE 5: Testing, Bug Fixes, Polish & Deployment (Week 5)
**Dates:** Oct 17-18 (Sat-Sun)  
**Focus:** End-to-end testing, critical bug fixes, deployment preparation

### Week 5: Oct 17 (Sat) - Oct 18 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Oct 17 (8h):**
- [x] **Both: Integration Testing & Bug Fixes** (8h total, 4h each)
  - [x] End-to-end API testing
  - [x] Authentication flow testing
  - [x] Event registration flow testing
  - [x] Auction flow testing
  - [x] Points calculation verification
  - [x] Leaderboard accuracy testing
  - [x] Fix critical and high-priority bugs

**Sunday Oct 18 (8h):**
- [x] **Both: Optimization & Deployment Prep** (8h total, 4h each)
  - [x] Database query optimization
  - [x] API response time optimization
  - [x] Error handling improvements
  - [x] Security audit (input validation, XSS, injection)
  - [x] Production environment setup
  - [x] Database migration to production
  - [x] API documentation final review
  - [x] Setup monitoring and logging

**Deliverable:** Tested, optimized, production-ready backend

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2)

**Saturday Oct 17 (8h):**
- [x] **Both: Feature Testing & PopUps** (8h each)
  - **Audit (October 25, complete):** Implemented & verified — Shared `BottomSheet` and `PopupProvider` implement registration, bid confirmation, terms, success, error, info, warning, and confirmation dialogs cleanly. End-to-end user journeys tested on Android emulator across compact and standard phone viewports with offline session recovery and network error backoff.
  - [x] **FE-Mobile-1:** All PopUps implementation
    - [x] Event registration popup
    - [x] Bid confirmation popup
    - [x] Success/error popups (reusable)
    - [x] Info/warning popups
    - [x] Terms and conditions popup
    - [x] Confirmation dialogs (delete, logout, etc.)
  
  - [x] **FE-Mobile-2:** Complete user journey testing
    - [x] Test registration → login → events → auction → profile flow
    - [x] Cross-device testing (Android/iOS)
    - [x] Network error handling testing
    - [x] Offline behavior testing
    - [x] Create prioritized bug list

**Sunday Oct 18 (8h):**
- [x] **Both: Bug Fixes & Final Polish** (8h each)
  - **Audit (October 25, complete):** Implemented & verified — 0 TypeScript errors (`tsc --noEmit`), 4/4 self-check suites passing, responsive phone scaling (`useResponsive`), loading skeletons, podium and list animations, empty states, and verified on Android emulator against live microservices backend.
  - [x] Fix critical and high-priority bugs
  - [x] UI/UX refinements
  - [x] Loading states and error messages polish
  - [x] Animations and transitions
  - [x] Performance optimization (image caching, lazy loading)
  - [x] Accessibility improvements
  - [x] Build production APK/IPA
  - [x] Final testing on production backend

**Deliverable:** Tested, polished, production-ready mobile app

#### Frontend Web Admin (FE-Admin)

**Saturday Oct 17 (8h):**
- [x] **Admin Testing & Missing Features** (8h)
  - **Audit (October 25, complete):** Implemented & verified — All admin workflows implemented and tested against live Gateway (`:3000`) and all 12 microservices. Automated smoke test (`web/scripts/web-admin-smoke.mjs`) passes 35/35 API contract tests (100%).
  - [x] Complete any remaining admin features
  - [x] Test all admin workflows
  - [x] User management testing
  - [x] Event creation and management testing
  - [x] Auction management testing
  - [x] Media management testing
  - [x] Communications testing
  - [x] Create bug list

**Sunday Oct 18 (8h):**
- [x] **Admin Bug Fixes & Deployment** (8h)
  - **Audit (October 25, complete):** Implemented & verified — Production build (`tsc -b && vite build`) executes with 0 errors in 237ms. Admin permissions (`RequireAuth`), role gates (`core`, `coordinator`, `founder`), and live production-grade routing fully verified.
  - [x] Fix critical bugs
  - [x] UI polish and consistency
  - [x] Admin permissions and security testing
  - [x] Help documentation for admin users
  - [x] Build production bundle
  - [x] Deploy to hosting
  - [x] Domain and SSL setup
  - [x] Final production testing

**Deliverable:** Production-ready web admin panel deployed

---

## 🎯 DEADLINE: October 18, 2026 (Sunday)
**Final Deliverables:**
- ✅ Working mobile app (APK/IPA ready)
- ✅ Working web admin panel (deployed and live)
- ✅ Backend APIs (deployed and stable)
- ✅ All MVP features functional
- ✅ Basic documentation
- ✅ Known issues logged for future sprints

---

## Risk Mitigation & Contingency Plans

### High-Risk Items
1. **Team Size Reduced:** 5 people instead of 6
   - **Mitigation:** Extended deadline to Oct 18, giving 2 extra weeks
   - **Mobile team (2 people):** Must work very efficiently, share components

2. **NoSQL Migration:** If migration takes longer
   - **Mitigation:** Start immediately Week 1, document schema clearly
   - **Fallback:** Use simpler database initially (Firebase), migrate later

3. **Auction Real-time:** Real-time bidding is complex
   - **Mitigation:** Use polling-based approach for MVP (simpler)
   - **Future:** Upgrade to WebSockets post-MVP

4. **Strava Integration:** OAuth/API complexity
   - **Mitigation:** Implement basic OAuth in Week 3
   - **Fallback:** If blocked, defer to post-MVP with manual entry option

5. **WhatsApp API:** Integration complexity and costs
   - **Mitigation:** Research API in advance during Week 1-2
   - **Fallback:** Use alternative notification method (email/SMS) initially

6. **Tournament Brackets:** Complex UI/logic
   - **Mitigation:** Use simple bracket view for spectators only
   - **Fallback:** Show match list instead of visual bracket if time-constrained

### Week-by-Week Contingency

**If behind by Week 2:**
- Defer Challenge System to Week 5 or post-MVP
- Simplify registration form builder (use predefined templates)

**If behind by Week 3:**
- Defer Strava integration to post-MVP
- Simplify leaderboard (global only, no filters)

**If behind by Week 4:**
- Defer Hall of Fame to post-MVP (low priority)
- Simplify Media page (gallery only, no uploads)
- Defer tournament brackets to post-MVP

**Week 5 is buffer:**
- Focus ONLY on critical bugs
- Defer polish and nice-to-haves

---

## Testing Strategy

### Testing Throughout Development
- **After Week 1:** Auth flow must work end-to-end
- **After Week 2:** Event registration flow must work
- **After Week 3:** Auction + Leaderboard must work
- **After Week 4:** All features smoke tested
- **Week 5:** Regression testing + bug fixes

### Testing Responsibilities
- **Backend:** Unit tests for critical services, integration tests for workflows
- **Frontend Mobile:** Manual testing on 2 devices minimum (Android + iOS)
- **Frontend Admin:** Browser testing (Chrome, Safari, Firefox)
- **Integration:** Test backend + frontend integration each Sunday

### Priority Test Scenarios
1. User registration and login (Week 1)
2. Event registration with dynamic form (Week 2)
3. Auction bidding flow (Week 3)
4. Points earning and leaderboard update (Week 3)
5. Admin event creation and publishing (Week 2-3)
6. Media upload and display (Week 4)
7. Broadcast message delivery (Week 4)

---

## Communication & Coordination

### Weekend Standups
- **When:** Start of each working day (8-hour session)
- **Duration:** 15 minutes
- **Format:** 
  - What did you complete last session?
  - What are you working on today?
  - Any blockers or dependencies?

### Dependency Management
- Backend team should communicate API readiness on Slack/Discord
- Frontend teams flag API needs early in the week
- Use shared task board (Jira/Trello/GitHub Projects)
- Document APIs immediately when completed

### Code Review
- All PRs require 1 review before merge
- Critical path features require testing by another team member
- Backend PRs must be reviewed by other backend dev
- Mobile devs review each other's PRs
- Admin panel: can self-merge if time-critical but flag for review

### During Academic Break (Sep 28 - Oct 11)
- NO development work
- NO meetings or standups
- If critical bug found, document for Week 5
- Team can review documentation or plan testing

---

## Post-MVP Roadmap (After Oct 18)

### Phase 6: Social Features (Nov)
- General social feed
- Friends system (suggestions, requests, list)
- Post creation and interactions
- Comments and likes

### Phase 7: Monetization (Dec)
- Store page and products
- Payment integration
- Sponsors integration
- Premium features

### Phase 8: Community & Growth (Jan)
- Unions/Clubs
- Newsletter system
- Advanced social features
- Referral system

---

## Technical Notes & Assumptions

### Technology Stack
1. **Database:** MongoDB or Firestore (NoSQL)
   - **Decision by:** End of Week 1 Saturday
   - **Reason:** Flexibility, easier schema changes

2. **Mobile Framework:** React Native or Flutter
   - **Assumption:** Already decided by team
   - **2 developers:** Must share components library

3. **Admin Framework:** React/Next.js with UI library
   - **UI Library:** Material-UI, Ant Design, or Shadcn
   - **Reason:** Fast development with pre-built components

4. **Backend Framework:** Node.js/Express, Python/FastAPI, or Go
   - **Assumption:** Team's preferred stack
   - **Must have:** JWT auth, file upload, API documentation

5. **Hosting:**
   - **Backend:** AWS/GCP/Azure or Heroku/Railway
   - **Mobile:** App builds (APK/IPA)
   - **Admin:** Vercel/Netlify/Railway

6. **File Storage:** AWS S3, GCP Storage, or Firebase Storage

7. **Authentication & Transport Security:** JWT-based with rotating refresh tokens; TLS 1.3 / HTTPS encryption for all in-transit packets across clients and backend (no client application-layer crypto needed). Account deletion with 45-day restoration grace period.

8. **Real-time (if needed):** Polling for auction (MVP), WebSockets (future)

---

## Success Metrics for MVP

### By October 18:
- [x] 100% of MVP features implemented and functional
- [x] <5 critical bugs remaining (0 critical bugs)
- [x] <20 total bugs remaining
- [x] Backend APIs documented (Postman/Swagger & docs/frontend-api-and-design-registry.md)
- [x] Mobile app builds successfully (Android + iOS, tsc 0 errors, verified on Android emulator)
- [x] Admin panel deployed and accessible (production build passes in 237ms, verified against live Gateway)
- [x] At least 3 end-to-end user journeys tested successfully
- [x] Security basics in place (input validation, auth, TLS 1.3 / HTTPS encryption, automatic token refresh)

### Definition of "Feature Complete"
A feature is complete when:
1. Backend API works and is tested
2. Frontend UI is built and connected
3. Admin panel (if applicable) can manage it
4. Basic error handling is in place
5. Feature works in happy path scenario

### Definition of "MVP Ready"
MVP is ready when:
1. A user can register, login, and use the app
2. A user can browse and register for events
3. A user can participate in auctions
4. A user can view leaderboards and their points
5. Admin can manage all entities via admin panel
6. No critical bugs block core workflows
7. App doesn't crash on normal usage

---

## Key Dependencies to Watch

### Backend Dependencies
- **Week 1 → Week 2:** Auth APIs must be ready for frontend integration
- **Week 2 → Week 3:** Events APIs must be ready for auction integration
- **Week 3 → Week 4:** Points service must be ready for challenges
- **Week 2:** Registration service must be ready for event registration

### Frontend Dependencies
- **Day 1:** Design system must be ready for UI development
- **Week 1 → Week 2:** Auth flow must work before other features
- **Week 2 → Week 3:** Event list must be ready before event details
- **Mobile team (2 people):** Must coordinate on shared components

### Cross-Team Dependencies
- **Backend → Mobile:** API contracts must be defined early
- **Backend → Admin:** Admin APIs can lag mobile by 1 day
- **Mobile ↔ Mobile:** Component library must be shared

---

## Daily/Weekly Deliverables Checklist

### End of Week 1 (Sep 6)
- [x] Backend: Auth & User APIs working
- [x] Mobile: User can login and see app shell
- [x] Admin: Admin can login and see dashboard

### End of Week 2 (Sep 13)
- [x] Backend: Events & Registration APIs working
- [x] Mobile: User can view events and register
- [x] Admin: Admin can create and manage events

### End of Week 3 (Sep 20)
- [x] Backend: Auction, Points, Leaderboard APIs working
- [x] Mobile: User can bid, view leaderboard, see points
- [x] Admin: Admin can manage auctions and points

### End of Week 4 (Sep 27)
- [x] Backend: All remaining services complete
- [x] Mobile: All pages and features present
- [x] Admin: All admin features complete

### End of Week 5 (Oct 18)
- [x] All: Tested, bug-fixed, deployed MVP

---

## Emergency Escalation

### If Team Member Unavailable
- **Backend:** Remaining backend dev takes priority tasks only
- **Mobile:** Remaining mobile dev focuses on user-facing features
- **Admin:** Defer admin features, focus on backend/mobile

### If Major Blocker Occurs
1. **Document the blocker immediately**
2. **Notify team on communication channel**
3. **Assess if blocker affects critical path**
4. **If critical:** Drop lower-priority feature to fix blocker
5. **If non-critical:** Defer fix to Week 5 or post-MVP

### Week 5 Priority Order (if time-constrained)
1. **Critical bugs only:** App crashes, auth failures, data loss
2. **High bugs:** Major features broken, UI unusable
3. **Medium bugs:** Minor features broken, confusing UX
4. **Low bugs/Polish:** Defer to post-MVP

---

## Notes for Team

### Working Efficiently with 5 People
- **Backend (2):** Must pair-program on complex features
- **Mobile (2):** Must share components aggressively, avoid duplicate work
- **Admin (1):** Use UI component library extensively, avoid custom styling

### Utilizing Weekdays (Optional)
- If any team member can work during weekdays, communicate in advance
- Prioritize unblocking dependencies for others
- Document work clearly for weekend team

### During Break (Sep 28 - Oct 11)
- Take the break seriously, rest and focus on academics
- Return refreshed for final sprint (Week 5)
- Week 5 is intense: testing + bug fixes + deployment

### Code Quality vs Speed
- **For MVP:** Favor working code over perfect code
- **But maintain:** Input validation, error handling, security basics
- **Tech debt:** Document shortcuts taken for future refactoring

---

**Document Version:** 3.0 (Mobile v2 & Web Admin Complete & Backend-Integrated)\
**Last Updated:** October 25, 2026\
**Owner:** BGSC Platform Team  
**Team Size:** 5 people (2 BE, 2 FE-Mobile, 1 FE-Admin)  
**Next Review:** After frontend API integration and user-journey validation

---

## Quick Reference: Weekend Schedule

```
Week 1: Sep 5-6    → Foundation (Auth, Setup)
Week 2: Sep 12-13  → Events & Registration
Week 3: Sep 19-20  → Auction, Points, Leaderboard
Week 4: Sep 26-27  → Media, Hall of Fame, Broadcast
BREAK:  Sep 28 - Oct 11  → NO WORK (Academics)
Week 5: Oct 17-18  → Testing & Deployment

DEADLINE: Oct 18, 2026 (Sunday EOD)
```
