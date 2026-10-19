# BGSC Platform - MVP Timeline Plan (Dual Deadline)
**Start Date:** September 5, 2026 (Friday)  
**Working Schedule:** Saturdays & Sundays, 8 hours/day (weekday work optional)

## Frontend Implementation Tally — October 19, 2026

**Scope:** Current `mobile/` and `web/` source compared against the frontend tasks in this plan. `Legacy/` was excluded from inspection and edits. Backend completion claims and the original schedule are unchanged; this audit does not validate backend readiness or revise deadlines.

**How to read the checklists:** A checked subtask means its stated UI or code exists in source. Static/mock displays can satisfy a display-only subtask, but do not establish live feature completion. Parent tasks remain unchecked when any requirement is missing, mocked instead of integrated, or unverified. Audit notes distinguish **implemented in source**, **partial**, **pending**, and **unverified**. No completion percentage is assigned because screen presence does not measure working user journeys.

**Overall:** Mobile has the design system, navigation shell, authentication screens and several feature prototypes. Most feature data and mutations are static, mocked or local. Web admin has the shell, login, dashboard cards and a read-only user directory; most management routes contain placeholder text. Neither frontend is established as MVP-ready by this source review.

### Mobile compared with the plan

| Planned area | Tally | Source evidence and remaining work |
|---|---|---|
| Project architecture | Partial | [App entry](../mobile/App.tsx), [navigation](../mobile/screens/drawer/layout.tsx), [auth context](../mobile/store/auth.tsx), [API client](../mobile/services/apiclient.ts). Mobile environment setup/example remains missing. |
| Design system | Implemented in source | [Theme](../mobile/src/theme/ThemeProvider.tsx), [components](../mobile/src/components/index.ts), [forms](../mobile/src/forms/index.ts), [feedback states](../mobile/src/feedback/index.ts), [responsive helpers](../mobile/src/responsive/index.ts), [typography](../mobile/src/typography/index.ts) and [icons](../mobile/src/icons/index.ts). |
| Authentication and protected access | Partial | [Login](../mobile/screens/login/login.tsx), [registration](../mobile/screens/login/register.tsx), [OTP](../mobile/screens/login/otp.tsx), [profile completion](../mobile/screens/login/complete-profile.tsx) and secure token storage exist. [Repository](../mobile/src/repositories/AuthRepository.ts) returns mock success on API failure; Google sign-in is simulated. [Forgot password](../mobile/screens/login/forgot-password.tsx) never calls the repository. Startup defaults to authenticated mock state. |
| Landing and app shell | Partial | [Bottom tabs](../mobile/screens/drawer/bottom-tabs-layout.tsx), drawer, home and [notification header](../mobile/src/components/AppHeader.tsx) exist. Dedicated landing/onboarding/splash work remains. |
| Events and registration | Partial | [Event list](../mobile/screens/drawer/events.tsx), [details](../mobile/screens/events/event-details.tsx), [conditional form and confirmation](../mobile/screens/events/registration.tsx) use [mock data and in-memory submissions](../mobile/src/mock/events.ts). API-backed listing/refresh, dynamic form schema, durable submissions and gallery remain. |
| Profile and history | Partial | [Profile](../mobile/screens/drawer/profile.tsx), [edit form](../mobile/screens/profile/edit-profile.tsx) and [history](../mobile/screens/profile/history.tsx) exist. Stats/history are static, save only alerts, and image upload, full settings, user card and suggestions remain. |
| Announcements | Partial | [Static list/cards](../mobile/screens/drawer/announcement.tsx) exist. API data, detail screen, priority levels and filtering remain. |
| Auction | Partial | [Spectator view](../mobile/screens/events/auction.tsx) has mock bids, wallets and local timer. [Mobile console](../mobile/screens/events/auction-console.tsx) changes local status only. Bid submission, synchronized state, winner/My Bids screens and role enforcement remain. |
| Points and leaderboard | Partial | Profile/home totals and [rankings](../mobile/screens/drawer/leaderboard.tsx) are static. Transactions, breakdown, API data, leaderboard filters/tabs, podium and refresh remain. |
| Challenges and Strava | Pending | [Home](../mobile/screens/drawer/home.tsx) has an inactive Challenges tile. No dedicated challenge or Strava flow was found. |
| Media | Pending | No mobile media screen or route was found. |
| Homepage, broadcasts and notifications | Partial | [Home](../mobile/screens/drawer/home.tsx) has static event cards. Header inbox calls [notification repository](../mobile/src/repositories/NotificationsRepository.ts), which falls back to mock data and swallows mutation failures. Broadcasts, push setup, WhatsApp and complete quick actions remain. |
| Hall of Fame | Partial | [Static feature/community cards](../mobile/screens/drawer/hall-of-fame.tsx) exist. API data, member detail, carousel, timeline, filtering and tabs remain. |
| Feedback, contact and brackets | Partial | [Feedback form](../mobile/screens/drawer/feedback.tsx) exists; Send has an empty handler. Contact, FAQ, bracket UI and working submissions remain. |
| Popups, testing and release | Partial / unverified | Registration/notification modals and Terms/Privacy alerts exist. Bid and delete/logout confirmations remain. No device testing, full journey validation or production build/deployment was performed for this audit. |

