# Events Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/events` (`src/app/(drawer)/events.tsx`)
**Visibility:** Public (Browse) / Authenticated (Registration, Team Formation)
**Developer Assignee:** `[TBD]`
**Source:** Complete Feature Specification & Architecture §5.5 F "Events Page"; `Events_page.md`
**Design Tokens Reference:** `design-system.md`

---

## 1. Page Structure & Master Viewport Architecture

The **Events Page** mobile screen implements a **Fixed-Header, Sticky-Tab, Persistent-Filter
Architecture**. A top fixed Dynamic Status Bar and sticky category tab bar sit above a
persistent filter row that survives tab switches, with a single scrolling content region below:

```text
┌────────────────────────────────────────────────────────┐
│ [≡]                 [ BGSC LOGO ]         [ Profile] │ ← Fixed Dynamic Status Bar
├────────────────────────────────────────────────────────┤
│ EVENTS                                                  │ ← Screen Title (BebasNeue_400Regular)
├────────────────────────────────────────────────────────┤
│ TAB BAR: [Leagues| BGEC| FitSoc| General]      │ ← Sticky Category Tab Bar
├────────────────────────────────────────────────────────┤
│ FILTERS: [ Past ] [ Upcoming ] [ Ongoing ]  (multi-sel) │ ← Sticky Filter Row (persists across tabs)
├────────────────────────────────────────────────────────┤
│ ▼ ACTIVE TAB VIEW (single vertical ScrollView)          │
│                                                          │
│  [Tab 0: Leagues]                                       │
│   • Interleaved Sports + Esports league card grid       │
│                                                          │
│  [Tab 1: BGEC Events]                                    │
│   • Standard event card list                             │
│                                                          │
│  [Tab 2: FitSoc Events]                                  │
│   • Standard event card list                             │
│   • Strava Sub-Section (streak hero + leaderboard)       │
│                                                          │
│  [Tab 3: General Events]                                 │
│   • Highlight / Waves / Sponsored event card list         │
│                                                          │
└────────────────────────────────────────────────────────┘
```

Tapping any event card in Tabs 0–3 pushes the shared **Event Details View** (§7) as a full-
screen route, not a modal — bracket views and the auction spectator screen are further
sub-routes reached from inside Event Details.

---

## 2. Dynamic Status Bar & Category Tab Navigation

### 2.1 Fixed Dynamic Status Bar
- **Component**: Rendered by `mobile/src/components/dynamic-status-bar.tsx`.
- **Positioning**: Fixed at the top of the screen viewport (`headerShown: true` / `position: 'fixed'`, `zIndex: 100`).
- **Slots**:
  - **Left Slot**: Hamburger drawer menu icon (`menu`) → Opens navigation drawer.
  - **Center Slot**: BGSC / Community Emblem (Height: 28pt).
  - **Right Slot**: Guest mode renders `"Login"` pill; Authenticated mode renders 36pt circular user profile avatar.

### 2.2 Screen Title
- **Text**: `"Events"`, `BebasNeue_400Regular`, 48sp, color `colors.text` (`#DAF1DE`), `paddingHorizontal: 16`, `marginTop: 12`.
- Use `BebasNeue_400Regular` for the screen title (48sp+); `BarlowCondensed_700Bold` for event/league titles, active tab labels, and large numerals
  (streak count, bid amount, scores) — never body copy (see §8).

### 2.3 Sticky Category Tab Bar
- **Positioning**: Sticky directly below the screen title (`zIndex: 90`).
- **Container Styling**: `backgroundColor: rgba(15,36,38,0.55)` (glass fill over `#163B32`), 1 dp `#8EB69B` border at 20% opacity, `borderRadius: 24`, `padding: 4`, `marginHorizontal: 16`, `marginVertical: 12`. Backdrop blur `24pt`.
- **Tabs** (icon + label, all four fit without horizontal scroll on any supported width):
  - `Index 0`: **Leagues** (`trophy-outline`)
  - `Index 1`: **BGEC** (`game-controller-outline`)
  - `Index 2`: **FitSoc** (`walk-outline`)
  - `Index 3`: **General** (`sparkles-outline`)
- **Interaction & Feedback**:
  - Tapping fires `Haptics.selectionAsync()`.
  - Active state uses the **Glass Press** animation (§10.1) — no separate scale transform is layered on top of it.
  - Active tab underline uses the **Tab Underline Glide** animation (§10.2).
  - Active tab label renders in `BarlowCondensed_700Bold` (`#E8662A` underline, `#DAF1DE` text); inactive tabs render in `Inter_600SemiBold` (`#8EB69B`).

### 2.4 Sticky Filter Row
- **Positioning**: Sticky directly below the tab bar (`zIndex: 85`).
- **Chips**: `Past`, `Upcoming`, `Ongoing` — multi-select (toggle, not radio); any combination may be active simultaneously.
- **Persistence Rule**: Filter selection is held in one screen-level state object, **not** reset or re-scoped per tab. Selecting `Ongoing` on Leagues and switching to FitSoc keeps `Ongoing` selected.
- **Chip Styling**: Capsule (`borderRadius: 20`), `height: 36`. Active: fill `#235347`, text `#DAF1DE`, `BarlowCondensed_700Bold` numeral badges where a count is shown. Inactive: transparent fill, 1 dp `#8EB69B` border, text `#8EB69B`.
- **Interaction**: Each chip uses the **Glass Press** animation (§10.1) on tap.

