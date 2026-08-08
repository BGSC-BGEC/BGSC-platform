# Web Admin Workspace — UI/UX Specification

**Section:** 5.15 Web Admin Workspace: Master Event, League & Rule Engine Configurator  
**Platform:** Web Admin Console (React 19 / Vite / Tailwind CSS / Desktop PWA)  
**Layout File:** `src/app/admin/layout.tsx`  
**Dashboard Main Route:** `src/app/admin/page.tsx`  
**Target Viewport:** Desktop Displays (`1024px`+ breakpoint target; optimal `1280px`–`1920px`)  
**Visibility / Access Control:** `Core`, `Coordinator`, `Founder` only (Restricted route wrapper; unauthorized users are redirected to `/login` with an "Access Denied" state)

---

## 1. Page Structure & Master Layout Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)  │  GLOBAL HEADER (64px height)                                             │
│  ┌──────────────┐ │  ┌───────────────────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │  BGSC Admin  │ │  │  Search (⌘K)...       │ │ [Live Admin]  │ │ [Bell] [Core] Profile ▼│ │
│  └──────────────┘ │  └───────────────────────┘ └───────────────┘ └───────────────────────┘ │
│  ─────────────────┼─────────────────────────────────────────────────────────────────────────│
│  NAVIGATION       │  BREADCRUMB / MAIN CANVAS HEADER                                        │
│                   │  Admin / Dashboard                                                      │
│  Overview         │  ────────────────────────────────────────────────────────────────────── │
│  Tournaments      │                                                                         │
│  Captains         │  MAIN CONTENT CANVAS (Fluid width, 1024px+ responsive)                  │
│  Scoring Rules    │                                                                         │
│  Moderation       │  ┌─────────────────────────┐  ┌──────────────────────────────────────┐  │
│  Tickets          │  │ Stat Card / Metric      │  │ Operational Queue                    │  │
│  Broadcasts       │  └─────────────────────────┘  └──────────────────────────────────────┘  │
│  Settings         │                                                                         │
│                   │                                                                         │
│  ─────────────────│                                                                         │
│  [Collapse]       │                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Desktop Design Tokens & Styling (Dark Slate & Teal Palette)

All components in the Web Admin Workspace adhere to the dark slate and high-contrast teal theme tokens.

### 2.1 Theme Palette

| Token Role | Hex Code | Tailwind Class | Semantic Purpose |
|---|---|---|---|
| **Canvas Background** | `#0F172A` | `bg-slate-900` | Main application canvas and viewport root |
| **Surface / Card / Sidebar** | `#1E293B` | `bg-slate-800` | Container cards, sidebar background, table rows |
| **Surface Hover / Active Track** | `#334155` | `bg-slate-700` | Hover states, active input fills, dropdown surfaces |
| **Borders & Dividers** | `#475569` | `border-slate-600` | 1px subtle outlines, table gridlines, card borders |
| **Primary Accent** | `#0D9488` / `#235347` | `bg-teal-600` / `ring-teal-600` | Active navigation tabs, primary CTA buttons, focus rings |
| **Text Primary** | `#F8FAFC` | `text-slate-50` | Headings, card titles, and primary data copy |
| **Text Secondary / Muted** | `#94A3B8` | `text-slate-400` | Helper descriptions, field labels, breadcrumbs |
| **Danger Status** | `#EF4444` | `text-red-500` / `bg-red-500/20` | Critical errors, unrecoverable deletions, auction overrides |
| **Warning / Amber Status** | `#F59E0B` | `text-amber-500` / `bg-amber-500/20`| Pending reviews, near-quota warnings, countdown ticks |
| **Success / Live Status** | `#10B981` | `text-emerald-500` / `bg-emerald-500/20`| Live auctions, verified players, active tournament brackets |

### 2.2 Typography Hierarchy

- **Primary UI & Body Font:** `Inter`, `system-ui`, `-apple-system`, `sans-serif`.
- **Monospace Font:** `JetBrains Mono`, `Fira Code`, `ui-monospace`, `monospace` (used for Match IDs e.g. `#M101`, Ticket IDs e.g. `#TICK-10492`, Moderation IDs e.g. `#MOD-8821`, UUIDs, real-time auction timers, numeric bounds, points, and multipliers).
- **Headings:**
  - Page Title: `24px` (font-semibold / text-slate-50)
  - Section / Card Header: `16px`–`18px` (font-medium / text-slate-100)
  - Field Labels: `12px` (font-medium / uppercase / tracking-wider / text-slate-400)
  - Monospace Data / Scores / Timers / Multipliers / IDs: `13px`–`18px` (`font-mono` / tabular-nums)

---

## 3. Global Navigation Shell & Header

### 3.1 Global Header Bar (`64px` Fixed Top)

