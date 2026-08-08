
## 1. Application Overview

### 1.1 Introduction

The platform is a comprehensive, **event-driven** application utilizing a microservices architecture, designed to serve as the digital hub for the BITS Goa sports and esports communities. It acts as a dual-purpose platform: a public-facing social and event engagement hub for students and gamers, and a robust internal workspace ("Union Page") for the core organizing committees (BGSC, BGEC, FitSoc).

By integrating external activity trackers (Strava, Steam), gamifying community participation through a points system, and providing seamless event management, the platform unifies campus recreation. Furthermore, it empowers the internal crew with advanced task management, automated communication, and role-based access controls to efficiently execute large-scale leagues and events.

### 1.2 Target Users

- **Guest:** Unauthenticated visitors with read-only access to public events and announcements.
    
- **User:** Authenticated students with access to personalized feeds, social features, and event registration.
    
- **Member (Union):** BGSC/BGEC crew members with restricted internal access to assigned events/tasks.
    
- **Core:** Event and workspace managers with full operational access to events they are assigned to.
    
- **Coordinator:** Top-level operational managers with full access except Founder role modification.
    
- **Founder / Admin:** Absolute access to all system configurations, roles, and data.
    

### 1.3 Core Philosophy

- **Events First:** The platform revolves around event discovery, registration, and management.
    
- **Gamified Engagement:** Points, challenges, leaderboards, and sponsor affiliations drive participation.
    
- **Community-Driven:** Social features, matchmaking, and content sharing create network effects.
    
- **Operational Excellence:** Internal tools must be as polished as public-facing features.
    
- **Event-Driven Architecture:** All state changes propagate through events, enabling real-time updates, audit trails, and loose coupling between services.
    

## 2. Architecture & Technical Stack

### 2.1 Architectural Pattern: Event-Driven Microservices

The platform follows an **Event-Driven Architecture (EDA)** where all significant state changes emit domain events. Services communicate asynchronously via an event bus, enabling loose coupling, horizontal scalability, and real-time feature support.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (MVVM)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   React      │  │   React      │  │   React      │  │    React     │  │
│  │   Native     │  │   Native     │  │   Native     │  │    Web       │  │
│  │   (iOS)      │  │   (Android)  │  │   (PWA)      │  │   (Admin)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                     │
│                         MVVM Pattern (ViewModel)                         │
│                         Event Sourcing (Client State)                    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTPS / WebSocket
┌────────────────────────────────────┴─────────────────────────────────────┐
│                      API GATEWAY (Kong / AWS API GW)                     │
│  - JWT Validation  - Rate Limiting  - Request Routing  - SSL/TLS         │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴─────────────────────────────────────┐
│                      EVENT BUS (Apache Kafka / RabbitMQ)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  user    │  │  event   │  │  social  │  │  union   │  │  points  │    │
│  │ events   │  │ events   │  │ events   │  │ events   │  │ events   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ Publish / Subscribe
┌────────────────────────────────────┴─────────────────────────────────────┐
│                     MICROSERVICES (Domain-Driven)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  Auth    │ │  User    │ │  Event   │ │  Social  │ │  Union   │        │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │ Service  │        │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  Points  │ │  Media   │ │  Notif.  │ │  Search  │ │  Audit   │        │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │ Service  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐                                               │
│  │ Sponsor  │ │  Hall    │                                               │
│  │ Service  │ │  of Fame │                                               │
│  │          │ │ Service  │                                               │
│  └──────────┘ └──────────┘                                               │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴─────────────────────────────────────┐
│                      Cache (Redis)                                       │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     |
┌────────────────────────────────────┴─────────────────────────┐
│                      DATA LAYER                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐  ┌──────────┐     │
│  │PostgreSQL│ | MongoDB  │ │Elasticsearch│  │  S3      │     │
│  │ (Primary)│ │ (Logs)   │ │  (Search)   │  │(Files)   │     │
│  └──────────┘ └──────────┘ └─────────────┘  └──────────┘     │
└──────────────────────────────────────────────────────────────┘
```

#### Event-Driven Flow Examples

**Event Registration Flow:**

1. User clicks "Register" → `POST /api/events/{id}/register`
    
2. Event Service validates → writes to DB → emits `EventRegistrationCreated` event
    
3. Points Service consumes → awards points → emits `PointsAwarded` event
    
4. Sponsor Service consumes → updates sponsor fan counts if user is affiliated
    
5. Notification Service consumes → sends push/email
    
6. User Service consumes → updates user's event history cache
    

**Auction Bid Flow:**

1. Captain places bid → `POST /api/auctions/{id}/bid`
    
2. Auction Service validates (purse, timing) → writes to DB → emits `AuctionBidPlaced` event
    
3. WebSocket Gateway consumes → broadcasts to all connected clients in auction room
    
4. Notification Service consumes → updates other captains
    
5. Audit Service consumes → logs bid for transparency
    

### 2.2 Frontend Pattern: MVVM (Model-View-ViewModel)

The client application follows **MVVM (Model-View-ViewModel)** pattern with **Event Sourcing** for local state management.

```
┌─────────────────────────────────────────┐
│              VIEW (UI)                  │
│  - React Components / React Native      │
│  - Observes ViewModel state             │
│  - Dispatches user actions              │
│  - Re-renders on state changes          │
└──────────────────┬──────────────────────┘
                   │ observes
┌──────────────────┴──────────────────────┐
│           VIEWMODEL                     │
│  - Exposes observable state             │
│  - Contains presentation logic          │
│  - Transforms raw data for UI           │
│  - Handles user actions                 │
│  - Emits commands to Model              │
└──────────────────┬──────────────────────┘
                   │ commands
┌──────────────────┴──────────────────────┐
│              MODEL                      │
│  - Domain entities and business logic   │
│  - API client / Repository pattern      │
│  - Local cache (React Query / Redux)    │
│  - Event sourcing for optimistic UI     │
└─────────────────────────────────────────┘
```

#### State Management Strategy

- **Global State:** Zustand / Redux Toolkit (auth, user, notifications)
    
- **Server State:** React Query / TanStack Query (events, posts, friends)
    
- **Local State:** React useState / useReducer (forms, UI toggles)
    
- **Event Store:** Client-side event log for optimistic updates and offline support
    

#### MVVM Implementation Example (Event Registration)

```
// Model (Repository)
class EventRepository {
  async registerForEvent(eventId: string): Promise<Registration> {
    const response = await api.post(`/events/${eventId}/register`);
    return response.data;
  }
}

// ViewModel
class EventViewModel {
  registrationState = observable<AsyncState<Registration>>({ status: 'idle' });

  async register(eventId: string) {
    this.registrationState.set({ status: 'loading' });
    try {
      const registration = await eventRepository.registerForEvent(eventId);
      this.registrationState.set({ status: 'success', data: registration });
      eventBus.emit('REGISTRATION_SUCCESS', { eventId, registration });
    } catch (error) {
      this.registrationState.set({ status: 'error', error });
    }
  }
}

// View (React Component)
const EventCard = ({ eventId }: { eventId: string }) => {
  const vm = useEventViewModel(eventId);
  const state = useObservable(vm.registrationState);

  return (
    <Card>
      <Button 
        onPress={() => vm.register(eventId)}
        loading={state.status === 'loading'}
      >
        {state.status === 'success' ? 'Registered!' : 'Register'}
      </Button>
    </Card>
  );
};
```

### 2.3 System Stack

|   |   |   |
|---|---|---|
|**Layer**|**Technology**|**Rationale**|
|**Mobile App**|React Native (Expo)|Single codebase for iOS/Android; campus users are mobile-first|
|**Web Frontend**|React + Tailwind CSS|Admin dashboards, PWA for desktop users|
|**Frontend Pattern**|MVVM + Event Sourcing|Clean separation, testable, real-time reactive UI|
|**Backend API**|Node.js (NestJS)|Native TypeScript, excellent event-driven support, high concurrency|
|**Event Bus**|Apache Kafka|Durable event log, replay capability, horizontal scaling|
|**Primary Database**|PostgreSQL|Relational data integrity, ACID compliance for transactions|
|**Cache & Sessions**|Redis|Session store, rate limiting, real-time leaderboards, pub/sub|
|**Document Store**|MongoDB|Media metadata, event logs, unstructured content|
|**Real-Time**|Socket.io + Redis Adapter|Auctions, chat, live leaderboard updates across server instances|
|**Message Queue**|BullMQ (Redis-based)|Async job processing: WhatsApp sends, email digests, image processing|
|**File Storage**|AWS S3 / Cloudflare R2|Media, PDFs, profile pictures, exports|
|**CDN**|CloudFront / Cloudflare|Global delivery for static assets and media|
|**Search**|Elasticsearch|Fuzzy username/event search, typo tolerance, faceted search|
|**Authentication**|JWT (Access + Refresh) + OAuth2|Stateless, scalable auth; Google OAuth integration|
|**Push Notifications**|Firebase Cloud Messaging (FCM)|Cross-platform push delivery|
|**Error Tracking**|Sentry|Real-time error monitoring and alerting|
|**Infrastructure Monitoring**|Grafana + Prometheus|API latency, DB performance, queue depth|
|**Container Orchestration**|Docker + Kubernetes|Scalable microservices deployment|
|**CI/CD**|GitHub Actions + ArgoCD|Automated testing and deployment|

### 2.4 Scalability Considerations

- **Horizontal Pod Autoscaling:** API servers scale based on CPU/memory and request queue depth
    
- **Database Read Replicas:** Event browsing and leaderboard queries served from replicas
    
- **CDN Caching:** Public event pages and media cached at edge locations
    
- **Async Job Processing:** Image resizing, video compression, bulk notifications via worker queues
    
- **Event Replay:** Kafka event log enables replay for debugging, new service hydration, and audit
    
- **CQRS (Command Query Responsibility Segregation):** Write model (PostgreSQL) separate from read model (Redis + Elasticsearch) for complex queries
    

## 3. Global UI/UX Frame & Navigation

### 3.1 Dynamic Status Bar

A persistent, context-aware status bar present on all screens:

- **Center:** Contextual Logo that changes based on the current module:
    
    - Home / Landing → BGSC logo
        
    - Esports Events → BGEC logo
        
    - Fitness Events → FitSoc logo
        
    - Specific Events (e.g., Offside) → Event-specific logo
        
- **Left:** Global Navigation / Side Drawer toggle containing routing links to all major modules.
    
- **Right:** - Authenticated: User Profile Picture (triggers Account Actions pop-up).
    
    - Guest: Login button (routes to Login/Registration Page).
        

### 3.2 Navigation Drawer (Side Drawer)

Contains links to:

- Home / Landing Page
    
- Point System and Challenge Page
    
- Sponsor / Newsletters Page
    
- Friends Page
    
- Events Page
    
- Leaderboards
    
- Hall of Fame
    
- Store Page
    
- Media Page
    
- Feedback and Contact Us
    
- Union Page (internal-only, visible based on role)
    
- Users Page (admin-only, visible based on role)
    

### 3.3 Authentication States

- **Guest View:** Mirrors the core features of the public BGSC website. Read-only access to public events, announcements, and public posts. No social interactions.
    
- **Authenticated View:** Unlocks personalized feeds, friend systems, internal routing, user profiles, points system, and event registration.
    

## 4. Data Models (Domain-Driven)

### 4.1 Core Entities

```
User: id, username, email, password_hash, contact, role, avatar_url, 
      interests[], socials{}, strava_id, steam_id, points_balance, 
      status, created_at, last_active, settings{}, newsletter_subscriptions[],
      active_sponsor_id

