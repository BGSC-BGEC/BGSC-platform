
> ⚠️ **NOTE — Union Page feature has been removed from the platform.** All sections referencing the Union Page, Union Workspace, or internal task management tools in this document are superseded by this decision and should be ignored during implementation.

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
│                         Secure Client Token Storage                      │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTPS (TLS 1.3)
┌────────────────────────────────────┴─────────────────────────────────────┐
│                    EDGE & API GATEWAY (:3000 / api.bgsc.in)              │
│  - Cloudflare DDoS Proxy & SSL/TLS Termination                           │
│  - Gateway Sliding-Window Rate Limiting (100 req/min, 5/15min on Auth)   │
│  - Request Proxying to Internal Service Network (http-proxy-middleware)  │
│  - Edge Blocks on /internal/* Routes                                     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ Internal Docker Network (bgsc-network)
┌────────────────────────────────────┴─────────────────────────────────────┐
│                     MICROSERVICES (Port Topology)                        │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌───────────────────┐ │
│  │ auth-service (:3001) │ │ user-service (:3002) │ │event-serv (:3003) │ │
│  │ (Auth & Sessions)    │ │ (Profiles & Badges)  │ │ (Events & Auction)│ │
│  └──────────┬───────────┘ └──────────┬───────────┘ └─────────┬─────────┘ │
│  ┌──────────┴───────────┐ ┌──────────┴───────────┐ ┌─────────┴─────────┘ │
│  │ registration (:3004) │ │ announcement (:3005) │ │ points (:3006)    │ │
│  │ (Forms & Teams)      │ │ (Feeds & Targeting)  │ │ (Financial Ledger)│ │
│  └──────────┬───────────┘ └──────────┬───────────┘ └─────────┬─────────┘ │
│  ┌──────────┴───────────┐ ┌──────────┴───────────┐ ┌─────────┴─────────┘ │
│  │ challenge (:3008)    │ │ notification (:3010) │ │ feedback (:3011)  │ │
│  │ (Quests & Strava)    │ │ (Inbox & WhatsApp)   │ │ (Anon Ticketing)  │ │
│  └──────────┬───────────┘ └──────────┬───────────┘ └─────────┬─────────┘ │
│  ┌──────────┴───────────┐ ┌──────────┴───────────┐ ┌─────────┴─────────┘ │
│  │ bracket (:3012)      │ │ leaderboard (:3007)  │ │ media (:3009)*    │ │
│  │ (Tourneys & Matches) │ │ (Ranks & Standings)  │ │ (* Unbuilt - BE1) │ │
│  └──────────────────────┘ └──────────────────────┘ └───────────────────┘ │
└─────────────────────────────┬──────────────────┬─────────────────────────┘
                               │                  │
┌─────────────────────────────┴─────┐      ┌─────┴─────────────────────────┐
│       EVENT BUS (Redis Pub/Sub)   │      │        SHARED DATA LAYER      │
│  Channel: `bgsc.events`           │      │  Single MongoDB 7.0 Instance  │
│  Async domain event distribution  │      │  Database: `bgsc_dev`         │
│  Local in-process fallback        │      │  Dedicated collection borders │
└───────────────────────────────────┘      └───────────────────────────────┘
```

#### Event-Driven Flow Examples

**Event Registration & Attendance Flow (As Implemented):**

1. User checks registration eligibility → `GET /events/{ref}/eligibility`
2. Client fetches dynamic form schema from Registration Service → `GET /forms/{form_id}`
3. User submits form answers → `POST /registrations`
4. Registration Service validates fields and issues synchronous internal call to Event Service → `POST /internal/events/{id}/reserve-seat` (`X-Internal-Token` protected)
5. Event Service atomically checks capacity (`max_participants`) and deadlines (`closes_at <= start_at`):
   - If capacity is available: increments `counts.registrations_confirmed` and returns `{ reserved: true, waitlisted: false }`
   - If capacity is full & `waitlist_enabled` is true: increments `counts.registrations_waitlisted` and returns `{ reserved: true, waitlisted: true }`
   - If capacity is full & `waitlist_enabled` is false: returns `{ reserved: false, reason: 'capacity_full' }`
6. Registration Service saves `form_submissions` document and emits `RegistrationCreated` on Redis Pub/Sub channel `bgsc.events`
7. Notification Service consumes `RegistrationCreated` → dispatches confirmation email/push
8. On-site attendance check-in (`POST /events/{ref}/attendance`) verifies presence and emits `ParticipantAttended`
9. Points Service consumes `ParticipantAttended` → idempotently credits participation points (`points_pool.participation`) using key `event.attended:{event_id}:{user_id}` (Points are paid for attending, not signing up)
10. On cancellation (`DELETE /registrations/{id}`), Registration Service calls `POST /internal/events/{id}/release-seat`, decrements confirmed count, emits `RegistrationCancelled`, auto-promotes next waitlisted applicant, and Points Service reverses any prior attendance credits

**Live Auction Bidding & Settlement Flow (As Implemented — BE-1, Sep 19 2026):**

1. Captain places bid → `POST /auction/lots/{id}/bid` with `{ amount, version }`
2. Pre-flight verification:
   - Verifies caller is in `event.auction.captain_user_ids` (`403 not_auction_captain`)
   - Verifies captain is not bidding on their own player card (`422 cannot_bid_on_self`)
   - Verifies captain is not outbidding themselves (`422 already_highest_bidder`)
   - Verifies team roster has open capacity: `team.members.length < team.size_max` (`422 team_roster_full`)
   - Verifies team purse coverage: `purse_remaining = purse_total - purse_spent >= amount` (`422 insufficient_purse`)
   - Verifies increment: `amount >= (current_bid ?? base_price) + min_bid_increment` (`422 bid_below_minimum`)
3. Lock-free OCC execution: Atomic CAS `AuctionLot.findOneAndUpdate({ _id: lotId, version, status: 'on_block', timer_ends_at: { $gt: now } }, ...)` increments version, updates highest bidder/amount, and resets countdown timer `timer_ends_at = now + bid_timer_seconds` (+5s)
   - If version or timer fails filter, returns `409 conflict_concurrent_bid` without dirty writes
4. Event Bus emission: Emits `BidPlaced` on Redis Pub/Sub `bgsc.events`
5. Real-time spectator read: Live Spectator and Captain clients poll `GET /auction/events/{ref}/live` (1.5–2.0s interval), fetching active lot, countdown timestamp, `seconds_remaining`, current bidder, recent bids, and team purse standings
6. Two-Phase Settlement & Advance:
   - On countdown expiration or admin call `POST /auction/lots/{id}/advance`:
     - If winning bid exists: debits team purse via `POST /internal/teams/{id}/debit-purse`, adds player to team roster via `POST /internal/teams/{id}/add-member` (`acquired_via: 'auction'`), marks lot `'sold'`, and emits `BidClosed` and `PlayerSold`
     - If no bids exist: marks lot `'unsold'` and emits `BidClosed` and `PlayerUnsold`
     - Automatically advances next queued lot (`order: 1`) to `'on_block'` with active countdown (+5s), emitting `AuctionStarted`
    

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
|**API Gateway**|Node.js (Express Gateway :3000)|Single public ingress, Cloudflare DDoS edge, rate limiting, request routing|
|**Microservices**|Node.js (Express 5 + TypeScript)|Monorepo workspaces (`apps/*`) sharing `@bgsc/shared` core package|
|**Event Bus**|Redis 7.0 Pub/Sub (`bgsc-events`)|Lightweight cross-process domain event propagation with local in-process fallback|
|**Primary Database**|MongoDB 7.0 (Mongoose 9)|Flexible NoSQL schema, shared `bgsc_dev` instance with strict collection ownership|
|**Cache & Sessions**|Redis 7.0|Rate limiting buckets, event bus, cached snapshots|
|**Real-Time**|Socket.io + Redis Adapter|Auctions, chat, live leaderboard updates across server instances|
|**File Storage**|Local Disk (`/uploads/`) → AWS S3 / R2|Avatars, event posters, dynamic form uploads (Media Service in Week 4)|
|**CDN & DNS**|Cloudflare|DNS proxy (`api.bgsc.in`), edge DDoS protection, TLS 1.3 termination|
|**Authentication**|JWT (15m Access + 7d Refresh) + Google OAuth + Phone OTP|Stateless session tokens, 6-digit SMS OTP, 45-day restoration grace period|
|**Containerization**|Docker + Docker Compose|Multi-stage single image build, internal `bgsc-network` bridge|

### 2.4 Scalability Considerations

- **Horizontal Pod Autoscaling:** API servers scale based on CPU/memory and request queue depth
    
- **Database Read Replicas:** Event browsing and leaderboard queries served from replicas
    
- **CDN Caching:** Public event pages and media cached at edge locations
    
- **Async Job Processing:** Image resizing, video compression, bulk notifications via worker queues
    
- **Event Replay:** Kafka event log enables replay for debugging, new service hydration, and audit
    
- **CQRS (Command Query Responsibility Segregation):** Write model (PostgreSQL) separate from read model (Redis + Elasticsearch) for complex queries
    

### 2.5 Resource-Constrained Hardware Sizing & Mathematical Concurrency Model (2 vCPU / 4GB RAM Target)

The BGSC platform is engineered to operate efficiently on a resource-constrained hardware profile (e.g. 2 vCPU, 4GB RAM host) serving an enrolled campus population of **4,000 registered users**, supporting steady nominal traffic (**40–100 concurrent active users**) and intense tournament/auction traffic spikes (**500–1,000 concurrent active users**).

#### 1. Mathematical Load Profile & Sizing Analysis

| Traffic Dimension | Nominal State | Peak Tournament / Auction Burst |
|---|---|---|
| **Enrolled Userbase** | 4,000 users | 4,000 users |
| **Concurrent Active Users ($U_c$)** | 40 – 100 users | 500 – 1,000 users |
| **Auction Polling Rate ($R_{\text{poll}}$)** | 1.5s interval | 1.5s interval |
| **Raw Polling Ingress ($Q_{\text{raw}}$)** | $26.7 - 66.7 \text{ req/s}$ | $333.3 - 666.7 \text{ req/s}$ |
| **Uncached DB Queries/sec** | $80 - 200 \text{ ops/s}$ | $1,000 - 2,001 \text{ ops/s}$ (Saturates 2 vCPU) |
| **Cached DB Queries/sec (750ms TTL)** | $\le 1.33 \text{ ops/s}$ | $\le 1.33 \text{ ops/s}$ (**99.9% DB CPU drop**) |
| **Points Investment Writes/event** | 1–5 writes | 2–5 writes (**Dirty write reduction from 1,000**) |
| **Global Leaderboard Read Latency** | $< 1\text{ms}$ (Redis ZSET) | $< 1\text{ms}$ (Redis ZSET vs 120ms MongoDB scan) |

#### 2. Key Architectural Bottlenecks & 2 vCPU Mathematical Solutions

1. **Auction Live State Micro-Caching (750ms TTL with RAM Countdown Math):**
   - *Problem:* Spectators and captains poll `GET /auction/events/:ref/live` every 1.5s. During a 500-user auction, uncached queries issue >1,000 MongoDB queries per second across `events`, `auction_lots`, and `teams`, exhausting the Mongoose connection pool (10 connections/service default) and stalling the single-threaded Node.js event loop.
   - *Solution:* In `apps/event-service`, `LIVE_STATE_CACHE` holds the materialized live state with a 750ms TTL.
     - Maximum database query throughput is mathematically capped at:
       $$\text{Max DB Query Rate} = \frac{1}{\text{TTL}} = \frac{1}{0.75} \approx 1.33 \text{ queries/s}$$
     - Cache hits are served purely from RAM in $<0.05\text{ms}$. The countdown timer is derived dynamically in memory on each hit:
       $$\text{seconds\_remaining} = \max\left(0, \left\lceil \frac{\text{timer\_ends\_at} - \text{now}}{1000} \right\rceil\right)$$
     - Mutation actions (`placeBid`, `advanceLot`, `overrideLotPrice`, `overrideCaptainBudget`, `startAuction`, `closeAuction`) instantly call `invalidateAuctionLiveCache(eventId)`, guaranteeing 0ms latency for real-time bid updates.

2. **Leaderboard Dirty Bulk Write Optimization (99.5% I/O Reduction):**
   - *Problem:* When 1,000 concurrent participants submit points investments or match scores, recalculating standings and unconditionally updating all 1,000 entries generates $1,000 \times 1,000 = 1,000,000$ MongoDB write operations, saturating the WiredTiger journal and locking collections.
   - *Solution:* In `apps/leaderboard-service/src/leaderboard/leaderboard.service.ts`, `recomputeEventRanks` compares the freshly normalized score and materialized rank against existing database values:
     ```ts
     const rankChanged = existingEntry.rank !== materializedRank;
     const scoreChanged = existingEntry.final_score !== finalScore;
     if (rankChanged || scoreChanged) {
         bulkOps.push({ updateOne: { filter: { _id: entry._id }, update: { $set: { rank: materializedRank, ... } } } });
     }
     ```
     Because a single point investment typically affects the investing user and causes at most 1–4 rank swaps, database write operations drop from 1,000 writes down to 2–5 writes per investment (a **99.5% reduction in disk I/O**).

3. **Normalization Math & Call Stack Protection:**
   - *Problem:* Calling `Math.min(...rawScores)` and `Math.max(...rawScores)` for an event with 1,000 entries pushes 1,000 parameters onto the V8 call stack, increasing GC pressure and risking `RangeError: Maximum call stack size exceeded`. Furthermore, computing floating-point division inside the normalization loop wastes CPU cycles.
   - *Solution:* Derived `min` and `max` using a single $O(N)$ loop. Precomputed the normalization scale factor outside the loop:
     $$\text{scale} = \frac{upper - lower}{\text{rawRange}}$$
     Converting 1,000 floating-point divisions into hardware multiplications in CPU registers.

4. **Global Leaderboard Compound Indexing & Redis ZSET Read Architecture:**
   - *Problem:* Aggregating global points across 50,000+ rows in `point_transactions` caused full collection scans (`COLLSCAN`), spiking 2 vCPU to 100% utilization.
   - *Solution:*
     - Added compound indexes in `@bgsc/shared/models/Points.ts`: `{ type: 1, source: 1, created_at: -1 }` and `{ type: 1, created_at: -1 }`, converting the query to an index scan (`IXSCAN`).
     - Implemented cache-first reads in `apps/leaderboard-service`: Queries read from Redis ZSET `lb:global:{period}:{domain}:{source}` using $O(\log N + M)$ `ZREVRANGE ... WITHSCORES`, with lean projection hydration for user avatars and names.
     - Response time drops from ~120ms to $<1\text{ms}$, decoupling read load from MongoDB entirely.

5. **Atomic CAS Advance & Double-Debit Immunity:**
   - *Problem:* High-velocity lot advancement under concurrent requests risks double-debiting team purses or double-adding roster members.
   - *Solution:* `advanceLot` transitions `status: 'on_block'` to `'sold'` / `'unsold'` via an atomic compare-and-swap (`AuctionLot.findOneAndUpdate({ _id: lotId, status: 'on_block' }, ...)`). If a concurrent call occurs, exactly one worker claims the settlement; all subsequent callers detect the settled state and return idempotently without duplicate side-effects. If debit fails, state safely rolls back to `'on_block'`.


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

> **Implementation note (Sep 6, 2026).** The entities below are the original domain sketch. The
> collections actually built are in `Backend/packages/shared/src/models/`, designed in `docs/modeldocs/`. Field names
> there are `snake_case`, `_id` is a UUID v4 **string** (not an ObjectId), and every timestamp ends
> in `_at`. Where the two disagree, the models are authoritative. Sections 4.1.1 and 4.1.2 list what
> exists; entities with no subsection below are still unbuilt.

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


#### 4.1.1 Collections as built (BE-1 & BE-2, Sep 13 2026)

Field lists are indicative, not exhaustive — see `docs/modeldocs/` for the full shape, invariants and indexes of each.

```
events               _id, slug, title, description, cover_media_url, logo_url,
                     category[leagues|bgec|fitsoc|general], type[LE|DE|ALL|DLL],
                     domain, tags[], status[draft|upcoming|ongoing|past|cancelled], visibility,
                     start_at, end_at, venue, timezone,
                     registration{opens_at, closes_at, roster_finalizes_at, form_id,
                                  max_participants, waitlist_enabled, requires_approval},
                     teaming{is_teamed, team_size_min, team_size_max, max_teams,
                             captain_application_required},
                     rules_pdf_url, rules_summary, awards[], contacts[],
                     created_by, core_admins[],
                     points_pool{participation, podium_multipliers[], sponsor_bonus,
                                 investment_enabled, investment_cap},
                     scoring{parameters[{key,label,kind,weight}], normalization{lower,upper}},
                     leaderboard{format, elim_after_n, min_participants} | null,
                     auction{k_multiplier, min_bid_increment, bid_timer_seconds,
                             oc_override_quota, oc_captain_override_quota, status, captain_user_ids[], purse_per_team} | null,
                     bracket (reserved, Week 4), counts{}, created_at, updated_at, deleted_at
                     -- invariants: leaderboard != null <=> type != 'DE'; auction != null <=> type == 'ALL'

auction_lots         _id, event_id, player{user_id,display_name,avatar_url}, registration_id,
                     base_price, oc_adjusted_price, order,
                     status[queued|on_block|sold|unsold], current_bid, current_bidder,
                     timer_ends_at, bids[], sold_to_team_id, sold_amount, closed_at,
                     version (optimistic lock), created_at, updated_at

teams                _id, owner{type[event|challenge], id}, name, name_lower, logo_url,
                     captain_user_id, members[{user_id, display_name, avatar_url,
                                               registration_id, joined_at, acquired_via}],
                     join_policy[open|invite_only|closed], invite_code, size_min, size_max,
                     pending[{user_id, direction, created_by, created_at, expires_at}],
                     status[forming|complete|locked|disbanded],
                     auction{purse_total, purse_spent, version, is_overridden, override_reason, overridden_by} | null, created_at, updated_at
                     -- one polymorphic collection for both events and challenges

form_definitions     _id, owner{type[event|challenge|generic], id}, title, description,
                     version, status[draft|published|archived], fields[FormField],
                     settings{allow_edit_until, confirmation_message},
                     created_by, created_at, updated_at, published_at

FormField            key, label, help_text, type[short_text|long_text|number|email|phone|url|
                     select|multi_select|checkbox|date|file|user_ref], required, placeholder,
                     options[], validation{min,max,pattern,accept,max_size_bytes},
                     visible_if{field_key,op,value}, admin_only, order

form_definition_versions
                     _id, form_id, version, fields[], published_at
                     -- frozen copies so old submissions still render

form_submissions     _id, form_id, form_version, owner{}, user{user_id,display_name,avatar_url},
                     answers{}, files[],
                     context{event{role, team_id, team_visibility, base_price,
                                   captain_application{}, attended} | challenge{team_id}},
                     status[draft|submitted|confirmed|waitlisted|rejected|cancelled],
                     waitlist_position, status_history[],
                     submitted_at, confirmed_at, cancelled_at, created_at, updated_at
                     -- registering for an event IS a form_submissions row

point_transactions   _id, user_id, amount (signed int), type[earn|spend|refund|adjust|expire],
                     source[event|challenge|leaderboard|store|engagement|sponsor|admin], reason,
                     reference{type,id}, idempotency_key (unique), balance_after,
                     actor{type,user_id}, note, expires_at, created_at
                     -- append-only ledger; balance = sum(amount); corrections are new rows

point_rules          _id (== reason key), label, source, default_amount,
                     overridable_by[event|challenge|null], enabled, expires_after_days,
                     updated_by, created_at, updated_at

leaderboard_entries  _id, event_id, participant{type[user|team], id, display_name, avatar_url},
                     registration_id, raw{}, raw_score, normalized_score, invested_points,
                     final_score, stats{played,won,lost,drawn,round_reached,fails,eliminated},
                     rank, previous_rank, last_scored_at, scored_by, version,
                     created_at, updated_at

leaderboard_snapshots
                     _id, event_id, taken_at, reason[score_update|investment|final|freeze],
                     frozen, ranks[{participant_id, rank, final_score}]

challenges           _id, slug, title, description, brief_hidden_until_accept, cover_media_url,
                     domain, kind[physical|digital], difficulty[easy|medium|hard|legend], tags[],
                     award_points, grants_hall_of_fame,
                     window{opens_at, closes_at, submissions_close_at, time_limit_minutes},
                     location{}, teaming{}, max_participants, resources[],
                     submission{requires_proof, proof_types[], max_files, auto_approve},
                     status[draft|active|completed|archived], counts{},
                     created_by, reviewers[], created_at, updated_at, deleted_at

challenge_participations
                     _id, challenge_id, challenge_snapshot{title,difficulty,award_points},
                     participant{type,id,display_name,avatar_url}, member_user_ids[],
                     status[accepted|submitted|under_review|approved|rejected|expired|withdrawn],
                     accepted_at, deadline_at, progress{percent, steps[], notes},
                     submission{proofs[], notes, submitted_at, version} | null,
                     review{reviewer_user_id, decision, reason, reviewed_at} | null,
                     reward{points_awarded, point_transaction_ids[], hall_of_fame_entry_id} | null,
                     status_history[], created_at, updated_at

announcements        _id, title, body, media_url, categories[], tags[],
                     priority[normal|important|urgent],
                     audience{min_role, event_id},
                     author{user_id, display_name, role_label, avatar_url},
                     status[draft|scheduled|published|archived],
                     scheduled_for, published_at, expires_at, pinned_until,
                     delivery{whatsapp{requested, per_category[]}, push{}},
                     created_at, updated_at, deleted_at

audit_logs           _id, actor_id, action (dotted machine key), target_type, target_id,
                     previous_value, new_value, reason, ip, created_at
                     -- append-only; required by 7.3. Not in the original entity list above
```

#### 4.1.2 `users` as built (BE-1 model, converted by BE-2)

```
users                _id (uuid string), email, username, password_hash*, role, status,
                     google_id (sparse unique), is_email_verified,
                     email_verification_token*, email_verification_expires*,
                     is_phone_verified, pending_phone_number,
                     phone_verification_otp_hash*, phone_verification_expires*, phone_verification_attempts,
                     refresh_token_hash*, last_login_at,
                     password_reset_token*, password_reset_expires*,
                     profile{full_name, avatar_url, phone_number, bio, interests[],
                             social_links{strava_id, instagram, linkedin, steam_id}},
                     player_card{card_tier, stats{}},
                     points_balance,          -- written only by Points Service
                     announcements{last_seen_at, read_ids[]},  -- written only by Announcement Service
                     settings{notifications{email,whatsapp}, privacy{is_profile_public}, theme},
                     last_active_at, deleted_at, created_at, updated_at
                     -- * = select:false, never loaded unless explicitly requested
```

Dropped from the 4.1 sketch: `newsletter_subscriptions[]` and `active_sponsor_id` — sponsors and
newsletters are out of MVP scope. `contact` became `profile.phone_number`; `socials{}`, `strava_id`
and `steam_id` were consolidated into `profile.social_links`.

#### 4.1.3 Not yet built

`Task`, `Post`, `Friendship`, `Notification`, `Match`, `StoreItem`, `MediaAlbum`, `FeedbackTicket`,
and every `Sponsor*` entity remain as sketched above. Tournament brackets are Week 4 (the `events`
document reserves a `bracket` slot); sponsors, social feed, friends, store and unions are out of MVP.

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

#### 5.2.1 Announcement Engine Architecture & Invariants (As Implemented — BE-2, Sep 13 2026)

The Announcement Service (`apps/announcement-service`, Port 3005) operates as an autonomous microservice responsible for real-time news dissemination, targeted audience broadcasts, read tracking, and landing page coordinator presence:

- **Multi-Tier Audience Resolution (`audience.ts`):**
  - **Public / All (`all`):** Globally visible to all users and unauthenticated guests (`optionalAuth` on read endpoints).
  - **Role-Scoped (`roles: RoleName[]`):** Filtered server-side using hierarchical role ranks (`ROLE_RANK`). Users only see announcements where `audience.min_role <= viewer.role`.
  - **Event Participant Scoped (`event_participants: eventId`):** Scoped dynamically by querying confirmed event registrations from `form_submissions` via index `{ 'user.user_id': 1, 'owner.type': 1, submitted_at: -1 }`. Users only see announcements for events where they hold confirmed registrations.
  - **Team Captain Scoped (`team_captains: eventId`):** Filtered to users holding verified captaincy on active teams for the designated event.
  - *Zero Client-Side Trust:* Audience matching is evaluated strictly server-side; clients cannot assert audience membership.

- **High-Performance Read Tracking Architecture (`reads.ts`):**
  - **Bounded Embedded State:** Instead of an unbounded relational mapping table (`O(users * announcements)`), read state is maintained directly on the `User` aggregate root as `{ 'announcements.last_seen_at': Date, 'announcements.read_ids': string[] }`. Announcement Service is the sole designated cross-service writer for this embedded subdocument.
  - **Watermark Model:** `last_seen_at` acts as a high-water mark; all announcements published prior to this timestamp are considered read.
  - **Capped Ring Buffer:** Individual reads (`POST /announcements/:id/read`) append to `read_ids` with a server-side Mongo `$slice: -200` ceiling and a `$ne` idempotency guard, guaranteeing zero document bloat and lock-free concurrency.
  - **Batch Read Dismissal:** Opening the Announcements feed or tapping "Mark all read" (`POST /announcements/read-all`) performs an atomic `$set` on `last_seen_at`, instantly clearing unread dots and badges.
  - **Unread Badge API:** `GET /announcements/unread-count` returns the real-time unread count matching the viewer's audience predicate published since `last_seen_at`.

- **Landing Page Coordinator Speech Bubbles (`GET /announcements/heads`):**
  - Powers Tab 1 of the Landing Page: fetches coordinator portrait metadata and their latest active announcement in a comic-style speech bubble. If a coordinator has no active announcements, a fallback meme or placeholder is returned.

- **Publication Lifecycle & Distributed CAS Scheduler (`tick.ts`):**
  - State Machine: `draft` ──publish──> `published` (or `scheduled` if future `scheduled_for` is set) ──archive──> `archived` / `deleted_at`.
  - Distributed Compare-And-Swap (CAS): Background 60-second ticker uses `Announcement.findOneAndUpdate({ status: 'scheduled', scheduled_for: { $lte: now }, deleted_at: null }, { $set: publishedSet(now) })`. Under horizontal scaling across multiple instances, exactly one node claims and publishes each document.
  - Retention Automation: Scheduler enforces the 4-month active window (`ACTIVE_MONTHS = 4`) and 12-month archive retention (`ARCHIVE_MONTHS = 12`).
  - Domain Event Emission: Emits `AnnouncementPublished` on Redis Pub/Sub channel `bgsc.events` upon publication.

- **Security & Authorization Invariants:**
  - Sensitive composer routes (`POST /announcements`, `POST /:id/publish`, `POST /:id/unschedule`) execute `requireActiveUser(UserRole.CORE)` which performs a live database lookup rather than trusting the JWT's 15-minute claims, ensuring deactivated or demoted coordinators cannot post announcements.
  - Reads utilize `optionalAuth`, enabling guest visitors to browse public announcements without authentication.
    

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
    

- Event Details View: Event info (title, description, rules PDF/link, awards, scheduling dates, coordinator contact points).
- **Event Registration Architecture (As Implemented — BE-1, Sep 12 2026):**
  - **Dynamic Form Delegation:** Event Service does not own form fields directly. The Registration Service (`registration-service` :3004) owns `form_definitions` and `form_submissions`. The Event document stores `registration.form_id`.
  - **Atomic Seat Reservation Handshake:**
    - Registration submissions call `POST /internal/events/:id/reserve-seat` (authenticated via `X-Internal-Token`) with `{ registration_id, idempotency_key }`.
    - Event Service atomically checks deadlines (`closes_at <= start_at`) and capacity (`max_participants`).
    - If capacity is full and `waitlist_enabled` is true, it increments `counts.registrations_waitlisted` and returns `{ reserved: true, waitlisted: true }`. If waitlist is disabled, it returns `{ reserved: false, reason: 'capacity_full' }`.
    - On registration cancellation, Registration Service calls `POST /internal/events/:id/release-seat` to decrement `counts.registrations_confirmed`.
  - **URL-Safe Slugs:** Derived automatically as `slugify(title) + '-' + year` (with automatic deduplication suffix if collisions occur). Deep links can query by either UUID `_id` or `slug`.
  - **Lifecycle State Machine:**
    - `draft` ──publish──> `upcoming` ──start_at──> `ongoing` ──end_at──> `past`
    - Any active state can transition to `cancelled`. `past` and `cancelled` are strictly terminal.
    - Soft-deletion (`deleted_at`) is restricted exclusively to `draft` status; published events must be cancelled to preserve ledger and participant records.
  - **Invariants Enforced:**
    - `start_at < end_at`
    - `registration.opens_at < registration.closes_at <= start_at`
    - `roster_finalizes_at >= registration.closes_at` (for teamed events)
    - `teaming.is_teamed == true` ⇒ `1 <= team_size_min <= team_size_max`
    - `type === 'DE'` ⇒ `leaderboard == null` (Direct Events have no leaderboard)
    - `type === 'ALL'` ⇒ `auction != null` (Auctions only apply to Auction Leagues)
  - **Media Uploads:** `POST /events/:ref/media` accepts raw images up to 10MB, validated via magic bytes (JPEG/PNG/WebP), and stores them under `/uploads/events/` on disk (replaced by Media Service in Week 4).
- **Advanced Events Architecture (As Implemented — BE-1, Sep 13 2026):**
  - **Search & Multi-Filter Query Engine (`GET /events`):**
    - Multi-select filtering: `category` (leagues, bgec, fitsoc, general), `status` (draft, upcoming, ongoing, past, cancelled), `type` (LE, DE, ALL, DLL), `domain` (sports, esports, fitness, general), `tags`, and date bounds (`from`, `to`).
    - Full-text and regex search matching `title`, `description`, and `tags`.
    - Dual pagination support: Cursor pagination (`cursor`) for fast mobile infinite scroll + Offset pagination (`page`, `limit`, returning `total` and `total_pages`) for web admin tables.
    - Configurable sorting: `date_asc` (default for upcoming), `date_desc`, `popular` (by `counts.registrations_confirmed`), and `title`.
  - **Registration Eligibility Pre-Flight API (`GET /events/:ref/eligibility`):**
    - A single lightweight read returning `{ eligible: boolean, reason, capacity_status: 'open' | 'waitlist_only' | 'full', seats_remaining, form_id, waitlist_enabled, requires_approval, is_teamed, captain_application_required, existing_registration_id }`.
    - Enables frontend clients to render exact registration CTA states (Register, Waitlist, Registration Closed, or Already Registered) in a single request.
  - **Participant Management & Privacy Boundaries (`GET /events/:ref/participants`, `GET /events/:ref/participants/stats`):**
    - Public requests receive a privacy-sanitized roster exposing only confirmed participants and non-sensitive attributes (`user`, `status`, `role`, `team_id`, `submitted_at`).
    - Organizer / Admin requests receive unmasked participant submissions including auction `base_price`, waitlist position, and full answers.
    - Aggregated metrics endpoint (`/participants/stats`) provides real-time totals across statuses, roles, and attendance.
  - **Waitlist FIFO & Promotion Engine (`GET /events/:ref/waitlist`, `POST /events/:ref/waitlist/:id/promote`):**
    - Exposes ordered waitlist queue with FIFO positions.
    - Admins can promote waitlisted participants with optional `admin_override: boolean`.
    - Promotion atomically increments `counts.registrations_confirmed`, decrements `counts.registrations_waitlisted`, flips submission status to `confirmed`, and emits `RegistrationConfirmed` domain event.
  - **Attendance Verification (`GET /events/:ref/attendance`, `POST /events/:ref/attendance`):**
    - Organizers can record check-in status individually or in bulk at match/venue check-in.
    - Persists `context.event.attended` boolean and emits `ParticipantAttended` domain event to trigger automated participation point crediting by Points Service.
  - **Captains Management & Event Consumer Handshake:**
    - Dedicated captain administration endpoints: `GET /events/:ref/captains`, `POST /events/:ref/captains`, `DELETE /events/:ref/captains/:userId`.
    - Event Service subscribes to Redis Pub/Sub channel `bgsc:events` and consumes `CaptainApproved` (emitted by `registration-service`) to automatically and idempotently add approved captains to `event.auction.captain_user_ids`.
    - Subscribes to `UserProfileUpdated` to automatically sync contact person display names in `event.contacts`.

- Event registration section:
    
    - Name, game name.
        
    - Role selection: Team Captain or Team Member.
        
        - If Captain: Team name input, invite codes, and joining parameters derived from the event registration details
            
        - Team participant count tracking.
            
        - Team status toggle: Open / Invite Only / Closed.
            
- Event Team Formation Section:
    
    - View team invites / own team details.
        
    - Send team invites to users who are "Open to join".
        
    - Search registered teams with multi-faceted filters.
        
    - User toggle: Open / Closed / Invite Only (controls if others can invite them to teams).
        
- Event Leaderboard (if active and enabled).
	
- Event Live Bracket (if its any type of tournament or League) 
	
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
        

#### 5.5.2 Dynamic Form & Teaming Engine Architecture (As Implemented — BE-2, Sep 12-13 2026)

The Registration Service (`apps/registration-service`, Port 3004) owns dynamic form generation, participant submission processing, waitlist lifecycles, and team assembly for events and challenges:

- **Dynamic Form Builder & Schema Engine (`/forms`):**
  - **Polymorphic Form Definitions (`forms`):** Forms are owned polymorphically (`owner: { type: 'event' | 'challenge' | 'generic', id }`).
  - **9 Core Field Types:** Supports `text`, `number`, `email`, `phone`, `select`, `multiselect`, `file`, `checkbox`, and `textarea`.
  - **Validation Constraints:** Each field supports `required`, length bounds (`min_length`, `max_length`), numerical limits (`min_value`, `max_value`), custom regex pattern evaluation, and option dictionaries. Admin-only fields are stripped when rendered to non-admin viewers.
  - **Immutable Version Pinning:** Modifying a published form increments its `version` counter without mutating existing submissions. Every submission stores its exact `form_version`. The historical endpoint (`GET /forms/:id/versions/:version`) guarantees past submissions can be reliably audited against the exact schema in effect at the time of submission.

- **Participant Registration Lifecycle (`/registrations`):**
  - **Pre-Flight File Upload Pipeline (`POST /registrations/upload-file`):** Files are uploaded prior to form submission via streaming raw binary parser (`limit: 10MB`). Validated via magic bytes (JPEG, PNG, WebP, PDF) and stored at `/uploads/registrations/`. Returns a reference token/URL to embed in submission `files[]`.
  - **Single Active Registration Invariant:** Enforced via MongoDB unique partial index `{ 'owner.id': 1, 'user.user_id': 1 }` where `status != 'cancelled'`. Concurrent or duplicate submissions immediately fail with `409 already_registered`.
  - **Synchronous Capacity Handshake:** Handshake invokes Event Service's `POST /internal/events/:id/reserve-seat` with `{ registration_id, idempotency_key }` guarded by `X-Internal-Token`. If the event is full and waitlisting is enabled, the submission is saved with `status: 'waitlisted'` and an assigned `waitlist_position`.
  - **User Cancellation & Immediate Seat Release:** Calling `POST /registrations/:id/cancel` sets `status: 'cancelled'`, invokes `POST /internal/events/:id/release-seat`, and emits `RegistrationCancelled` with payload `{ owner, freed_seat: true }`.
  - **Autonomous FIFO Waitlist Promotion:** A background event consumer subscribes to `RegistrationCancelled`. When `freed_seat: true`, it selects the lowest `waitlist_position` (`sort({ waitlist_position: 1 })`), invokes `reserveSeat` with the registration ID as idempotency key, transitions the registration to `confirmed`, and emits `RegistrationCreated`.
  - **Manual Admin Override:** Core administrators can force-promote or override registration states via `PATCH /registrations/:id/status`.

- **Teaming Lifecycle & Captain Authorization (`/teams`):**
  - **Captain Approval Gate:** Participants applying for team captaincy submit an application payload during registration. Core reviewers approve applications via `PATCH /registrations/:id/captain-application`, which emits `CaptainApproved`. This event unlocks `POST /teams` creation for the captain and updates `event.auction.captain_user_ids`.
  - **Team Capacity & Invariants:** Teams enforce `team_size_min` and `team_size_max` inherited from event configuration.
  - **Roster Invitation & Join:** Captains issue member invitations (`POST /teams/:id/invite`); eligible registered members join (`POST /teams/:id/join`). Members can be pruned by the captain, the member themselves, or Core (`DELETE /teams/:id/members/:user_id`).
  - **Roster Lockdown:** Core freezes team changes prior to competition via `PATCH /teams/:id/lock`, preventing roster churn.
  - **Asynchronous Snapshot Reconciliation:** The service subscribes to `UserProfileUpdated`. When full name or avatar changes occur, it asynchronously updates user snapshots across both `form_submissions.user` and `teams.members[]`.


#### 5.5.3 Live Auction Engine Architecture & Invariants (As Implemented — BE-1, Sep 19 2026)

The Live Auction Hub (Spec §4.1, §5.15.4, §11.4) governs high-concurrency player bidding for All-Star Auction Leagues (`type === 'ALL'`). It is mounted under the Event Service (`:3003`) answering both `/events/:ref/auction/*` and the dedicated `/auction/*` gateway route:

- **Architectural Placement & Operational Rationale:**
  - *Co-location within Event Service (`:3003`):* An auction is an operational tournament phase of an All-Star League (`type === 'ALL'`), tightly coupled to event lifecycles, permissions, and captain approvals (`CaptainApproved` consumer). Operating an isolated microservice container solely for auction would introduce redundant deployment overhead, extra inter-process network hops, and operational debt without domain boundary benefits (Ponytail YAGNI).
  - *Edge Ingress & URL Parity:* The Gateway routes `/auction/**` directly to `:3003` (`LIVE_SERVICES` contains `'auction'`), presenting a first-class microservice boundary to clients while keeping internal deployment lean. Furthermore, the engine supports dual-mount routing: `/auction/events/:ref/*` for global auction hub screens and `/events/:ref/auction/*` for in-context event navigation.

- **Data Models & Lot Partitioning:**
  - `events.auction`: Stores macro parameters (`k_multiplier`, `min_bid_increment`, `bid_timer_seconds: 5`, `oc_override_quota: 3/7`, `oc_captain_override_quota: 3/7`, `status: 'not_started' | 'live' | 'paused' | 'finished'`, `captain_user_ids[]`, `purse_per_team`).
  - `auction_lots`: One document per player on the auction block (`order`, `player` snapshot, `registration_id`, `base_price`, `oc_adjusted_price`, `status: 'queued' | 'on_block' | 'sold' | 'unsold'`, `current_bid`, `current_bidder: { user_id, team_id }`, `timer_ends_at`, embedded append-only `bids[]`, `sold_to_team_id`, `sold_amount`, `closed_at`, `version`).
  - `teams.auction`: Team purse management (`purse_total`, `purse_spent`, `version`, `is_overridden: boolean`, `override_reason: string | null`, `overridden_by: string | null`).

- **Automatic Budget Allocation via $K$-Multiplier System:**
  - The total money supply of the auction economy is derived from the player pool and the macroeconomic multiplier $K$ (`event.auction.k_multiplier`, default 1.0):
    $$\text{Purse Pool} = K \times \sum_{i=1}^M \text{lot}[i].\text{base\_price}$$
  - Upon auction start (`POST /auction/events/:ref/start`), or via budget dry-run preview (`GET /auction/events/:ref/budget-preview`), the engine automatically derives the standard baseline purse per team:
    $$\text{Default Purse per Team} = \left\lfloor \frac{\text{Purse Pool}}{N_{\text{teams}}} \right\rfloor = \left\lfloor \frac{K \times \sum_{i=1}^M \text{lot}[i].\text{base\_price}}{N_{\text{teams}}} \right\rfloor$$
  - Every participating team without an explicit OC custom override has its `team.auction.purse_total` automatically initialized to this default purse, guaranteeing mathematical equilibrium across all rosters.

- **Dual Anti-Collusion OC Override Quota System:**
  - To prevent competitive distortion while granting necessary operational agility to the Organising Committee (OC), the engine enforces two independent mathematical quota ceilings:
    1. *Player Lot Base Price Quota (`oc_override_quota`, default $3/7 \approx 0.42857$):* OC can adjust individual player base prices (`POST /auction/lots/:id/override-price`). Strictly bounded by:
       $$\frac{N_{\text{overridden\_lots}} + 1}{N_{\text{total\_lots}}} \le \text{event.auction.oc\_override\_quota}$$
       Exceeding attempts fail with `422 oc_override_quota_exceeded`.
    2. *Team Captain Budget Quota (`oc_captain_override_quota`, default $3/7 \approx 0.42857$):* Before the auction starts (`status: 'not_started'`), OC can adjust an individual captain's team purse (`PATCH /auction/events/:ref/teams/:teamId/budget`). Strictly bounded by:
       $$\frac{N_{\text{overridden\_captains}} + 1}{N_{\text{total\_teams}}} \le \text{event.auction.oc\_captain\_override\_quota}$$
       Exceeding attempts fail with `422 oc_captain_override_quota_exceeded`. Overridden teams preserve their custom budget when automatic $K$-multiplier purse allocation executes, recording audit fields `override_reason` and `overridden_by`.

- **Admin Macro Configurability at Event Creation:**
  - When creating or configuring an All-Star League event (`type === 'ALL'`), the event creator (Admin / Coordinator) can customize all governing variables:
    * `k_multiplier` (positive float, default 1.0)
    * `oc_override_quota` (float $0 \le Q \le 1$, default $3/7$)
    * `oc_captain_override_quota` (float $0 \le Q \le 1$, default $3/7$)
    * `min_bid_increment` (positive integer, default 100)
    * `bid_timer_seconds` (integer 5–60s, default 5s)
    * `purse_per_team` (optional manual override for all teams)

- **Hierarchical Access Control Matrix:**
  | Role Tier | Permitted Operations | Restricted Operations |
  |---|---|---|
  | **Admin / Founder** (`founder`, `admin`, `coordinator`) | Define and update all macro variables ($K$, both OC caps, timers); override lots/budgets; force-reset or close auction. | Cannot alter budgets or quotas once auction transitions to `live`. |
  | **Organising Committee (OC)** (`core`, `referee`) | Override player base prices within `oc_override_quota`; override team captain purses within `oc_captain_override_quota` prior to start; start, pause, resume, and advance lots. | Cannot expand quota limits or alter $K$ once set; cannot modify captain budgets after auction is `live`. |
  | **Captains** (`captain_user_ids[]`) | Place live bids (`POST /auction/lots/:id/bid`) for active lot within remaining purse balance. | Cannot edit lots, prices, or budgets; cannot bid on self; cannot outbid self. |
  | **Spectators & Members** (Public / Authenticated) | Read live state (`/live`), browse lots (`/lots`), view teams and purses (`/budget-preview`). | Read-only. Any write attempt returns `401 Unauthorized` or `403 Forbidden`. |

- **Concurrency & Contention Control (Lock-Free OCC):**
  - High-velocity bidding wars utilize Optimistic Concurrency Control via `version: Number`. Rather than heavy distributed locking (Redlock), a single atomic compare-and-swap (CAS) operation guarantees sub-millisecond throughput with zero deadlock risk:
    ```ts
    AuctionLot.findOneAndUpdate(
      { _id: lotId, version, status: 'on_block', timer_ends_at: { $gt: now } },
      {
        $push: { bids: { bid_id: randomUUID(), bidder_user_id, team_id, amount, placed_at: now } },
        $set: { current_bid: amount, current_bidder: { user_id: bidder_user_id, team_id }, timer_ends_at: now + bid_timer_seconds },
        $inc: { version: 1 }
      },
      { returnDocument: 'after' }
    )
    ```
  - Stale bids (mismatched `version` from a concurrent higher bid, or `timer_ends_at <= now`) fail the atomic filter and are rejected immediately with `409 conflict_concurrent_bid` without dirty writes or race conditions.

- **Server-Authoritative Countdown:**
  - Timer is server-authoritative (`timer_ends_at`). Every valid bid increment resets the countdown to `now + bid_timer_seconds` (default 5s). Eliminates mobile device clock drift and timing manipulation.

- **Purse & Authorization Pre-Flight Checks:**
  1. *Captaincy Gate:* Caller must belong to `event.auction.captain_user_ids` (synchronized via `CaptainApproved` consumer). Non-captains receive `403 not_auction_captain`.
  2. *Self-Bidding Defense:* A registered captain who is also entered as a player on the block cannot bid on themselves (`422 cannot_bid_on_self`).
  3. *Accidental Self-Outbid Defense:* If the caller already holds the current highest bid (`current_bidder.user_id === bidder.id`), subsequent bids are rejected (`422 already_highest_bidder`) to protect mobile users from network double-taps.
  4. *Active Team & Roster Capacity:* Caller must own an active team in the event. If `team.members.length >= team.size_max`, the team is full and cannot acquire further players (`422 team_roster_full`), preventing player hoarding.
  5. *Purse Ceiling:* Team purse must cover the bid: `purse_remaining = purse_total - purse_spent >= amount` (`422 insufficient_purse`).
  6. *Minimum Increment:* First bid must satisfy `amount >= (oc_adjusted_price ?? base_price)`. Subsequent bids must satisfy `amount >= current_bid + min_bid_increment` (`422 bid_below_minimum`).

- **Real-Time Client Architecture (MVP Polling & Phase 2 SSE/WebSocket Roadmap):**
  - *MVP Phase & 750ms In-Memory Micro-Cache:* The spectator and bidding clients poll `GET /auction/events/:ref/live` at 1.5–2.0 second intervals. To protect the 2 vCPU server from high polling query volumes (which would reach ~667 req/s under 1,000 spectators), the Event Service maintains an in-memory cache (`LIVE_STATE_CACHE`) with a 750ms TTL:
    * Cache hits dynamically recalculate `seconds_remaining` in memory from `timer_ends_at`, completely bypassing MongoDB and serving responses in $<0.05\text{ms}$.
    * Any mutation (`placeBid`, `advanceLot`, `overrideLotPrice`, `overrideCaptainBudget`, `startAuction`, `closeAuction`) instantly purges the cache via `invalidateAuctionLiveCache(eventId)`, providing immediate zero-latency propagation of bids and lot transitions.
    * Database queries for live state use lean projections (`.lean()`) and `$slice: -10` on bids, preventing memory bloat.
  - *Phase 2 Ingress Transition:* Because the API contracts are consolidated behind `/auction/events/:ref/live`, Phase 2 seamlessly introduces an SSE (Server-Sent Events) or WebSocket streaming gateway adapter without modifying the underlying domain model or lot state machine.

- **Settlement, Double-Debit Immunity & Cross-Service Consistency:**
  - *Atomic CAS Settlement:* To eliminate race conditions where concurrent worker calls or admin retries could double-debit a winning team's purse, `advanceLot` claims lot advancement via an atomic compare-and-swap (CAS):
    ```ts
    AuctionLot.findOneAndUpdate(
      { _id: lotId, status: 'on_block' },
      {
        $set: { status: isSold ? 'sold' : 'unsold', sold_to_team_id, sold_amount, closed_at: now },
        $inc: { version: 1 }
      },
      { returnDocument: 'after' }
    )
    ```
    Only the single worker that successfully claims the CAS proceeds to invoke inter-service mutations (`debitTeamPurse` and `addAuctionTeamMember`). Subsequent concurrent callers or retries detect the terminal `'sold'` / `'unsold'` state and return the existing settled lot and next lot idempotently without duplicate debiting.
  - *Settlement Rollback:* If Registration Service or database updates fail during purse debit or roster addition, the lot status and fields are safely rolled back to `'on_block'`.
  - *Sold Settlement:* If a highest bidder exists, the winning team's purse is debited via Registration Service (`POST /internal/teams/:id/debit-purse` with atomic DB fallback), the player is added to the team roster (`POST /internal/teams/:id/add-member` with `acquired_via: 'auction'`), and domain events `BidClosed` and `PlayerSold` are published.
  - *Unsold Settlement:* If no bids were placed, the lot moves to `'unsold'`, and `BidClosed` and `PlayerUnsold` are published.
  - *Queue Advance:* The next queued lot (`order: 1`) automatically transitions to `'on_block'` with an active countdown timer, emitting `AuctionStarted`. If all lots are exhausted, `event.auction.status` transitions to `'finished'`.
  - *Active vs Disbanded Team Partitioning:* All auction lifecycle operations (budget calculation $N_{\text{teams}}$, bulk purse initialization, and OC captain override quota checks) strictly filter for active teams (`status: { $ne: 'disbanded' }`). Disbanded teams never dilute the default purse divisor or consume OC override quotas.
  - *Graceful Auction Close:* When an auction is closed manually (`POST /auction/events/:ref/close`), any lot actively `on_block` is automatically settled before transitioning event status to `'finished'`, preventing abandoned lots with expired timers.

- **Comprehensive API Surface:**
  - `GET /auction/events/:ref/live` & `GET /events/:ref/auction/live` — live player on block, countdown timestamp, seconds remaining, current highest bidder, and team purses.
  - `GET /auction/events/:ref/lots` & `GET /events/:ref/auction/lots` — catalogue of queued, on_block, sold, and unsold players.
  - `GET /auction/lots/:id` — full lot record with complete embedded bid audit history.
  - `GET /auction/events/:ref/budget-preview` & `GET /events/:ref/auction/budget-preview` — calculation preview of total lots, sum of base prices, $K$, total purse pool, default purse per team, and list of overridden vs baseline teams.
  - `POST /auction/lots/:id/bid` — high-concurrency atomic bid placement with OCC versioning.
  - `POST /auction/events/:ref/lots` — batch creation of auction lots from registered players.
  - `POST /auction/events/:ref/start` — start auction, automatically allocate $K$-multiplier purses, move first lot to block.
  - `POST /auction/events/:ref/pause` — pause active auction.
  - `POST /auction/events/:ref/resume` — resume auction and reset block timer.
  - `POST /auction/events/:ref/close` — close auction.
  - `PATCH /auction/events/:ref/config` & `PATCH /events/:ref/auction/config` — update macro auction parameters (`min_bid_increment`, `bid_timer_seconds`, `purse_per_team`, `k_multiplier`, `oc_override_quota`, `oc_captain_override_quota`).
  - `PATCH /auction/events/:ref/teams/:teamId/budget` & `PATCH /events/:ref/auction/teams/:teamId/budget` — OC override of individual captain team budget bounded by `oc_captain_override_quota` prior to auction start.
  - `POST /auction/lots/:id/advance` — settle lot (sold/unsold) and advance to next queued player.
  - `POST /auction/lots/:id/override-price` — admin override of base price (`oc_adjusted_price`) within `oc_override_quota`.

- **Domain Events Emitted (Redis Pub/Sub `bgsc.events`):**
  - `AuctionStarted`: `{ event_id, lot_id, player_user_id }`
  - `BidPlaced`: `{ bid_id, lot_id, event_id, bidder_user_id, team_id, amount }`
  - `BidClosed`: `{ lot_id, winner_team_id | null, final_amount | null }`
  - `PlayerSold`: `{ lot_id, player_user_id, team_id, amount }`
  - `PlayerUnsold`: `{ lot_id, player_user_id }`

#### 5.5.4 Tournament Bracket & Fixture Engine (As Implemented — BE-2, Sep 27 2026)

The Bracket Service (`apps/bracket-service`, Port 3012) manages tournament fixtures, structures, and automated match score advancements:

- **Domain Collections (`brackets`, `matches`):**
  - `brackets`: Polymorphic structure (`event_id`, `format: 'single_elim' | 'double_elim' | 'round_robin'`, `total_rounds`, `status: 'draft' | 'active' | 'completed'`).
  - `matches`: Round fixtures (`bracket_id`, `round`, `match_number`, `teams: [{ team_id, score, result }]`, `winner_id`, `scheduled_at`, `venue`, `status: 'scheduled' | 'in_progress' | 'completed'`).
- **Automated Generation & Progression:**
  - Brackets are generated from confirmed participants/teams in `form_submissions` or `teams`.
  - When a match score is submitted (`POST /matches/:id/score`), the winner is calculated, match status moves to `completed`, and the winner is automatically advanced to the designated next-round match slot.
- **Spectator Read Optimization:**
  - Fully decoupled reads: spectator trees query indexed `matches` by `bracket_id` sorted by `round` and `match_number`, serving the Mobile Spectator Bracket View in a single round-trip without touching Event Service.


### 5.6 F: Leaderboards Page

**Visibility:** Public (view), Authenticated (participate/invest)

- View all active events with leaderboards
    
- Filter by tags, participation status, event type
    
- **Points Investment:** If user is a participant and event permits, user can invest points to improve rank
    
- Leaderboard formats supported: Round Robin, Upper-Lower Bracket, Direct Elimination, Elimination after $N$ fails
    
- Min participant threshold required to activate leaderboard
    
- Score normalization controls (lower limit $\ge 0$, upper limit $\le 1000$)

#### 5.6.1 Leaderboard Engine Architecture & Invariants (As Implemented — BE-1, Sep 20 2026)

The Leaderboard Service (`apps/leaderboard-service`, Port 3007) governs event participant standings, scoring normalization, podium materialization, points investments, and cross-event global rankings.

- **Architectural Placement & Data Ownership:**
  - *Dedicated Container (`:3007`):* Mounted behind API Gateway route `/leaderboards/**` (`LIVE_SERVICES` contains `'leaderboard'`).
  - *Data Ownership:* Owns collections `leaderboard_entries` and `leaderboard_snapshots`. Configuration schemas (`scoring.parameters`, `scoring.normalization`, `leaderboard.format`, `leaderboard.min_participants`, `points_pool.investment_enabled`, `points_pool.investment_cap`) reside on `events` (Event Service) and are strictly read-only for Leaderboard Service.
  - *Two Leaderboard Archetypes:*
    1. **Event Leaderboards (`LE`, `DLL`, `ALL`):** Document-backed in `leaderboard_entries`. Evaluated from participant raw scoring parameters, dynamic weights, whole-event min-max normalization, and active points investments.
    2. **Global Platform Leaderboard:** Query-backed aggregation over the immutable `point_transactions` financial ledger (`points-service`). Sliceable across time periods (`all`, `semester`, `month`, `week`) and domain categories (`all`, `sports`, `esports`, `fitness`, `general`), accelerated via Redis sorted sets.

- **Dynamic Scoring Engine & Normalization:**
  - *Raw Score Aggregation:* Evaluated from admin-entered metric key-values:
    $$\text{raw\_score} = \sum_{p} \text{parameter}[p].\text{weight} \times \text{raw}[p]$$
    (Booleans map to 0/1; unknown keys are rejected at validation).
  - *Min-Max Normalization (Bounded in $[lower, upper]$):*
    To normalize heterogeneous metrics (e.g. goals scored vs lap times) into platform-standard values:
    $$\text{normalized} = \begin{cases} lower & \text{if } max\_raw = min\_raw \\ \text{round}\left(lower + \frac{raw - min\_raw}{max\_raw - min\_raw} \times (upper - lower), 2\right) & \text{if } max\_raw > min\_raw \end{cases}$$
  - *Final Score:*
    $$\text{final\_score} = \text{normalized\_score} + \text{invested\_points}$$
  - *Mathematical Derivation & Call Stack Protection:*
    - Derives `min` and `max` raw scores in a single $O(N)$ pass, eliminating memory thrashing and call stack overflow risks associated with `Math.min(...rawScores)`.
    - Precomputes the normalization scale factor $\text{scale} = \frac{upper - lower}{\text{rawRange}}$ outside the loop, substituting 1,000 floating-point divisions with CPU register multiplications.
  - *Dirty Bulk Write Invariant (99.5% I/O Reduction):*
    - To prevent disk I/O saturation on a 2 vCPU server (where unconditionally writing 1,000 participant documents per point investment generates 1,000 disk writes), `recomputeEventRanks` compares the newly computed rank and normalized score against existing database values:
      $$\text{isDirty} = (\text{existing.rank} \ne \text{materializedRank}) \lor (\text{existing.final\_score} \ne \text{finalScore})$$
    - Only dirty entries are appended to `bulkWrite`. A typical point investment causes 2–5 entries to swap ranks, dropping MongoDB write operations from 1,000 down to 2–5 ops per investment.
  - *Materialized Rank Invariant:*
    - Entries are sorted deterministically: active competitors strictly precede eliminated competitors (`stats.eliminated: true`), followed by `final_score` DESC, with deterministic tiebreak on `participant.display_name` ASC. Eliminated participants and disbanded teams never occupy podium positions (Ranks 1–3) over active competitors, but retain their scores and audit history at the bottom of the table.
    - If total active entries < `event.leaderboard.min_participants` (default 2), all entries maintain `rank = null` (under-threshold state; UI renders locked standings).
    - When threshold is satisfied, integer ranks ($1, 2, 3, \dots$) are materialized in `leaderboard_entries.rank`. `previous_rank` is preserved from the preceding snapshot to power the $\Delta$ rank change indicator.
    - *Mid-Event Threshold Drop Invariant:* If participant dropouts or cancellations cause active entries to fall below `min_participants` mid-event, existing materialized ranks are preserved (not cleared to null), the snapshot is marked `frozen: true, reason: 'freeze'`, and `LeaderboardFrozen { event_id, reason: 'below_threshold' }` is emitted. Further points investments are halted until threshold recovers.

- **Points Investment Flow & Invariants:**
  - *Pre-Flight Eligibility:*
    1. Caller must be an active, confirmed participant in the event.
    2. Event must be ongoing (`event.status === 'ongoing'`).
    3. Investment must be enabled (`event.points_pool.investment_enabled === true`).
    4. Minimum investment is 10 points (`amount >= 10`).
    5. Leaderboard must not be frozen (`latestSnapshot?.frozen !== true`).
    6. Sliding-window rate limit (max 5 investments per user per event per hour via Redis).
  - *Distributed Lock & Atomic Cap Verification:*
    - To prevent race conditions where teammates concurrently invest points and exceed `event.points_pool.investment_cap`, the service acquires a distributed entry lock: `lb:lock:entry:{entryId}` (with exponential backoff and Lua CAS release).
    - Fresh entry reload inside the lock evaluates cumulative cap: $\text{freshEntry.invested\_points} + \text{amount} \le \text{event.points\_pool.investment\_cap}$. Attempts exceeding the cap are refused with 400 `investment_cap_exceeded` *before* debiting any user points.
  - *Two-Phase Synchronous Debit Handshake:*
    - Leaderboard Service issues an internal service-to-service call to Points Service:
      `POST http://points-service:3006/internal/points/spend` (`X-Internal-Token` protected) with payload:
      `{ user_id, amount, reference: { type: 'leaderboard_entry', id }, request_id }`
      (falling back to atomic ledger debit if Points Service is in-process).
    - If user has insufficient balance, Points Service answers `409 insufficient_points`, aborting the investment without write.
  - *Optimistic Concurrency Lock:*
    - Upon successful debit, the entry is atomically incremented:
      ```ts
      LeaderboardEntry.findOneAndUpdate(
        { _id: entryId, version: currentVersion },
        { $inc: { invested_points: amount, version: 1 } },
        { returnDocument: 'after' }
      )
      ```
    - Standings are immediately re-sorted, snapshot recorded, lock released in `finally`, and `LeaderboardInvestmentMade` emitted.
  - *Non-Refundable Policy:* Invested points are non-refundable except upon event cancellation (`EventCancelled`), triggering an automated reversal sweep by Points Service.

- **Advisory Investment Projection Engine:**
  - `GET /leaderboards/events/:eventRef/project?amount=X`: Read-only projection calculation. Computes the user's projected final score and projected rank if $X$ points were invested, enabling mobile clients to show real-time rank jump previews before committing points.

- **Caching & High-Throughput Read Paths:**
  - *Event Leaderboard:* Redis ZSET `lb:event:{event_id}` stores `participant_id` scored by `final_score`, enabling $O(\log N)$ podium reads (`ZREVRANGE 0 2`), participant rank lookup (`ZREVRANK`), and scroll-to-my-position queries.
  - *Global Leaderboard (Redis ZSET Cache-First with Compound Index Fallback):*
    - Read path queries Redis ZSET `lb:global:{period}:{domain}:{source}` using $O(\log N + M)$ `ZREVRANGE ... WITHSCORES`, hydrating user profiles via lean projections. Response latency drops from ~120ms to $<1\text{ms}$.
    - If cache misses, an aggregation pipeline computes point sums from `point_transactions`, storing the result in Redis with a 5-minute TTL.
    - Aggregation is guarded by compound indexes in `point_transactions` (`{ type: 1, source: 1, created_at: -1 }` and `{ type: 1, created_at: -1 }`), eliminating un-indexed collection scans.

- **Domain Events & Lifecycle Consumers (`bgsc.events`):**
  - *Emits:*
    - `LeaderboardUpdated`: `{ event_id, reason, changed_participant_ids[] }`
    - `LeaderboardInvestmentMade`: `{ event_id, user_id, amount, previous_rank, new_rank }`
    - `LeaderboardFrozen`: `{ event_id, reason: 'below_threshold' | 'final' }`
  - *Consumes:*
    - `RegistrationCreated`: Auto-creates participant entry for solo events (`is_teamed === false`).
    - `RegistrationCancelled`: If pre-start, removes entry; if mid-event (ongoing), sets `stats.eliminated: true` to preserve the historical audit trail.
    - `TeamCreated` / `TeamLocked`: Auto-creates team entry for teamed events (`is_teamed === true`).
    - `TeamDisbanded`: If pre-start, removes entry; if mid-event, marks `stats.eliminated: true`.
    - `EventCompleted`: Triggers final rank settlement, freezes snapshot (`frozen: true, reason: 'final'`).
    - `EventCancelled`: Cleans up leaderboard entries and snapshots.
    - `UserProfileUpdated`: Synchronizes participant snapshots (`display_name`, `avatar_url`).
    - `UserDeleted`: Anonymizes participant snapshots in `leaderboard_entries` (`display_name = 'Deleted User'`, `avatar_url = null`, `deleted = true`) per GDPR.

- **Comprehensive API Surface:**
  - `GET /leaderboards/global` — query global ranked performers (`?period=all|semester|month|week&domain=all|sports|esports|fitness|general&source=all|challenge|event&limit=50&page=1`).
  - `GET /leaderboards/events/:eventRef` — paginated event standings, including normalization bounds, active threshold, and current participant counts.
  - `GET /leaderboards/events/:eventRef/podium` — top-3 podium standings with participant snapshots.
  - `GET /leaderboards/events/:eventRef/me` — authenticated user's entry, current rank, and scoring parameter breakdown.
  - `GET /leaderboards/events/:eventRef/project` — advisory investment projection (`?amount=X`).
  - `POST /leaderboards/events/:eventRef/invest` — authenticated participant points investment.
  - `PUT /leaderboards/events/:eventRef/scores` — Admin/Core score submission (`[{ participant_id, raw }]`).
  - `GET /leaderboards/events/:eventRef/snapshots` — historical rank snapshot audit log.

- **Strava & Challenge Decoupling Invariant:**
  - Leaderboard Service does *not* query the Strava API directly.
  - Strava OAuth, encrypted credentials (`strava_credentials`), and run/ride/swim caches (`strava_activities`) are owned exclusively by Challenge Service (`:3008`).
  - Strava activity proof completes physical challenges $\rightarrow$ Challenge Service emits `ChallengeCompleted` $\rightarrow$ Points Service records append-only ledger entries (`type: 'earn', source: 'challenge'`) $\rightarrow$ Leaderboard Service aggregates these points in `GET /leaderboards/global?source=challenge` (and domain `fitness` / `sports`).

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
- team formation list for making or joining public teams and all following the structure of teammed events

#### 5.7.1 Points Engine Architecture & Invariants (As Implemented — BE-2, Sep 19 2026)

The Points Service (`apps/points-service`, Port 3006) acts as the immutable financial ledger and points allocation authority:

- **Append-Only Financial Ledger (`point_transactions`):**
  - Schema: `{ _id, user_id, amount: signed int, type: 'earn' | 'spend' | 'refund' | 'adjust' | 'expire', source: 'event' | 'challenge' | 'leaderboard' | 'store' | 'engagement' | 'sponsor' | 'admin', reason, reference: { type, id }, idempotency_key, balance_after, actor: { type, user_id }, note, expires_at }`.
  - Derived Balance Invariant: The user's total points balance equals $\sum \text{amount}$. Points Service is the **sole authorized cross-service writer** of `users.points_balance`.
  - Double-Credit Defense: Enforced via unique partial index on `idempotency_key`. Retried events or network repetitions never mint duplicate points.
- **Rules Configuration Engine (`point_rules`):**
  - Database-backed configuration (`_id` == reason key, `label`, `source`, `default_amount`, `overridable_by`, `enabled`, `expires_after_days`).
  - Seeded at boot with insert-only semantics (`seedRules`) to ensure admin parameter overrides are never wiped on container restart.
- **Asynchronous Event-Driven Crediting:**
  - `ParticipantAttended` (emitted by Event Service): Idempotently credits attendance points (`key: event.attended:<event_id>:<user_id>`).
  - `ChallengeCompleted` (emitted by Challenge Service): Idempotently credits award points to all participant team members (`key: challenge.completed:<participation_id>:<user_id>`).
  - `RegistrationCancelled`: Automatically queries prior credits and issues offsetting negative `refund`/`adjust` transactions.
- **Synchronous Internal Handshake (`/internal/points/debit`):**
  - Mounts `requireServiceToken` for service-to-service calls.
  - Used by Leaderboard Service for points investment debits: performs an atomic conditional decrement (`points_balance >= amount`) and records an append-only `spend` transaction before confirming the user's investment.
- **Automated Expiry Sweeper (`scheduler/expiry.ts`):**
  - Background sweeper running every 60 minutes.
  - Queries positive transactions where `expires_at <= now` and remaining unexpired credit $> 0$, writing offsetting negative `expire` transactions.

#### 5.7.2 Challenge Engine & Strava Architecture (As Implemented — BE-2, Sep 20 2026)

The Challenge Service (`apps/challenge-service`, Port 3008) powers competitive solo/team quests and automated physical activity proofing:

- **Polymorphic Challenge Specifications (`challenges`):**
  - Kinds: `physical` (venue/GPS verified) vs `digital` (submission/proof verified).
  - Difficulties: `easy`, `medium`, `hard`, `legend` (grants Hall of Fame entry).
  - Validation Gates: Time limit countdowns (`time_limit_minutes`), submission proof types (`proof_types: ['image', 'video', 'link', 'strava']`), and auto-approval toggles.
- **Participation State Machine (`challenge_participations`):**
  - States: `accepted` ──submit──> `submitted` ──review──> `under_review` ──approve──> `approved` (or `rejected`).
  - Auto-Expiry: A background sweeper transitions accepted participations to `expired` if `deadline_at <= now` and no submission was made.
  - Decoupled Points Awarding: Upon approval, the service emits `ChallengeCompleted { challenge_id, participation_id, member_user_ids, award_points }`. The Points Service consumes this event, guaranteeing clean domain decoupling.
- **Strava OAuth & Activity Synchronization (`/strava`):**
  - Serves OAuth connection flows: `GET /strava/auth-url`, `POST /strava/callback`, `GET /strava/activities`, `DELETE /strava/disconnect`.
  - Secure Key Storage: User OAuth tokens (`access_token`, `refresh_token`) are encrypted with AES-256-GCM (`assertStravaKeyConfigured`) prior to storing in `strava_credentials`.
  - Activity Proofing: Fetches and caches Strava runs/rides/swims in `strava_activities` to automatically satisfy distance/pace verification for physical challenges.

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

#### 5.12.1 Feedback & Support Ticket Architecture (As Implemented — BE-2, Sep 27 2026)

The Feedback Service (`apps/feedback-service`, Port 3011) manages user inquiries, problem escalation, and coordinator contact routing:

- **Ticket Data Model (`feedback_tickets`):**
  - Schema: `{ _id, ticket_number: auto-increment integer, category: 'bug' | 'feature_request' | 'complaint' | 'general', priority: 'low' | 'medium' | 'high' | 'critical', status: 'submitted' | 'under_review' | 'resolved' | 'closed', reporter: { user_id, display_name, email } | null, is_anonymous: boolean, subject, message, attachments[], assigned_to, resolution_notes, created_at, resolved_at }`.
- **Absolute Anonymous Privacy Invariant:**
  - When `is_anonymous: true`, the service strips `user_id`, reporter display name, email, and IP address from both the ticket document and any audit log rows. Staff can reply to or resolve the issue, but identity is mathematically unreconstructible.
- **Abuse & Rate Throttling (`feedback_throttle`):**
  - Enforces IP-based and user-based throttling (maximum 5 tickets per hour) to prevent spamming coordinator inboxes.
- **Alert Dispatch via Domain Events:**
  - Submitting a ticket emits `FeedbackSubmitted { ticket_id, ticket_number, category, priority, is_anonymous }`. The Notification Service consumes this event to trigger coordinator email/push alerts.


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
        
### 5.15 Web Admin Workspace: Master Event, League & Rule Engine Configurator

**Visibility:** Core, Coordinator, Founder only

**Layout:** Comprehensive multi-step creation workflows and visual structural editors on React Web Console.

this will have the popUps for annoucements, 
#### 1. Structural Event/League Builder Wizard

This is the main page to create events!
- **Base Information Form:** Input Title, Rich-text Description, Cover Media, Venue Dropdown, and Calendar Scheduling bounds. (add other fiels depending upon the detials needed for the event to be placed and show  properly in the Events page)
- **Ruleset PDF Upload Area:** Drag-and-drop media module with EXIF stripping and virus scans. Parses PDF outlines directly to rules metadata fields.
- **Registration Deadline Gates:** Set registration opening time, team capping limits, and roster finalization closures.
- **Administrative Assignment Matrix:** Multi-select checklist assigning specific Core and Member roles to serve as administrators/referees of the event, which gives them the access to the event's edit and all

#### 1.1 Event Operations & Live Roster Management Console (As Implemented — BE-1, Sep 13 2026)

Operational console for event coordinators and Core referees during active event lifecycle:
- **Participant Directory & Audit Controls:** Live data grid of registered participants filterable by status (`confirmed`, `waitlisted`, `rejected`, `cancelled`), teaming role (`solo`, `captain`, `member`), team assignment, and attendance. Provides organizers with full submission answers and auction base prices.
- **FIFO Waitlist Queue & Manual Override Promotion:** Real-time waitlist inspection with promotion triggers (`POST /events/:id/waitlist/:id/promote`) allowing organizers to promote waitlisted participants on demand with optional capacity limit overrides.
- **Venue Check-in & Attendance Verification:** Match/venue attendance interface (`POST /events/:id/attendance`) allowing individual or bulk check-ins, persisting attendance records and firing `ParticipantAttended` events for points distribution.
- **Captain Roster Governance:** Dedicated controls (`POST/DELETE /events/:id/captains`) for assigning or revoking team captain privileges for auction-style leagues, integrated with the Redis domain event bus (`CaptainApproved`).

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
        $$\text{Default Purse per Team} = \left\lfloor \frac{\text{Purse Pool}}{N_{\text{teams}}} \right\rfloor$$
- **The Dual 3/7ths OC Override Matrix:** High-precision compliance interface displaying player and team roster lists:
    - *Player Lot Base Price Overrides:* Referees and coordinators can adjust individual player base prices, up to a strict mathematical threshold of $3/7\text{ths}$ of the entire player lot quota (`oc_override_quota`).
    - *Captain Team Purse Overrides:* Prior to auction start (`status: 'not_started'`), coordinators can adjust individual captain team purses, up to a strict mathematical threshold of $3/7\text{ths}$ of all competing teams (`oc_captain_override_quota`), recording audit reasons and preserving custom balances against automated recalculation resets.
    - *Budget Preview Controller:* Real-time calculation inspector invoking `GET /auction/events/:ref/budget-preview` displaying total purse pool, baseline team allocation, and active custom overrides.
- **Live Bid Controller:** Master interface with "Start Auction Block", "Close Bid", "Sold/Unsold", and countdown override buttons, updating client sessions under $100\text{ms}$.
    

#### 5 Users Page (Administration)

**Visibility:** Coordinator, Founder only

**Layout:** Desktop-optimized pagination grids with infinite scroll support.

##### User Management Table

- Columns: Full Name, Active Email, Role, Status Flag (Active/Suspended), Last Active Epoch, Participations Count, Registration Date, Active Sponsor Affiliation.
    
- Multi-Faceted Filters: Role dropdown, User status, Join date brackets, Sponsor groups.
    

##### Role Management Engine

- **Promotion to Core:** Form requires operational authorization logs detailing justifications.
    
- **Promotion to Coordinator:** Secure workflow requiring immediate **2FA/TOTP verification code verification** from Founder session on PWA workspace.
    
- **Demotion / Suspension:** Audit trail log mandatory. Cannot demote own active session.
    

##### Sponsor Management

- **Sponsor Onboarding Wizard:** Form initializing corporate sponsors, tenure boundaries, asset fields (high-res logos, website links, custom sponsor promotion videos), and reward tiers.
    
- **Tenure End Settlement Panel:** Red action button initiating database aggregation scripts. Freezes current transaction ledger, calculates final sponsor ranking vectors, identifies award winners, automatically distributes digital certificates, and provides comprehensive CSV data reports.
    

##### Audit & Moderation Workspace

- **Impersonation Sandbox Engine:** Safe view-only portal running sandboxed client simulation mimicking targeted user session for bug diagnostic analysis. Explicit logs are published to the immutable audit ledger.
    
- **Audit Log Explorer:** Cryptographically structured data rows showing Timestamp, Actor ID, Event Action, Target Type, Target ID, Previous State Value, and New State Value.
    

### Challange Creation
This covers all the fields needed to create a challange from the web panel:
- Required fields:
	- Points
	- Title
	- Description 
	- Time
	- Location
	- Status 
	- Domain
	- Teammable or not? 
		- If yes then also add the whole section for there being a team 

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
EventCancelled { event_id, cancelled_by, reason, timestamp }
EventDeleted { event_id, deleted_by, timestamp }
ParticipantAttended { event_id, registration_id, user_id, marked_by, timestamp }
```

#### Registration Domain Events

```
RegistrationCreated { registration_id, event_id, user_id, role, timestamp }
RegistrationCancelled { registration_id, event_id, user_id, freed_seat, reason, timestamp }
RegistrationConfirmed { registration_id, event_id, user_id, promoted_by, timestamp }
CaptainApproved { registration_id, event_id, user_id, approved_by, timestamp }
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
AuctionStarted { event_id, lot_id, player_user_id, timestamp }
BidPlaced { bid_id, lot_id, event_id, bidder_user_id, team_id, amount, timestamp }
BidClosed { lot_id, winner_team_id, final_amount, timestamp }
PlayerSold { lot_id, player_user_id, team_id, amount, timestamp }
PlayerUnsold { lot_id, player_user_id, timestamp }
```

#### Announcement Domain Events

```
AnnouncementCreated { announcement_id, title, author_id, timestamp }
AnnouncementPublished { announcement_id, title, category, priority, audience, timestamp }
AnnouncementArchived { announcement_id, archived_by, timestamp }
```

#### Challenge Domain Events

```
ChallengeCreated { challenge_id, title, kind, award_points, timestamp }
ChallengeAccepted { participation_id, challenge_id, user_id, timestamp }
ChallengeCompleted { challenge_id, participation_id, member_user_ids[], award_points, timestamp }
```

#### Feedback Domain Events

```
FeedbackSubmitted { ticket_id, ticket_number, category, priority, is_anonymous, timestamp }
FeedbackResolved { ticket_id, resolved_by, timestamp }
```

#### Leaderboard Domain Events

```
LeaderboardUpdated { event_id, reason, changed_participant_ids[], timestamp }
LeaderboardInvestmentMade { event_id, user_id, amount, previous_rank, new_rank, timestamp }
LeaderboardFrozen { event_id, reason, timestamp }
```

### 8.2 Event Consumers by Service

|   |   |   |
|---|---|---|
|**Service**|**Events Consumed**|**Actions Taken**|
|**Event Service**|CaptainApproved, UserProfileUpdated, UserDeleted|Adds approved captains to `event.auction.captain_user_ids`; synchronizes contact display snapshots in `event.contacts`; anonymizes references to deleted users|
|**Registration Service**|RegistrationCancelled, UserProfileUpdated, UserDeleted|Auto-promotes next waitlisted participant when a confirmed seat is freed; synchronizes user snapshots on `form_submissions` and `teams`; anonymizes user records upon deletion|
|**Announcement Service**|UserProfileUpdated, UserDeleted|Synchronizes author display snapshots in `announcements.author`; anonymizes author references upon deletion|
|**Points Service**|ParticipantAttended, RegistrationCancelled, EventCancelled, ChallengeCompleted|Awards base participation points upon on-site attendance confirmation; reverses participation credits on cancellation; cleans up awards on event cancellation; credits challenge award points to member users; updates user points balances|
|**Leaderboard Service**|RegistrationCreated, RegistrationCancelled, TeamCreated, TeamDisbanded, EventCompleted, EventCancelled, UserProfileUpdated, UserDeleted|Auto-populates participant entries on registration/teaming; updates statuses on cancellation; finalizes and freezes rankings on completion; cleans up on event cancel; syncs participant profile snapshots|
|**Challenge Service**|UserProfileUpdated, UserDeleted|Synchronizes participant snapshots across active challenge participations; anonymizes participant records upon deletion|
|**Notification Service**|AnnouncementPublished, AnnouncementUpdated, AnnouncementDeleted, RegistrationCreated, RegistrationConfirmed, RegistrationWaitlisted, EventCancelled, PointsEarned, ChallengeCompleted, ChallengeRejected|Fans out in-app inbox items, push notifications, and WhatsApp community broadcasts per user preferences and event priorities|
|**Feedback Service**|UserProfileUpdated, UserDeleted|Synchronizes reporter names or anonymizes tickets upon account deletion|
|**Bracket Service**|UserDeleted|Gracefully unlinks deleted users from tournament draw fixtures|
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

### 10.4 Notification & Broadcast Architecture (As Implemented — BE-2, Sep 26 2026)

The Notification Service (`apps/notification-service`, Port 3010) operates as the cross-channel dispatch and inbox management authority:

- **Domain Collections (`notifications`, `notification_dispatches`, `notification_preferences`):**
  - `notifications`: User inbox records (`user_id`, `category`, `title`, `body`, `action_url`, `is_read`, `read_at`, `created_at`).
  - `notification_dispatches`: Dispatch audit trail (`channel: 'in_app' | 'push' | 'whatsapp' | 'email'`, `status: 'queued' | 'sent' | 'failed'`, `external_message_id`, `error_message`, `retries`).
  - `notification_preferences`: Per-user granular opt-ins/opt-outs.
- **Broadcast Fan-Out on `AnnouncementPublished`:**
  - Consumes `AnnouncementPublished` from the domain event bus.
  - Automatically fans out to in-app user notifications matching the target audience.
  - Resolves mapped WhatsApp community groups for the announcement tags and sends external broadcasts via WhatsApp Business API.
- **Outbound Delivery Writeback:**
  - Invokes `PATCH /internal/announcements/:id/delivery` on the Announcement Service (guarded with `X-Internal-Token`) to record delivery timestamps and WhatsApp broadcast confirmation directly onto the announcement document.
- **Scheduler & Reconciliation (`scheduler/tick.ts`):**
  - Runs background retry routines for transient dispatch failures and catches up writebacks if external network outages occur.


## 11. Security, Privacy & Moderation

### 11.1 Authentication Security

- **JWT:** Access token (15 min expiry) + Refresh token (7 days, rotating)
    
- **Password Policy:** Min 8 chars, 1 uppercase, 1 number, 1 special char. BCrypt hashing.
    
- **OAuth2:** Google sign-in with state parameter CSRF protection (co-located on same server)
    
- **Phone Verification:** 6-digit numeric OTP via SMS/WhatsApp with 5-minute expiry, hashed storage, max 3 verification attempts, and 3 OTP requests per 15 min rate limit
    
- **2FA:** TOTP-based, required for Coordinator promotion and Founder actions
    
- **DDoS Mitigation & Multi-Tier Rate Limiting:**
    
    - **Edge Layer (Cloudflare DNS Proxy):** Public domain (`api.bgsc.in`) proxied through Cloudflare to absorb Layer 3/4 volumetric DDoS floods and hide the origin server IP.
    
    - **Gateway Ingress Layer (Port 3000):** Single public entry point reverse-proxying traffic to downstream microservices (Auth :3001, Users :3002, Events/Auction :3003, Registration :3004, Announcements :3005, Points :3006, Challenges :3008, Notifications :3010, Feedback :3011, Brackets :3012). Drops malformed traffic and enforces payload size limits (1MB default).
    
    - **Application Rate Limiting (Sliding Window):**
        - Auth & OTP endpoints (`/auth/login`, `/auth/register`, `/auth/phone/send-otp`): 5 attempts per 15 minutes per IP (blocks brute force & SMS flooding)
        - General API: 100 requests per minute per user/IP
        - Auction bidding: 1 request per second per user
        - Excess requests immediately reject with `429 Too Many Requests` and `Retry-After` header.
        

### 11.2 Data Privacy

- **Encryption:** AES-256 at rest, TLS 1.3 in transit (all client-server packets across mobile, web admin, and backend are encrypted end-to-end via TLS 1.3 / HTTPS; no manual client application-layer packet crypto required)
    
- **Field Masking:** Email and phone partially masked in public APIs (e.g., `r***@gmail.com`)
    
- **Full Access:** Only visible to friends or admin roles
    
- **GDPR Compliance:**
    
    - Account Information Request: Complete data export including all chat history, posts, points transactions, sponsor data
        
    - Right to deletion: Soft delete with 45-day grace period — **see 11.2.1 for what this actually does as built** before permanent purge. Logging in within 45 days allows account restoration; unrecovered accounts are permanently purged after 45 days
        
    - Privacy Policy and Terms of Service accessible pre-registration and in Account Actions
        

#### 11.2.1 Account Deletion — As Implemented (BE-2, Sep 6 2026; Re-Audited Sep 12 2026)

The delete flow is a **hide plus disclosure**, not an erasure. Recorded here because it differs from the
plain reading of "right to deletion" above.

| Concern | Behaviour |
|---|---|
| On request | `deleted_at` stamped, `status` → `deleted`, refresh token cleared. The account disappears from search, public profile reads and admin lists immediately |
| Data retained | **Everything.** No field is destroyed and no purge job exists. Registrations, point transactions, leaderboard entries and team rosters keep resolving |
| Grace period | 45 days (governed by canonical constant `ACCOUNT_DELETION_GRACE_DAYS = 45`), and it governs **restore**, not deletion. Signing in during the window detects `status: deleted` with `ACCOUNT_DELETED` error payload indicating remaining days. After 45 days, restore is permanently closed (`410 Gone`) |
| Disclosure | `GET /users/me/deletion-preview` returns the exact retention text the client must show, versioned. The confirmation captures `confirm: "DELETE"` (literal, case-sensitive), an optional `reason`, and an opt-in `research_consent` (default off) |
| Restore | Canonical restoration path: **Credentials-based Restoration via `POST /account/reactivate`** (Auth Service :3001) with `{ login, password }`. Restores user within the 45-day window (`ACCOUNT_DELETION_GRACE_DAYS = 45`), resets `status` to `active`, unsets `deleted_at`, records `user.restored` / `account_reactivated` audit log, and issues a fresh JWT token pair. User Service deliberately exposes no authenticated `/users/me/restore` route because soft-deletion revokes active tokens and login yields status `{ account_status: 'scheduled_for_deletion' }`; `GET /users/me` instead points clients directly to `restore_with: 'POST /account/reactivate'`. Past 45 days: `410 Gone`, restore blocked |
| `research_consent` | Marks whose identifiable data may be **used** for institutional research. Retention is universal; this flag governs use, not storage |
| Audit | Every deletion writes an immutable `AuditLog` row recording the disclosure version shown and the consent given. Restores write `user.restored` / `account_reactivated` |
| Encryption | Not yet implemented. 11.2's AES-256 at rest remains outstanding work; nothing in this flow assumes it |

Consequence to be aware of: a user who deletes their account cannot have their personal data removed
by any current mechanism. If an erasure obligation is ever asserted, a purge or pseudonymization job
has to be written — the schema supports it (`deleted_at` is already the marker), but it does not exist.


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
    
- Delete account (with confirmation flow, immediate session termination, and 45-day restoration grace period)
    

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

|                     |                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Feature**         | **Detail**                                                                                       |
| **Infrastructure**  | CI/CD pipelines (GitHub Actions), staging environment, Docker setup, basic monitoring            |
| **Design System**   | Core component library, color tokens (BGSC/BGEC/FitSoc themes), typography, spacing system       |
| **Backend Core**    | Auth service (JWT + Google OAuth), User service, RBAC middleware, API Gateway with rate limiting |
| **Database**        | PostgreSQL schema migrations, Redis cache layer                                                  |
| **MVVM Scaffold**   | Base ViewModel classes, observable patterns, repository layer, React Query integration           |
| **Mobile Shell**    | Navigation drawer, status bar, tab system, empty screens, theme switching                        |
| **Event Bus (MVP)** | In-memory event emitter (upgrade to Kafka in Phase 2)                                            |

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

|                          |                                                                                                                                                                          |              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| **Feature**              | **Detail**                                                                                                                                                               | **Priority** |
| **Auth**                 | Login/Register (email + Google), Forgot password, Guest browsing                                                                                                         | P0           |
| **Sponsor System v1**    | Sponsor selection during onboarding, active sponsor display, basic sponsor leaderboard, fan count on event wins                                                          | P0           |
| **Home Page**            | Landing intro, Announcements (last 4 months), Public social feed (read-only)                                                                                             | P0           |
| **Events**               | Browse upcoming/ongoing/past events, Solo registration, Basic event details, Post-event fan awards                                                                       | P0           |
| **User Profile**         | View profile, Edit basic info, Interest fields (onboarding), Public player card with sponsor badge, Sponsor stats                                                        | P0           |
| **Admin (Coordinator+)** | Create `DE` (Direct Event) and `LE` (Leaderboard Event) workspace config setups on web portal, Post announcements, Basic Users table, Sponsor creation/management on PWA | P0           |
| **Points System**        | Manual point awards by admin on event participation, User can see balance, Sponsor bonus points                                                                          | P1           |
| **Notifications**        | In-app only (event reminders, registration confirm, sponsor updates)                                                                                                     | P1           |
| **Search**               | Search events and users by name                                                                                                                                          | P1           |
| **Hall of Fame v1**      | Event winners + Sponsor Champions section                                                                                                                                | P1           |

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
|**3/7ths Quota**|Default OC anti-collusion override limit for player base prices and team captain purse allocations in auctions|
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