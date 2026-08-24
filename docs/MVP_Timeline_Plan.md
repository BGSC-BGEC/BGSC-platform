# BGSC Platform - MVP Timeline Plan
**Target Deadline:** September 28, 2026 (Monday)  
**Start Date:** August 24, 2026 (Monday)  
**Working Schedule:** Saturdays & Sundays, 8 hours/day (weekday work optional)

---

## Team Allocation

### Frontend Team (4 people)
- **FE-Admin (1):** Web Admin Panel
- **FE-Mobile-1, FE-Mobile-2, FE-Mobile-3:** Mobile Application

### Backend Team (2 people)
- **BE-1 & BE-2:** Backend services & NoSQL migration

---

## Available Working Days

| Week | Dates | Days Available | Total Hours/Person |
|------|-------|----------------|-------------------|
| Week 1 | Aug 29 (Sat), Aug 30 (Sun) | 2 days | 16h |
| Week 2 | Sep 5 (Sat), Sep 6 (Sun) | 2 days | 16h |
| Week 3 | Sep 12 (Sat), Sep 13 (Sun) | 2 days | 16h |
| Week 4 | Sep 19 (Sat), Sep 20 (Sun) | 2 days | 16h |
| Week 5 | Sep 26 (Sat), Sep 27 (Sun) | 2 days | 16h |
| Final Sprint | Sep 28 (Mon) - Deadline | Delivery | - |

**Total Available:** 10 weekend days = 80 hours per person

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
- **Priority:** Must complete early (Week 1-2)

### New Service Architecture
- **Registration Service:** Common/shared service for all form-based registrations
- **Modular Design:** Services must be independently deployable

---

## Phase-by-Phase Timeline

## 🔷 PHASE 1: Foundation & Architecture (Week 1)
**Dates:** Aug 29-30 (Sat-Sun)  
**Focus:** Database design, core architecture, authentication, project setup

### Week 1: Aug 29 (Sat) - Aug 30 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Aug 29 (8h):**
- [ ] **BE-1: NoSQL Database Setup & User/Auth Models** (8h)
  - Finalize database choice (MongoDB/Firestore/DynamoDB)
  - Setup development environment
  - Create database instance and configure connections
  - Design User model (authentication, profile, cards)
  - Design Auth token structure

- [ ] **BE-2: Event & Registration Models** (8h)
  - Design Event model (categories, filters, details, auction)
  - Design Registration model (common schema for dynamic forms)
  - Design Points & Leaderboard model
  - Document relationships and references

**Sunday Aug 30 (8h):**
- [ ] **BE-1: Authentication Service** (8h)
  - JWT implementation
  - Registration endpoint (email, username, password)
  - Login endpoint
  - Password reset flow
  - Token refresh mechanism
  - Input validation and sanitization

- [ ] **BE-2: User Service Core** (8h)
  - User CRUD operations
  - Profile management endpoints
  - User card data structure
  - Player card data structure
  - File upload setup (profile pictures)

**Deliverable:** Database setup + Auth & User APIs working

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2, FE-Mobile-3)

**Saturday Aug 29 (8h):**
- [ ] **FE-Mobile-1: Project Architecture Setup** (8h)
  - Initialize mobile project structure
  - Setup navigation (React Navigation/Flutter routing)
  - Configure state management (Redux/Provider/Bloc)
  - Setup API client and environment configs
  - Create folder structure
  - Setup authentication flow skeleton

- [ ] **FE-Mobile-2: Design System Foundation** (8h)
  - Create color palette and theme constants
  - Build reusable UI components (Buttons, Inputs, Cards, Headers)
  - Typography system
  - Setup responsive utilities
  - Icon library setup
  - Loading and error state components

- [ ] **FE-Mobile-3: Authentication UI Screens** (8h)
  - Login screen UI
  - Registration screen UI
  - Forgot password UI
  - Form validation setup
  - Password strength indicator
  - Terms and conditions screen