### Web admin compared with the plan

| Planned area | Tally | Source evidence and remaining work |
|---|---|---|
| Admin setup and authentication | Partial | [React/Vite dependencies](../web/package.json), [layout](../web/src/components/layout/adminLayout.tsx), [sidebar](../web/src/components/layout/sidebar.tsx), [login](../web/src/pages/Login.tsx) and [role guard](../web/src/components/RequireAuth.tsx) exist. Tailwind styling is configured; the planned admin component library is absent. [Auth store](../web/src/stores/authStore.ts) authenticates a mock admin when live login fails. |
| Dashboard and basic user management | Partial | [Dashboard cards](../web/src/pages/Dashboard.tsx) use fixtures. [User directory](../web/src/pages/Users.tsx) supports local search/role/status filtering and a [detail modal](../web/src/components/users/UserDetailModal.tsx). [User service](../web/src/services/userService.ts) attempts API reads with fixture fallback. [Table](../web/src/components/users/UserTable.tsx) has no pagination. |
| Complete user management | Pending | Editing, deletion, bulk actions, role changes, export and activity logs are missing. Existing search/filter and member total do not complete this task group. |
| Events, form builder and registrations | Pending | [Router](../web/src/app/router.tsx) renders placeholder events content. Creation/editing, dynamic forms, participants, responses, exports and communication remain. |
| Auction, points, leaderboard and challenges | Pending | Auction and leaderboard routes are placeholders. No functional points or challenge management exists. Mobile demo console is not a web admin implementation. |
| Media, broadcasts, Hall of Fame, feedback and brackets | Pending | Media, feedback and tournament routes are placeholders. Management workflows and live analytics remain. Announcements is also a placeholder route. |
| Testing, polish and deployment | Unverified | Browser workflows, permissions, production build, deployment and production testing were not performed or established by this audit. |

### Main gaps before frontend feature completion

1. Replace automatic mock authentication/success fallbacks with real error handling; bootstrap authenticated state from a validated session and complete token expiry/refresh behavior. Refresh-token storage in web is present, but no automatic refresh workflow was found in either client.
2. Confirm API contracts and wire feature repositories to actual data. Mobile currently assumes `{ user, token }`, while the web login client expects `{ user, tokens: { access_token, refresh_token } }`; compatibility with the backend remains to be checked.
3. Replace in-memory registration and local-only profile/auction actions with durable API operations; complete backend-schema-driven forms and bidding.
4. Build missing mobile features and the web management modules currently represented by placeholders.
5. Validate real user journeys, failure/expired-session behavior, Android/iOS and browser behavior, then production builds and deployment.