---

## 3. Tab 0: Leagues

### 3.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  LEAGUES                                                │
│  Sports + Esports, interleaved                          │
│                                                          │
│  ╭─────────────────────╮  ╭─────────────────────╮      │
│  │  SPORTS       ● LIVE│  │  ESPORTS           │      │
│  │ Badminton League      │  │ Valorant Circuit      │      │
│  │ AUCTION                │  │                       │      │
│  ╰─────────────────────╯  ╰─────────────────────╯      │
│  ╭─────────────────────╮  ╭─────────────────────╮      │
│  │  SPORTS            │  │  ESPORTS       ● LIVE│      │
│  │ Football Premier      │  │ BGMI Showdown         │      │
│  │ AUCTION                │  │                       │      │
│  ╰─────────────────────╯  ╰─────────────────────╯      │
└────────────────────────────────────────────────────────┘
```

### 3.2 Card Specification Table

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Grid** | 2-column card grid | Sports and Esports leagues render in one interleaved list — no sub-tabs. | Sort order: `Ongoing → Upcoming → Past`, then start date ascending. |
| **Type Badge** | Top-left pill | `Sports` or `Esports`, with category icon. | `Inter_600SemiBold`, 12sp, `#8EB69B` on `rgba(20,50,52,0.40)`. |
| **League Title** | Card title | Event/league name. | `BarlowCondensed_700Bold`, 18sp, `#DAF1DE`. |
| **Auction Tag** | Small pill, bottom-left | Renders only if `isAuctionBased === true`. | `#E8662A` text on `rgba(232,102,42,0.12)` fill. |
| **Live Indicator** | Top-right dot | Renders only if `status === 'Ongoing'`. | Uses the **Live Pulse Blob** animation (§10.4), 10pt. |
| **Card Surface** | Glass card | `borderRadius: 24`, backdrop blur `20pt`, fill `rgba(15,36,38,0.55)`, 1 dp `#8EB69B` border at 15% opacity. | Uses the **Card Press Deepen** animation (§10.3) on tap. |

### 3.3 Tap Behavior
Tapping any card pushes the shared **Event Details View** (§7) with the League-specific
registration block active (§7.4).

### 3.4 Leagues States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | 4 skeleton shimmer cards (2×2 grid). | Uses the **Shimmer Sweep** animation while fetching. |
| **Empty State** | Centered illustration: *"No leagues scheduled right now."* | No CTA — leagues are admin-created only. |
| **Filtered-Empty State** | *"No leagues match your current filters."* | Shows `[ Clear Filters ]` tertiary button. |

---

## 4. Tab 1: BGEC Events

### 4.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  BGEC EVENTS                                            │
│                                                          │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Debate Night — Finals              ● Ongoing      │  │
│  │ Sat, 14 Feb · Auditorium                          │  │
│  ╰──────────────────────────────────────────────────╯  │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Quiz Bowl Prelims                                  │  │
│  │ Upcoming · 21 Feb                                  │  │
│  ╰──────────────────────────────────────────────────╯  │
└────────────────────────────────────────────────────────┘
```

### 4.2 Card Specification Table

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Grid** | Single-column card list | No sport badge, no auction tag — BGEC events are never auction-based. | |
| **Event Title** | Card title | `BarlowCondensed_700Bold`, 18sp, `#DAF1DE`. | |
| **Schedule Caption** | Subtitle | `Inter_400Regular`, 12sp, `#8EB69B`. | Date + venue string. |
| **Live Indicator** | Top-right dot | Renders only if `status === 'Ongoing'`. | **Live Pulse Blob** (§10.4), 10pt. |
| **Card Surface** | Glass card | Identical spec to §3.2's card surface. | **Card Press Deepen** (§10.3) on tap. |

### 4.3 Tap Behavior
Tapping a card pushes Event Details (§7) **without** the League-specific block (§7.4 does not render).

### 4.4 BGEC States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | 3 skeleton shimmer cards, full-width. | **Shimmer Sweep** animation. |
| **Empty State** | *"No BGEC events posted yet."* | No CTA. |

---

## 5. Tab 2: FitSoc Events