**Sunday Aug 30 (8h):**
- [ ] **FE-Mobile-1: Authentication Integration** (8h)
  - Connect login/registration to backend APIs
  - Implement token storage (secure storage)
  - Setup authentication state management
  - Protected route implementation
  - Auto-login on app start
  - Logout functionality

- [ ] **FE-Mobile-2: Homepage Shell & Navigation** (8h)
  - Homepage layout and structure
  - Bottom navigation bar
  - Header with notifications icon
  - Pull-to-refresh setup
  - Loading states and error handling
  - Navigation between main sections

- [ ] **FE-Mobile-3: Landing Page & Onboarding** (8h)
  - Landing page with app intro
  - Onboarding screens (app tour/walkthrough)
  - Skip and get started flows
  - First-time user experience
  - Splash screen

**Deliverable:** Mobile project initialized + Auth working + Landing page

#### Frontend Web Admin (FE-Admin)

**Saturday Aug 29 (8h):**
- [ ] **Admin Dashboard Setup** (8h)
  - Initialize React/Next.js admin project
  - Setup admin routing and layout
  - Install and configure admin UI library (MUI/Ant Design/Shadcn)
  - Create sidebar navigation structure
  - Setup authentication guards
  - Admin login page

**Sunday Aug 30 (8h):**
- [ ] **User Management Interface - Part 1** (8h)
  - Admin authentication integration
  - Dashboard home page layout
  - Users list table (with pagination, search, filter)
  - User detail view modal
  - Basic statistics cards (total users, events, etc.)

**Deliverable:** Admin panel initialized + Admin auth + User management UI

---

## 🔷 PHASE 2: Core Services & Event System (Week 2)
**Dates:** Sep 5-6 (Sat-Sun)  
**Focus:** Events, Registration, User profiles

### Week 2: Sep 5 (Sat) - Sep 6 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 5 (8h):**
- [ ] **BE-1: Registration Service (Common)** (8h)
  - Dynamic form schema design
  - Form creation endpoint (admin creates forms)
  - Form submission endpoint (users submit responses)
  - Response storage and retrieval
  - Support for event registration use case
  - Validation engine for form fields

- [ ] **BE-2: Events Service Foundation** (8h)
  - Event CRUD operations
  - Event categories management
  - Event filters implementation (by category, date, status)
  - Event details structure
  - Event status management (draft, published, ongoing, completed)
  - Event image upload

**Sunday Sep 6 (8h):**
- [ ] **BE-1: Events Service - Advanced** (8h)
  - League-specific registration integration
  - Event participants management
  - Event search and filtering logic
  - Event capacity management
  - Event registration deadline handling

- [ ] **BE-2: Announcements Service** (8h)
  - Announcement CRUD operations
  - Announcement categories
  - Announcement priority levels
  - Target audience filtering (all users, specific events)
  - Announcement scheduling

**Deliverable:** Registration + Events + Announcements APIs ready

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2, FE-Mobile-3)

**Saturday Sep 5 (8h):**
- [ ] **FE-Mobile-1: User Profile Page** (8h)
  - Profile screen layout
  - Player card component
  - User card component
  - User info section
  - Edit profile UI
  - Profile image upload

- [ ] **FE-Mobile-2: Events List & Filters** (8h)
  - Events feed/list view
  - Event card component
  - Category filters UI
  - Search and filter controls
  - Event status indicators
  - Empty states

- [ ] **FE-Mobile-3: Announcements UI** (8h)
  - Announcements list view
  - Announcement detail view
  - Announcement card component
  - Priority indicators
  - Filter by category
  - Pull-to-refresh

**Sunday Sep 6 (8h):**
- [ ] **FE-Mobile-1: Profile - History & Events Suggestion** (8h)
  - History section in profile (past events)
  - Events suggestion section
  - Activity timeline component
  - Integration with backend APIs
  - Loading and empty states

- [ ] **FE-Mobile-2: Event Details Page** (8h)
  - Event detail screen
  - Event information display (full details)
  - Event image gallery
  - Share event functionality
  - Register button with state handling