**Verification limit:** This is a static source audit. No backend services were started, no API calls were validated, and no app/browser/device tests or production builds were run. Older mobile implementation notes were cross-checked against source rather than treated as proof of completion. The detailed frontend checklists below now reflect this tally.

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
- [ ] **FE-Mobile-1: Project Architecture Setup** (8h)
  - **Audit (October 19):** Partial — Expo/React Native, navigation, React Context, Axios and folder structure exist. EXPO_PUBLIC_API_URL is referenced; mobile environment setup/example is missing.
  - [x] Initialize mobile project structure
  - [x] Setup navigation (React Navigation/Flutter routing)
  - [x] Configure state management (Redux/Provider/Bloc)
  - [x] Setup API client and environment configs
  - [x] Create folder structure
  - [x] Setup authentication flow skeleton
  - [ ] Environment variables configuration

- [x] **FE-Mobile-2: Design System Foundation** (8h)
  - **Audit (October 19):** Implemented in source — theme tokens, typography, reusable components, responsive helpers, icons, feedback states and form controls exist. Device-level visual verification remains separate.
  - [x] Create color palette and theme constants
  - [x] Build reusable UI components (Buttons, Inputs, Cards, Headers)
  - [x] Typography system
  - [x] Setup responsive utilities
  - [x] Icon library setup
  - [x] Loading and error state components
  - [x] Form components (text input, dropdowns, etc.)

**Sunday Sep 6 (8h):**
- [ ] **FE-Mobile-1: Authentication UI & Integration** (8h)
  - **Audit (October 19):** Partial — login, registration, OTP, profile completion and forgot-password UI exist. API calls return mock success on failure; startup defaults to a mock authenticated user. Forgot-password UI only displays a local success message. Live integration and secure route enforcement remain incomplete.
  - [x] Login screen UI
  - [x] Registration screen UI
  - [x] Forgot password UI
  - [ ] Connect to backend Auth APIs
  - [x] Implement token storage (secure storage)
  - [x] Setup authentication state management
  - [ ] Protected route implementation

- [ ] **FE-Mobile-2: Landing Page & App Shell** (8h)
  - **Audit (October 19):** Partial — home layout, bottom tabs, drawer and notification header exist. No dedicated landing, onboarding or configured splash implementation was found.
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
  - **Audit (October 19):** Partial — React/Vite, React Router, Tailwind, sidebar, layout, login page and client role guard exist. Planned admin component library is not installed. Guard code exists, but mock login fallback prevents production-ready authentication.
  - [x] Initialize React/Next.js admin project
  - [x] Setup admin routing and layout
  - [ ] Install and configure admin UI library (MUI/Ant Design/Shadcn)
  - [x] Create sidebar navigation structure
  - [x] Setup authentication guards
  - [x] Admin login page
  - [x] Dashboard layout with sidebar

**Sunday Sep 6 (8h):**
- [ ] **Admin Auth & User Management - Part 1** (8h)
  - **Audit (October 19):** Partial — login/user API clients, static dashboard cards, local search/role/status filters and detail modal exist. Failed login authenticates a mock admin; failed user fetch returns fixtures. Table has no pagination. Previously checked parent task is reopened.
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
  - **Audit (October 19):** Partial — cards, local search/category filters, status badges and empty state use MOCK_EVENTS. Refresh runs a timer without fetching data; API loading/error states are missing.
  - [x] Events feed/list view
  - [x] Event card component
  - [x] Category filters UI
  - [x] Search and filter controls
  - [x] Event status indicators
  - [ ] Empty states and loading
  - [ ] Pull-to-refresh

- [ ] **FE-Mobile-2: User Profile Page** (8h)
  - **Audit (October 19):** Partial — profile, embedded player stats and edit form exist. Stats are hardcoded; no separate user-card component, image upload or dedicated settings screen exists. Save only displays an alert and does not persist changes; contact input is fixed.
  - [x] Profile screen layout
  - [x] Player card component
  - [ ] User card component
  - [x] User info section
  - [x] Edit profile UI
  - [ ] Profile image upload
  - [ ] Settings screen basic structure