Event: id, title, description, type[LE|DE|ALL|DLL], status[upcoming|ongoing|past], 
       start_date, end_date, venue, rules_pdf_url, award_list[], 
       needs_leaderboard, is_teamed, team_size, max_teams,
       registration_deadline, created_by, tags[], 
       core_admins[], points_pool{}, is_auction_based

Team: id, event_id, name, captain_id, members[], status[open|invite_only|closed],
      registration_cost, max_members, invite_code

Task: id, title, description, type[quick|standard|pathway|event_task], 
      assignees[], deadline, priority, status[active|abandoned|completed], 
      parent_task_id, event_id, created_by, updates[], reminders[], 
      is_public, chat_group_id, steps[]

Post: id, user_id, media_urls[], caption, tags[], 
      visibility[public|protected|private], likes_enabled, comments_enabled, 
      comments_visibility[public|protected|private], shares_allowed, created_at

Friendship: id, requester_id, recipient_id, status[pending|accepted|rejected|blocked], created_at

Notification: id, user_id, type, title, body, data_payload, 
              is_read, channel[in_app|push|email|whatsapp], created_at

PointTransaction: id, user_id, amount, type[earn|spend|refund], 
                source[event|challenge|store|leaderboard], reference_id, created_at

Announcement: id, title, body, type[BGEC|FitSoc|Airball|Offside|PowerPlay|AroundTheNet|Deuce|Highlight|Teams], 
              tags[], created_by, whatsapp_sent, created_at, expires_at

Match: id, event_id, team_a_id, team_b_id, score_a, score_b, 
       parameters{}, status[scheduled|ongoing|completed|cancelled], 
       scheduled_at, completed_at, venue

Auction: id, event_id, player_id, current_bid, current_bidder_id, 
         status[upcoming|active|sold|unsold], min_bid_increment, 
         bid_history[], timer_start, timer_end

StoreItem: id, name, description, image_url, points_cost, stock, 
           category[merch|indie_game], status[available|sold_out|discontinued]

Challenge: id, title, description, domain, team_limit, time_limit, 
           resource_links[], award_points, difficulty[easy|medium|hard|legend], 
           status[active|completed|archived]

MediaAlbum: id, event_id, title, cover_image_url, media_items[], 
            visibility, created_at

FeedbackTicket: id, user_id, category[bug|feature|complaint|general], 
                severity, description, attachments[], status, created_at, response

AuditLog: id, actor_id, action, target_type, target_id, 
          previous_value, new_value, timestamp

Sponsor: id, name, logo_url, description, website_url, 
         tenure_start, tenure_end, status[active|inactive], 
         prizes[], total_fans, ranking

UserSponsorAffiliation: id, user_id, sponsor_id, 
                        affiliated_at, fan_count, events_won[],
                        total_points_contributed

SponsorRanking: id, sponsor_id, semester, year, 
                total_fans, rank, events_won_count, 
                top_contributors[], prize_awarded

SponsorPrize: id, sponsor_id, title, description, 
              criteria[top_fans|most_wins|highest_rank], 
              threshold, points_cost, status[available|claimed|expired]