- [ ] **FE-Mobile-3: Event Registration Flow** (8h)
  - Dynamic registration form rendering
  - Form field validation
  - League-specific registration
  - Registration submission
  - Registration confirmation screen
  - Registration history view

**Deliverable:** Profile + Events + Registration + Announcements working

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 5 (8h):**
- [ ] **User Management - Complete** (8h)
  - User edit form
  - User delete confirmation
  - Bulk actions (approve, suspend, delete)
  - User statistics and filters
  - User roles management
  - Export user data

**Sunday Sep 6 (8h):**
- [ ] **Event Management Interface - Part 1** (8h)
  - Events list table with filters
  - Event creation form (basic details)
  - Event categories management
  - Event status management (draft, publish, close)
  - Event image upload
  - Event duplication feature

**Deliverable:** User management complete + Event management started

---

## 🔷 PHASE 3: Auction, Points & Leaderboard (Week 3)
**Dates:** Sep 12-13 (Sat-Sun)  
**Focus:** Auction system, Points, Leaderboard, Challenge system

### Week 3: Sep 12 (Sat) - Sep 13 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 12 (8h):**
- [ ] **BE-1: Auction Service** (8h)
  - Auction creation for events
  - Bidding system (real-time or polling)
  - Auction rules and constraints
  - Winner selection logic
  - Auction status management
  - Notifications for auction events
  - Bid history tracking

- [ ] **BE-2: Points & Leaderboard Service** (8h)
  - Points allocation rules engine
  - Points transaction history
  - Leaderboard calculation logic
  - Leaderboard filtering (by event, category, time period)
  - Global and event-specific leaderboards
  - Rank calculation and updates

**Sunday Sep 13 (8h):**
- [ ] **BE-1: Challenge System Service** (8h)
  - Challenge creation and management
  - Challenge types (individual, team)
  - Challenge participation endpoints
  - Challenge completion tracking
  - Challenge rewards integration with points
  - Challenge leaderboards

- [ ] **BE-2: Social Links Integration (Strava)** (8h)
  - Strava OAuth integration
  - Activity sync from Strava
  - Activity-based points calculation
  - Sub-leaderboard for Strava activities
  - Webhook setup for real-time sync
  - Activity history retrieval

**Deliverable:** Auction + Points + Leaderboard + Challenge + Strava APIs ready

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2, FE-Mobile-3)

**Saturday Sep 12 (8h):**
- [ ] **FE-Mobile-1: Auction Interface** (8h)
  - Auction event view
  - Bidding interface
  - Current bid display
  - Bid history view
  - Auction timer/countdown
  - Bid submission with confirmation
  - Winner announcement screen

- [ ] **FE-Mobile-2: Leaderboard Page** (8h)
  - Leaderboard screen layout
  - Leaderboard list (ranked)
  - Filter controls (by event, category, time period)
  - User position highlight
  - Pull-to-refresh
  - Podium view for top 3
  - Scroll to my position

- [ ] **FE-Mobile-3: Points & History** (8h)
  - Points history screen
  - Transaction list view
  - Points breakdown by source
  - Points display in profile
  - Points earning opportunities section
  - Visual points indicator

**Sunday Sep 13 (8h):**
- [ ] **FE-Mobile-1: Challenge System UI** (8h)
  - Challenges list view
  - Challenge detail view
  - Challenge participation UI
  - Challenge progress tracking
  - Challenge completion screen
  - Active vs completed challenges tabs

- [ ] **FE-Mobile-2: Spectator Bracket View** (8h)
  - Tournament bracket UI component
  - Match/game display
  - Live updates indication
  - Navigation through bracket rounds
  - Responsive bracket layout
  - Zoom and pan functionality

- [ ] **FE-Mobile-3: Strava Integration UI** (8h)
  - Strava connection screen
  - OAuth flow integration
  - Connected accounts display
  - Activity sync status
  - Strava leaderboard view
  - Disconnect option

**Deliverable:** Auction + Leaderboard + Challenges + Brackets + Strava integration working

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 12 (8h):**
- [ ] **Event Management - Part 2** (8h)
  - Event registration form builder (drag-drop fields)
  - Auction setup interface for events
  - Event participants management view
  - Bracket/tournament setup UI
  - Event registration responses view
  - Export registrations