### 5.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  FITSOC EVENTS                                          │
│                                                          │
│  ╭──────────────────────────────────────────────────╮  │
│  │ 30-Day Fitness Challenge          ● Ongoing        │  │
│  │ Ends 28 Feb            [ View in Strava ↓ ]       │  │
│  ╰──────────────────────────────────────────────────╯  │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Zumba Social                                       │  │
│  │ Upcoming · 18 Feb                                  │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                          │
│  ── STRAVA · DAILY RUNS ──────────────────────────────  │
│  ╭──────────────────────────────────────────────────╮  │
│  │          12                                      │  │
│  │        DAY STREAK                                  │  │
│  │  Run at least 1km today to keep it alive           │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                          │
│  LEADERBOARD (Consistency)                              │
│  ╭──────────────────────────────────────────────────╮  │
│  │ 1  ● Aditi Rao          92% consistency            │  │
│  │ 2  ● Karan Shah         87% consistency            │  │
│  │ 3  ● Meher Singh        81% consistency            │  │
│  │ 4    You                64% consistency            │  │
│  ╰──────────────────────────────────────────────────╯  │
└────────────────────────────────────────────────────────┘
```

### 5.2 Event Card Specification Table
Identical to §4.2's BGEC card spec, with one addition:

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Strava Cross-Link Chip** | Small tertiary chip, bottom-right | Renders only when `event.linkedToStrava === true`. | Tapping scrolls the current tab down to the Strava Sub-Section (§5.3) — the only cross-section link on this screen. Uses the **Scroll-To Anchor** animation (§10.7). |

### 5.3 Strava Sub-Section (nested inside FitSoc tab, below the event list)

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Section Divider** | Label rule | `"STRAVA · DAILY RUNS"`, `Inter_600SemiBold`, 12sp, `#8EB69B`, flanked by 1px `#8EB69B` hairlines at 20% opacity. | |
| **Streak Hero Card** | Full-width glass card | Streak count in `BarlowCondensed_700Bold`, 34sp, `#DAF1DE`. Label `"DAY STREAK"` below in `Inter_400Regular`, 12sp, `#8EB69B`. | Streak counts only if ≥1km was logged that day; a day with no ≥1km run does not extend it. |
| **Streak Flame** | Icon accent, beside the count | Renders only while today's streak is currently active. | Uses the **Streak Flame Ignite** animation (§10.5), 22pt. |
| **Streak Broken Caption** | Helper text | Renders instead of the flame when today's run hasn't happened yet: *"Run at least 1km today to keep it alive."* | `Inter_400Regular`, 12sp, `#8EB69B`. |
| **Leaderboard List** | Ranked rows | Ranked by **consistency** = days-run ÷ days-in-window for the current cycle — not raw distance or streak length. | Each row: rank numeral (`BarlowCondensed_700Bold`), name, consistency %. |
| **Top-3 Live Indicator** | Small dot before rank 1–3 | Only ranks 1, 2, 3 get this — it signals "currently holding this position," which can change today. | **Live Pulse Blob** (§10.4), 10pt. |
| **Current User Row** | Highlighted row | The signed-in user's row is pinned/highlighted with a `rgba(52,210,123,0.08)` fill regardless of rank. | No live blob unless the user is also top-3. |
| **Strava Not Connected State** | Locked/blurred overlay | Streak hero and leaderboard render behind a light blur with a single centered `[ Connect Strava ]` glass button. | Button uses the **Glass Press** animation (§10.1). This is the only interactive element until connected. |

### 5.4 FitSoc States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | Skeleton shimmer event cards + skeleton streak hero + 3 skeleton leaderboard rows. | **Shimmer Sweep** animation. |
| **Empty Event List** | *"No FitSoc events posted yet."* | Strava Sub-Section still renders below (independent of event list state). |
| **Strava Disconnected** | See §5.3 locked overlay row. | `[ Connect Strava ]` initiates OAuth flow via in-app browser. |

---

## 6. Tab 3: General Events

### 6.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  GENERAL EVENTS                                         │
│                                                          │
│  ╭──────────────────────────────────────────────────╮  │
│  │   HIGHLIGHT                                       │  │
│  │  BGSC Waves — Founder's Day                        │  │
│  │  ● Ongoing · Main Lawn                             │  │
│  ╰──────────────────────────────────────────────────╯  │
│  ╭─────────────────────╮  ╭─────────────────────╮      │
│  │ SPONSORED             │  │ Open Mic Night        │      │
│  │ Red Bull Arena Night   │  │ Upcoming · 22 Feb      │      │
│  ╰─────────────────────╯  ╰─────────────────────╯      │
└────────────────────────────────────────────────────────┘
```

### 6.2 Card Specification Table

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Highlight Card** | Full-width card | Renders first, above the 2-column grid, for `isFeatured === true` events. | Double column span of a standard card; otherwise identical card spec to §4.2. |
| **Standard Grid** | 2-column card grid | Non-featured General events (Waves, sponsored, other). | |
| **Sponsored Ribbon** | Top-right label strip | Renders only when `isSponsored === true`. | `Inter_600SemiBold`, 11sp, `#8EB69B` text on `#235347` strip. **Not** `#E8662A` — a sponsor label is not a live state and must not spend the accent budget (§8, §9). |
| **Live Indicator** | Top-right dot (non-sponsored cards) | Renders only if `status === 'Ongoing'`. | **Live Pulse Blob** (§10.4), 10pt. |

### 6.3 General States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | 1 skeleton highlight card + 4 skeleton grid cards. | **Shimmer Sweep** animation. |
| **Empty State** | *"No general events right now — check back soon."* | No CTA. |

