# BGSC Platform — Screen Inventory

Derived from the Complete Feature Specification & Architecture (v4.0).

Screens are marked with the platform they belong to: **[M]** Mobile (React Native/Expo), **[W]** Web Admin Console (React PWA), or **[M+W]** both. Visibility levels follow the spec: `Public`, `Authenticated`, or a specific role (`Member+`, `Core+`, `Coordinator+`, `Founder`).

---

## Mobile App Screens

### Auth [kashyap]

| Screen | Visibility | Notes |
|---|---|---|
| Login | Public | Email/password + Google OAuth; "Keep me logged in" toggle; link to Register |
| Register | Public | Username, email, contact, password, sponsor selection (mandatory), ToS acceptance; triggers Get Started flow on success |
| Auth Callback | Public | Google OAuth redirect target; exchanges code for tokens then navigates home |

---

### Core Navigation (Drawer)

All drawer screens share the Dynamic Status Bar (contextual logo center, drawer toggle left, profile picture / login button right).

#### Home Page — 3 tabs [doorbin]

| Tab | Visibility | Key Content |
|---|---|---|
| Introduction / Landing | Public | BGSC/BGEC/FitSoc intro, coordinator comic-portrait announcements, link to Announcements tab |
| Announcements | Public | Broadcast feed (4-month retention), category-filtered (BGEC, FitSoc, Airball, Offside, PowerPlay, Around The Net, Deuce, Highlight, Teams); coordinators can open Make Announcement Popup |
| General Social Feed | Public (read), Authenticated (post) | Public posts from community; FAB opens Add Post Popup (guests redirected to Login) |

#### User Profile Page [doorbin]

| Section | Visibility | Key Content |
|---|---|---|
| Player Card | Authenticated | Avatar, bio, interests, sponsor badge, tags, social links, rating, shareable export |
| User Info | Authenticated | Name/email/contact, Strava activity, Steam activity, sponsor stats (fan count, rank, events won) |
| Event Suggestions | Authenticated | Personalised upcoming events; open public teams listed below teamed events |
| Friend Suggestions | Authenticated | Suggestions based on contacts, interests, event activity |
| History | Authenticated | Past events, match history, challenges, sponsor contribution history |

Custom status bar on this page: back button (left), "Account Actions" (center), profile picture (right).

#### Friends Page — 5 tabs [doorbin]

| Tab | Visibility | Key Content |
|---|---|---|
| General Chats & Search | Authenticated | Friend list, DMs, group chats, community servers, friend requests, search by username |
| Activities & Events | Authenticated | Events friends have participated in; filter by live / past |
| Recent Achievements | Authenticated | Friends' wins and achievements; sponsor fan contributions |
| Challenge Friends | Authenticated | Browse challenges, send challenge invitations (physical or digital) |
| Team Up For Event | Authenticated | Select event, send team-up requests, view open public teams |

#### Events Page — 4 category tabs [doorbin]

| Tab | Visibility | Key Content |
|---|---|---|
| Leagues (Sports + Esports) | Public (browse), Authenticated (register) | League events with captain request flow; auction-based player pricing |
| BGEC Events | Public (browse), Authenticated (register) | Esports-specific events |
| FitSoc Events | Public (browse), Authenticated (register) | Fitness / physical sport events |
| General Events | Public (browse), Authenticated (register) | Highlight events, Waves, sponsored events |

Each tab supports **Past / Upcoming / Ongoing** multi-select filters.

**Event Details View** (drill-in from any event card):

| Section | Visibility | Key Content |
|---|---|---|
| Event Info | Public | Title, description, rules PDF, awards, schedule, coordinator contacts, sponsor leaderboard preview |
| Registration | Authenticated | Name, game name, role (Captain / Member), team name, invite code, team status toggle |
| Team Formation | Authenticated | View team invites, search registered teams, send invites to open users |
| Event Leaderboard | Public | Live ranking if active and enabled |
| Event Results | Public | Post-completion results; "+X fans earned for [Sponsor]" notification |