**Sunday Sep 13 (8h):**
- [ ] **Leaderboard, Points & Challenges Admin** (8h)
  - View all leaderboards
  - Manual points adjustment interface
  - Points rules configuration
  - Challenge management interface (create, edit, delete)
  - Strava integration monitoring
  - Auction management and winner selection

**Deliverable:** Complete event + auction management + Leaderboard/points admin

---

## 🔷 PHASE 4: Homepage Features, Media & Hall of Fame (Week 4)
**Dates:** Sep 19-20 (Sat-Sun)  
**Focus:** Broadcast, WhatsApp, Media, Hall of Fame, Feedback

### Week 4: Sep 19 (Sat) - Sep 20 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 19 (8h):**
- [ ] **BE-1: Broadcast & WhatsApp API Integration** (8h)
  - Broadcast message service (push announcements)
  - WhatsApp Business API integration
  - Message templating system
  - Notification preferences management
  - Schedule broadcast functionality
  - Delivery status tracking

- [ ] **BE-2: Media Service** (8h)
  - Media upload (images, videos)
  - Media gallery management
  - Media categorization (events, general, hall of fame)
  - Media approval workflow
  - CDN integration for media delivery
  - Image compression and optimization

**Sunday Sep 20 (8h):**
- [ ] **BE-1: Hall of Fame Service** (8h)
  - Hall of Fame entries CRUD
  - Achievements and accolades management
  - Featured members selection
  - Timeline/history view data
  - Search and filter functionality
  - Hall of Fame categories

- [ ] **BE-2: Feedback & Contact Service** (8h)
  - Feedback submission endpoint
  - Contact us form endpoint
  - Feedback categorization (bug, suggestion, general)
  - Email notification integration
  - Admin response tracking
  - Feedback status management

**Deliverable:** Broadcast + WhatsApp + Media + Hall of Fame + Feedback APIs complete

#### Frontend Mobile (FE-Mobile-1, FE-Mobile-2, FE-Mobile-3)

**Saturday Sep 19 (8h):**
- [ ] **FE-Mobile-1: Homepage - Broadcast & Notifications** (8h)
  - Broadcast message display widget on homepage
  - Live announcements banner
  - Notification center/inbox
  - Push notification setup
  - WhatsApp redirect integration
  - Homepage refresh and real-time updates

- [ ] **FE-Mobile-2: Media Page** (8h)
  - Media gallery view
  - Image grid layout (masonry/grid)
  - Video player integration
  - Media filters (by event, date, type)
  - Full-screen media viewer with swipe
  - Share media functionality

- [ ] **FE-Mobile-3: Hall of Fame Page** (8h)
  - Hall of Fame list view
  - Featured members carousel
  - Member detail page
  - Achievements display
  - Timeline view
  - Search and filter by category

**Sunday Sep 20 (8h):**
- [ ] **FE-Mobile-1: Feedback & Contact Us** (8h)
  - Feedback form screen with categories
  - Contact us form screen
  - Form validation
  - Submission success/error handling
  - FAQ section (static content)
  - Support ticket tracking

- [ ] **FE-Mobile-2: PopUps Implementation** (8h)
  - Event registration popup
  - Bid confirmation popup
  - Success/error popups (reusable)
  - Info/warning popups
  - Terms and conditions popup
  - Confirmation dialogs (delete, logout, etc.)

- [ ] **FE-Mobile-3: Homepage Content Integration** (8h)
  - Featured events section on homepage
  - Quick actions (register, leaderboard, challenges)
  - Recent activity feed
  - Upcoming events widget
  - User stats summary
  - Navigation to all sections

**Deliverable:** Homepage complete + Media + Hall of Fame + Feedback + All popups

#### Frontend Web Admin (FE-Admin)