---

## 7. Shared Event Details View

Reached by tapping any card in Tabs 0–3. Renders as a full-screen pushed route. Sections
render conditionally per the source markdown's own conditions (`if active`, `if enabled`,
`post-completion`); nothing here is tab-specific except §7.4, which renders only for League
events.

### 7.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│ [←]              EVENT DETAILS                          │
├────────────────────────────────────────────────────────┤
│  BADMINTON LEAGUE — SPRING CUP                          │
│  Interhostel badminton league, singles + doubles.        │
│   Rules PDF    Awards: ₹15,000 pool                  │
│   12–20 Feb     coordinator@bgsc.in                  │
│                                                          │
│  ╭──────────────────────────────────────────────────╮  │
│  │ ● Red Bull is leading in fan support                │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                          │
│  REGISTER                                                │
│  Name:        [______________________]                  │
│  Game name:   [______________________]                  │
│  Role:        [ Team Captain ] [ Team Member ]           │
│                                                          │
│   ── If Captain ──                                       │
│   Team name:  [______________________]                  │
│   Invite code: BADM-7F2K   [ Copy ]                      │
│   Team status: [ Open ][ Invite Only ][ Closed ]         │
│   Reserve / base price: [______]                         │
│   [ Apply for Team Captain ]                              │
│                                                          │
│  TEAM FORMATION                                           │
│  My Team: Falcons (4/6 members)                          │
│  Search teams: [ _______________ ]                     │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Falcons · 4 members · Open        [ Invite ]       │  │
│  ╰──────────────────────────────────────────────────╯  │
│  Open to invites: [ Open ][ Closed ][ Invite Only ]      │
│                                                          │
│  LEADERBOARD                                              │
│  1  ● Falcons        3-0                                  │
│  2    Ravens          2-1                                  │
│                                                          │
│  STATUS: ● Ongoing                                        │
│                                                          │
│  ╭──────────────────────────────────────────────────╮  │
│  │  +50 fans earned for Red Bull                       │  │
│  ╰──────────────────────────────────────────────────╯  │
└────────────────────────────────────────────────────────┘
```

### 7.2 Event Info Block

| Field | Component Type | Notes |
|---|---|---|
| **Title** | Header text | `BarlowCondensed_700Bold`, 24sp, `#DAF1DE`. |
| **Description** | Body paragraph | `Inter_400Regular`, 16sp, `#DAF1DE`. |
| **Rules PDF/Link** | Inline link row | Opens system PDF viewer / browser. |
| **Awards** | Inline text row | Renders only if present on the event. |
| **Scheduling Dates** | Caption row | `Inter_400Regular`, 12sp, `#8EB69B`. |
| **Coordinator Contact** | Caption row | `mailto:` link, `#8EB69B`. |

No animation renders in this block — static reading content. A fourth ad-hoc use of any
animation library here would violate §10's ownership rule.

### 7.3 Sponsor Leaderboard Preview
Renders only if the event is currently active.

| Element | Component Type | Notes |
|---|---|---|
| **Preview Card** | Glass card, full width | Text: `"[Sponsor] is leading in fan support"`. |
| **Live Indicator** | Dot, left of text | It's live because the leading sponsor can change in real time. | Uses **Live Pulse Blob** (§10.4), 10pt. |

### 7.4 Registration Section

| Field | Component Type | Rules | Notes |
|---|---|---|---|
| **Name** | Text input | Required. | |
| **Game Name** | Text input | Required. | |
| **Role Selector** | Two-way glass chip toggle | `Team Captain` / `Team Member`. | Uses **Glass Press** (§10.1) on each tap. |
| **Team Name** *(Captain only)* | Text input | Required if Captain. | |
| **Invite Code** *(Captain only)* | Read-only field + copy action | Auto-generated. | Copy action triggers a snackbar confirmation. |
| **Team Status Toggle** *(Captain only)* | 3-way glass chip toggle | `Open` / `Invite Only` / `Closed`. | Uses **Glass Press** (§10.1). |
| **Reserve / Base Price** *(Captain only, auction leagues)* | Numeric input | Required only when the event `isAuctionBased`. | Corrects the source spec, which listed no additional Captain fields for auction leagues — this field is the fix. |
| **Base Price** *(Member only, auction leagues)* | Numeric input | Required only for Team Member role in an auction league. | Accompanied by price-guidance text: Average / Deviation / Variance. |
| **Captain Request Flow** *(League events only)* | See §7.5 | | |

### 7.5 Captain Request Flow (League events only)

| Element | Component Type | Notes |
|---|---|---|
| **Apply Button** | Primary glass button | `"Apply for Team Captain"`. Uses **Glass Press** (§10.1). |
| **Pending Caption** | Text, replaces the button once tapped | `"Application under review by the Core member(s) assigned to this league."` |
| **Approval Status Pill** | Read-only chip | `pending` / `approved` / `declined`. Colored `#34D27B` (success) only when `approved` — a plain color swap, no live blob, since approval is a one-time state change rather than something continuously live. |