**Spectator Bracket View** (drill-in from league events):
- Styled real-time bracket tree (Round Robin, Single/Double Elimination, Elimination after N fails)
- Tap any match to see venue, date, rosters, head-to-head stats, live scores
- Coordinators see a "Manage on Web" redirect anchor instead of edit controls

**Auction Spectator View** (mobile-only, drill-in from auction-based league):
- Live player on the block
- Bid log with 5-second countdown timer
- Captain wallets and rosters (read-only)

#### Leaderboards Page [dorobin]

| Screen | Visibility | Key Content |
|---|---|---|
| Leaderboards | Public (view), Authenticated (invest) | All active leaderboard events; filter by tags/type/status; points investment if permitted; format indicators (Round Robin, Elimination, etc.) |

#### Point System & Challenge Page [doorbin]

| Section | Visibility | Key Content |
|---|---|---|
| Points Dashboard | Authenticated | Balance, earning sources, spending history, transaction log |
| Challenge Browser | Authenticated | Filter by domain and difficulty; time/team limits; resource links; award points; Legend tier unlocks Hall of Fame entry |

#### Sponsor / Newsletters Page [adit]

| Section | Visibility | Key Content |
|---|---|---|
| Active Sponsors | Public | Sponsor cards with fan count, ranking, affiliated users, events won; tenure countdown |
| Sponsor Leaderboard | Public | Ranked list; sort by total fans / events won / affiliated users; time filter |
| User Affiliation | Authenticated | Current sponsor badge; "Change Sponsor" (once per semester); personal fan contribution breakdown |
| Sponsor Prizes | Public | Prize pool per sponsor; criteria, current leader, claim status |
| Sponsor Archive | Public | Past sponsors with tenure, linked events, and social links |
| Newsletters | Authenticated | Subscribe/unsubscribe per category (Gaming News, Indie Spotlights, Game Dev, Campus Studio) |

#### Hall of Fame [jeet]

| Screen | Visibility | Key Content |
|---|---|---|
| Hall of Fame | Public | Winner cards by category (League, Highlight, Challenge Legends, Sponsor Champions); filter by year/type/sport/sponsor; shareable cards; sponsor dynasty timeline |

#### Store Page [adit]

| Section | Visibility | Key Content |
|---|---|---|
| Merchandise Store | Authenticated | Item cards, points cost, stock status; cart and checkout; order tracking |
| Indie Game Showcase | Public | Game trailers, download links, points cost |
| Friendly Games Jam | Authenticated | Pitch board; upvote/comment on ideas |
| Friendly Gaming | Authenticated | Discord/Steam integration; voice coordination overlay (future) |

#### Media Page [adit]

| Screen | Visibility | Key Content |
|---|---|---|
| Media Gallery | Public (public media), Authenticated (friends-only) | Masonry grid; event albums, community uploads, Memories ("Year in Review"), sponsor galleries; filter by tag/date/uploader/type/sponsor; download, share, report |

#### Feedback & Contact Us [jeet]

| Section | Visibility | Key Content |
|---|---|---|
| Feedback Tickets | Public | Submit bug/feature/complaint/general tickets; severity, rich text, attachments; anonymous toggle; status tracking |
| Contact Directory | Public | Current + past coordinators; email, masked WhatsApp; quick action buttons |
| FAQ | Public | Accordion by section (Account, Events, Points, Union, Technical, Privacy, Sponsors); keyword search |

#### Union Page (Mobile Subset) [doorbin]

| Section | Visibility | Key Content |
|---|---|---|
| Quick Add Task | Member+ | Floating overlay for rapid unassigned task logging |
| Task Reminder Banner | Member+ | Active task reminders shown inline |
| Automated Task Chat | Member+ | Group chat rooms auto-created per task assignment |
| On-Duty Status | Member+ | Daily coordinator on-duty calendar view |

Full Union workspace (Kanban, Gantt, strict task creation) is **Web-only** — mobile shows a "Manage on Web" redirect for those views.

---

## Web Admin Console Screens

### Auth

| Screen | Visibility | Notes |
|---|---|---|
| Login | Public | Email/password + Google OAuth for coordinators/founders |
| Auth Callback | Public | Google OAuth redirect handler |

---

### Event & League Management