**Saturday Sep 19 (8h):**
- [ ] **Media & Announcements Management** (8h)
  - Media library view (grid/list with filters)
  - Media upload interface (bulk upload)
  - Media approval workflow
  - Media categorization and tagging
  - Announcement creation and management
  - Broadcast message creation and sending interface

**Sunday Sep 20 (8h):**
- [ ] **Hall of Fame & Communications** (8h)
  - Hall of Fame management (add/edit/delete entries)
  - Achievement management
  - Feedback inbox view
  - Contact submissions view
  - Response interface for feedback/contact
  - Analytics dashboard (users, events, engagement)

**Deliverable:** Media + Announcements + Hall of Fame + Feedback admin complete

---

## 🔷 PHASE 5: Testing, Bug Fixes & Polish (Week 5)
**Dates:** Sep 26-27 (Sat-Sun)  
**Focus:** End-to-end testing, bug fixes, performance optimization, final polish

### Week 5: Sep 26 (Sat) - Sep 27 (Sun) - 16 hours

#### Backend (BE-1 & BE-2)

**Saturday Sep 21 (8h):**
- [ ] **Both: Integration Testing** (8h total)
  - End-to-end API testing
  - Authentication flow testing
  - Event registration flow testing
  - Auction flow testing
  - Points calculation verification
  - Load testing for critical endpoints
  - API documentation review and updates

**Sunday Sep 22 (8h):**
- [ ] **Both: Bug Fixes & Optimization** (8h total)
  - Fix critical and high-priority bugs
  - Database query optimization
  - API response time optimization
  - Error handling improvements
  - Security audit (input validation, XSS, injection)
  - Setup monitoring and logging

**Deliverable:** Tested, optimized, production-ready backend

#### Frontend Mobile (FE-Mobile: 3 people)

**Saturday Sep 21 (8h):**
- [ ] **All 3: Feature Testing** (8h each)
  - Complete user journey testing (registration → events → auction → profile)
  - Cross-device testing (Android/iOS)
  - Network error handling testing
  - Offline behavior testing
  - UI responsiveness across screen sizes
  - Create bug list with priorities

**Sunday Sep 22 (8h):**
- [ ] **All 3: Bug Fixes & Polish** (8h each)
  - Fix critical and high-priority bugs
  - UI/UX refinements
  - Loading states and error messages polish
  - Animations and transitions
  - Performance optimization (image caching, lazy loading)
  - Accessibility improvements

**Deliverable:** Tested, polished mobile app ready for MVP

#### Frontend Web Admin (FE-Admin: 1 person)

**Saturday Sep 21 (8h):**
- [ ] **Admin Testing** (8h)
  - Test all admin workflows
  - User management testing
  - Event creation and management testing
  - Media management testing
  - Communications testing
  - Create bug list

**Sunday Sep 22 (8h):**
- [ ] **Admin Bug Fixes & Final Touch** (8h)
  - Fix critical bugs
  - UI polish and consistency
  - Admin permissions and security testing
  - Dashboard analytics implementation
  - Help documentation for admin users

**Deliverable:** Production-ready web admin panel

---

## 🔷 PHASE 5: Final Integration & Deployment (Sep 23-27)
**Dates:** Sep 23-27 (Weekdays - Optional)  
**Focus:** Final integration, deployment preparation, MVP handoff

### Activities (If team works during week)
- [ ] **Backend:** Production deployment setup
  - Environment configuration
  - Database migration to production
  - CI/CD pipeline setup
  - Backup and recovery setup

- [ ] **Frontend Mobile:** Build and release preparation
  - Build production APK/IPA
  - App store listings preparation
  - Testing on production backend
  - Bug fixes from production testing

- [ ] **Frontend Web Admin:** Production deployment
  - Build production bundle
  - Deploy to hosting
  - Domain and SSL setup
  - Final production testing

- [ ] **All Team:** Documentation
  - User guides
  - Admin guides
  - API documentation
  - Known issues and workarounds

---

## 🎯 DEADLINE: September 28, 2026 (Monday)
**Final Deliverables:**
- ✅ Working mobile app (APK/IPA)
- ✅ Working web admin panel (deployed)
- ✅ Backend APIs (deployed and stable)
- ✅ All MVP features functional
- ✅ Basic documentation
- ✅ Known issues logged