### 7.6 Event Team Formation Section

| Field | Component Type | Rules | Notes |
|---|---|---|---|
| **My Team Card** | Glass card | Renders the user's own team summary if they belong to one. | |
| **Team Search** | Search input + result list | Multi-faceted filters (status, member count). | List rows use **Card Press Deepen** (§10.3). |
| **Invite Action** | Small button on each Open team row | Sends a team invite. | Uses **Glass Press** (§10.1). |
| **My Visibility Toggle** | 3-way glass chip toggle | `Open` / `Closed` / `Invite Only` — controls whether others can invite this user. | Uses **Glass Press** (§10.1). |

### 7.7 Event Leaderboard / Status / Results / Post-Event Sponsor Update

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Leaderboard** | Ranked list | Renders if active and enabled. | Same row pattern as §5.3's Strava leaderboard — top-3 rows get the **Live Pulse Blob** (§10.4). |
| **Status Indicator** | Chip | `Upcoming` / `Ongoing` / `Past`. | **Live Pulse Blob** (§10.4) only while `Ongoing`. |
| **Results** | Read-only block | Renders post-completion. | |
| **Post-Event Sponsor Update** | Dismissible glass card | `"+X fans earned for [Sponsor Name]"`, `BarlowCondensed_700Bold`, `#34D27B` (success token — reward text). | The one place the accent sets large display text rather than just a dot — justified because it's a one-time reward notice the user dismisses (tap to clear), so it never sits on-screen burning accent budget. Uses the **Sponsor Reward Reveal** animation (§10.8) on first appearance. |

---

## 8. Spectator Bracket View

Reached from Event Details (§7) when the event has a bracket. Pushed as its own sub-route.

### 8.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│ [←]              BRACKET — SPRING CUP                   │
├────────────────────────────────────────────────────────┤
│  ROUND OF 8      SEMIS         FINAL                     │
│  ╭─────────╮                                             │
│  │ Falcons  ▏3│                                           │
│  │ Ravens   ▏1│──╮  ╭─────────╮                          │
│  ╰─────────╯   │  │ Falcons  ●│                          │
│  ╭─────────╮   ╰──│ Hawks    │──╮  ╭─────────╮           │
│  │ Hawks    ▏2│    ╰─────────╯   │  │  TBD      │          │
│  │ Owls     ▏0│──╮                ╰──│  TBD      │          │
│  ╰─────────╯   │                     ╰─────────╯          │
└────────────────────────────────────────────────────────┘
```

### 8.2 Specification Table

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **Bracket Layout** | Horizontally-scrollable round columns | Elimination formats (Single/Double). | Round Robin renders as a grid instead, same match-card component. |
| **Match Card** | Glass card | Two team rows: name + score. | Uses **Card Press Deepen** (§10.3) on tap. Winner's score colored `#34D27B` (success token — positive result). |
| **Live Match Indicator** | Dot on the match card | Renders only while the match is in progress. | **Live Pulse Blob** (§10.4), 8pt. |
| **Round Connectors** | SVG lines between rounds | Computed from match card DOM positions. | Static — not an animation library job. |
| **Match Detail Sheet** | Bottom sheet | Opens on match tap: venue, date, team roster sheets, historical head-to-head, live score feed. | Uses the **Bottom Sheet Rise** animation (§10.6). Live score feed carries the same **Live Pulse Blob** only while the match is live. |
| **Admin/Coordinator Link** | Text link, bottom of screen | `"Manage on Web →"`, opens the Web Console. | Hard rule, not a toggle: no edit affordance renders on mobile for any role, ever. All structural layout, ruleset, and score-mapping changes happen only on the Web Console — this is explicit in the source spec's "Operational Boundaries Clarification." |

### 8.3 Bracket States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | Skeleton round columns with shimmer match-card outlines. | **Shimmer Sweep** animation. |
| **No Bracket Yet** | *"Bracket has not been generated yet."* | No CTA — bracket generation is Web Console only. |

---

## 9. Auction Event Interface — Mobile Spectator View

Reached from Event Details (§7) for an auction-based League event. Pushed as its own
sub-route. General spectators view only — no bidding controls render on mobile.