* **Positioning:** Fixed top (`height: 64px`, `z-index: 1000`). Dynamically adjusts `left` offset based on sidebar state (`240px` when expanded, `64px` when collapsed).
* **Left:** Clickable breadcrumb navigation (e.g., `Admin / Tournaments / Offside S3 / Bracket`).
* **Center-Left:** Command Palette trigger (`⌘K` / `Ctrl+K`) displaying a `320px` search input placeholder with quick fuzzy search.
* **Center-Right:** Environment/Live status pill (`[Live Admin]`, `[Production]`, `[Staging]`).
* **Right Slot 1:** `+ Create` primary action dropdown (`New Announcement`, `New Event`, `Manual Point Adjust`).
* **Right Slot 2:** System Notification Bell `[Bell]` with unread counter badge. Tapping opens a `400px` right slide-over notification drawer.
* **Far Right:** Administrator Profile Avatar (`36px`), Display Name, and Role Pill (`[Core]` / `[Coordinator]` / `[Founder]`). Tapping opens a dropdown menu (`Profile Settings`, `Audit Log`, `Mobile View`, `Log Out`).

### 3.2 Collapsible Navigation Sidebar (`240px` / `64px` Fixed Left)

* **Positioning:** Fixed left (`top: 0`, `bottom: 0`, `z-index: 1100`).
* **Header:** Clean text branding title (`BGSC Admin / Console Hub`) with full click target and an explicit collapse toggle button (`ChevronLeft` / `ChevronRight`) positioned with ample breathing room to prevent misclicks when collapsing or expanding to icon-only mode (`64px`).
* **Footer:** Version label (`v2.4.0-admin`) and active session duration display.

#### Navigation Hierarchy & Domain Groups:

1. **SYSTEM OVERVIEW**
   - **Dashboard** (`/admin/dashboard` or `/admin`)
2. **COMPETITIONS & LEAGUES**
   - **Tournaments & Brackets** (`/admin/tournaments`)
   - **Captain Requests** (`/admin/captains`)
   - **Auction Controllers** (`/admin/auctions`)
3. **ECONOMY & SCORING**
   - **Scoring Engine** (`/admin/scoring`)
   - **Points & Investments** (`/admin/investments`)
4. **COMMUNITY & GOVERNANCE**
   - **Feedback Tickets** (`/admin/tickets`) — *Badge: N open tickets*
   - **Moderation Queue** (`/admin/moderation`) — *Badge: N pending reports*
   - **Broadcast Engine** (`/admin/broadcasts`)
   - **System Settings** (`/admin/settings`) — *Gated to Founder/Coordinator role with lock indicator*

---

## 4. Element 2: Competitions & Leagues Overview

Element 2 specifies the three core administrative interfaces governing tournament schedules, seedings, captain vetting, and live player auctions:

| Sub-Module / View | Route File | Purpose |
|---|---|---|
| **Bracket Manager** | `src/app/admin/tournaments/[id]/bracket/page.tsx` | Visual scalable vector bracket editor with live score inputs, seed dragging, and rules drawer. |
| **Captain Applications** | `src/app/admin/captains/page.tsx` | Full data table with deviation indicators and 560px review slide-over drawer for vetting team leaders. |
| **Live Auction Controller** | `src/app/admin/auctions/[id]/page.tsx` | Sub-100ms real-time auction operator hub with 5s countdown clock, bid steppers, and captain wallet matrices. |

---

## 5. Component 1: Interactive Bracket Engine (`/admin/tournaments/[id]/bracket`)

### 5.1 Page Layout & Control Toolbar

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Tournaments]  Offside Season 3 — Championship Bracket                    [Live]  [Autosaved]        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TOOLBAR:                                                                                               │
│ Format: [ Single Elimination ▾ ]  │  Zoom: [-] [ 100% ] [+] [Reset Fit]  │  [Configure Rules]          │
│ Status: [ 4 / 7 Matches Complete ]                                      │  [Save Bracket State ]       │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ INTERACTIVE BRACKET SURFACE (Pan / Zoom Canvas · Connected SVG Vector Progression Lines)               │
│                                                                                                        │
│   ROUND 1 (Quarter-Finals)          ROUND 2 (Semi-Finals)              ROUND 3 (Championship Finals)   │
│                                                                                                        │
│   ┌──────────────────────────┐                                                                         │
│   │ #M101 · Pitch A · 10:00  │                                                                         │
│   │ [Completed]              │                                                                         │
│   ├──────────────────────────┤                                                                         │
│   │ (1) Titans [W]    [ 3  ] │═══════════╗                                                             │
│   │ (8) Strikers      [ 1  ] │           ║                                                             │
│   └──────────────────────────┘           ╠════▶ ┌──────────────────────────┐                           │
│                                          ║      │ #M201 · Pitch A · 14:00  │                           │
│   ┌──────────────────────────┐           ║      │ [Live Match]             │                           │
│   │ #M102 · Pitch B · 10:00  │           ║      ├──────────────────────────┤                           │
│   │ [Completed]              │           ║      │    (1) Titans     [ 1  ] │───────────┐               │
│   ├──────────────────────────┤           ║      │    (4) Phantoms   [ 1  ] │           │               │
│   │ (4) Phantoms [W]  [ 2  ] │═══════════╝      └──────────────────────────┘           │               │
│   │ (5) Spartans      [ 0  ] │                                                         │               │
│   └──────────────────────────┘                                                         │               │
│                                                                                        ├─────▶ ┌───────│
│   ┌──────────────────────────┐                                                         │       │ #M301 │
│   │ #M103 · Pitch A · 11:30  │                                                         │       │ [Pendi│
│   │ [Completed]              │                                                         │       ├───────│
│   ├──────────────────────────┤                                                         │       │    TBD│
│   │ (2) Phoenix [W]   [ 4  ] │═══════════╗                                             │       │    TBD│
│   │ (7) Vipers        [ 2  ] │           ║                                             │       └───────│
│   └──────────────────────────┘           ╠════▶ ┌──────────────────────────┐           │               │
│                                          ║      │ #M202 · Pitch B · 14:00  │           │               │
│   ┌──────────────────────────┐           ║      │ [Pending]                │           │               │
│   │ #M104 · Pitch B · 11:30  │           ║      ├──────────────────────────┤           │               │
│   │ [Completed]              │           ║      │    (2) Phoenix    [    ] │───────────┘               │
│   ├──────────────────────────┤           ║      │    (3) Dragons    [    ] │                           │
│   │ (3) Dragons [W]   [ 1  ] │═══════════╝      └──────────────────────────┘                           │
│   │ (6) Wolves        [ 0  ] │                                                                         │
│   └──────────────────────────┘                                                                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Control Toolbar Mechanics
1. **Format Dropdown:** Selects active topology (`Round Robin`, `Single Elimination`, `Double Elimination`, `Elimination after N Fails`).
2. **Zoom & Pan Controls:** Step zoom (`+`, `-`, `Reset Fit` to 100%), smooth canvas dragging, and minimap in bottom-right corner.
3. **Configure Rules Drawer (`560px` right slide-over):** Opens side panel to configure seed positions, bye awards, and score normalization parameters ($[0, 1000]$ scale).
4. **Save Bracket State CTA:** Pinned primary action button (`bg-teal-600`) triggering optimistic UI commit and server sync.