---

## Risk Mitigation & Contingency

### High-Risk Items
1. **NoSQL Migration:** If migration takes longer, prioritize essential collections first
2. **Auction Real-time:** If real-time proves complex, implement polling-based approach
3. **Strava Integration:** If OAuth/API issues, defer to post-MVP with manual entry option
4. **WhatsApp API:** If integration is complex, use alternative notification method initially

### Backup Plans
- **Week 3 contingency:** If behind schedule, defer Challenge System to post-MVP
- **Week 4 contingency:** If behind schedule, simplify Hall of Fame to basic list view
- **Week 5 contingency:** Focus on critical bugs only, defer polish to post-MVP updates

### Success Criteria for MVP
- ✅ Users can register and login
- ✅ Users can view and register for events
- ✅ Auction system works for events
- ✅ Leaderboard displays correctly with points
- ✅ Admin can manage all entities
- ✅ No critical bugs blocking core workflows
- ✅ Basic error handling in place

---

## Testing Strategy Throughout

### Weekly Testing Checkpoints
- **End of Week 1:** Auth flow testing
- **End of Week 2:** User + Events basic flow
- **End of Week 3:** Full event flow with auction
- **End of Week 4:** All features smoke tested
- **End of Week 5:** Regression testing complete

### Testing Responsibilities
- **Backend:** Unit tests for services, integration tests for APIs
- **Frontend Mobile:** Manual testing on 2 devices minimum (Android + iOS)
- **Frontend Admin:** Browser testing (Chrome, Safari, Firefox)
- **Integration:** Cross-team testing sessions on Sundays

### Test Scenarios (Priority)
1. User registration and login
2. Event registration with form submission
3. Auction bidding flow
4. Points earning and leaderboard update
5. Admin event creation and publishing
6. Media upload and display
7. Broadcast message delivery

---

## Communication & Coordination

### Daily Standups (On working days)
- **What:** Quick sync (15 min)
- **When:** Start of 8-hour work session
- **Format:** What did you complete? What's next? Any blockers?

### Dependency Alerts
- Frontend teams should flag API needs early
- Backend team should communicate API availability
- Use shared task board (Jira/Trello/GitHub Projects)

### Code Review
- All PRs require 1 review before merge
- Critical path features require testing by another team member
- Admin panel PRs can be self-merged if time-critical

---

## Post-MVP Roadmap (Out of Scope for Sept 28)

### Phase 6: Social Features (Oct-Nov)
- General social feed
- Friends system
- Post creation and interactions

### Phase 7: Monetization (Nov-Dec)
- Store page
- Sponsors integration
- Premium features

### Phase 8: Community (Dec-Jan)
- Unions/Clubs
- Newsletter system
- Advanced social features

---

## Notes & Assumptions

1. **Database Choice:** Assuming MongoDB or Firestore (team to decide Week 1)
2. **Mobile Framework:** Assuming React Native or Flutter (already decided)
3. **Admin Framework:** Assuming React/Next.js with MUI or Ant Design
4. **Hosting:** Backend on AWS/GCP/Azure, Frontend on Vercel/Netlify
5. **API Architecture:** RESTful APIs (GraphQL if team prefers)
6. **Real-time:** WebSockets for auction if needed, otherwise polling
7. **File Storage:** AWS S3 / GCP Storage / Firebase Storage
8. **Authentication:** JWT-based with refresh tokens

---

## Success Metrics

### By September 28:
- [ ] 100% of MVP features implemented
- [ ] <10 critical bugs remaining
- [ ] <30 total bugs remaining
- [ ] 80%+ test coverage on backend critical paths
- [ ] Mobile app builds without errors
- [ ] Admin panel deployed and accessible
- [ ] Backend APIs documented

---

**Document Version:** 1.0  
**Last Updated:** August 24, 2026  
**Owner:** BGSC Platform Team  
**Next Review:** End of Week 2 (September 1)