### 9.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│ [←]              AUCTION — BADMINTON LEAGUE              │
├────────────────────────────────────────────────────────┤
│           ╭──────────────────────────╮                  │
│           │      [ PLAYER PHOTO ]     │  ⏱ 3.2s          │
│           │      Rahul Verma          │                  │
│           │      ₹ 4,200               │                  │
│           ╰──────────────────────────╯                  │
│                                                          │
│  BID LOG                                                  │
│  Falcons Captain      ₹ 4,200                             │
│  Hawks Captain        ₹ 3,800                             │
│                                                          │
│  CAPTAIN WALLETS                                           │
│  ╭──────────────────────────────────────────────────╮    │
│  │ Falcons — ₹15,800 remaining · 6 on roster           │    │
│  ╰──────────────────────────────────────────────────╯    │
│  ╭──────────────────────────────────────────────────╮    │
│  │ Hawks — ₹18,200 remaining · 5 on roster             │    │
│  ╰──────────────────────────────────────────────────╯    │
└────────────────────────────────────────────────────────┘
```

### 9.2 Specification Table

| Element | Component Type | Rules | Notes |
|---|---|---|---|
| **On-the-Block Panel** | Glass card, centered | Current player photo, name (`BarlowCondensed_700Bold`), current bid (`BarlowCondensed_700Bold`, `#E8662A`). | Uses the **Auction Ripple Surge** animation (§10.9) continuously while a bid is active. |
| **Bid Countdown Ring** | Circular progress ring | 5-second countdown, resets on every new bid. | Uses the **Bid Countdown Ring** animation (§10.10). Starts/stops in sync with the panel's ripple. |
| **Bid Log** | List, most recent first | Captain name + bid amount (`#E8662A`). | No animation — a static, fast-updating list. |
| **Captain Wallets** | Glass card list | Wallet remaining + roster count per captain. | Uses **Card Press Deepen** (§10.3) if tapped for a roster detail sheet. |

### 9.3 Auction States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Auction Not Started** | *"Auction begins at [time]."* | Countdown-to-start text, no block panel. |
| **Auction Paused** | On-the-block panel dims to 60% opacity, ripple stops. | *"Auction paused by Core."* banner. |
| **Auction Ended** | Final rosters render read-only. | `[ View Full Results ]` link to Event Details. |

---

## 10. Animation & Motion Reference

This is the single source of truth for every animation on the screen. Every trigger listed in
§2–9 points back to a named entry here — no section re-describes or reinvents an animation.
Three libraries, each with one job; anything that doesn't match a row below gets a plain
`react-native-reanimated` timing/spring transition instead, never a fourth ad-hoc use of any
of the three.

| # | Animation Name | Trigger | Powered By | Behavior |
|---|---|---|---|---|
| 10.1 | **Glass Press** | User taps a glass button or chip (tab, filter chip, role toggle, status toggle, invite button, Connect Strava, Apply for Captain). | `dashersw/liquid-glass-js` — `Button` component, `warp: true`. | A center-out distortion ripple through the glass material itself, built into the shader. This **is** the press feedback — no separate scale/opacity transform is layered on top of it. |
| 10.2 | **Tab Underline Glide** | Active tab changes (category tab bar, §2.3). | `react-native-reanimated` spring physics (`damping: 18, stiffness: 150`). | The `#E8662A` underline slides from the previous active tab to the new one; tab content crossfades over 220ms. Fires on the same frame as the tab's Glass Press. |
| 10.3 | **Card Press Deepen** | User presses down on any glass card (event card, league card, team row, match card, wallet card). | `dashersw/liquid-glass-js` — `Container` component, `tintOpacity` shifted from 0.45 → 0.6 on `pointerdown`, released on `pointerup`. | The glass fill thickens/darkens under the finger, then relaxes on release — a tactile "press into glass" read. |
| 10.4 | **Live Pulse Blob** | Any element representing a currently-live state: Ongoing status dot, sponsor-leading indicator, top-3 leaderboard rank, live bracket match. | `paper-design/liquid-logo` (`LiquidMetal` shader). | A small organic blob that continuously morphs at low amplitude — reads as "alive right now." Reserved only for things that are live at this instant; never used decoratively. |
| 10.5 | **Streak Flame Ignite** | Renders next to the Strava streak count whenever today's ≥1km run has already been logged. | `paper-design/liquid-logo` (`LiquidMetal` shader), higher amplitude/speed variant of 10.4. | A brighter, faster blob morph than the standard Live Pulse Blob — signals "today is secured," disappears (replaced by the reminder caption) the moment midnight passes without a qualifying run. |
| 10.6 | **Bottom Sheet Rise** | User taps a match card (bracket detail), a team row (invite detail), or any element that opens a sheet. | `react-native-reanimated` — `translateY` from 100% to 0%, `cubic-bezier(0.32, 0.72, 0, 1)`, 300ms. | Sheet content sits inside a glass container (`dashersw/liquid-glass-js`, blur 32pt, fill 65%) but the rise motion itself is a plain transform, not a shader effect. |
| 10.7 | **Scroll-To Anchor** | User taps the "View in Strava ↓" chip on a linked FitSoc event card. | `react-native-reanimated` — `scrollTo` with `animated: true`, 400ms ease-in-out. | Smooth-scrolls the current ScrollView down to the Strava Sub-Section header, without changing tabs. |
| 10.8 | **Sponsor Reward Reveal** | The Post-Event Sponsor Update card first mounts (results just published). | `paper-design/liquid-logo`-driven glow burst on the card border, decaying to static after ~800ms, then handled by 10.4's idle state if the card stays visible. | A one-time "reward just landed" burst rather than a continuous loop — it settles, it doesn't keep pulsing, so it doesn't compete with the dismiss action. |
| 10.9 | **Auction Ripple Surge** | The Auction Event Interface's on-the-block panel, while a bid is actively in play. | `dashersw/liquid-glass-js` — live-updated `glassControls` (`edgeIntensity`, `rimIntensity`, `blurRadius` raised), border tint switched to `#E8662A` @ 40%. | The glass surface itself visibly ripples harder the instant a bid lands, and settles the instant bidding pauses — driven directly by the real-time bid-active signal, never a fixed loop. |
| 10.10 | **Bid Countdown Ring** | Every new bid in the Auction Event Interface. | Plain `requestAnimationFrame` SVG stroke-dashoffset animation (not one of the three libraries — tightly coupled to 10.9 and must start/stop in sync with it). | A 5-second circular countdown ring around the timer readout, resetting to full on every new bid; stroke color `#E8662A`. |
| 10.11 | **Shimmer Sweep** | Any loading state across all tabs and sub-views. | `react-native-reanimated` — linear gradient sweep, 1200ms loop, `#163B32` → `#235347` → `#163B32`. | Standard skeleton shimmer; not a glass/blob effect — kept plain so loading states never compete visually with the live-state language reserved for real content. |
| — | **Ambient Background Drift** | Always running, screen-wide, non-interactive. | `ruucm/shadergradient` — `ShaderGradientCanvas`, full-bleed behind the entire screen, `z-index: -1`. | A slow, continuous gradient drift across `#060D0E → #0F2426 → #163832`. This is the one animation with no discrete trigger — it's the ambient backdrop everything else sits on top of. Freezes to a static frame under `prefers-reduced-motion`. |

