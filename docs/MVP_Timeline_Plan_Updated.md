# BGSC Platform - MVP Timeline Plan (Dual Deadline)
**Start Date:** September 5, 2026 (Friday)  
**Working Schedule:** Saturdays & Sundays, 8 hours/day (weekday work optional)

## Frontend Implementation Tally — October 19, 2026 (Re-audit)

**Source baseline:** `1ce56b8`, including FE-Mobile-1 commit `adf207c` (PR #62) and web-admin progress through `7357a80`. This section replaces the earlier tally; the previous descriptions of mobile mock authentication, in-memory registrations, absent media/Hall of Fame screens and placeholder web Events are obsolete.

**Scope:** Current `mobile/` and `web/` source, the [FE-Mobile-1 commit audit](fe-mobile-1-commit-audit.md), and the [FE1 checklist](../mobile/FE1_CHECKLIST.md). `Legacy/` and `docs/Legacy/` are excluded from inspection and edits. Backend task statuses and the original schedule are preserved. No application source was changed for this audit.

**Status rules:** **Implemented in source** means code/UI exists; **wired / defects / unverified** means API calls exist but known issues or missing live tests block completion; **partial** means requirements are missing or mocked; **pending** means the workflow is absent; **unverified** means there is no current execution evidence. Checked subtasks credit the stated implementation only, including display-only prototypes. Unchecked subtasks can indicate missing or defective behavior even when their UI exists; checked implementation subtasks are not runtime sign-off. Parent feature tasks stay open for unresolved defects or integration verification, even if all implementation subtasks are checked. No MVP completion percentage is inferred from screen count.

**Overall:** FE-Mobile-1 has replaced the main mock flows with API wiring and added substantial events, registration, auction, leaderboard, media, Hall of Fame and popup code. These features require fixes and end-to-end validation. FE-Mobile-2 screens still have substantial static/demo behavior. Web admin now includes user CSV export and event list/create UI, but authentication, event integration and most management modules remain incomplete. Neither frontend is established as MVP-ready.

### Mobile compared with the plan (18 task groups)

| Planned area | Current tally | Source evidence and remaining work |
|---|---|---|
| Project architecture | Implemented in source | [App](../mobile/App.tsx), [API/config](../mobile/src/api/client.ts), [environment example](../mobile/.env.example), [token storage](../mobile/src/api/tokenStorage.ts) and repositories exist. Native secure storage and web localStorage hold access/refresh tokens. Local package installation is incomplete; copying the example unchanged uses localhost even on Android, overriding its emulator fallback. |
| Design system | Partial / defects | Theme, controls, feedback states and responsive helpers exist. Current typecheck reports absent theme tokens, old Showcase variants and an incomplete [ThemeProvider fallback](../mobile/src/theme/ThemeProvider.tsx). |
| Authentication | Wired / defects / unverified | [Repository](../mobile/src/repositories/AuthRepository.ts), [auth context](../mobile/store/auth.tsx), [client](../mobile/src/api/client.ts) and [forgot-password screen](../mobile/screens/login/forgot-password.tsx) implement API requests, restore, refresh/retry and logout. Mobile fake-success fallbacks are gone. Network failures can erase sessions; Google is unavailable; OTP route is obsolete; verification/resend UI and mobile link handling remain incomplete. |
| Landing and app shell | Partial | [Drawer/stack](../mobile/screens/drawer/layout.tsx) has protected navigation, confirmation on logout and a boot loading spinner. [Tabs](../mobile/screens/drawer/bottom-tabs-layout.tsx) include Media. Landing/onboarding and configured production splash remain missing. |
| Events list and filters | Wired / unverified | [Events](../mobile/screens/drawer/events.tsx) uses API cursor pagination, category/status filters, debounced search, refresh and loading/error/empty states. API failures during refresh/load-more hide previously loaded rows; registration status labels need review. |
| Profile | Partial | [Profile](../mobile/screens/drawer/profile.tsx) uses session identity but hardcodes points/rank/history. [Edit profile](../mobile/screens/profile/edit-profile.tsx) still uses demo values and only alerts on Save. Avatar upload, user card and full settings remain missing. |
| Event details and registration | Wired / defects / unverified | [Details/gallery](../mobile/screens/events/event-details.tsx), [schema-driven registration](../mobile/screens/events/registration.tsx) and [field renderer](../mobile/src/forms/DynamicFormField.tsx) use API data. Visibility/validation, rejected status, team join/create conditions, post-approval flows and image-only file selection prevent completion. |
| Announcements and profile enhancements | Partial | [Announcements](../mobile/screens/drawer/announcement.tsx) and [history](../mobile/screens/profile/history.tsx) remain static. API integration, announcement detail/priority/filtering and profile event suggestions remain missing. |
| Auction | Wired / defects / unverified | [Auction](../mobile/screens/events/auction.tsx) and [repository](../mobile/src/repositories/AuctionRepository.ts) implement polling, captain bidding, countdown, bid histories, results and My Bids. Bid confirmation can submit against a changed lot; recent bid order, refresh/limiting and stale poll responses need correction. Mock mobile admin controls were removed. |
| Points system | Partial | Home/profile point totals are static. API-backed rankings do not complete points transaction history, source breakdown, earning opportunities or points animations. |
| Leaderboard | Wired / defects / unverified | [Global/event/challenge tabs](../mobile/screens/drawer/leaderboard.tsx), podium, period/domain filters, refresh/pagination and [event standings](../mobile/screens/events/event-leaderboard.tsx) exist. Rank request races, hidden domain filtering, locked event search and pagination/rank lookup limits remain. Domain filters do not fully implement event-category filtering. |
| Challenges and Strava | Pending | No dedicated challenge participation/progress or Strava connection/OAuth flow was found. A challenge rankings tab and static home tile do not satisfy these requirements. |
| Media | Wired / defects / unverified | [Gallery/upload](../mobile/screens/drawer/media.tsx), [viewer](../mobile/screens/media/media-viewer.tsx) and [repository](../mobile/src/repositories/MediaRepository.ts) implement grid, swipe, video, share and likes. Event/date filters, approved-only query, initial like state and format/size handling remain; the supplied audit reports iOS QuickTime incompatibility. |
| Homepage, broadcasts and notifications | Partial | [Home](../mobile/screens/drawer/home.tsx) remains static; event buttons now open Events. [Inbox repository](../mobile/src/repositories/NotificationsRepository.ts) no longer supplies fake data, but read failures are swallowed, cursor continuation is unused and notification taps have no destination. Broadcasts, push, WhatsApp and functional challenge/reward actions remain missing. |
| Hall of Fame | Wired / defects / unverified | [List/carousel/timeline](../mobile/screens/drawer/hall-of-fame.tsx) and [detail/badges](../mobile/screens/hall-of-fame/hall-of-fame-detail.tsx) use API data. Search is locked; detail assumes members is always present; list is capped at 100 without paging. Category switching uses chips. |
| Feedback, contact and brackets | Partial | [Feedback](../mobile/screens/drawer/feedback.tsx) has category/message controls, but Send still has an empty handler. Contact, FAQ, bracket UI and working submissions remain missing. |
| Popups and journey testing | Partial / defects | [Popup provider](../mobile/src/popups/PopupProvider.tsx), [registration review](../mobile/src/popups/EventRegistrationPopup.tsx), [bid confirm](../mobile/src/popups/BidConfirmPopup.tsx), [terms](../mobile/src/popups/TermsPopup.tsx) and [logout confirmation](../mobile/src/hooks/useConfirmLogout.ts) exist. Bid context and invented default rules need fixes; device/modal-handoff and full journey tests remain open. |
| Final polish and release | Partial / failing checks | Podium animations, skeletons and navigation fixes exist. Mobile typecheck fails. [app.json](../mobile/app.json) lists plugins only; production app metadata/identifiers, accessibility/performance checks, APK/IPA and production validation remain open. |

### Web admin compared with the plan (10 task groups)

| Planned area | Current tally | Source evidence and remaining work |
|---|---|---|
| Admin setup | Partial | [React/Vite/Tailwind dependencies](../web/package.json), routing/layout/sidebar, login and [client guard](../web/src/components/RequireAuth.tsx) exist. Planned admin component library is absent; guard behavior depends on an unvalidated local user. |
| Auth and basic users | Partial | [Auth store](../web/src/stores/authStore.ts) still authenticates a mock admin after a failed live login, even when explicit mock mode is off. Refresh tokens are stored but never automatically renewed. [Dashboard](../web/src/pages/Dashboard.tsx) uses fixtures; [users](../web/src/pages/Users.tsx) has local search/filters/detail but no pagination, and reads fall back to fixtures. |
| Complete user management | Partial | Users page exports currently loaded/filtered rows to CSV. [updateUserRole](../web/src/services/userService.ts) is a service-only helper with no UI caller. Editing, deletion, bulk actions, role management UI, fuller analytics and activity logs remain missing. |
| Event management, Part 1 | Partial | [Events](../web/src/pages/Events.tsx), [table](../web/src/components/events/EventTable.tsx), [creation modal](../web/src/components/events/CreateEventModal.tsx) and [service](../web/src/services/eventService.ts) now exist. List/filter and basic form are present; View Details only logs. Creation forwards camelCase data while the read adapter expects snake_case/nested fields; live contract needs verification. Status/category management, upload, duplication and preview remain missing. |
| Event management, Part 2 | Pending | No form builder, participant/response management, registration export or participant communication UI exists. |
| Auction, points, leaderboard and challenges | Pending | [Router](../web/src/app/router.tsx) still provides auction/leaderboard placeholders. No working auction controls, point rules/adjustment, leaderboard administration or challenge management exists. |
| Media and broadcasts | Pending | Media route is a placeholder. Library/upload/approval and broadcast creation/scheduling/history remain missing. |
| Hall of Fame, feedback and brackets | Pending | Feedback/tournament routes are placeholders. Management/response flows, Hall of Fame administration and live analytics remain absent; announcements route is also a placeholder. |
| Admin workflow testing | Unverified | Browser user journeys and feature/permission tests were not run during this audit. |
| Admin release/deployment | Unverified | Web dependencies are not installed locally; build/lint were not run. No deployment or production validation was established. |

### FE-Mobile-1 audit findings that block completion

The supplied [commit audit](fe-mobile-1-commit-audit.md) is the detailed issue register for `adf207c`. Its numbered findings and latent issues remain **open**; no fixes were made as part of this tally. Client-side observations below were checked against source. Backend-specific and native-device outcomes are attributed to that audit and still require reproduction in the integration environment.

| Area / supplied audit reference | Outstanding finding and acceptance needed |
|---|---|
| Session loss — #1–2; session edge cases | Refresh and bootstrap clear valid tokens on transient/network failures. Preserve sessions on retryable failures; prevent an in-flight refresh from restoring tokens after logout. Validate offline startup and expired-token recovery. |
| Registration — #3–6; validator edge cases | Handle rejected submissions distinctly; align field coercion/visibility and validation with the server; allow team joins/creation only in valid confirmed states. Add usable later create/join flows after approval. File fields currently ignore schema accept/size constraints and cannot select PDFs. |
| Rules and popups — #7; popup edge cases | Remove fabricated fallback event rules and require acceptance only for supplied rules. Verify sequential native modal handoffs on iOS; current behavior is reported as a risk, not device-tested here. |
| Bid correctness — #8–9 | Reverse the oldest-first recent log before labelling Leading. Freeze lot/version/amount at review time, close confirmation and reset amount on lot change; verify that a bid cannot target the next player. |
| Auction session/traffic — #10; auction edge cases | Audit reports expired optional-auth requests falling back to shared-IP rate limiting. Address token expiry, 429 backoff, overlapping/out-of-order polls and permanent-error polling; coordinate server optional-auth/purse behavior separately. |
| Hall of Fame — #11; pagination | Guard optional members before filtering. Independently found: Hall of Fame search has the same controlled-input defect as event standings. Add paging beyond the first 100 entries. |
| Media — #12–14; media edge cases | Request approved gallery items explicitly; initialize liked-by-me state and guard repeat toggles. Audit reports QuickTime/HEIC compatibility and server format gaps; validate iOS uploads, size limits, upload category and viewer resource use. |
| Rankings — #15–19; leaderboard edge cases | Fix locked event search, independent rank-request tracking, hidden domain on Challenges and deleted-user labels. Display W/L only when meaningful. Handle ranks beyond 500 and event standings beyond 100; verify podium ranks and deduplicate pages. |
| Remaining client behavior — cleanup/edge cases | Wire or remove Remember me and obsolete OTP paths; surface notification mutation failures; complete verification/resend and account recovery UX. Optional registration phone updates currently lose failures silently. |

**Additional web findings:** Event-list request errors are caught and converted to an empty array, so the page's retry/error UI is bypassed. Creation fields (`startAt`, `endAt`, `maxParticipants`, `isTeamed`) are posted without mapping to the shape its read adapter consumes (`start_at`, `end_at`, `registration`, `teaming`); this is a source-level contract inconsistency, not a reproduced server response. The default [web API URL](../web/src/services/apiClient.ts) includes `/api`, whereas [the example](../web/.env.example) and mobile gateway config do not. Confirm the deployed contract before signing off integration.

### Verification performed and limits

| Check | Result / evidence |
|---|---|
| Current source review | All 28 frontend task groups re-tallied; supplied FE1 audit and checklist cross-checked. Removed mock files/auction-console links replaced by current source links. |
| Mobile TypeScript — `cd mobile && ./node_modules/.bin/tsc --noEmit --pretty false` | **Failed (exit 2).** Local installation cannot resolve `@react-navigation/bottom-tabs`, `expo-image-picker` and `expo-video`, although declared in package.json. Also reports shared design-system errors: missing theme tokens, Showcase variants and ThemeProvider fallback missing shadow/neumorphic. Restore declared dependencies and fix source errors before repeating. |
| Earlier FE1 build claims | Supplied commit audit reports **27 pre-existing design-system errors** and a successful Android **JavaScript bundle export** (4.2 MB). These were historical results in its environment; the export was not rerun here. A JS bundle is not a production APK/IPA. The checklist's general claim that the app typechecks is contradicted by both audits. |
| Web build/lint | **Not run:** no local web/node_modules. No dependency installation or source repair was performed for this documentation update. |
| Live API, browser and device journeys | **Not run.** API wiring is credited as source implementation only; backend compatibility, Android/iOS behavior, performance and release readiness are not verified. |

**Next work:** Resolve session/bid/registration correctness first, then media/Hall of Fame/ranking defects and shared type errors; complete remaining FE-Mobile-2 and web requirements; execute the Week 5 user journeys and production-build checks. The detailed frontend task checklists below reflect this re-audit. Original milestone deliverable lines describe targets, not audited completion.

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

- [ ] **FE-Mobile-2: Design System Foundation** (8h)
  - **Audit (October 19, re-audit):** Partial / defects — reusable theme, typography, components, responsive utilities, forms, icons and feedback primitives exist. Current typecheck fails on missing theme tokens, unsupported Showcase variants and an incomplete ThemeProvider fallback. Existence of these primitives does not establish a working design system.
  - [x] Create color palette and theme constants
  - [x] Build reusable UI components (Buttons, Inputs, Cards, Headers)
  - [x] Typography system
  - [x] Setup responsive utilities
  - [x] Icon library setup
  - [x] Loading and error state components
  - [x] Form components (text input, dropdowns, etc.)

**Sunday Sep 6 (8h):**
- [ ] **FE-Mobile-1: Authentication UI & Integration** (8h)
  - **Audit (October 19, re-audit):** Wired / defects / unverified — login, registration, forgot password, secure storage, session restore, refresh/retry and protected navigation are implemented; mobile fake login fallbacks were removed. Network/refresh failures can erase valid sessions (commit audit #1–2). Google sign-in reports unavailable; OTP is obsolete, and email verification/resend UI and reset-link handling remain incomplete. No live auth journey was validated.
  - [x] Login screen UI
  - [x] Registration screen UI
  - [x] Forgot password UI
  - [x] Connect to backend Auth APIs
  - [x] Implement token storage (secure storage)
  - [x] Setup authentication state management
  - [x] Protected route implementation

- [ ] **FE-Mobile-2: Landing Page & App Shell** (8h)
  - **Audit (October 19, re-audit):** Partial — drawer, bottom tabs, home and notification header exist. BootSplash is a session-loading spinner, not the configured production splash. Dedicated landing/onboarding and production splash configuration remain missing.
  - [ ] Landing page with app intro
  - [ ] Onboarding screens (app tour/walkthrough)
  - [ ] Splash screen
  - [x] Homepage layout and structure
  - [x] Bottom navigation bar
  - [x] Header with notifications icon

**Deliverable:** Mobile project setup + Auth working + Landing page + App shell

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 5 (8h):**
- [ ] **Admin Dashboard Setup** (8h)
  - **Audit (October 19, re-audit):** Partial — React/Vite, routing, Tailwind, sidebar/layout, login and client role guard exist. Planned admin component library is absent. Web authentication still falls back to a mock admin after API failure.
  - [x] Initialize React/Next.js admin project
  - [x] Setup admin routing and layout
  - [ ] Install and configure admin UI library (MUI/Ant Design/Shadcn)
  - [x] Create sidebar navigation structure
  - [x] Setup authentication guards
  - [x] Admin login page
  - [x] Dashboard layout with sidebar

**Sunday Sep 6 (8h):**
- [ ] **Admin Auth & User Management - Part 1** (8h)
  - **Audit (October 19, re-audit):** Partial — login/user API clients, static dashboard cards, local directory search/role/status filters and detail modal exist. Failed live login authenticates a mock admin; user-read failure returns fixtures. Users table still has no pagination.
  - [ ] Admin authentication integration
  - [x] Dashboard home page with stats cards
  - [ ] Users list table (with pagination, search, filter)
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
- [ ] **FE-Mobile-1: Events List & Filters** (8h)
  - **Audit (October 19, re-audit):** Wired / unverified — API-backed cursor list, category/status filters, debounced search, badges, skeleton/error/empty states and pull-to-refresh exist. Refresh/load-more failures hide the previous list; the Open badge can be shown without a registration form. Live API/device validation remains open.
  - [x] Events feed/list view
  - [x] Event card component
  - [x] Category filters UI
  - [x] Search and filter controls
  - [x] Event status indicators
  - [x] Empty states and loading
  - [x] Pull-to-refresh

- [ ] **FE-Mobile-2: User Profile Page** (8h)
  - **Audit (October 19, re-audit):** Partial — profile identity uses auth state; stats/history remain hardcoded. Edit form still starts with demo values and Save only alerts. No image upload, separate user card or full settings screen exists; Help & Support also opens EditProfile.
  - [x] Profile screen layout
  - [x] Player card component
  - [ ] User card component
  - [x] User info section
  - [x] Edit profile UI
  - [ ] Profile image upload
  - [ ] Settings screen basic structure

**Sunday Sep 13 (8h):**
- [ ] **FE-Mobile-1: Event Details & Registration** (8h)
  - **Audit (October 19, re-audit):** Wired / defects / unverified — API details/gallery, schema-driven fields, file uploads, submit/cancel requests and confirmation UI exist. Rejected submissions are presented as pending success; visibility/validation differ from server rules; file picker is image-only; team create/join conditions and later post-approval flows are incomplete (audit #3–7). Submission and confirmation are not signed off as working user journeys.
  - [x] Event detail screen
  - [x] Event information display (full details)
  - [x] Event image gallery
  - [x] Dynamic registration form rendering
  - [ ] Form field validation
  - [ ] League-specific registration
  - [x] Registration submission
  - [ ] Registration confirmation screen

- [ ] **FE-Mobile-2: Announcements & Profile Enhancement** (8h)
  - **Audit (October 19, re-audit):** Partial — static announcement list/cards and mock profile/history remain. No announcement API integration, detail route, priority mapping, category filtering or profile suggestions exists.
  - [x] Announcements list view
  - [ ] Announcement detail view
  - [x] Announcement card component
  - [ ] Priority indicators and badges
  - [ ] Filter by category
  - [x] History section in profile (past events)
  - [ ] Events suggestion section in profile

**Deliverable:** Events + Registration + Announcements + Profile functional

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 12 (8h):**
- [ ] **User Management - Complete** (8h)
  - **Audit (October 19, re-audit):** Partial — CSV export of currently loaded/filtered users is implemented. updateUserRole exists as a service helper but has no UI caller. Edit/delete, bulk actions, role management UI, fuller statistics and activity logs remain missing; export does not fetch all server pages.
  - [ ] User edit form
  - [ ] User delete confirmation
  - [ ] Bulk actions (approve, suspend, delete)
  - [ ] User statistics and filters
  - [ ] User roles management
  - [x] Export user data
  - [ ] User activity logs

**Sunday Sep 13 (8h):**
- [ ] **Event Management - Part 1** (8h)
  - **Audit (October 19, re-audit):** Partial — /events now has a table, local search/category/status filters and a basic creation modal with POST wiring. Create sends camelCase fields without adapting them to the snake_case/nested response model; live compatibility is unverified. View Details only console.logs. Category/status management, upload, duplication and preview remain missing; failed list fetch becomes an empty list.
  - [x] Events list table with filters
  - [x] Event creation form (basic details)
  - [ ] Event categories management
  - [ ] Event status management (draft, publish, close)
  - [ ] Event image upload
  - [ ] Event duplication feature
  - [ ] Event preview

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
- [ ] **FE-Mobile-1: Auction Interface** (8h)
  - **Audit (October 19, re-audit):** Wired / defects / unverified — one-second polling, captain bid controls, current bid, history, countdown, sold/unsold results and My Bids exist. Bid confirmation does not freeze lot/version/amount across lot changes; bid amount can carry into the next lot, and the oldest recent bid is labelled Leading (audit #8–10). Poll overlap, expiry and rate-limit behavior need correction and live testing.
  - [x] Auction event view
  - [x] Bidding interface
  - [x] Current bid display
  - [x] Bid history view
  - [x] Auction timer/countdown
  - [ ] Bid submission with confirmation popup
  - [x] Winner announcement screen
  - [x] My bids view

- [ ] **FE-Mobile-2: Points System UI** (8h)
  - **Audit (October 19, re-audit):** Partial — home/profile totals and badges remain hardcoded, although leaderboard data is now API-backed. Dedicated transaction history, source breakdown, earning opportunities and points animations remain missing.
  - [x] Points display in profile
  - [ ] Points history screen
  - [ ] Transaction list view
  - [ ] Points breakdown by source
  - [ ] Points earning opportunities section
  - [x] Visual points indicator/badge
  - [ ] Points animations

**Sunday Sep 20 (8h):**
- [ ] **FE-Mobile-1: Leaderboard Page** (8h)
  - **Audit (October 19, re-audit):** Wired / defects / unverified — API global/event/challenge tabs, period/domain filters, podium, current-user highlighting, paging and refresh exist. Full category filtering is missing; scroll-to-self covers loaded rows and rank lookup is capped at 500. Rank/load-more requests can lose the rank result; a hidden domain persists into Challenges, and event search is locked (audit #15–19).
  - [x] Leaderboard screen layout
  - [x] Leaderboard list (ranked)
  - [ ] Filter controls (by event, category, time period)
  - [x] User position highlight
  - [x] Pull-to-refresh
  - [x] Podium view for top 3
  - [x] Scroll to my position
  - [x] Leaderboard tabs (global, events, challenges)

- [ ] **FE-Mobile-2: Challenges & Strava** (8h)
  - **Audit (October 19, re-audit):** Pending — no challenge participation/progress screens or Strava connection/OAuth flow exists. The Challenges leaderboard tab displays rankings only; it does not implement challenge management or participation.
  - [ ] Challenges list view
  - [ ] Challenge detail view
  - [ ] Challenge participation UI
  - [ ] Challenge progress tracking
  - [ ] Active vs completed challenges tabs
  - [ ] Strava connection screen
  - [ ] Strava OAuth flow integration
  - [ ] Connected accounts display

**Deliverable:** Auction + Points + Leaderboard + Challenges + Strava functional

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 19 (8h):**
- [ ] **Event Management - Part 2** (8h)
  - **Audit (October 19, re-audit):** Pending — no web dynamic form builder, auction setup, participant/response management, registration export or communication tools exist. Basic event creation in Part 1 does not satisfy these requirements.
  - [ ] Event registration form builder (drag-drop fields)
  - [ ] Form field types (text, dropdown, checkbox, etc.)
  - [ ] Auction setup interface for events
  - [ ] Event participants management view
  - [ ] Event registration responses view
  - [ ] Export registrations to CSV
  - [ ] Participant communication tools

**Sunday Sep 20 (8h):**
- [ ] **Auction, Points & Leaderboard Admin** (8h)
  - **Audit (October 19, re-audit):** Pending — auction/leaderboard routes remain placeholders; points adjustment/rules, winner controls and challenge management are missing. The old mobile mock auction console was removed.
  - [ ] Auction management (view, monitor, close)
  - [ ] Winner selection and confirmation
  - [ ] Manual points adjustment interface
  - [ ] Points rules configuration
  - [ ] View all leaderboards
  - [ ] Leaderboard filters and export
  - [ ] Challenge management interface (create, edit, delete)

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
- [ ] **FE-Mobile-1: Media Page** (8h)
  - **Audit (October 19, re-audit):** Wired / defects / unverified — API grid/pagination, image/video viewer, swipe, share, likes and upload UI exist. Filters cover type/category, not event/date. Approved-only filtering, initial liked state, format/size handling and iOS video compatibility remain unresolved (audit #12–14); native media behavior was not tested.
  - [x] Media gallery view
  - [x] Image grid layout (masonry/grid)
  - [x] Video player integration
  - [ ] Media filters (by event, date, type)
  - [x] Full-screen media viewer with swipe
  - [x] Share media functionality
  - [x] Media upload (if user-generated)

- [ ] **FE-Mobile-2: Homepage - Broadcast & Content** (8h)
  - **Audit (October 19, re-audit):** Partial — static featured/upcoming event cards remain; action buttons now open Events. Notification API fixtures were removed, but only the first inbox page is loaded and read failures are swallowed. Broadcast/banner, push setup, WhatsApp, activity feed and functional Challenges/Rewards actions remain missing.
  - [ ] Broadcast message display widget on homepage
  - [ ] Live announcements banner
  - [x] Notification center/inbox
  - [ ] Push notification setup
  - [ ] WhatsApp redirect integration
  - [x] Featured events section on homepage
  - [ ] Quick actions (register, leaderboard, challenges)
  - [ ] Recent activity feed
  - [x] Upcoming events widget

**Sunday Sep 27 (8h):**
- [ ] **FE-Mobile-1: Hall of Fame Page** (8h)
  - **Audit (October 19, re-audit):** Wired / defects / unverified — API list, featured carousel, detail, achievement badges, year timeline and category chips exist. Search is locked because controlled SearchInput lacks onChangeText; detail unconditionally calls members.filter (audit #11), and list is capped at 100 without pagination.
  - [x] Hall of Fame list view
  - [x] Featured members carousel
  - [x] Member detail page
  - [x] Achievements display with badges
  - [x] Timeline view
  - [ ] Search and filter by category
  - [x] Hall of Fame categories tabs

- [ ] **FE-Mobile-2: Feedback, Contact & Brackets** (8h)
  - **Audit (October 19, re-audit):** Partial — feedback category/message form exists with a blank-message guard; Send still has an empty handler. Working submission/error handling, full validation, contact, FAQ and tournament bracket UI remain missing.
  - [x] Feedback form screen with categories
  - [ ] Contact us form screen
  - [ ] Form validation
  - [ ] Submission success/error handling
  - [ ] FAQ section (static content)
  - [ ] Tournament bracket view (spectator)
  - [ ] Bracket navigation through rounds
  - [ ] Match/game display

**Deliverable:** Media + Homepage complete + Hall of Fame + Feedback + Brackets

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 26 (8h):**
- [ ] **Media & Broadcast Management** (8h)
  - **Audit (October 19, re-audit):** Pending — media route remains placeholder text; upload/approval/library and broadcast creation/scheduling/history are not implemented.
  - [ ] Media library view (grid/list with filters)
  - [ ] Media upload interface (bulk upload)
  - [ ] Media approval workflow
  - [ ] Media categorization and tagging
  - [ ] Broadcast message creation interface
  - [ ] Broadcast scheduling
  - [ ] Broadcast history and analytics

**Sunday Sep 27 (8h):**
- [ ] **Hall of Fame, Feedback & Brackets** (8h)
  - **Audit (October 19, re-audit):** Pending — feedback/tournament routes remain placeholders. Hall of Fame management, achievements, response workflows and live analytics are missing; dashboard metrics are fixtures.
  - [ ] Hall of Fame management (add/edit/delete entries)
  - [ ] Achievement management
  - [ ] Feedback inbox view
  - [ ] Contact submissions view
  - [ ] Response interface for feedback/contact
  - [ ] Tournament bracket setup UI
  - [ ] Bracket management (update results)
  - [ ] Analytics dashboard (users, events, engagement)

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
- [ ] **Both: Integration Testing & Bug Fixes** (8h total, 4h each)
  - End-to-end API testing
  - Authentication flow testing
  - Event registration flow testing
  - Auction flow testing
  - Points calculation verification
  - Leaderboard accuracy testing
  - Fix critical and high-priority bugs

**Sunday Oct 18 (8h):**
- [ ] **Both: Optimization & Deployment Prep** (8h total, 4h each)
  - Database query optimization
  - API response time optimization
  - Error handling improvements
  - Security audit (input validation, XSS, injection)
  - Production environment setup
  - Database migration to production
  - API documentation final review
  - Setup monitoring and logging

**Deliverable:** Tested, optimized, production-ready backend

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2)

**Saturday Oct 17 (8h):**
- [ ] **Both: Feature Testing & PopUps** (8h each)
  - **Audit (October 19, re-audit):** Partial / defects — PopupProvider, registration/bid/terms popups, success/error/info/warning messages and destructive/logout confirmations exist. Bid confirmation state and invented fallback event rules block completion; the supplied audit also reports an unverified iOS modal-handoff risk. Device/network/offline and full journey tests remain open.
  - [ ] **FE-Mobile-1:** All PopUps implementation
    - [x] Event registration popup
    - [ ] Bid confirmation popup
    - [x] Success/error popups (reusable)
    - [x] Info/warning popups
    - [ ] Terms and conditions popup
    - [x] Confirmation dialogs (delete, logout, etc.)
  
  - [ ] **FE-Mobile-2:** Complete user journey testing
    - [ ] Test registration → login → events → auction → profile flow
    - [ ] Cross-device testing (Android/iOS)
    - [ ] Network error handling testing
    - [ ] Offline behavior testing
    - [ ] Create prioritized bug list

**Sunday Oct 18 (8h):**
- [ ] **Both: Bug Fixes & Final Polish** (8h each)
  - **Audit (October 19, re-audit):** Partial / failing checks — navigation remount and invalid home-route issues were addressed in source; podium animations, skeletons and transitions exist. Mobile typecheck currently fails; known defects, accessibility/performance checks, production app configuration/APK/IPA and backend validation remain open. A reported Android JS bundle export is not a production app build.
  - [ ] Fix critical and high-priority bugs
  - [ ] UI/UX refinements
  - [ ] Loading states and error messages polish
  - [x] Animations and transitions
  - [ ] Performance optimization (image caching, lazy loading)
  - [ ] Accessibility improvements
  - [ ] Build production APK/IPA
  - [ ] Final testing on production backend

**Deliverable:** Tested, polished, production-ready mobile app

#### Frontend Web Admin (FE-Admin)

**Saturday Oct 17 (8h):**
- [ ] **Admin Testing & Missing Features** (8h)
  - **Audit (October 19, re-audit):** Unverified — no browser/admin user-journey testing was performed in this audit. Source gaps and placeholder modules remain; local web dependencies are not installed.
  - [ ] Complete any remaining admin features
  - [ ] Test all admin workflows
  - [ ] User management testing
  - [ ] Event creation and management testing
  - [ ] Auction management testing
  - [ ] Media management testing
  - [ ] Communications testing
  - [ ] Create bug list

**Sunday Oct 18 (8h):**
- [ ] **Admin Bug Fixes & Deployment** (8h)
  - **Audit (October 19, re-audit):** Unverified — web build/lint, permission tests, deployment and production verification were not run; local web dependencies are not installed. No production-readiness claim is made.
  - [ ] Fix critical bugs
  - [ ] UI polish and consistency
  - [ ] Admin permissions and security testing
  - [ ] Help documentation for admin users
  - [ ] Build production bundle
  - [ ] Deploy to hosting
  - [ ] Domain and SSL setup
  - [ ] Final production testing

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
- [ ] 100% of MVP features implemented and functional
- [ ] <5 critical bugs remaining
- [ ] <20 total bugs remaining
- [ ] Backend APIs documented (Postman/Swagger)
- [ ] Mobile app builds successfully (Android + iOS)
- [ ] Admin panel deployed and accessible
- [ ] At least 3 end-to-end user journeys tested successfully
- [ ] Security basics in place (input validation, auth, HTTPS)

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
- [ ] Backend: Auth & User APIs working
- [ ] Mobile: User can login and see app shell
- [ ] Admin: Admin can login and see dashboard

### End of Week 2 (Sep 13)
- [ ] Backend: Events & Registration APIs working
- [ ] Mobile: User can view events and register
- [ ] Admin: Admin can create and manage events

### End of Week 3 (Sep 20)
- [ ] Backend: Auction, Points, Leaderboard APIs working
- [ ] Mobile: User can bid, view leaderboard, see points
- [ ] Admin: Admin can manage auctions and points

### End of Week 4 (Sep 27)
- [ ] Backend: All remaining services complete
- [ ] Mobile: All pages and features present
- [ ] Admin: All admin features complete

### End of Week 5 (Oct 18)
- [ ] All: Tested, bug-fixed, deployed MVP

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

**Document Version:** 2.2 (frontend re-audit with FE-Mobile-1 commit findings)\
**Last Updated:** October 19, 2026\
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