```

## 5. Page & Feature Specifications

### 5.1 F: Login / Registration Page

**Visibility:** Public (Guest + All authenticated users for re-login)

**Common Fields (Both Login & Register):**

- Forgot password link
    
- Sign up with Google (OAuth2)
    

**Login Page:**

- Move to register page link
    
- Username / Email `*U` (required, unique)
    
- Password `*` (required)
    
- Session persistence toggle ("Keep me logged in")
    

**Registration Page:**

- Username `*U` (required, unique)
    
- Email `*U` (required, unique)
    
- Contact (optional)
    
- Password `*` (required)
    
- Re-enter Password `*` (required, must match)
    
- Terms of Service and Privacy Policy acceptance checkbox `*`
    
- **Sponsor Selection:** Dropdown of active sponsors for the current semester/year. User must select one `*`. This becomes their affiliated sponsor.
    
- Post-registration: Automatically triggers the Get Started Popup sequence
    

### 5.2 F: Home Page (Landing Page)

**Visibility:** Public (Guest + Authenticated)

**Layout:** Tab navigation with three sub-pages.

#### Tab 1: Introduction / Landing

- Introduction to BGSC and its subsections (BGEC, FitSoc)
    
- Catchy one-liners and campus sports culture highlights
    
- **"What Our Heads Have to Say" Section:**
    
    - Pixelated/photographic portraits of coordinators posed in announcement stance
        
    - Thought-box / comic-style speech bubbles displaying their latest announcement
        
    - If a coordinator has no announcements, a meme is displayed instead
        
    - Quick link to full Announcements page
        
    - Reference design: https://www.behance.net/gallery/27476403/Minions-Website
        

#### Tab 2: Announcements

- Centralized announcement feed (similar to Moodle/AWS broadcasting)
    
- WhatsApp API integration for automatic broadcasting (budget-dependent)
    
- Coordinators and Admins can create new announcements via the Make Announcement Popup (accessible on-the-go on mobile or web).
    
- Retention policy: Only announcements from the past 4 months are displayed and stored
    
- Attribution: Shows which coordinator/admin made each announcement
    
- Categories: BGEC, FitSoc, Airball, Offside, PowerPlay, Around The Net, Deuce, Highlight Events, Teams
    

#### Tab 3: General Social Feed

- Public posts from friends and community (public visibility only)
    
- Add Post button (floating action button, bottom-right)
    
    - Guest click → redirect to Login Page
        
    - Authenticated click → opens Add Post Popup
        

### 5.3 P: User-Profile Page

**Visibility:** Authenticated only (replaced by Login button if logged out)

**Status Bar:** Custom status bar for this page:

- Left: Back button → returns to Landing Page
    
- Center: "Account Actions" button → opens Account Action Popup
    
- Right: Profile Picture → opens Profile Picture section
    

#### Player Card / User Card (Center of Page)

Inspired by: https://pin.it/81Wcd43Gj

- Username
    
- Avatar (2D illustration)
    
- Short Description / Bio
    
- Sports / Esports Interests (Games)
    
- Animations (entrance/idle)
    
- Goal Achievements
    
- Custom Tags (game/sport-specific, e.g., "Striker", "IGL")
    
- **Active Sponsor Badge:** Logo and name of currently affiliated sponsor
    
- Social Media Links / Handles
    
- Fixed Rating Section (computed metrics)
    
- Shareable Card export (image generation for social media)
    
- Matchmaking integration: Used elsewhere to find similar players
    

#### User Info Section (Below Card)

- Tags given by friends
    
- Name, Email, Contact
    
- Interest fields (Sports + Esports)
    
- Newsletter subscriptions and interaction data
    
- Sport activity (Strava integration)
    
- Esport activity (Steam integration)
    
- Connected social accounts
    
- **Sponsor Stats:**
    
    - Current sponsor name and logo
        
    - Personal fan count earned for sponsor
        
    - Events won contributing to sponsor
        
    - Sponsor ranking position
        

#### Event Suggestions Section

- Upcoming and highlight events tailored to user interests
    
- Forces discovery of new categories (exploration algorithm)
    
- For teamed tournaments: list of open public teams below each event card
    

#### Friends Suggestions Section

- Suggestions based on contact list, shared interests, or event activity
    

#### History Section

- Events participated in
    
- Games played / match history
    
- Challenge completions
    
- Sponsor contribution history (events where user earned fans for their sponsor)
    

#### Future Roadmap

- "Looking For?" dating/matchmaking feature (relationship status)
    
- Deeper connection features based on community interests
    

### 5.4 P: Friends Page

**Visibility:** Authenticated only

**Layout:** Tab navigation with 5 tabs.

#### Tab 1: General Chats & Search

- Friend list with chat previews
    
- Search bar:
    
    - Find friend by username/name
        
    - Search results show: Mutuals, Activities/Interests, Player Card preview, Sponsor affiliation
        
- Friend Requests button (beside search bar):
    
    - View all incoming/outgoing requests
        
    - Accept / Reject / Cancel
        
    - Add / Remove friend actions
        
- Chat Section:
    
    - Direct Messages (DMs)
        
    - Group Chats
        
    - Community Servers
        
- Active Users indicator (online status)
    

#### Tab 2: Activities & Events

- Events that friends have participated in
    
- Filter by live / past
    

#### Tab 3: Recent Achievements

- List of friends with recent wins/achievements
    
- Expandable detail view per friend
    
- Sponsor fan contributions visible
    

#### Tab 4: Challenge Friends

- Browse available challenges
    
- Select challenge + target friend(s)
    
- Send challenge invitation
    
- Challenge types: Physical (space/time required) or Digital (timeline-based)
    

#### Tab 5: Team Up For Event

- Select event from upcoming list
    
- Send team-up requests to specific friends
    
- View open public teams for that event
    

#### Friends System Logic

- Suggest friends based on similar interests + sponsor affiliation (optional filter)
    
- Weekly/Monthly interest update prompts (popup)
    
- Interest auto-update based on newsletter interaction
    
- Collaboration option for games/events
    
- Active friends / teammates indicator
    
- Friend participation tracking (live and past)
    
- Challenge system for both sports and esports
    

### 5.5 F: Events Page

**Visibility:** Public (browse), Authenticated (registration)

**Layout:** Tab navigation.

#### Event Categories (Tabs)

- Leagues (Sports + Esports)
    
- BGEC Events
    
- FitSoc Events
    
- General Events (Highlight events, Waves, sponsored events)
    

#### Filters (Per Tab)

- Past
    
- Upcoming
    
- Ongoing
    
- Multi-select enabled (can view all simultaneously)
    

#### Event Details View (Read-Only/Standard Participant Experience)

- Event info (title, description, rules PDF/link, awards, scheduling dates, coordinator contact points).
    
- **Sponsor Leaderboard Preview:** If event is active, show which sponsor is leading in fan contributions for this event type.
    
- Event registration section:
    
    - Name, game name.
        
    - Role selection: Team Captain or Team Member.
        
        - If Captain: Team name input, invite codes, and joining parameters.
            
        - Team participant count tracking.
            
        - Team status toggle: Open / Invite Only / Closed.
            
- Event Team Formation Section:
    
    - View team invites / own team details.
        
    - Send team invites to users who are "Open to join".
        
    - Search registered teams with multi-faceted filters.
        
    - User toggle: Open / Closed / Invite Only (controls if others can invite them to teams).
        
- Event Leaderboard (if active and enabled).
    
- Event Status indicator.
    
- Event Results (post-completion).
    
- **Post-Event Sponsor Update:** When results are published, users who won earn virtual fans for their sponsor. Display: "+X fans earned for [Sponsor Name]".
    

#### League-Specific Registration

- Same as events, plus:
    
- **Captain Request Flow:**
    
    - Users can apply for the Team Captain role during the registration window.
        
    - Captain applications are reviewed by the Core members assigned to that league.
        
    - Approved captains are reflected in the auction system or team availability list.
        
- If auction-based:
    
    - Team Captain: No additional fields required.
        
    - Team Member: Starting cost / base price input.
        
    - System displays: Average price, deviation, variance to guide pricing.
        

#### Spectator Bracket View

- View highly styled, real-time updated match bracket trees (Round Robin grids, Single/Double Elimination brackets, bypass rounds) rendered beautifully on device screen.
    
- Clicking any match in the tree displays scheduled venue, date, team roster sheets, historical head-to-head parameters, and real-time score feeds.
    
- **Operational Boundaries Clarification:** Admins/Coordinators get a "Manage on Web" redirection anchor link instead of on-device editing capabilities. All structural layouts, ruleset definitions, bracket configurations, and scores parameters mapping take place strictly inside the dedicated Web Console to prevent layout bloat on mobile screens.
    

#### Auction Event Interface (Mobile Spectator View)

- General spectators can view:
    
    - Live player currently standing on the block.
        
    - Live bid log updates.
        
    - 5-second countdown timer per bid.
        
    - Bid history of captains.
        
    - Core team captain wallets and rosters.
        

### 5.6 F: Leaderboards Page

**Visibility:** Public (view), Authenticated (participate/invest)

- View all active events with leaderboards
    
- Filter by tags, participation status, event type
    
- **Points Investment:** If user is a participant and event permits, user can invest points to improve rank
    
- Leaderboard formats supported: Round Robin, Upper-Lower Bracket, Direct Elimination, Elimination after $N$ fails
    
- Min participant threshold required to activate leaderboard
    
- Score normalization controls (lower limit $\ge 0$, upper limit $\le 1000$)
    

### 5.7 P: Point System & Challenge Page

**Visibility:** Authenticated only

#### Points System

- User points balance display
    
- Points earning sources:
    
    - Event participation
        
    - Challenge completion
        
    - Platform engagement (posts, invites)
        
    - Sponsor-related bonuses (winning events for your sponsor)
        
- Points spending:
    
    - Store redemption
        
    - Leaderboard investment
        
- Transaction history
    

#### Challenge System

- Challenge browser:
    
    - Domain filter (Sports, Esports, Game Dev, General)
        
    - Difficulty levels: Easy, Medium, Hard, Legend
        
    - Team limit indicator
        
    - Time limit display
        
    - Resource section (help links/guides)
        
    - Award points display
        
- Legend-level challenges grant Hall of Fame entry
    
- Challenge types:
    
    - Physical (dedicated space/time required)
        
    - Digital (timeline-based, details revealed upon acceptance)
        
- Progress tracking and submission portal
    

### 5.8 F: Sponsor / Newsletters Page

**Visibility:** Public

#### Active Sponsors Section

- **Current Tenure Display:** Active sponsors for the current semester/year with countdown to tenure end
    
- **Sponsor Cards:**
    
    - Sponsor name, logo, description, website link / Sponser Vid
        
    - Total fan count (aggregate from all affiliated users)
        
    - Current ranking among active sponsors
        
    - Number of affiliated users
        
    - Events won count
        
- **Sponsor Leaderboard:**
    
    - Ranked list of all active sponsors
        
    - Sort by: Total Fans, Events Won, Affiliated Users
        
    - Time-filter: This Semester, This Year, All Time
        
    - Visual bar chart showing fan distribution
        
- **User Affiliation:**
    
    - Current user sponsor badge
        
    - "Change Sponsor" button (limited to once per semester)
        
    - Fan contribution breakdown: "You have earned X fans for [Sponsor]"
        

#### Sponsor Prizes & Rewards

- **Preset Prize Pool:** Prizes configured by admin for each sponsor tenure
    
- **Prize Categories:**
    
    - Top Fan Contributor (individual user who earned most fans)
        
    - Top Winning Sponsor (sponsor with most event wins)
        
    - Highest Ranked Sponsor (by composite score)
        
    - Random Draw (among users who earned $>N$ fans)
        
- **Prize Display:**
    
    - Prize name, description, image
        
    - Criteria to win
        
    - Current leader (if applicable)
        
    - Claim status
        
- **Prize Distribution:**
    
    - Auto-awarded at end of tenure
        
    - Notification to winners
        
    - Digital certificate + physical prize coordination
        

#### Sponsor Archive

- Past sponsors with their tenure period
    
- The events for which that sponsor was part of along with some media
    
- Social links to those sponsor's page and the event as well
    

#### Newsletter Section

- Gaming and game development world updates
    
- Subscribe/Unsubscribe management
    
- Interaction tracking (opens, clicks) to update user interest profiles
    
- Newsletter categories:
    
    - Gaming Industry News
        
    - Indie Game Spotlights
        
    - Game Development Tutorials
        
    - Campus Studio Updates
        

### 5.9 F: Hall of Fame

**Visibility:** Public

- Aesthetic collection of all winners
    
- Categories:
    
    - League Winners (per sport/esport)
        
    - Highlight Event Winners
        
    - Challenge Legends
        
    - **Sponsor Champions:**
        
        - Top sponsor per semester/year with fan count
            
        - Top individual contributors per sponsor ("MVP" fans earners)
            
        - Sponsor dynasty tracking (consecutive wins)
            
        - Visual timeline of sponsor dominance
            
- Winner cards: Event name, Winner name/team, Date, Trophy icon, Quote, Sponsor affiliation (if applicable)
    
- Filter by year, event type, sport, sponsor
    
- Shareable winner cards
    

### 5.10 P: Store Page

**Visibility:** Authenticated (browse), Authenticated (redeem)

#### Merchandise Store

- Points redemption for physical/digital merch
    
- Item cards: Image, name, description, points cost, stock status
    
- Cart and checkout flow (points deduction)
    
- Order tracking: Pending → Processing → Shipped → Delivered
    

#### Indie Game Support

- Publish and promote games developed by campus studio or partner studios
    
- Game cards: Trailer, description, download link, points cost (if paid)
    
- Future: Separate app once marketing scales
    

#### Friendly Games Jam Section

- Idea board for game concepts
    
- Users can pitch ideas under Dev section
    
- Studio admins (Founder perms) manage submissions
    
- Upvote/comment system on pitches
    

#### Friendly Gaming Section

- Third-party overlay integration for voice calls
    
- Discord/Steam integration for coordination
    

### 5.11 F: Media Page

**Visibility:** Public (with permission-based filtering)

#### Layout

- Masonry grid (Pinterest-style) with lazy loading
    
- Dynamic layout adapting to screen size
    

#### Sections

- **Event Albums:** Auto-generated per event (Offside, Waves, etc.)
    
- **Community Uploads:** User-generated clips/images (moderated)
    
- **Memories:** "Year in Review" auto-compilation for each user
    
- **Sponsor Galleries:** Media from sponsor-branded events
    

#### Filters

- By event tag
    
- By date range
    
- By uploader
    
- By media type (photo / video / clip)
    
- By sponsor
    

#### Actions

- Download (if permitted)
    
- Share to external platforms
    
- Add to "My Memories"
    
- Report content
    

#### Permissions

- Public media: Visible to guests
    
- Private media (from friends-only posts): Visible only to friends
    
- Event-specific media: Visible based on event visibility
    
- Sponsor media: Visible to all
    

#### Upload Flow

- Via Add Post Popup → auto-tagged to event if posted from event page
    
- Camera and gallery access required
    

### 5.12 F: Feedback & Contact Us

**Visibility:** Public

#### Feedback Ticket System

- Categories: Bug Report, Feature Request, Event Complaint, General
    
- Severity: Low, Medium, High, Critical
    
- Description field with rich text
    
- Anonymous submission toggle
    
- Attachment support (screenshots, up to 5MB)
    
- Auto-reply with ticket ID
    
- Status tracking: Submitted → Under Review → Resolved → Closed
    

#### Contact Directory

- Current Coordinators: Name, Role, Email, WhatsApp (masked until clicked to reveal)
    
- Past Coordinators (Hall of Admin): Legacy team with tenure period, role, and quote
    
- Quick action buttons: Email, Copy contact, Report issue to specific coordinator
    

#### FAQ Section

- Expandable accordion with search functionality
    
- Sections: Account, Events, Points, Union, Technical, Privacy, Sponsors
    
- Auto-suggest based on search keywords
    

### 5.13 P: Union Page (Internal Workspace)

**Visibility:** Member, Core, Coordinator, Founder only

**Layout:** Full-width dense dashboard layouts optimized for desktop screen.

#### Task & Project Management

- **Task Creation:**
    
    - Quick Add: Floating dashboard overlay accessible on Web and Mobile for memory-logging unassigned minor tasks without full details.
        
    - Strict Add (Web Console Exclusive): Comprehensive layout configuration detailing deadline dates, multiple assignees, specific event associations, level of priority, and extensive sub-task trees.
        
- **Task Hierarchy:**
    
    - Main Tasks (Epic/Theme milestones)
        
    - Grouped Tasks (task groups/sprint categories)
        
    - Mini Tasks (sub-tasks checklist)
        
    - Pathway Tasks: Continuous, trackable operational pathways with deadlines (e.g., "Build 2D Platformer"). Dynamic tracks display updates; inactive tracks transition automatically to "Abandoned" status.
        
- **Task Views (Fully Switchable):**
    
    - List View (hierarchical data rows)
        
    - Gantt Chart View (visual dependency lines and timelines)
        
    - Calendar View (grid-aligned schedules)
        
    - Kanban Board View (cards across customizable columns)
        
- **Task Status:** Active, Abandoned, Completed, On-Hold
    
- **Task Privacy:** Public (visible to all Union members) or Private (restricted to assigned personnel)
    
- **Task Updates:** Threaded timeline logs showing comments, uploaded file attachments, and completion indicators.
    
- **Crew Allocation Heatmaps:** Visual grid overlay showing core workspace members' on-duty calendars and current active task workloads to prevent scheduling congestion.
    

#### Team Coordination & Scheduling

- **Automated Task Chats:** Assigning crew members to a task dynamically instantiates a dedicated group chat on friends service linked to that specific task card.
    
- **Google Calendar Sync:**
    
    - Two-way REST API integration.
        
    - Dynamic imports of BITS academic timetables.
        
    - Automated task and meeting exports with background sync notifications.
        

### 5.14 P: Users Page (Administration)

**Visibility:** Coordinator, Founder only

**Layout:** Desktop-optimized pagination grids with infinite scroll support.

#### User Management Table

- Columns: Full Name, Active Email, Role, Status Flag (Active/Suspended), Last Active Epoch, Participations Count, Registration Date, Active Sponsor Affiliation.
    
- Multi-Faceted Filters: Role dropdown, User status, Join date brackets, Sponsor groups.
    

#### Role Management Engine

- **Promotion to Core:** Form requires operational authorization logs detailing justifications.
    
- **Promotion to Coordinator:** Secure workflow requiring immediate **2FA/TOTP verification code verification** from Founder session on PWA workspace.
    
- **Demotion / Suspension:** Audit trail log mandatory. Cannot demote own active session.
    

#### Sponsor Management

- **Sponsor Onboarding Wizard:** Form initializing corporate sponsors, tenure boundaries, asset fields (high-res logos, website links, custom sponsor promotion videos), and reward tiers.
    
- **Tenure End Settlement Panel:** Red action button initiating database aggregation scripts. Freezes current transaction ledger, calculates final sponsor ranking vectors, identifies award winners, automatically distributes digital certificates, and provides comprehensive CSV data reports.
    

#### Audit & Moderation Workspace

- **Impersonation Sandbox Engine:** Safe view-only portal running sandboxed client simulation mimicking targeted user session for bug diagnostic analysis. Explicit logs are published to the immutable audit ledger.
    
- **Audit Log Explorer:** Cryptographically structured data rows showing Timestamp, Actor ID, Event Action, Target Type, Target ID, Previous State Value, and New State Value.
    

### 5.15 Web Admin Workspace: Master Event, League & Rule Engine Configurator

**Visibility:** Core, Coordinator, Founder only

**Layout:** Comprehensive multi-step creation workflows and visual structural editors on React Web Console.

#### 1. Structural Event/League Builder Wizard

- **Base Information Form:** Input Title, Rich-text Description, Cover Media, Venue Dropdown, and Calendar Scheduling bounds.
    
- **Ruleset PDF Upload Area:** Drag-and-drop media module with EXIF stripping and virus scans. Parses PDF outlines directly to rules metadata fields.
    
- **Registration Deadline Gates:** Set registration opening time, team capping limits, and roster finalization closures.
    
- **Administrative Assignment Matrix:** Multi-select checklist assigning specific Core and Member roles to serve as administrators/referees of the event.
    

#### 2. Visual Bracket Generator Engine

- **Bracket Type Configuration:** Dropdown to select system structures:
    
    - Round Robin (auto-calculates matches based on team counts)
        
    - Single Elimination (tree diagram rendering team seeds)
        
    - Double Elimination (Upper and Lower Bracket split trees)
        
    - Elimination after $N$ failures (where $N$ is configured dynamically via slider)
        
- **Interactive Bracket Canvas:** Scalable vector drag-and-drop node graph. Admins can click match boxes to manually change seed positions, award bye-rounds, reschedule specific matchups, or override match results.
    

#### 3. Dynamic Rule Scoring Engine

- **Point Award Toggles:** Configure direct points earning parameters:
    
    - Base points for participation
        
    - Winner multiplier variables
        
    - Sponsor affinity bonus points allocation
        
- **Custom Parameter Score Matrix:** Dynamic table mapping key-value input variables for scorecards (e.g., creating variables like `goals: int`, `mvp: bool`, `assists: int` for Airball; or `kills: int`, `deaths: int`, `bomb_defuses: int` for esports leagues).
    
- **Score Normalization Constraints:** Input sliders setting baseline lower limits ($\ge 0$) and upper limits ($\le 1000$) to convert diverse sports metrics into standard platform leaderboard values.
    

#### 4. The Live Auction Hub Console

- **Auction Room Initialization:** Setup panel defining:
    
    - Captain selections from Core approved captains.
        
    - Global bidding countdown timers (default 5s).
        
    - Minimum bid increments ($M$) and bid bracket thresholds.
        
    - Purse allocation calculations utilizing the system multiplier $K$:
        
          
        
        $$\text{Purse Pool} = K \times \sum \text{Player Base Prices}$$
- **The 3/7ths OC Override Matrix:** High-precision compliance matrix displaying player lists. Referees and coordinators can slide value modifiers to manually adjust player base prices, up to a strict mathematical threshold of $3/7\text{ths}$ of the entire player base quota, maintaining financial equilibrium.
    
- **Live Bid Controller:** Master interface with "Start Auction Block", "Close Bid", "Sold/Unsold", and countdown override buttons, updating client sessions over WebSockets under $100\text{ms}$.
    

## 6. Popups & Modal Specifications

### 6.1 Account Action Popup

**Trigger:** Clicking profile picture on Status Bar

**Layout:** Bottom sheet covering full width, 3/4 screen height

#### Section 1: Edit Account

- **Status Bar:** Back button (left) → returns to the User-Profile Page
    
- **Fields:**
    
    - Username (editable)
        
    - Email (editable, re-verification required)
        
    - Contact (editable)
        
    - Password change (does NOT require current password — uses verified session)
        
- **Interest Fields:** Button opens the Interest Fields Popup with current selections highlighted
    
- **Newsletters:** Manual subscribe/unsubscribe to categories
    
- **Socials:** Connect/disconnect Instagram, WhatsApp, Twitch, Discord
    
- **Sponsor:** Change active sponsor (limited to once per semester, with confirmation)
    

#### Section 2: Account Actions

- **Status Bar:** Back button (left) → returns to the User-Profile Page
    
- **Actions:**
    
    - Disable Account (soft delete, reversible)
        
    - Remove Account (permanent deletion, data export offered)
        
    - Account Information Request (GDPR-style data dump including all chat history)
        
    - Privacy Policy and Terms of Service (view only)
        

### 6.2 Interest Fields Popup

**Trigger:** First login (Get Started), Account Edit, Manual update prompt

**Layout:** Multi-select grid with categories

#### Categories & Options

- **Sports:** Football, Basketball, Cricket, Badminton, Table Tennis (TT)
    
- **Esports:** Valorant, CS (Counter-Strike), Tekken, Minecraft, Other Esport Games
    
- **Gaming Industry:** Story Mode Games, Indie Games
    
- **Game Development:** Unity, Unreal Engine, Indie Games from Scratch
    

#### Behavior

- Current selections highlighted
    
- Save/Update button
    
- Weekly/Monthly prompt to update interests (configurable in settings)
    

### 6.3 Get Started Popup (Onboarding)

**Trigger:** First successful login

**Layout:** Sequential pages, must be completed to access full app

#### Page Sequence

1. **Interest Fields Popup** (as above)
    
2. **Sponsor Selection:**
    
    - Display all active sponsors for current semester/year
        
    - Sponsor cards with logo, description, current fan count, ranking
        
    - Mandatory selection (cannot skip)
        
    - Tooltip: "You can change this once per semester"
        
3. **Add Friends:**
    
    - Suggestions based on selected interests and sponsor affiliation
        
    - Contact list matching (with permission)
        
    - Interest-based recommendations
        
4. **Connect Socials:**
    
    - Instagram
        
    - WhatsApp (contact card)
        
    - Twitch
        
    - Discord
        

### 6.4 Make Announcement Popup

**Trigger:** Admin/Coordinator action from Home Page or dedicated button

**Permissions:** Coordinator, Founder, Core (with permission)

#### Fields

- Title
    
- Body (rich text)
    
- Announcement Type (multi-select tags):
    
    - BGEC (Visible to all)
        
    - FitSoc (Visible to all)
        
    - Airball (Visible to all)
        
    - Offside (Visible to all)
        
    - PowerPlay (Visible to all)
        
    - Around The Net (Visible to all)
        
    - Deuce (Visible to all)
        
    - Highlight Events (Visible to all)
        
    - Teams (Visible to Core, Coordinator, Founder only)
        
- **WhatsApp Integration:** Each tag maps to a WhatsApp community group API. Auto-sends to respective groups upon publish.
    
- Send Now / Schedule for Later
    

### 6.5 Add Post Popup

**Trigger:** FAB on Home Page or Friends Page

**Permissions:** Authenticated only (guests redirected to Login)

**Layout:** Full-screen sequential tab form, vertically scrollable

#### Tab 1: Media Selection

- Camera access (live capture)
    
- Gallery access (select existing)
    
- Multi-select enabled
    
- Preview grid with reorder/delete
    

#### Tab 2: Post Details

- Header / **Caption**
    
- **Tags** (event tags, interest tags, sponsor tag)
    
- **Description**
    

#### Tab 3: Privacy & Interaction Controls

- **Likes Section:**
    
    - Like count visibility toggle (on/off)
        
    - Likes feature toggle (enabled/disabled entirely)
        
    - Note: Cannot see WHO liked (computation optimization)
        
- **Comments Section:**
    
    - Comments toggle (on/off)
        
    - Sharing toggle (allowed/not allowed)
        
    - Comments visibility:
        
        - Public: Visible to all
            
        - Private: Visible only to post author
            
        - Protected: Visible to all EXCEPT post author
            
- **Post Visibility:**
    
    - Public: Visible to all, including guests
        
    - Protected: Visible to all authenticated users (guests excluded)
        
    - Private: Visible only to user's friends list
        
    - Non-Judgmental: 24h ephemeral, visible to close circle only
        
    - Close: 24h ephemeral, visible to friends
        
    - General: 24h ephemeral, visible to all friends/public
        

#### Tab 4: Background Music (Future Feature)

- Placeholder for audio overlay
    

### 6.6 Profile Picture Section

**Trigger:** Clicking profile picture on User-Profile Page status bar

**Layout:** Bottom sheet, 3/4 screen height

- Camera option (live capture)
    
- Gallery option (select existing)
    
- Crop/Zoom controls
    
- Preview before save
    

## 7. Administration & RBAC

### 7.1 Global Role Architecture (5 Tiers)

|   |   |
|---|---|
|**Role**|**Access Level & Permissions**|
|**Founder**|Absolute Access. Can modify anything including altering the Founder role itself and assigning highest-level system permissions. Immutable audit trail for all actions.|
|**Coordinator**|Full Operational Access. Can manage events, workspaces, users, and sponsors. Cannot alter Founder roles. Can manage and assign Core/Member roles. Can make global announcements.|
|**Core**|Event & Workspace Management. Full access to manage events they are assigned to. Role changing restricted and requires Coordinator permission. Can manage team formations and match data. Can view sponsor stats.|
|**Member (Union)**|Restricted Internal Access. Can edit specific event/task details ONLY if explicitly granted access or assigned to that event/task. Can view internal Union Page features. Can view sponsor data.|
|**User**|Standard Access. Public frontend access to register for events, use social features, view content, earn/spend points, affiliate with sponsors. No internal capabilities.|

### 7.2 Permission Enforcement

- **API Gateway:** JWT verification + role extraction on every request
    
- **Service Level:** Endpoint-level role checks against required permission bitmask
    
- **Field-Level:** Sensitive fields (email, phone) masked in public APIs unless friendship exists or admin role
    
- **UI-Level:** Buttons/pages hidden based on role (not just API-rejected)
    

### 7.3 Audit & Compliance

- All role changes, event deletions, point modifications, sponsor changes, and auction overrides logged immutably
    
- Audit log entries: Actor ID, Action, Target Type, Target ID, Previous Value, New Value, Timestamp
    
- Admin impersonation sessions logged with full traceability
    

## 8. Event-Driven System Design

### 8.1 Domain Events Catalog

#### User Domain Events

```
UserRegistered { user_id, email, username, sponsor_id, timestamp }
UserLoggedIn { user_id, device, ip, timestamp }
UserProfileUpdated { user_id, changed_fields[], timestamp }
UserRoleChanged { user_id, old_role, new_role, changed_by, timestamp }
UserSponsorChanged { user_id, old_sponsor_id, new_sponsor_id, timestamp }
UserDisabled { user_id, reason, disabled_by, timestamp }
UserDeleted { user_id, timestamp }
```

#### Event Domain Events

```
EventCreated { event_id, title, type, created_by, timestamp }
EventUpdated { event_id, changed_fields[], updated_by, timestamp }
EventRegistrationOpened { event_id, timestamp }
EventRegistrationClosed { event_id, timestamp }
EventStarted { event_id, timestamp }
EventCompleted { event_id, timestamp }
EventDeleted { event_id, deleted_by, timestamp }
```

#### Registration Domain Events

```
RegistrationCreated { registration_id, event_id, user_id, role, timestamp }
RegistrationCancelled { registration_id, event_id, user_id, reason, timestamp }
TeamCreated { team_id, event_id, captain_id, name, timestamp }
TeamUpdated { team_id, changed_fields[], updated_by, timestamp }
TeamMemberAdded { team_id, user_id, added_by, timestamp }
TeamMemberRemoved { team_id, user_id, removed_by, timestamp }
```

#### Social Domain Events

```
FriendRequestSent { request_id, requester_id, recipient_id, timestamp }
FriendRequestAccepted { request_id, requester_id, recipient_id, timestamp }
FriendRequestRejected { request_id, requester_id, recipient_id, timestamp }
FriendRemoved { requester_id, recipient_id, timestamp }
PostCreated { post_id, user_id, visibility, timestamp }
PostLiked { post_id, user_id, timestamp }
CommentCreated { comment_id, post_id, user_id, timestamp }
```

#### Points Domain Events

```
PointsEarned { transaction_id, user_id, amount, source, reference_id, timestamp }
PointsSpent { transaction_id, user_id, amount, source, reference_id, timestamp }
PointsRefunded { transaction_id, user_id, amount, source, reference_id, reason, timestamp }
```

#### Sponsor Domain Events

```
SponsorCreated { sponsor_id, name, tenure_start, tenure_end, created_by, timestamp }
SponsorActivated { sponsor_id, activated_by, timestamp }
SponsorDeactivated { sponsor_id, deactivated_by, timestamp }
UserAffiliated { affiliation_id, user_id, sponsor_id, timestamp }
UserSponsorChanged { user_id, old_sponsor_id, new_sponsor_id, timestamp }
FanEarned { user_id, sponsor_id, event_id, amount, reason, timestamp }
SponsorPrizeAwarded { prize_id, sponsor_id, user_id, prize_title, timestamp }
SponsorTenureEnded { sponsor_id, final_rank, total_fans, timestamp }
```

#### Union Domain Events

```
TaskCreated { task_id, title, type, assignees[], created_by, timestamp }
TaskAssigned { task_id, user_id, assigned_by, timestamp }
TaskUpdated { task_id, changed_fields[], updated_by, timestamp }
TaskCompleted { task_id, completed_by, timestamp }
TaskAbandoned { task_id, reason, timestamp }
MeetingScheduled { meeting_id, task_id, attendees[], time, timestamp }
```

#### Auction Domain Events

```
AuctionStarted { auction_id, event_id, player_id, timestamp }
BidPlaced { bid_id, auction_id, bidder_id, amount, timestamp }
BidClosed { auction_id, winner_id, final_amount, timestamp }
PlayerSold { auction_id, player_id, team_id, amount, timestamp }
PlayerUnsold { auction_id, player_id, timestamp }
```

### 8.2 Event Consumers by Service

|   |   |   |
|---|---|---|
|**Service**|**Events Consumed**|**Actions Taken**|
|**Notification Service**|All domain events|Routes to appropriate channel (push, email, WhatsApp) based on user preferences|
|**Points Service**|EventCompleted, ChallengeCompleted, RegistrationCreated|Awards points, updates balances|
|**Sponsor Service**|EventCompleted, UserAffiliated, FanEarned|Updates sponsor fan counts, rankings, prize eligibility|
|**Search Service**|EventCreated, EventUpdated, UserRegistered, PostCreated, SponsorCreated|Updates Elasticsearch indices|
|**Audit Service**|UserRoleChanged, EventDeleted, PointsEarned, BidPlaced, SponsorTenureEnded|Writes immutable audit records|
|**Analytics Service**|All domain events|Aggregates metrics, updates dashboards|
|**Media Service**|PostCreated|Processes images/videos, generates thumbnails|
|**Union Service**|TaskCreated, TaskAssigned, MeetingScheduled|Updates calendar, creates chat groups|

### 8.3 Event Store & Replay

- **Kafka Retention:** 7 days for hot topics, 30 days for audit topics, 1 year for compliance topics
    
- **Replay Capability:** New services can hydrate state by replaying events from beginning
    
- **Event Sourcing Pattern:** Current state = fold of all events (enables time-travel debugging)
    
- **Snapshotting:** Daily snapshots of aggregate state to optimize replay performance
    

## 9. Third-Party Integrations

### 9.1 Strava (Physical Sports)

- **Data Pulled:** Activity type, distance, duration, calories, pace, route maps
    
- **Auth:** OAuth2 with read permissions
    
- **Sync:** Real-time webhooks + daily batch sync for historical data
    
- **Display:** Activity feed on user profile, weekly stats summary
    

### 9.2 Steam (Esports)

- **Data Pulled:** Games owned, playtime (last 2 weeks + total), public achievements, recently played
    
- **Auth:** OpenID / OAuth2
    
- **Sync:** Daily sync (Steam API limitations)
    
- **Display:** Esports activity section on profile, favorite games, total playtime
    
- **Note:** Requires Steam to be unblocked on campus network
    

### 9.3 Google Calendar (Union Scheduling)

- **Data Pulled:** Free/busy slots, existing events
    
- **Data Pushed:** Task deadlines, meeting invites, event schedules
    
- **Auth:** OAuth2 with calendar read/write permissions
    
- **Sync:** Two-way sync via push notifications + daily reconciliation
    
- **Use Case:** Crew availability tracking, meeting scheduling, deadline management
    

### 9.4 WhatsApp Business API (Announcements)

- **Function:** Auto-broadcast announcements to community groups
    
- **Trigger:** Announcement creation via Make Announcement Popup
    
- **Mapping:** Each announcement tag maps to a specific WhatsApp group ID
    
- **Fallback:** In-app notification if WhatsApp delivery fails
    
- **Rate Limiting:** Max 1 announcement per tag per hour to prevent spam
    

### 9.5 Discord (Community & Gaming)

- **Data Pulled:** Rich presence (what game user is playing), server invites
    
- **Auth:** OAuth2
    
- **Display:** Discord handle on profile, "Join our server" links
    
- **Future:** Voice call integration for Friendly Gaming section
    

### 9.6 Instagram / Twitch / Socials

- **Auth:** OAuth2 where available
    
- **Display:** Social handles on player card, clickable links
    
- **Data:** No automated data pull; display-only integration
    

## 10. Notification System

### 10.1 Notification Channels

|   |   |   |
|---|---|---|
|**Channel**|**Use Cases**|**Tech**|
|**In-App**|Universal fallback, all action types|Stored in DB, real-time via polling or WebSocket|
|**Push (FCM)**|Event reminders, friend requests, task deadlines, auction updates|Firebase Cloud Messaging|
|**Email**|Account actions, weekly digest, ticket replies, password reset|SendGrid / AWS SES|
|**WhatsApp**|Announcements, event reminders, critical alerts|WhatsApp Business API|
|**SMS**|Critical alerts only (backup channel)|Twilio / AWS SNS|

### 10.2 Notification Categories & Types

#### Event Notifications

- Registration opened for [Event Name]
    
- Reminder: [Event Name] starts in 24 hours
    
- Reminder: [Event Name] starts in 1 hour
    
- Results published for [Event Name]
    
- Team invite received for [Event Name]
    
- You earned [X] fans for [Sponsor Name]!
    

#### Social Notifications

- Friend request received from [Username]
    
- [Username] accepted your friend request
    
- [Username] liked your post
    
- [Username] commented on your post
    
- [Username] challenged you to [Challenge Name]
    

#### Sponsor Notifications

- New sponsor [Name] is now active for this semester!
    
- Your sponsor [Name] moved up to rank [X]!
    
- [Sponsor Name] won the semester! You contributed [X] fans.
    
- You won a prize from [Sponsor Name]: [Prize Title]
    
- Sponsor tenure ends in [N] days — earn more fans!
    

#### Union / Task Notifications

- You were assigned to task: [Task Name]
    
- Deadline approaching: [Task Name] (24 hours left)
    
- Deadline approaching: [Task Name] (1 hour left)
    
- Meeting scheduled: [Meeting Name] at [Time]
    
- Task [Task Name] marked as abandoned — available for pickup
    

#### System Notifications

- Password changed successfully
    
- [X] points awarded for [Reason]
    
- Account disabled by administrator
    
- New login detected from [Device/Browser]
    

### 10.3 User Preferences

- Granular toggles per channel per category
    
- Default: In-App ON, Push ON (except non-urgent), Email OFF (except security), WhatsApp OFF (except announcements if subscribed)
    
- Quiet hours: Configurable Do Not Disturb period
    

## 11. Security, Privacy & Moderation

### 11.1 Authentication Security

- **JWT:** Access token (15 min expiry) + Refresh token (7 days, rotating)
    
- **Password Policy:** Min 8 chars, 1 uppercase, 1 number, 1 special char. BCrypt hashing.
    
- **OAuth2:** Google sign-in with state parameter CSRF protection
    
- **2FA:** TOTP-based, required for Coordinator promotion and Founder actions
    
- **Rate Limiting:**
    
    - Auth endpoints: 5 attempts per 15 minutes per IP
        
    - General API: 100 requests per minute per user
        
    - Auction bidding: 1 request per second per user
        
    - Friend requests: 10 per day
        
    - Posts: 5 per hour for new users, 20 per hour for established users
        
    - Sponsor change: 1 per semester
        

### 11.2 Data Privacy

- **Encryption:** AES-256 at rest, TLS 1.3 in transit
    
- **Field Masking:** Email and phone partially masked in public APIs (e.g., `r***@gmail.com`)
    
- **Full Access:** Only visible to friends or admin roles
    
- **GDPR Compliance:**
    
    - Account Information Request: Complete data export including all chat history, posts, points transactions, sponsor data
        
    - Right to deletion: Account removal with 30-day grace period
        
    - Privacy Policy and Terms of Service accessible pre-registration and in Account Actions
        

### 11.3 Content Moderation

#### Auto-Moderation

- **Profanity Filter:** Configurable word list on posts and comments
    
- **Image Scanning:** AWS Rekognition / Google Vision API for NSFW content detection
    
- **Spam Detection:** Rate limiting + duplicate content detection
    
- **Link Filtering:** Auto-flag suspicious URLs
    

#### Report System

- **Report Categories:** Spam, Harassment, Cheating, Inappropriate Content, Other
    
- **Reporter Anonymity:** Optional anonymous reporting
    
- **Report Queue:** Dedicated moderation queue for Core+ in Union Page
    
- **Actions:**
    
    - Hide content pending review
        
    - Shadow ban (user sees own content, others don't)
        
    - Temporary ban: 1 day, 7 days, 30 days
        
    - Permanent ban (with appeal option)
        
- **Ban Appeals:** One appeal per ban. Coordinator review required. Audit logged.
    

### 11.4 Auction Security

- **Bid Finality:** Once placed, cannot be retracted. Prevents bid manipulation.
    
- **Timer Synchronization:** Server-authoritative countdown. Client displays are estimates.
    
- **Purse Validation:** Server-side validation that captain has sufficient funds before accepting bid.
    
- **Concurrent Bid Handling:** Atomic database operations with optimistic locking to prevent race conditions.
    

## 12. Settings & Preferences

**Visibility:** Authenticated only

**Location:** Accessible via Account Action Popup

### 12.1 Account Settings

- Change password (requires current password or verified session)
    
- Two-factor authentication toggle (TOTP setup/reset)
    
- Download my data (GDPR export, emailed as ZIP)
    
- Delete account (with confirmation flow and 30-day grace period)
    

### 12.2 Privacy Settings

- Profile visibility: Public / Friends Only / Private
    
- Who can send friend requests: Everyone / Friends of Friends / No One
    
- Post default visibility: Public / Protected / Private
    
- Blocked users list (unblock action available)
    
- Activity status visibility (online/last seen)
    
- Sponsor visibility: Show/Hide my sponsor affiliation on profile
    

### 12.3 Notification Settings

- Granular toggles per channel (In-App, Push, Email, WhatsApp) per category (Event, Social, Sponsor, Union, System)
    
- Quiet hours configuration (start time, end time, timezone)
    
- Newsletter email preferences (frequency: daily, weekly, off)
    
- Sponsor updates toggle (on/off)
    

### 12.4 Integration Settings

- Connect / Disconnect Strava
    
- Connect / Disconnect Steam
    
- Connect / Disconnect Google Calendar
    
- Connect / Disconnect Discord
    
- Re-sync data buttons for each integration
    

### 12.5 Appearance Settings

- Theme: Dark / Light / System Default
    
- Accent color: BGSC Blue / BGEC Purple / FitSoc Green / Custom
    
- Font size: Small / Default / Large
    
- Reduced motion toggle (accessibility)
    

## 13. Search & Discovery

### 13.1 Global Search

- **Placement:** Accessible from Status Bar (search icon or omnibox)
    
- **Indexed Entities:** Users, Events, Teams, Posts, Announcements, Store Items, Challenges, Sponsors
    
- **Search Types:**
    
    - Fuzzy text matching on names and titles
        
    - Exact match on tags
        
    - Partial match on descriptions
        

### 13.2 Filters & Facets

- **By Type:** User, Event, Team, Post, Announcement, Item, Sponsor
    
- **By Date:** Today, This Week, This Month, Custom Range
    
- **By Tag:** Interest tags, Event tags, Sport categories, Sponsor tags
    
- **By Status:** Upcoming, Ongoing, Past (for events)
    

### 13.3 Suggestions & Discovery

- **Recent Searches:** Last 10 searches, clearable
    
- **Trending:** Trending events (by registration velocity), trending challenges, trending sponsors
    
- **People You May Know:** Based on mutual friends + shared interests + event co-participation + sponsor affiliation
    
- **Recommended Events:** ML-based recommendation using interests + past behavior + exploration factor
    

## 14. Analytics & Success Metrics

### 14.1 Product Metrics

- **User Acquisition:** Daily/Weekly/Monthly Active Users (DAU/WAU/MAU), registration conversion rate
    
- **Engagement:** Average session duration, screens per session, posts per user, friend requests per user
    
- **Event Metrics:** Event registration conversion rate, drop-off rate in registration funnel, team formation rate
    
- **Retention:** Day-1, Day-7, Day-30 retention cohorts
    

### 14.2 Gamification Metrics

- **Points Velocity:** Average points earned per user per week
    
- **Store Metrics:** Redemption rate, most popular items, stock turnover
    
- **Challenge Metrics:** Challenge acceptance rate, completion rate by difficulty, Legend completions
    
- **Sponsor Metrics:**
    
    - Sponsor affiliation rate (% of users who selected a sponsor)
        
    - Fan velocity per sponsor
        
    - Sponsor-driven engagement (events participated by sponsor-affiliated users vs non-affiliated)
        
    - Prize claim rate
        

### 14.3 Operational Metrics (Union)

- **Task Efficiency:** On-time task completion percentage, average task age, abandoned task rate
    
- **Communication:** Messages per task group, meeting attendance rate
    
- **Event Execution:** Time from event creation to first registration, admin response time to tickets
    

### 14.4 Technical Metrics

- **Performance:** API p95 latency, p99 latency, database query time
    
- **Reliability:** Uptime percentage, error rate, crash rate (mobile)
    
- **Infrastructure:** Server CPU/memory, queue depth, cache hit rate
    

### 14.5 Reporting Dashboards

- **Coordinator Dashboard:** Event analytics, registration trends, user growth, sponsor rankings
    
- **Founder Dashboard:** Platform-wide metrics, sponsor ROI, system health
    
- **Union Dashboard:** Task completion rates, crew availability heatmap, project timelines
    
- **Sponsor Dashboard:** (For sponsor admins if external) Fan growth, event wins, user engagement
    

## 15. Media & Content Specifications

### 15.1 Supported Media Types

- **Images:** JPG, PNG, WebP (max 10MB, auto-compressed to WebP)
    
- **Videos:** MP4, MOV (max 50MB, transcoded to multiple resolutions)
    
- **Documents:** PDF only (for rulesets, max 5MB)
    
- **Audio:** MP3 (future feature for post background music)
    

### 15.2 Upload Processing Pipeline

1. Client-side validation (type, size)
    
2. Pre-signed URL generation for direct-to-S3 upload
    
3. Virus scanning (ClamAV / cloud-native)
    
4. Image: Resize to thumbnails (150x150), preview (800x800), full resolution
    
5. Video: Transcode to 480p, 720p, 1080p with H.264 encoding. Generate thumbnail.
    
6. Metadata extraction (EXIF stripping for privacy, dimensions, duration)
    
7. CDN cache invalidation and distribution
    

### 15.3 Storage & Retention

- **User-generated content:** Retained until account deletion (30-day grace)
    
- **Event media:** Retained for 2 years post-event, then archived to cold storage
    
- **Announcements:** 4 months active, then archived (1 year retention)
    
- **Chat history:** Retained per user data request policy. Deleted upon account removal.
    
- **Audit logs:** Immutable, 7-year retention
    
- **Sponsor data:** Retained for 3 years post-tenure for historical rankings
    

## 16. Multi-Platform Client Topology: Web Console (PWA) vs. Mobile App Client

### 16.1 Division of System Responsibilities

The platform's user experience is split across two distinct client applications accessing a shared event-driven backend workspace. This section outlines the functional boundaries to prevent UI bloat on mobile devices while maximizing workspace productivity on desktop devices.

- **The Mobile Client (React Native + Expo):** Primarily dedicated to the public-facing "Participant Experience" and quick on-the-go organizing actions. Optimized for high engagement, real-time social interaction, and tournament registration.
    
- **The Web Admin Workspace (React + Tailwind CSS PWA):** Dedicated exclusively to "Operational Governance", organizational project management, and heavy data orchestration. Optimized for dense configuration grids, calendar scheduling, bracket generation, and live auction operations.
    

### 16.2 Client Functional Mapping Matrix

|   |   |   |
|---|---|---|
|**Functional Domain**|**Mobile Client Feature Set (iOS/Android App)**|**Web Admin Console Feature Set (PWA Workspace)**|
|**User Experience**|Full personal profile curation, interactive Player Cards, interest matching, direct and group messaging, social media exports, and store redemptions.|Read-only structural database grids; developer submission forms for friendly Games Jams.|
|**Sponsorships**|Mandatory onboarding sponsor selection, personal fan contribution analytics, active sponsor badge displays, and prize eligibility tracking.|Full tenure onboarding configurations, prize pool configurations, visual leaderboard charts, and automated tenure end settlement scripts.|
|**Events & Leagues**|Event browsing, filter-based event discovery, individual registrations, player squad formation tools, and live leaderboard spectating.|League system model parameters mapping, captain applicant reviews, team creation approvals, and visual tournament bracket builders.|
|**The Auction Engine**|Spectator feed tracking live bid logs, countdown visual cues, and official player rosters.|**Team Captain Workspace:** Real-time bidding engine, remaining wallet trackers.<br><br>  <br><br>**Admin Dashboard:** Auction controller panel, start/stop timers, base price adjustments, and the **3/7ths OC Override Matrix**.|
|**Union Workspaces**|"Quick Add" unassigned tasks, automated project chat rooms, on-duty daily coordinator status, and task reminder banners.|Full Kanban workboards, chronological Gantt charts, master calendars, member availability grids, and strict project task setups.|
|**Security & RBAC**|Basic credential setups, interest updates, account closures, and instant user-reported content flags.|**Immutable Audit Log Explorer**, complete table views of all users, Coordinator promotion TOTP validations, content moderation queues, and the secure administrative **Impersonation Engine**.|

### 16.3 Client Synchronization & Interoperability

To guarantee absolute data consistency, state changes across the desktop Web Console and Mobile Clients synchronize seamlessly using an asynchronous event-driven design:

```
┌────────────────────────┐                    ┌────────────────────────┐
│  Web Admin Console     ├────────┐  ┌───────>│  Mobile App Spectator  │
│  (Real-Time Action)    │        │  │        │  (Real-Time State)     │
└───────────┬────────────┘        │  │        └────────────────────────┘
            │ HTTPS Command       │  │ Socket.io Broadcast
            v                     v  │