**Sunday Sep 13 (8h):**
- [ ] **FE-Mobile-1: Event Details & Registration** (8h)
  - **Audit (October 19):** Partial — mock details, conditional individual/team/captain/player forms, validation and confirmation modal exist. Forms are hardcoded rather than backend-schema driven; submission updates only an in-memory Set/Map. Live league registration and image gallery remain pending.
  - [x] Event detail screen
  - [x] Event information display (full details)
  - [ ] Event image gallery
  - [ ] Dynamic registration form rendering
  - [x] Form field validation
  - [ ] League-specific registration
  - [ ] Registration submission
  - [x] Registration confirmation screen

- [ ] **FE-Mobile-2: Announcements & Profile Enhancement** (8h)
  - **Audit (October 19):** Partial — two static announcement cards with a New badge and mock profile/event history exist. Detail route, priority mapping, category filters, suggestions and API data are missing.
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
  - **Audit (October 19):** Pending — search/filter and total count exist under Part 1. Editing, deletion, bulk actions, fuller statistics, role mutation, exports and activity logs are missing.
  - [ ] User edit form
  - [ ] User delete confirmation
  - [ ] Bulk actions (approve, suspend, delete)
  - [ ] User statistics and filters
  - [ ] User roles management
  - [ ] Export user data
  - [ ] User activity logs

**Sunday Sep 13 (8h):**
- [ ] **Event Management - Part 1** (8h)
  - **Audit (October 19):** Pending — /events renders placeholder text; no management form, table or event actions exist.
  - [ ] Events list table with filters
  - [ ] Event creation form (basic details)
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
  - **Audit (October 19):** Partial — spectator view shows mock player/bid/wallet data and local countdown. Bid entry/submission, confirmation, winner screen and My Bids are missing. Mobile console changes only local status, has no role gate and does not synchronize with spectator view.
  - [x] Auction event view
  - [ ] Bidding interface
  - [x] Current bid display
  - [x] Bid history view
  - [x] Auction timer/countdown
  - [ ] Bid submission with confirmation popup
  - [ ] Winner announcement screen
  - [ ] My bids view

- [ ] **FE-Mobile-2: Points System UI** (8h)
  - **Audit (October 19):** Partial — static totals and badges appear in home/profile/rankings. Event history includes sample awards; dedicated transactions, source breakdown, earning flow and animations are missing.
  - [x] Points display in profile
  - [ ] Points history screen
  - [ ] Transaction list view
  - [ ] Points breakdown by source
  - [ ] Points earning opportunities section
  - [x] Visual points indicator/badge
  - [ ] Points animations

**Sunday Sep 20 (8h):**
- [ ] **FE-Mobile-1: Leaderboard Page** (8h)
  - **Audit (October 19):** Partial — static three-player rankings and hardcoded current-position highlight exist. API data, filters, refresh, podium, scroll-to-self and tabs are missing.
  - [x] Leaderboard screen layout
  - [x] Leaderboard list (ranked)
  - [ ] Filter controls (by event, category, time period)
  - [x] User position highlight
  - [ ] Pull-to-refresh
  - [ ] Podium view for top 3
  - [ ] Scroll to my position
  - [ ] Leaderboard tabs (global, events, challenges)

- [ ] **FE-Mobile-2: Challenges & Strava** (8h)
  - **Audit (October 19):** Pending — only a static Challenges tile exists; no challenge screens, participation/progress flows or Strava connection/OAuth implementation was found.
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
  - **Audit (October 19):** Pending — no web form builder, auction setup, participant/response management, registration export or communication tooling exists.
  - [ ] Event registration form builder (drag-drop fields)
  - [ ] Form field types (text, dropdown, checkbox, etc.)
  - [ ] Auction setup interface for events
  - [ ] Event participants management view
  - [ ] Event registration responses view
  - [ ] Export registrations to CSV
  - [ ] Participant communication tools

**Sunday Sep 20 (8h):**
- [ ] **Auction, Points & Leaderboard Admin** (8h)
  - **Audit (October 19):** Pending — /auction and /leaderboard are placeholders. Local mobile auction controls do not implement these web-admin requirements.
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
  - **Audit (October 19):** Pending — no mobile media screen or navigation route was found.
  - [ ] Media gallery view
  - [ ] Image grid layout (masonry/grid)
  - [ ] Video player integration
  - [ ] Media filters (by event, date, type)
  - [ ] Full-screen media viewer with swipe
  - [ ] Share media functionality
  - [ ] Media upload (if user-generated)