---

## 11. Scrolling & Viewport Behavior Rules

1. **Header Pinning**: Dynamic Status Bar, screen title, category tab bar, and filter row all remain fixed/sticky at the top (`zIndex: 100 / 90 / 85` respectively).
2. **Main Scroll Container**: Each active tab view is wrapped in a single vertical `ScrollView` (`showsVerticalScrollIndicator={false}`).
3. **Horizontal Scroll Sub-Components**: The bracket view's round columns use horizontal scrolling (`horizontal={true}`, `showsHorizontalScrollIndicator={false}`); the tab bar and filter row do not scroll — they're sized to always fit (§2.3, §2.4).
4. **Nested Scroll Prohibition**: Card grids, leaderboard rows, and bid logs render inline via `.map()`; nested `FlatList` or `ScrollView` instances are strictly prohibited.
5. **Cross-Tab / Cross-Section Behavior**: The FitSoc "View in Strava ↓" chip scrolls within the same tab (§10.7) — it does not switch tabs, since Strava now lives inside FitSoc rather than as its own tab.
6. **Filter Persistence Across Scroll Position**: Switching tabs preserves filter selection (§2.4) but resets scroll position to top for the newly active tab.

---

## 12. Typography & Font Configuration

> Fonts are defined in `UI-UX-Master-Doc.md §5`. Load all fonts in `app/_layout.tsx` via `expo-font` + `@expo-google-fonts/*`. Never reference font family strings inline — use the `FONTS` constant.

### 12.1 Font Families & Loading Architecture
1. **Display Font**: `BebasNeue_400Regular` — screen title (48 sp+) and any numeral ≥ 32 sp. Installed via `@expo-google-fonts/bebas-neue`.
2. **UI Heading Font**: `BarlowCondensed_700Bold` — event/league titles (18–28 sp), active tab label, large numerals below 32 sp. Installed via `@expo-google-fonts/barlow-condensed`.
3. **Body / UI Font**: `Inter` family (400 / 600 / 700) — all captions, form labels, inactive tab labels, button labels, metadata. Installed via `@expo-google-fonts/inter`.
4. **Fallback**: `Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif' })`.

### 12.2 Font Family Application Rules Table

| UI Context | Font Variant | Font Size (sp) | Example UI Elements |
|---|---|---|---|
| **Screen Title** | `BebasNeue_400Regular` | 48 sp | "EVENTS" |
| **Event / League Titles** | `BarlowCondensed_700Bold` | 18–24 sp | Event Details title, League card title |
| **Active Tab Label** | `BarlowCondensed_700Bold` | 13 sp | Active category tab |
| **Large Numerals (streak, bid, scores ≥ 32 sp)** | `BebasNeue_400Regular` | 32–48 sp | Streak count, bid total |
| **Large Numerals (< 32 sp)** | `BarlowCondensed_700Bold` | 18–28 sp | Scores, rank numbers |
| **Buttons & Chips (inactive)** | `Inter_600SemiBold` | 12–14 sp | Filter chips, role toggle, invite button |
| **Body & Paragraph Text** | `Inter_400Regular` | 14–16 sp | Event descriptions, form labels |
| **Captions & Metadata** | `Inter_400Regular` | 11–12 sp | Timestamps, coordinator contact, sponsor ribbon |

---

## 13. Palette & Color System

> **Tokens from `UI-UX-Master-Doc.md §4`.** Always consume via `useColors()` — never hardcode hex in component code. Values listed here are reference only.