┌────────────────────────┐     ┌──┴──┴──┐     ┌────────────────────────┐
│  API Gateway           ├────>│ Socket ├────>│ Mobile Captain Bidding │
│  (Validation & Logic)  │     │ Server │     │ (Interactive Action)   │
└───────────┬────────────┘     └──▲──▲──┘     └───────────┬────────────┘
            │                     │                       │
            v                     │ Socket Event          │ HTTPS Bid
┌────────────────────────┐        │                       │
│  Apache Kafka Bus      ├────────┘                       │
│  (Emits Domain Event)  │<───────────────────────────────┘
└────────────────────────┘
```

1. **Command Execution (Web to Backend):** When a Coordinator updates brackets, modifies user roles, or performs database overrides, the Web Admin Console dispatches a REST command.
    
2. **Domain Event Propagation:** The validated backend service saves changes to PostgreSQL/Redis and broadcasts a corresponding domain event (e.g., `EventUpdated`, `AuctionStarted`, `UserRoleChanged`) over the Kafka event bus.
    
3. **Real-Time Spectator Broadcast:**
    
    - **High-Velocity Workspaces (Auctions, Chats):** Dedicated Socket.io servers consume the event from Kafka and immediately push visual updates to all active client screens (both mobile app users and web administrators) in under $100\text{ms}$.
        
    - **Low-Velocity Workspaces (Announcements, Tasks, Profiles):** The user's mobile client leverages React Query to dynamically invalidate local caches upon receiving Firebase Cloud Messaging background silent push events. This synchronizes the local UI state without requiring manual page reloads or pull-to-refresh steps.
        

## 17. Future Roadmap

### 17.1 Social Features

- **Dating / Matchmaking:** "Looking for?" feature based on community interests and player cards
    
- **Relationship Status:** Optional profile field with privacy controls
    

### 17.2 Platform Expansion

- **Multi-Campus:** White-label support for other colleges (custom branding, separate databases)
    
- **Indie Game Store:** Separate standalone app once catalog scales
    
- **Tournament API:** External tournament organizers can list events on BGSC platform
    
- **Sponsor Marketplace:** External brands can bid to become sponsors with self-service dashboards
    

### 17.3 Advanced Features

- **AI Matchmaking:** ML-based team recommendations using player card data and historical performance
    
- **Live Streaming:** Integration with Twitch/YouTube for event broadcasts
    
- **VR/AR:** Virtual trophy room in Hall of Fame, AR player cards
    
- **Blockchain (Optional):** NFT-based achievement badges for Hall of Fame entries
    
- **Predictive Sponsor Analytics:** ML model predicting which sponsor will win based on affiliated user activity
    

## 18. Phased Development Roadmap

### Philosophy

Development follows the **"Platform → Engagement → Operations → Scale"** model. Each phase builds upon the previous, with clear success criteria before proceeding. The MVP answers: _"Will students use a digital hub for campus sports?"_

**Total Timeline:** 8 Months (32 Weeks)

**Buffer:** 1.5 Months (6 Weeks)

**Active Development:** 6.5 Months (26 Weeks)

### Phase 0: Foundation (Weeks 1–2)

**Goal:** Ship nothing user-facing. Build the engine, establish patterns, and set up operational infrastructure.

**Duration:** 2 weeks

**Deliverables:**

|   |   |
|---|---|
|**Feature**|**Detail**|
|**Infrastructure**|CI/CD pipelines (GitHub Actions), staging environment, Docker setup, basic monitoring|
|**Design System**|Core component library, color tokens (BGSC/BGEC/FitSoc themes), typography, spacing system|
|**Backend Core**|Auth service (JWT + Google OAuth), User service, RBAC middleware, API Gateway with rate limiting|
|**Database**|PostgreSQL schema migrations, Redis cache layer|
|**MVVM Scaffold**|Base ViewModel classes, observable patterns, repository layer, React Query integration|
|**Mobile Shell**|Navigation drawer, status bar, tab system, empty screens, theme switching|
|**Event Bus (MVP)**|In-memory event emitter (upgrade to Kafka in Phase 2)|

**Success Criteria:**

- [ ] All services deployable via single command
    
- [ ] Auth flow works end-to-end (register → login → token refresh)
    
- [ ] Design system has 15+ reusable components
    
- [ ] Unit test coverage $> 50\%$ for all services
    

### Phase 1: MVP — The Public Platform (Weeks 3–10)

**Goal:** Validate that students will use this for event discovery and registration. Launch with sponsor affiliation from day one.

**Target Audience:** All BITS Goa students (Users + Guests).

**Duration:** 8 weeks

**In Scope:**

|   |   |   |
|---|---|---|
|**Feature**|**Detail**|**Priority**|
|**Auth**|Login/Register (email + Google), Forgot password, Guest browsing|P0|
|**Sponsor System v1**|Sponsor selection during onboarding, active sponsor display, basic sponsor leaderboard, fan count on event wins|P0|
|**Home Page**|Landing intro, Announcements (last 4 months), Public social feed (read-only)|P0|
|**Events**|Browse upcoming/ongoing/past events, Solo registration, Basic event details, Post-event fan awards|P0|
|**User Profile**|View profile, Edit basic info, Interest fields (onboarding), Public player card with sponsor badge, Sponsor stats|P0|
|**Admin (Coordinator+)**|Create `DE` (Direct Event) and `LE` (Leaderboard Event) workspace config setups on web portal, Post announcements, Basic Users table, Sponsor creation/management on PWA|P0|
|**Points System**|Manual point awards by admin on event participation, User can see balance, Sponsor bonus points|P1|
|**Notifications**|In-app only (event reminders, registration confirm, sponsor updates)|P1|
|**Search**|Search events and users by name|P1|
|**Hall of Fame v1**|Event winners + Sponsor Champions section|P1|

**Out of Scope (Post-MVP):**

- ❌ Team registration (solo only)
    
- ❌ Auction system
    
- ❌ Union Page / Task management
    
- ❌ Friends system (beyond basic search)
    
- ❌ Store checkout (display only)
    
- ❌ Strava/Steam integration (manual activity entry)
    
- ❌ Advanced search filters
    
- ❌ WhatsApp API (manual announcement copy-paste)
    
- ❌ Real-time chat (use WhatsApp groups for MVP)
    
- ❌ Media upload processing pipeline (basic image upload only)
    
- ❌ Sponsor prizes (track only, distribute manually)
    

**MVP Tech Stack:**

|   |   |
|---|---|
|**Layer**|**Technology**|
|**Mobile App**|React Native (Expo)|
|**Web (Admin)**|React + Tailwind|
|**Backend**|Node.js + NestJS|
|**Database**|PostgreSQL (Supabase/Railway)|
|**Cache**|Redis|
|**Auth**|Supabase Auth / Firebase Auth|
|**Storage**|Supabase Storage / Cloudinary|
|**Hosting**|Railway/Render (backend) + Vercel (web)|
|**Event Bus**|In-memory event emitter (upgrade to Kafka in Phase 2)|

**MVP Timeline:**

|   |   |
|---|---|
|**Week**|**Focus**|
|**3–4**|Auth service + User service + Sponsor service scaffold + Onboarding flow (with sponsor selection)|
|**5–6**|Home page (Landing + Announcements + Feed) + Sponsor leaderboard page|
|**7–8**|Events CRUD + Registration flow + Basic leaderboard display + Post-event fan award logic|
|**9–10**|Player card + Profile (with sponsor badge) + Points (basic) + Hall of Fame v1 + Admin panel + Polish/Bugfix|

**Success Criteria:**

- [ ] 500+ registered users in 4 weeks post-launch
    
- [ ] 70% of registered users select a sponsor during onboarding
    
- [ ] 60% of registered users view at least one event
    
- [ ] 20% event registration conversion rate
    
- [ ] Zero critical security issues
    
- [ ] App store rating $\ge 4.0$ (if published)
    

### Phase 2: Community & Engagement (Weeks 11–16)

**Goal:** Drive retention through social features, challenges, and gamification.

**Target Audience:** Registered users.

**Duration:** 6 weeks

**In Scope:**

|   |   |
|---|---|
|**Feature**|**Detail**|
|**Friends System**|Add/Remove/Accept/Reject, Search by mutuals, Friend suggestions by interest + sponsor|
|**Social Feed v2**|Create posts (camera/gallery), Like/Comment (with visibility controls), 3-tier visibility|
|**Player Cards v2**|Customizable tags, shareable image export, "Find similar players"|
|**Challenges**|Browse challenges, Accept challenge, Submit proof, Points award|
|**Leaderboards v2**|Auto-generated for `LE` events, Basic score entry by admin, Live updates|
|**Store (Browse)**|View merch, Points pricing, "Coming Soon" checkout|
|**Notifications v2**|Push notifications (FCM), Email digests|
|**Search v2**|Filter by interests, recent achievements, sponsor|
|**Media Pipeline**|Full upload processing (resize, transcode, CDN), Media page with albums|
|**Event Bus Upgrade**|Migrate from in-memory to Apache Kafka|
|**Sponsor Prizes v1**|Preset prize configuration, auto-tracking of leaders, manual prize distribution|

**Success Criteria:**

- [ ] 30% of users send at least one friend request
    
- [ ] 15% of users create a post within 30 days
    
- [ ] 25% challenge acceptance rate
    
- [ ] DAU/MAU ratio $> 20\%$  
    
- [ ] Sponsor leaderboard viewed by 50% of users weekly
    

### Phase 3: Operations & League Management (Weeks 17–24)

**Goal:** Make the platform indispensable for the organizing committee. Enable full league and auction support.

**Target Audience:** Members, Core, Coordinators.

**Duration:** 8 weeks

**In Scope:**

|   |   |
|---|---|
|**Feature**|**Detail**|
|**Union Page**|Task creation (Quick Add + Strict Add), Gantt/Calendar views, Task assignment, Priority flags|
|**Team Management**|Team creation, Join open teams, Invite system, Team captain flow|
|**Leagues (`ALL` & `DLL`)**|Full league creation, Bracket generation, Match scheduling, Score parameter system|
|**Auction System**|Player base price submission, OC override quota (3/7ths), Live bidding interface, Purse management|
|**Union Chat**|Auto-generated group chats per task, Task-linked discussions|
|**Calendar Sync**|Google Calendar two-way integration for crew availability|
|**Advanced RBAC**|Full 5-tier system, Task Leads ($\ge 2$), Task OCs ($\ge 2$), Task Members|
|**Store (Checkout)**|Points redemption, Order tracking, Indie game showcase|
|**Hall of Fame v2**|Full archive with sponsor dynasty tracking, automated winner archives|
|**Feedback System**|Ticket system, FAQ, Contact directory|
|**Sponsor Prizes v2**|Auto-distribution of preset prizes at tenure end, digital certificates|

**Success Criteria:**

- [ ] 100% of Core team uses Union Page for task management
    
- [ ] 80% task on-time completion rate
    
- [ ] Auction system handles 50+ concurrent bidders without lag
    
- [ ] Zero data loss in Union operations
    
- [ ] First sponsor tenure completes successfully with prize distribution
    

### Phase 4: Integrations & Polish (Weeks 25–28)

**Goal:** Differentiate the platform with external integrations and production polish.

**Target Audience:** Power users.

**Duration:** 4 weeks

**In Scope:**

|   |   |
|---|---|
|**Feature**|**Detail**|
|**External Integrations**|Strava activity sync, Steam library sync, Discord rich presence|
|**WhatsApp API**|Announcement auto-broadcast to community groups|
|**Media Memories**|"Year in Review" auto-compilation, Event highlight reels|
|**Advanced Analytics**|Coordinator dashboard for event analytics, User cohort retention, Sponsor ROI dashboard|
|**Performance Optimization**|Image compression, CDN, query optimization, bundle splitting|
|**Accessibility**|WCAG 2.1 AA compliance audit|
|**Security Hardening**|Penetration testing, security audit|
|**Sponsor Analytics**|Predictive sponsor rankings, engagement heatmaps|

**Success Criteria:**

- [ ] 40% of users connect at least one external integration
    
- [ ] 20% of users view their "Year in Review"
    
- [ ] API p95 latency $< 200\text{ms}$  
    
- [ ] Zero critical vulnerabilities in penetration test
    
- [ ] Platform ready for next semester sponsor rollout
    

### Phase 5: Buffer & Contingency (Weeks 29–32)

**Goal:** Absorb delays, fix critical bugs, and prepare for launch/marketing.

**Duration:** 4 weeks (1 month buffer) — **Note:** Total buffer is 1.5 months (6 weeks). The remaining 2 weeks are distributed as flex time across previous phases.

**Activities:**

- Bug fixes from Phase 4 testing
    
- Performance tuning based on load testing
    
- Marketing material creation (app store screenshots, demo videos)
    
- Campus ambassador onboarding
    
- Soft launch to 100 beta users
    
- Final security review
    
- Documentation completion (API docs, user guides, admin guides)
    

**Success Criteria:**

- [ ] All P0 bugs resolved
    
- [ ] Load test passed: 1000 concurrent users
    
- [ ] Beta user NPS $> 50$  
    
- [ ] App store submission ready (if applicable)
    

## 19. Appendix: Glossary

|   |   |
|---|---|
|**Term**|**Definition**|
|**BGSC**|BITS Goa Sports Community|
|**BGEC**|BITS Goa Esports Community|
|**FitSoc**|Fitness Society|
|**Union Page**|Internal workspace for organizing committees|
|**Player Card**|Shareable digital card showcasing user gaming/sports profile|
|**Instants**|Ephemeral story-like posts (future feature)|
|**ALL**|Auction Leaderboard League|
|**DLL**|Direct Leaderboard League|
|**LE**|Leaderboard Event|
|**DE**|Direct Event (no leaderboard)|
|**OC**|Organizing Committee member|
|**K Multiplier**|Auction purse calculation factor: Pool = K × Σ Base Prices|
|**Quick Add**|Rapid task creation without full details (memory logging)|
|**Pathway Task**|Multi-step task with deadline and progress tracking|
|**3/7ths Quota**|OC override limit for player base prices in auction|
|**Non-Judgmental**|Closest privacy tier for stories/posts|
|**Protected**|Visible to all authenticated users, hidden from guests|
|**FCM**|Firebase Cloud Messaging|
|**TOTP**|Time-based One-Time Password (2FA)|
|**GDPR**|General Data Protection Regulation|
|**CSRF**|Cross-Site Request Forgery|
|**RBAC**|Role-Based Access Control|
|**MVP**|Minimum Viable Product|
|**SLA**|Service Level Agreement|
|**CDN**|Content Delivery Network|
|**PWA**|Progressive Web App|
|**EXIF**|Exchangeable Image File Format (metadata)|
|**EDA**|Event-Driven Architecture|
|**MVVM**|Model-View-ViewModel|
|**CQRS**|Command Query Responsibility Segregation|
|**Kafka**|Apache Kafka (distributed event streaming platform)|
|**Avro**|Data serialization system for Kafka schemas|
|**Fan Count**|Virtual points earned by users for their sponsor when winning events|
|**Sponsor Tenure**|A semester or year period during which a sponsor is active|
|**Sponsor Dynasty**|Consecutive tenure wins by the same sponsor|

_Document Version: 4.0_ _Last Updated: 2026-06-12_ _Status: Complete Specification with Event-Driven Architecture, Multi-Platform Client Topology (Web PWA Workspace vs. Mobile App Client), MVVM Frontend, Sponsor System, and 8-Month Development Roadmap_