**Master Event / League Configurator** (`Core+`)

| Step | Key Content |
|---|---|
| 1 — Structural Builder Wizard | Title, rich-text description, cover media, venue, calendar bounds, rules PDF upload (EXIF-stripped, virus-scanned), registration deadline gates, admin assignment matrix |
| 2 — Visual Bracket Generator | Bracket type selector (Round Robin, Single/Double Elimination, Elimination after N); interactive SVG drag-and-drop bracket canvas; seed management, bye-round awards, result overrides |
| 3 — Dynamic Rule Scoring Engine | Points toggles (base participation, winner multiplier, sponsor bonus), custom score parameter matrix (e.g. `goals`, `kills`, `assists`), score normalization sliders |
| 4 — Live Auction Hub Console | Auction room initialization (captains, timer, min increment, purse calc via K multiplier), 3/7ths OC Override Matrix, live bid controller (Start, Close Bid, Sold/Unsold, countdown override) |

---

### Union Workspace

**Full Task & Project Management** (`Member+`)

| View | Key Content |
|---|---|
| List View | Hierarchical task rows with status, assignees, priority, deadline |
| Kanban Board | Cards across customizable columns (Active, On-Hold, Abandoned, Completed) |
| Gantt Chart | Visual dependency lines and timelines |
| Calendar View | Grid-aligned task and meeting schedule |
| Crew Allocation Heatmap | Member on-duty calendars overlaid with active task workloads |
| Strict Task Creation Form | Deadline, multiple assignees, event association, priority, sub-task trees, Google Calendar sync |

---

### Users & Administration

**Users Page** (`Coordinator+`)

| Section | Key Content |
|---|---|
| User Management Table | Full Name, Email, Role, Status, Last Active, Participation Count, Registration Date, Active Sponsor; multi-faceted filters |
| Role Management Engine | Promote to Core (with justification log), promote to Coordinator (requires Founder 2FA/TOTP), demotion/suspension with audit trail |
| Sponsor Management | Sponsor onboarding wizard (tenure bounds, logos, promo video, reward tiers); Tenure End Settlement Panel (aggregation scripts, CSV export, prize distribution) |
| Audit & Moderation Workspace | Immutable audit log explorer (Timestamp, Actor, Action, Target, Previous/New Value); Impersonation Sandbox Engine (view-only sandboxed user session, fully logged) |

---

### Dashboards

| Dashboard | Visibility | Key Content |
|---|---|---|
| Coordinator Dashboard | Coordinator+ | Event analytics, registration trends, user growth, sponsor rankings |
| Founder Dashboard | Founder | Platform-wide metrics, sponsor ROI, system health |
| Union Dashboard | Member+ | Task completion rates, crew availability heatmap, project timelines |

---

## Popups & Modals (Both Platforms) [kashyap]

| Popup | Trigger | Visibility | Key Content |
|---|---|---|---|
| Get Started / Onboarding | First login | Authenticated | Sequential: Interest Fields → Sponsor Selection → Add Friends → Connect Socials |
| Interest Fields | First login, Account Edit, periodic prompt | Authenticated | Multi-select grid: Sports, Esports, Gaming Industry, Game Dev |
| Account Action — Edit | Profile picture tap on status bar | Authenticated | Edit username/email/contact/password, interests, newsletters, social connections, sponsor change |
| Account Action — Actions | Profile picture tap on status bar | Authenticated | Disable account, delete account, data export request, ToS/Privacy Policy |
| Make Announcement | Admin button on Home or dedicated button | Core+ | Title, rich-text body, type tags (maps to WhatsApp groups), send now / schedule |
| Add Post | FAB on Home or Friends feed | Authenticated | Tab 1: Media selection; Tab 2: Caption/tags/description; Tab 3: Likes/comments/sharing/visibility controls |
| Profile Picture | Profile picture on User Profile status bar | Authenticated | Camera/gallery, crop/zoom, preview before save |
| Global Search | Search icon on status bar | Public | Fuzzy search across Users, Events, Teams, Posts, Announcements, Store Items, Challenges, Sponsors; filters by type/date/tag/status |

---