```typescript
// Reference values only — use useColors() in all component code.
export const glassForestThemeTokens = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  background:           '#060D0E',                 // App canvas             (token: background)
  backgroundMid:        '#0F2426',                 // Section bg variant     (token: backgroundMid)

  // ── Glass Surfaces ────────────────────────────────────────────────────────
  surface:              'rgba(15,36,38,0.55)',      // Card/panel + blur(20px)(token: surface)
  surfaceRaised:        'rgba(20,50,52,0.40)',      // Nested rows, inputs    (token: surfaceMuted)
  surfaceModal:         'rgba(15,36,38,0.65)',      // Bottom sheet + blur(32px)
  surfaceSolid:         '#163832',                 // No-blur fallback       (token: surfaceSolid)

  // ── Borders ───────────────────────────────────────────────────────────────
  border:               'rgba(142,182,155,0.15)',  // 1dp hairline           (token: border)
  borderTabBar:         'rgba(142,182,155,0.20)',  // Tab bar container border
  borderActive:         'rgba(142,182,155,0.40)',  // Focus / selected       (token: borderActive)
  borderAuctionActive:  'rgba(232,102,42,0.40)',   // Auction bid-active panel border

  // ── Typography ────────────────────────────────────────────────────────────
  textPrimary:          '#DAF1DE',                 // Titles, body           (token: text)
  textMuted:            '#8EB69B',                 // Subtitles, captions    (token: textMuted)

  // ── Accent — CTAs, active tab underline, links ───────────────────────────
  accent:               '#E8662A',                 // Burnt orange           (token: accent)
  accentText:           '#FFFFFF',                 // Text on accent fill    (token: accentText)
  accentMuted:          'rgba(232,102,42,0.15)',   // Accent tint bg         (token: accentMuted)

  // ── Success — live indicators, positive results ───────────────────────────
  success:              '#34D27B',                 // Live dots, scores, rewards (token: success)
  successMuted:         'rgba(52,210,123,0.08)',   // Current-user row highlight

  // ── Sponsor label (NOT the accent — see §6.2) ────────────────────────────
  sponsorRibbonBg:      '#235347',
  sponsorRibbonText:    '#8EB69B',

  // ── States ────────────────────────────────────────────────────────────────
  danger:               '#F2686C',                 // Error / destructive    (token: danger)

  // ── Overlay ──────────────────────────────────────────────────────────────
  modalBackdrop:        'rgba(6,13,14,0.65)',      // Scrim over canvas
};
```

---

## 14. Minimalist Button & Card Geometry System

| Button / Trigger | Tier | Shape & Radius | Height (dp) | Background Fill | Border | Text Style |
|---|---|---|---|---|---|---|
| **`[ Connect Strava ]` / `[ Apply for Team Captain ]`** | Primary | Capsule (`24 dp`) | `48 dp` | `#235347` glass fill | None | `14 sp` `Inter_600SemiBold` (`#DAF1DE`) |
| **Active Tab Pill** | Secondary | Capsule (`24 dp`, part of tab bar) | `40 dp` | `#235347` glass fill | None | `13 sp` `BarlowCondensed_700Bold` (`#DAF1DE`) + `#E8662A` underline |
| **Inactive Tab Item** | Secondary | Capsule (part of tab bar) | `40 dp` | Transparent | None | `13 sp` `Inter_600SemiBold` (`#8EB69B`) |
| **Active Filter Chip** | Secondary | Capsule (`20 dp`) | `36 dp` | `#235347` glass fill | None | `12 sp` `Inter_600SemiBold` (`#DAF1DE`) |
| **Inactive Filter Chip** | Secondary | Capsule (`20 dp`) | `36 dp` | Transparent | 1 dp `#8EB69B` @ 20% | `12 sp` `Inter_400Regular` (`#8EB69B`) |
| **Event / League Card** | Primary Surface | Rounded (`24 dp`) | Auto (content-based) | `rgba(15,36,38,0.55)` glass | 1 dp `#8EB69B` @ 15% | Per §12.2 |
| **`[ Invite ]` (Team Search Row)** | Tertiary | Soft Rectangle (`6 dp`) | `32 dp` | Transparent | 1 dp `#8EB69B` @ 20% | `12 sp` `Inter_400Regular` (`#DAF1DE`) |
| **`[ Copy ]` (Invite Code)** | Tertiary | Soft Rectangle (`6 dp`) | `32 dp` | Transparent | 1 dp `#8EB69B` @ 20% | `12 sp` `Inter_400Regular` (`#DAF1DE`) |
| **Bracket / Auction Match Card** | Primary Surface | Rounded (`24 dp`) | Auto | `rgba(15,36,38,0.55)` glass | 1 dp `#8EB69B` @ 15% (`#E8662A` @ 40% for the on-the-block panel while a bid is active) | Per §12.2 |

---

## Appendix — Open Questions, Resolved

| # | Question | Resolution |
|---|---|---|
| 1 | Where should the Strava section live? | Sub-section inside the FitSoc Events tab (§5.3), not a standalone tab this time. |
| 2 | How should the Strava leaderboard rank users? | Consistency (days run ÷ days in the current cycle's window), not raw distance or streak length. |

Nothing else in this document is an open question — build from §1–14 as written.