### 5.3 Bracket Node Card Specification
- **Container:** `bg-slate-800`, `border: 1px solid #475569`, `rounded-lg`, `width: 240px`, tagged with `data-match-id` for dynamic anchor geometry.
- **Header:** Match ID (e.g. `#M101` in `JetBrains Mono` / `text-slate-400`), Schedule Timestamp & Court/Pitch label, and Status Badge (`Pending`, `Live`, `Completed`, `Bye`).
- **Competitor Rows (2 per card):** Seed number badge `(1)`, Team Name (`font-medium truncate`), and inline numeric score input field (`0–1000` clamp, `font-mono`, `text-center`, `w-14`).
- **Visual State Transitions:** Live matches pulse with `#10B981` border; completed matches highlight winning row in `#0D9488` tint.

### 5.4 Dynamic SVG Vector Connector Engine & Geometry Alignment
- **Dynamic DOM Anchor Points:** Uses `getBoundingClientRect()` relative to the canvas container to calculate exact center-right anchors of feeder match cards (`start.x = card.right, start.y = card.centerY`) and center-left anchors of target match cards (`target.x = card.left, target.y = card.centerY`).
- **Scale Normalization:** All coordinates are normalized by `(zoomLevel / 100)` ensuring vector lines remain locked to card borders during canvas zoom and resize events.
- **Orthogonal Step Routing:** Step paths are drawn as `M start.x start.y H midX V target.y H target.x` where `midX = (start.x + target.x) / 2` and `target.x` reaches 100% of the column gap to meet the target card border with zero horizontal gap.
- **Progressive State Highlighting:** Completed winner advancement lines render with `#0D9488` (2.5px solid), while pending connections render with dashed stroke patterns (`strokeDasharray: '4 4'`).

---

## 6. Component 2: Captain Application Queue (`/admin/captains`)