- [ ] **FE-Mobile-2: Homepage - Broadcast & Content** (8h)
  - **Audit (October 19):** Partial — static upcoming/featured cards and notification inbox exist. Notification requests fall back to mocks; read updates swallow failures. Broadcast/banner, push, WhatsApp, activity feed and complete quick actions are missing; Challenges/Rewards tiles have no actions.
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
  - **Audit (October 19):** Partial — static featured/community cards and year badge exist. API entries, achievement-specific badges, carousel, member detail, timeline, search/filter and category tabs are missing.
  - [x] Hall of Fame list view
  - [ ] Featured members carousel
  - [ ] Member detail page
  - [ ] Achievements display with badges
  - [ ] Timeline view
  - [ ] Search and filter by category
  - [ ] Hall of Fame categories tabs

- [ ] **FE-Mobile-2: Feedback, Contact & Brackets** (8h)
  - **Audit (October 19):** Partial — category/message UI and blank-message button guard exist. Send has an empty handler; full validation/submission, contact, FAQ and brackets are missing.
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
  - **Audit (October 19):** Pending — /media is placeholder text; no library/upload/approval or broadcast management exists.
  - [ ] Media library view (grid/list with filters)
  - [ ] Media upload interface (bulk upload)
  - [ ] Media approval workflow
  - [ ] Media categorization and tagging
  - [ ] Broadcast message creation interface
  - [ ] Broadcast scheduling
  - [ ] Broadcast history and analytics

**Sunday Sep 27 (8h):**
- [ ] **Hall of Fame, Feedback & Brackets** (8h)
  - **Audit (October 19):** Pending — /feedback and /tournaments are placeholders. Hall of Fame management, achievements, response workflows and live analytics are missing.
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
  - **Audit (October 19):** Partial — registration and notification modals, Terms/Privacy alerts and reusable inline feedback components exist. Bid confirmation and delete/logout confirmation dialogs are missing. Device, network/offline and full journey testing remain unverified.
  - [ ] **FE-Mobile-1:** All PopUps implementation
    - [x] Event registration popup
    - [ ] Bid confirmation popup
    - [ ] Success/error popups (reusable)
    - [ ] Info/warning popups
    - [x] Terms and conditions popup
    - [ ] Confirmation dialogs (delete, logout, etc.)
  
  - [ ] **FE-Mobile-2:** Complete user journey testing
    - [ ] Test registration → login → events → auction → profile flow
    - [ ] Cross-device testing (Android/iOS)
    - [ ] Network error handling testing
    - [ ] Offline behavior testing
    - [ ] Create prioritized bug list

**Sunday Oct 18 (8h):**
- [ ] **Both: Bug Fixes & Final Polish** (8h each)
  - **Audit (October 19):** Unverified — styling, transitions and feedback primitives exist; final polish, accessibility/performance checks, production APK/IPA builds and production-backend testing are not established by this source audit.
  - [ ] Fix critical and high-priority bugs
  - [ ] UI/UX refinements
  - [ ] Loading states and error messages polish
  - [ ] Animations and transitions
  - [ ] Performance optimization (image caching, lazy loading)
  - [ ] Accessibility improvements
  - [ ] Build production APK/IPA
  - [ ] Final testing on production backend

**Deliverable:** Tested, polished, production-ready mobile app

#### Frontend Web Admin (FE-Admin)

**Saturday Oct 17 (8h):**
- [ ] **Admin Testing & Missing Features** (8h)
  - **Audit (October 19):** Unverified — no browser/admin workflow testing was performed for this source audit; missing modules prevent completion.
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
  - **Audit (October 19):** Unverified — production build/deployment, permission checks, documentation and production testing are not established by this source audit.
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

**Document Version:** 2.1 (frontend implementation tally)\
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