### 6.1 Data Table & Review Workflow Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CAPTAIN APPLICATIONS QUEUE                                                                             │
│ Search: [ Search applicant or @username... ]      League: [ All Leagues ▾ ]   Status: [ Pending Review ▾]│
│ Total Applications: 18   │   [ Export CSV ]                                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [x] │ APPLICANT               │ LEAGUE & TYPE │ SELF-PRICED BASE │ ROSTER STATUS │ STATUS   │ ACTIONS   │
├───┼─────────────────────────┼───────────────┼──────────────────┼───────────────┼──────────┼───────────┤
│ [ ] │ [Avatar] Vikram Malhotra│ Offside S3    │ 650 pts          │ 4 / 5 Members │ [Pending]│ [Approve] │
│     │          @vikram_m      │ ALL (Auction) │ (+15% deviation) │               │          │ [Reject]  │
│ ────┼─────────────────────────┼───────────────┼──────────────────┼───────────────┼──────────┼───────────┤
│ [ ] │ [Avatar] Samantha Roy   │ PowerPlay S2  │ 400 pts          │ 5 / 5 Members │ [Approved│ [View]    │
│     │          @sam_roy       │ DLL (Draft)   │ (0% deviation)   │ (Complete)    │          │ [Revoke]  │
│ ────┼─────────────────────────┼───────────────┼──────────────────┼───────────────┼──────────┼───────────┤
│ [ ] │ [Avatar] Devansh Joshi  │ Airball S1    │ 900 pts          │ 2 / 5 Members │ [Pending]│ [Approve] │
│     │          @dev_joshi     │ ALL (Auction) │ (+45% High Dev!) │               │          │ [Reject]  │
└─────┴─────────────────────────┴───────────────┴──────────────────┴───────────────┴──────────┴───────────┘
```

### 6.2 Captain Queue Table Fields & Column Mechanics
1. **Search & Filter Bar:** Search by applicant display name or `@username`, League Selector, Format filter (`ALL` vs `DLL`), Status filter (`All`, `Pending Review`, `Approved`, `Rejected`), and `[ Export CSV ]`.
2. **Table Columns:** Checkbox, Applicant (Avatar + Name + `@username`), League Name & Type, Self-Priced Base Cost with **Deviation Label** ($\le 10\%$ neutral, $11\%–25\%$ amber warning `+15% deviation`, $>25\%$ red critical `+45% High Dev!`), Roster Status (`N/5 members`), Status Pill, and Quick Action buttons `[ Approve ]` / `[ Reject ]`.
3. **Right Slide-Over Review Drawer (`560px` width):** Historical captaincy record, proposed team name & crest, roster list, self-evaluation notes, and decision buttons (`[ Approve as Captain ]`, `[ Reject with Reason ]`).

---

## 7. Component 3: Live Auction Controller (`/admin/auctions/[id]`)

### 7.1 Operator Command Dashboard Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Auctions]  Offside Season 3 — Live Auction Hub                            [Live WebSocket: 24ms] [Core Admin]       │
├──────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────────────────┤
│ PLAYER ON BLOCK (LEFT - 5 COLS)      │ LIVE BID STREAM (MID - 3 COLS│ TEAM WALLETS & ROSTERS (RIGHT - 4 COLS)          │
│ ┌──────────────────────────────────┐ │ ┌──────────────────────────┐ │ ┌───────────────────────┐ ┌────────────────────┐ │
│ │ [Avatar]  KABIR KHAN             │ │ │ LIVE BIDS: Recent 20 Bids│ │ │ Team Delta (Sarah)    │ │ Team Alpha (John)  │ │
│ │ @kabir_keeper · Goalkeeper (S)   │ │ │                          │ │ │ Wallet: 7,050 / 9,000 │ │ Wallet: 8,100      │ │
│ │ Base Price: 500 pts              │ │ │ 02:18:12 Team Delta: 950 │ │ │ Roster: 4/5 Acquired  │ │ Roster: 3/5        │ │
│ ├──────────────────────────────────┤ │ │ 02:18:08 Team Alpha: 900 │ │ ├───────────────────────┤ ├────────────────────┤ │
│ │ HAMMER CLOCK:   HIGHEST BIDDER:  │ │ │ 02:18:04 Team Delta: 850 │ │ │ Team Bravo (Mike)     │ │ Team Sigma (Lisa)  │ │
│ │ [ 0:04.2 SEC ]  950 pts (Sarah)  │ │ │                          │ │ │ Wallet: 9,000 / 9,000 │ │ Wallet: 8,400      │ │
│ ├──────────────────────────────────┤ │ └──────────────────────────┘ │ │ Roster: 2/5 Acquired  │ │ Roster: 3/5        │ │
│ │ [ Pause ] [ Pass ] [ SOLD! ]     │ │                              │ └───────────────────────┘ └────────────────────┘ │
│ ├──────────────────────────────────┤ │                              │                                                  │
│ │ MANUAL OPERATOR DISPATCHER:      │ │                              │                                                  │
│ │ [Select Captain ▾] [ +10 ][ +25 ]│ │                              │                                                  │
│ └──────────────────────────────────┘ │                              │                                                  │
└──────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────────────────┘
```

### 7.2 Core Auction Sub-Panels & Mechanics
1. **Player On Block & Controls Panel (Left, 5 cols / ~40%):** 80px avatar, Name, `@username`, position, tier badge, base price, 5-second countdown hammer clock (`0:05` in `JetBrains Mono`), Current High Bidder card, Operator gavel action buttons (`[ SOLD! ]`, `[ Pass / Unsold ]`, `[ Pause ]`), and Manual Operator Bid Dispatcher (`+10 pts`, `+25 pts`, `+50 pts`, `+100 pts`).
2. **Live Bid Event Stream Panel (Center, 3 cols / ~25%):** High-density vertical live stream showing real-time bids, timestamps, team names, manual intervention tags, and active bid pulsing animations.
3. **Team Wallets & Rosters Panel (Right, 4 cols / ~35%):** Side-by-side roster overview placed directly to the right of the Bidding Log, displaying each captain's remaining purse balance, total budget, roster count (`N/5`), and acquired player badge tags.
4. **Sub-100ms WebSocket Protocol:** Synchronizes `AUCTION_START_BLOCK`, `AUCTION_BID_SUBMIT`, `AUCTION_TIMER_TICK`, `AUCTION_SOLD`, and `AUCTION_UNSOLD`.
5. **Authentic Human Bidding Architecture (Zero AI/Bot Bidders):** All live auction bids originate strictly from verified human Captains logged into their mobile app instances via low-latency WebSocket connection or direct Admin Manual Operator gavel dispatchers. Automated bot bidding algorithms and simulations are completely omitted to ensure 100% fair and authentic tournament roster acquisitions.

---

## 8. Element 3: Economy & Scoring Overview

Element 3 specifies the platform-wide point multipliers, category base awards, and per-event points investment parameters:

| Sub-Module / View | Route File | Purpose |
|---|---|---|
| **Scoring Rules & Multipliers** | `src/app/admin/scoring/page.tsx` | Platform-wide multiplier controls, sponsor win bonuses, event base scoring matrix, and 560px rule tuning drawer. |
| **Investments Manager** | `src/app/admin/investments/page.tsx` | Per-event leaderboard points investment table with live toggles, Min/Max validation, step increments, and total invested pool metrics. |

---

## 9. Component 1: Scoring Engine & Multipliers (`/admin/scoring`)

### 9.1 Page Layout & Global Multipliers Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [← Dashboard]  Scoring Engine & Multipliers Configurator           [Autosaved]  [Save Changes (Dirty)] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. GLOBAL MULTIPLIERS PANEL                                        [ Audit History (560px Drawer) ]    │
│ ┌──────────────────────────────────┬──────────────────────────────────┬──────────────────────────────┐ │
│ │ SPONSOR WIN MULTIPLIER           │ DAILY STREAK MULTIPLIER          │ CHALLENGE LEGEND FLAT BONUS  │ │
│ │ [ 1.5x ▾ ] (Range: 1.0x – 2.0x)  │ [ 1.25x ▾ ] (Range: 1.0x – 1.5x) │ [ +250  ] pts (Mono Numeric) │ │
│ ├──────────────────────────────────┼──────────────────────────────────┼──────────────────────────────┤ │
│ │ REFERRAL AWARD                   │ TIE-BREAKER FAIR PLAY BONUS      │ PODIUM STREAK MULTIPLIER     │ │
│ │ [ +100  ] pts (Mono Numeric)     │ [ +50   ] pts                    │ [ 1.15x ]                    │ │
│ └──────────────────────────────────┴──────────────────────────────────┴──────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. EVENT BASE SCORING MATRIX TABLE                                                                     │
│ ┌───────────────┬─────────────────────┬──────────────┬──────────────┬──────────────┬─────────────────┐ │
│ │ CATEGORY      │ PARTICIPATION AWARD │ 1ST PLACE    │ 2ND PLACE    │ 3RD PLACE    │ ACTIONS         │ │
│ ├───────────────┼─────────────────────┼──────────────┼──────────────┼──────────────┼─────────────────┤ │
│ │ Leagues (ALL) │ [ 50  ] pts         │ [ 500 ] pts  │ [ 300 ] pts  │ [ 150 ] pts  │ [ Edit Rule ]   │ │
│ │ BGEC (Esports)│ [ 40  ] pts         │ [ 400 ] pts  │ [ 250 ] pts  │ [ 120 ] pts  │ [ Edit Rule ]   │ │
│ │ FitSoc Events │ [ 30  ] pts         │ [ 300 ] pts  │ [ 180 ] pts  │ [ 90  ] pts  │ [ Edit Rule ]   │ │
│ │ General Events│ [ 20  ] pts         │ [ 200 ] pts  │ [ 100 ] pts  │ [ 50  ] pts  │ [ Edit Rule ]   │ │
│ └───────────────┴─────────────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Global Multipliers Panel Mechanics
1. **Sponsor Win Multiplier:** Multiplies match win points when participating under an active sponsor affiliation ($1.0\times$ to $2.0\times$).
2. **Daily Streak Multiplier:** Multiplier ($1.0\times$ to $1.5\times$) scaling daily app check-in points based on streak length.
3. **Challenge Legend Flat Bonus:** Fixed bonus points (e.g. `+250 pts`) granted upon completing all tier challenges in an event.
4. **Referral Award:** Fixed bonus points (e.g. `+100 pts`) awarded to both referrer and referee upon account verification.
5. **Tie-Breaker Fair Play Bonus:** Fixed points (e.g. `+50 pts`) awarded to teams maintaining zero yellow/red cards in tournament play.
6. **Audit History Slide-Over Drawer (`560px` width):** Chronological timeline of rule adjustments (`Timestamp`, `Actor`, `Field`, `Old Value ──▶ New Value`).

### 9.3 Event Base Scoring Matrix Table Mechanics
1. **Category Rows:** `Leagues (ALL)`, `BGEC (Esports)`, `FitSoc Events`, `General Events`.
2. **Standard Placements:** Editable baseline awards for `Participation`, `1st Place`, `2nd Place`, `3rd Place`.
3. **Right Slide-Over Rule Drawer (`560px` width):** Fine-tunes placement decay curve formulas, custom sport variables (`goals`, `kills`, `assists`), and tie-breaker parameters.
4. **Primary `Save Changes` CTA:** Pinned in header, disabled in pristine state, enabled (`bg-teal-600`) when any value is modified.

---

## 10. Component 2: Points Investment Manager (`/admin/investments`)

### 10.1 Data Table & Configuration Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ POINTS INVESTMENT MANAGER                                                                              │
│ Search: [ Search event by name or ID... ]                  Status Filter: [ All Statuses ▾ ]           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [x] │ EVENT NAME           │ STATUS   │ ALLOW INVESTMENT │ MIN INVEST  │ MAX INVEST  │ STEP │ POOL     │
├───┼──────────────────────┼──────────┼──────────────────┼─────────────┼─────────────┼──────┼──────────┤
│ [ ] │ Offside Season 3     │ [Active] │ [ (•) ON  ]      │ [ 100 ] pts │ [ 500 ] pts │ [50] │ 42,500pts│
│ ────┼──────────────────────┼──────────┼──────────────────┼─────────────┼─────────────┼──────┼──────────┤
│ [ ] │ PowerPlay Season 2   │ [Active] │ [ (•) ON  ]      │ [ 50  ] pts │ [ 300 ] pts │ [25] │ 28,200pts│
│ ────┼──────────────────────┼──────────┼──────────────────┼─────────────┼─────────────┼──────┼──────────┤
│ [ ] │ BGEC Valorant Cup    │ [Upcomng]│ [ ( ) OFF ]      │ [ 100 ] pts │ [ 1,000]pts │[100] │ 0 pts    │
│ ────┼──────────────────────┼──────────┼──────────────────┼─────────────┼─────────────┼──────┼──────────┤
│ [ ] │ FitSoc Marathon 2026 │ [Active] │ [ (•) ON  ]      │ [ 500 ] pts!│ [ 200 ] pts!│ [50] │ ── ERROR ──
│     │                      │          │                  │ [!] Min>=Max│ [!] Max<=Min│      │ Invalid  │
└─────┴──────────────────────┴──────────┴──────────────────┴─────────────┴─────────────┴──────┴──────────┘
```

### 10.2 Table Column Specifications & Validation Logic
1. **Search & Status Filters:** Search input matches Event Name or Event ID slug. Status Filter: `All`, `Active`, `Upcoming`, `Completed`.
2. **Table Columns:** Checkbox, Event Name, Status Pill (`Active`, `Upcoming`, `Completed`), `Allow Investment` Toggle Switch, Min Investment Input (`pts`), Max Investment Input (`pts`), Step Increment Dropdown (`25`, `50`, `100`), Total Invested Pool (`pts`).
3. **Validation Engine:** Constraint `Min Investment < Max Investment`. If `Min >= Max`, input cells display a red alert border (`border-red-500 bg-red-500/10`) with inline tooltip: `Min must be strictly less than Max`. The row `Save` action is disabled until resolved.

---

## 11. Element 4: Community & Governance Overview

Element 4 specifies the administrative workflows for user support resolution, community content moderation, and multichannel broadcast delivery:

| Sub-Module / View | Route File | Purpose |
|---|---|---|
| **Feedback Tickets** | `src/app/admin/tickets/page.tsx` | Comprehensive ticket management queue with multi-criteria filters, severity badges, and 720px resolution drawer. |
| **Moderation Queue** | `src/app/admin/moderation/page.tsx` | Community content review console with content-type tabs, offender dossiers, and graduated sanction actions. |
| **Broadcast Engine** | `src/app/admin/broadcasts/page.tsx` | Multichannel broadcast composer with 16:9 media uploader, push notification triggers, scheduling, and history table. |

---

## 12. Component 1: Feedback Ticket Resolution Queue (`/admin/tickets`)

### 12.1 Data Table & Filter System Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FEEDBACK TICKET RESOLUTION QUEUE                                                                       │
│ Search: [ Search ticket ID, user, keywords... ]     Category: [ All ▾ ]  Severity: [ All ▾ ]  Status: [Submitted ▾]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [x] │ TICKET ID     │ CATEGORY       │ USER HANDLE │ SEVERITY   │ STATUS PIPELINE      │ ASSIGNED TO    │
├───┼───────────────┼────────────────┼─────────────┼────────────┼──────────────────────┼────────────────┤
│ [ ] │ #TICK-10492   │ Bug Report     │ @vikram_m   │ [CRITICAL] │ [ Submitted ▾      ] │ Sarah (Coord)  │
│ ────┼───────────────┼────────────────┼─────────────┼────────────┼──────────────────────┼────────────────┤
│ [ ] │ #TICK-10488   │ Account Issue  │ @sara_k     │ [HIGH]     │ [ Under Review ▾   ] │ John (Core)    │
│ ────┼───────────────┼────────────────┼─────────────┼────────────┼──────────────────────┼────────────────┤
│ [ ] │ #TICK-10475   │ Feature Request│ @dev_j      │ [LOW]      │ [ Resolved ▾       ] │ Unassigned     │
│ ────┼───────────────┼────────────────┼─────────────┼────────────┼──────────────────────┼────────────────┤
│ [ ] │ #TICK-10460   │ Technical      │ @alex_c     │ [MEDIUM]   │ [ Closed ▾         ] │ Lisa (Coord)   │
└─────┴───────────────┴────────────────┴─────────────┴────────────┴──────────────────────┴────────────────┘
```

### 12.2 Table Controls & Field Mechanics
1. **Search Bar:** Real-time search across Ticket ID (`#TICK-XXXXX`), submitter name, `@username`, and subject keywords.
2. **Category Dropdown:** `All`, `Bug Report`, `Feature Request`, `Account Issue`, `Technical`.
3. **Severity Filter:** `Low`, `Medium`, `High`, `Critical`.
4. **Status Filter:** `Submitted`, `Under Review`, `Resolved`, `Closed`.
5. **Columns:** Checkbox, Ticket ID (`font-mono`), Category, User Handle (`font-mono`), Severity Badge (`Critical`, `High`, `Medium`, `Low`), Status Pipeline Selector Dropdown, Assigned Coordinator.

### 12.3 Right Slide-Over Resolution Drawer (`720px` width)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ TICKET DETAILS: #TICK-10492 — Match Score Discrepancy                   [X]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ SUBMISSION DETAILS:                                                          │
│ User: [Avatar] Vikram Malhotra (@vikram_m) · Submitted: 24 mins ago         │
│ Category: Bug Report  │  Severity: [ CRITICAL ]     │  Status: [ Under Review ]│
│ Description: Match #M102 scorecard omitted 1 assist credit for Vikram.      │
│ Attached Media: [ screenshot_score.png (Preview) ]                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ THREAD HISTORY:                                                              │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [User] @vikram_m (Public User Message · 24 mins ago)                     │ │
│ │ "Hi, our team won 3-1 but my assist was attributed to team captain."     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [Internal Note] Sarah (Admin · 10 mins ago)                              │ │
│ │ "Checked stream VOD at 14:22. Assist confirmed for Vikram. Awarding +5pts│ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ MESSAGE COMPOSER:                                                            │
│ Canned Response: [ Select Canned Response ▾ ]                                │
│ [ Message Type: (•) Public Reply to User   ( ) Internal Note Only ]          │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Enter reply or resolution notes (Markdown supported)...                  │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ [ Attach File ]                                                              │
│                                                                              │
│ Status Update: [ Set to: Resolved ▾ ]                                        │
│ [ Close Drawer ]                                   [ Send & Update Status ]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Thread History Distinction:**
  - **Public User Messages:** Styled in subtle blue card containers (`bg-blue-950/30 border-blue-800/40 text-slate-100`).
  - **Internal Admin Notes:** Styled in subtle yellow card containers with lock icon (`bg-amber-950/30 border-amber-800/40 text-amber-100`).
- **Composer Toolbar:** Canned responses dropdown, markdown formatting, attachment upload, and `Send & Update Status` CTA (`bg-teal-600`).

---

## 13. Component 2: Moderation Queue (`/admin/moderation`)

### 13.1 Content Review Queue Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ COMMUNITY MODERATION & SAFETY QUEUE                                                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ CONTENT TYPE TABS:                                                                                     │
│ [ (•) All (14) ]  [ ( ) Posts (3) ]  [ ( ) Comments (5) ]  [ ( ) Chat Messages (4) ]  [ ( ) Media (2) ] │
│ Reason Filter: [ All Reasons ▾ ] (Harassment, Spam, Inappropriate Content, Cheating)                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ MODERATION CARDS GRID:                                                                                 │
│                                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [Chat Message] · Reported Reason: Harassment · 14 mins ago · Reporter: @referee_1                  │ │
│ ├──────────────────────────────────────────────────────┬─────────────────────────────────────────────┤ │
│ │ REPORTED CONTENT BOX:                                │ OFFENDER DOSSIER:                           │ │
│ │ "You guys are absolute trash, refund my points or    │ [Avatar] ToxicGamer99 (@toxic_99)           │ │
│ │ I will ruin every tournament match tonight."         │ Account Age: 4 months                       │ │
│ │ Location: Match #M102 Live Chat                      │ Prior Infractions: 2 Flags (1 Warning)      │ │
│ ├──────────────────────────────────────────────────────┴─────────────────────────────────────────────┤ │
│ │ ACTIONS:                                                                                           │ │
│ │ [ Dismiss Report (Outline Teal) ]  [ Remove Content (Warning Orange) ]  [ Issue Warning / Ban User ] │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [Media Upload] · Reported Reason: Inappropriate Content · 1 hr ago · Reporter: @member_4           │ │
│ ├──────────────────────────────────────────────────────┬─────────────────────────────────────────────┤ │
│ │ REPORTED CONTENT BOX:                                │ OFFENDER DOSSIER:                           │ │
│ │ [ Image Preview: team_crest_nsfw.png ]               │ [Avatar] ShadowCaptain (@shadow_c)          │ │
│ │ Location: Team "Phantoms X" Custom Crest             │ Account Age: 1 year · Flags: 0 prior        │ │
│ ├──────────────────────────────────────────────────────┴─────────────────────────────────────────────┤ │
│ │ ACTIONS:                                                                                           │ │
│ │ [ Dismiss Report (Outline Teal) ]  [ Remove Content (Warning Orange) ]  [ Issue Warning / Ban User ] │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Moderation Queue Mechanics & Actions
1. **Filter Header:** Content Type Tabs (`All`, `Posts`, `Comments`, `Chat Messages`, `Media Uploads`) and Reason Dropdown (`Harassment`, `Spam`, `Inappropriate Content`, `Cheating`).
2. **Moderation Cards:**
   - Content type badge, report reason, timestamp, reporter handle.
   - **Reported Content Box:** Live preview of reported text, image, or video asset with origin context.
   - **Offender Profile Card:** Display name, `@username`, account age, prior flags/infractions count.
3. **Action Buttons:**
   - `[ Dismiss Report ]`: Outline Teal (`border-teal-500 text-teal-400`).
   - `[ Remove Content ]`: Warning Orange (`bg-amber-600 hover:bg-amber-700 text-slate-50`).
   - `[ Issue Warning / Ban User ]`: Danger Red (`bg-red-600 hover:bg-red-700 text-slate-50`) opening punishment modal (`Warning`, `1h/24h/7d Mute`, `Shadowban`, `Hard Ban`).

---

## 14. Component 3: System Broadcast Engine (`/admin/broadcasts`)

### 14.1 Multichannel Broadcast Composer Wireframe

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM BROADCAST ENGINE                                                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. BROADCAST COMPOSER FORM                                                                             │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Title: [ Offside Season 3 Championship Finals Kickoff!                                           ] │ │
│ │ Category: [ Leagues ▾ ] (BGEC, FitSoc, General, Leagues, All)  │  Audience: [ Offside S3 Players ▾]│ │
│ ├────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Rich Text Editor Toolbar: [ B ] [ I ] [ Link ] [ List ] [ Media ] [ Format ▾ ]                     │ │
│ │ ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ **Grand Championship Match Today at 17:00 IST!**                                               │ │ │
│ │ │ Catch Titans vs Phoenix battling for the championship cup at the Main Ground.                  │ │ │
│ │ │ Live streaming link is now open in the Match Hub.                                              │ │ │
│ │ └────────────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│ ├────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ 16:9 Aspect Ratio Media Uploader (Drag & Drop):                                                    │ │
│ │ ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ Drop 16:9 Banner Image (1280x720) or click to browse...                                         │ │ │
│ │ └────────────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│ ├────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ Options:                                                                                           │ │
│ │ [x] Send Instant Push Notification                                                                 │ │
│ │ [ ] Schedule for Later  ──▶  Date & Time: [ YYYY-MM-DD HH:MM ]                                      │ │
│ ├────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ [ Save Draft ]                                                        [ Publish Broadcast ]        │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. BROADCAST HISTORY TABLE                                                                             │
│ ┌──────────────────────────────────────┬──────────┬──────────────────┬────────────┬──────────────────┐ │
│ │ TITLE                                │ CATEGORY │ SEND DATE        │ OPEN RATE  │ TARGET REACH     │ │
│ ├──────────────────────────────────────┼──────────┼──────────────────┼────────────┼──────────────────┤ │
│ │ Offside S3 Championship Finals       │ Leagues  │ Today, 14:00     │ 68.4%      │ 342 Users        │ │
│ │ FitSoc 10k Run Registration Open     │ FitSoc   │ Yesterday, 09:30 │ 54.2%      │ 1,250 Users      │ │
│ │ BGEC Valorant Cup Rules Update       │ BGEC     │ 3 days ago       │ 81.0%      │ 180 Users        │ │
│ └──────────────────────────────────────┴──────────┴──────────────────┴────────────┴──────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Composer Fields & History Specifications
1. **Composer Form:** Title input, Category Selector (`BGEC`, `FitSoc`, `General`, `Leagues`, `All`), Target Audience Dropdown, Rich Text Editor toolbar (Bold, Italic, Links, Lists, Media), 16:9 Aspect Ratio Media Uploader (Drag & Drop zone), `Send Instant Push Notification` checkbox, `Schedule for Later` toggle (with date/time picker), and Action buttons (`[ Save Draft ]` and `[ Publish Broadcast ]` in Primary Teal `#0D9488`).
2. **Broadcast History Table:** Columns for Title, Category, Send Date, Open Rate (`%`), and Target Reach count.

---

## 15. Global Keyboard Shortcuts & Slide-Over Drawer System

### 15.1 Global Keyboard Listeners

| Shortcut | Scope | Action |
|---|---|---|
| `⌘K` / `Ctrl+K` | Global | Opens Command Palette search overlay |
| `⌘B` / `Ctrl+B` | Global | Toggles Sidebar expanded (`240px`) / collapsed (`64px`) |
| `Space` | Auction Console | Starts or pauses current bidding block timer |
| `Enter` | Auction Console | Confirms player SOLD to current highest bidder |
| `Esc` | Global | Closes open modals, dropdowns, and slide-over drawers |
| `⌘S` / `Ctrl+S` | Bracket / Scoring / Broadcast | Saves current bracket, scoring rules, or draft broadcast |

### 15.2 Slide-Over Panel Architecture
- **Standard Width:** `560px` or `720px` right slide-over drawer with backdrop scrim (`rgba(15, 23, 42, 0.6)`).
- **Used For:** Rule Configuration (`560px`), Ticket Resolution (`720px`), Captain Review Dossier (`560px`), and Moderation Sanctioning (`560px`).
- **Persistence:** Underlying canvas/table state remains active and preserved during drawer interactions.

---

## 16. State Management, Autosave & Audit Logging

| Scenario / State | System Behavior |
|---|---|
| **Autosave Engine** | Bracket, scoring engine, and broadcast drafts automatically save every 30 seconds to `localStorage` and background API. |
| **Score Override Audit** | Every manual bracket score override requires coordinator justification text, written directly to the immutable audit log (`Timestamp`, `ActorID`, `MatchID`, `OldScore`, `NewScore`, `Reason`). |
| **Ticket & Moderation Audit** | Every moderator action (`Warning`, `Mute`, `Ban`, `Ticket Resolution`) creates an immutable audit log entry. |
| **Rule Adjustment Audit** | Every change to Global Multipliers or Category Base Awards generates an audit log entry visible in the Audit History Drawer. |
| **WebSocket Reconnection** | Automatically attempts reconnect with exponential backoff (`1s`, `2s`, `4s`, `8s`) during Live Auction with persistent status pill indicator. |
| **3/7ths Equilibrium Guard** | Strictly blocks coordinators from overriding base prices for $> \lfloor 3/7 \times \text{Players} \rfloor$. |
