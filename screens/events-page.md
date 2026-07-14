# Events Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/events` (`src/app/(drawer)/events.tsx`)
**Drill-in Routes:** `/(stack)/event/[id]` (Event Detail) · `/(stack)/event/[id]/bracket` (Spectator Bracket) · `/(stack)/event/[id]/auction` (Auction Spectator)
**Visibility:** Public (browse) · Authenticated (register, team-up, invest)
**Source:** Complete Feature Specification & Architecture §5.5; Screen Inventory "Events Page — 4 category tabs"

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top (center brand = BGEC)
├─────────────────────────────────────┤
│  Category Tabs                      │  ← sticky; horizontally scrollable
│  [Leagues | BGEC | FitSoc | General]│
├─────────────────────────────────────┤
│  Status Filter Chips (multi-select) │  ← sticky below tabs
│  [Upcoming] [Ongoing] [Past]        │
├─────────────────────────────────────┤
│                                     │
│         Event List (scroll)         │  ← event cards for active tab + filters
│  ┌──────────────────────────────┐   │
│  │ Event Card                   │   │
│  └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘

(drill-in)  Event Card ─tap→ Event Detail Screen
            League Card ─tap "Bracket"→ Spectator Bracket View
            Auction League ─tap "Auction"→ Auction Spectator View
```

The page reuses the Home Page's interaction grammar: a sticky tab strip, a sticky filter row, vertically scrolling cards, drill-in detail surfaces, and skeleton/empty/error states. A user can browse everything as a Guest; any action that creates state (register, apply for captain, send team invite, invest points) requires authentication and redirects Guests to `/login`.

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header (identical behaviour to the Home Page §2). On the Events route the **center contextual brand is `BGEC`** (`ROUTE_BRAND.events = 'BGEC'`).

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (☰) | Tap → opens the Side Drawer overlay |
| Center | BGEC logo | Non-interactive; confirms current module context |
| Right — Guest | "Login" text button | Tap → navigates to `/login` |
| Right — Authenticated | User's profile avatar (circular) | Tap → opens Account Actions Popup |

**Theme:** Background, icon, and text colours follow the active light/dark scheme from `themeStore`.

---

## 3. Category Tabs

Four category tabs sit in a horizontal strip pinned directly below the status bar. If the labels overflow the viewport the strip scrolls horizontally; otherwise they distribute evenly.

| Index | Label | Content |
|---|---|---|
| 0 | Leagues | Sports + Esports league events (`ALL` / `DLL`); captain-request flow and, where applicable, auction-based player pricing |
| 1 | BGEC Events | Esports-specific events |
| 2 | FitSoc Events | Fitness / physical-sport events |
| 3 | General Events | Highlight events, Waves, and sponsored events |

- Tapping a tab label or swiping horizontally switches the active category with a slide animation (mirrors Home Page §3).
- Active tab label is bold and underlined with the brand accent colour; inactive labels are muted.
- The tab strip is **sticky** — it does not scroll away with the list.
- Switching tabs preserves each tab's selected status filters and scroll position is reset to top.

---

## 4. Status Filter Chips

A single-row chip set pinned below the category tabs, scoped to the active tab.

```
┌──────────────────────────────────┐
│  [Upcoming] [Ongoing] [Past]     │  ← multi-select
└──────────────────────────────────┘
```

- Chips: **Upcoming · Ongoing · Past**.
- **Multi-select** (spec §5.5): any combination may be active simultaneously; all three active shows everything.
- **Default selection:** `Upcoming` + `Ongoing` (active/forthcoming events surface first; `Past` is opt-in).
- Active chip: filled background with accent colour. Inactive: outlined.
- Deselecting the last remaining chip is **not** allowed — at least one filter must stay active (tapping the only active chip is a no-op, or re-selects the default set). This prevents an intentional empty list being confused with an error.
- A status colour token is shared across the page: **Upcoming = blue**, **Ongoing = green**, **Past = grey** (matches `STATUS_COLOR` in code).

---

## 5. Event Card

```
┌────────────────────────────────────────┐
│  [Cover thumbnail]      [Status badge]  │
│                                         │
│  Event Title (bold, 1–2 lines)          │
│  [Type pill] · [Category pill]          │
│                                         │
│  📅 12 Jul · 6:00 PM  →  14 Jul         │
│  📍 Venue / Online                      │
│                                         │
│  [Sponsor leader chip]   [Reg. status]  │
└────────────────────────────────────────┘
```

- **Cover thumbnail:** Event cover media (image). Falls back to a category-tinted placeholder block when none is set.
- **Status badge:** `Upcoming` / `Ongoing` / `Past` using the shared status colour.
- **Title:** Bold, max 2 lines with ellipsis.
- **Type pill:** Human-readable event type derived from `EventType`:
  - `LE` → "Leaderboard Event"
  - `DE` → "Direct Event"
  - `ALL` → "Auction League"
  - `DLL` → "Direct League"
- **Category pill:** Leagues / BGEC / FitSoc / General (matches the originating tab).
- **Schedule:** Relative-aware date range from `startDate → endDate` (e.g., "Starts in 3 days", "Live now", "Ended 12 Jul").
- **Venue line:** Physical venue or "Online"; hidden if not set.
- **Sponsor leader chip (Ongoing only):** Compact "🏆 [Sponsor] leading" chip when the event has an active sponsor-fan contest (spec §5.5 Sponsor Leaderboard Preview). Hidden otherwise.
- **Registration status (Authenticated):** Small right-aligned label reflecting the viewer's relationship to the event — "Registered", "Registration open", "Registration closed", "Full", or "Results out". Guests see only "Registration open / closed".
- **Card tap** → opens the **Event Detail Screen** (§6).
- **League cards** additionally surface a secondary "View bracket" affordance (and "Auction" for `ALL` leagues) when those views are live.

---

## 6. Event Detail Screen

Navigated to by tapping any event card. Full-screen stack screen (`/(stack)/event/[id]`) with a back button; long secondary actions (registration, team formation) may open as nested bottom sheets. The detail screen is organised into stacked sections, all read-only for Guests.

### 6.1 Layout (top-to-bottom scroll)

```
┌──────────────────────────────────┐
│  ← Back        [Share ↗]         │
│  Cover banner + Status badge     │
├──────────────────────────────────┤
│  Event Info                      │
│  Sponsor Leaderboard Preview     │
│  Registration Section            │
│  Team Formation Section          │
│  Event Leaderboard (if active)   │
│  Event Results (post-completion) │
├──────────────────────────────────┤
│  [Primary CTA — sticky bottom]   │
└──────────────────────────────────┘
```

### 6.2 Event Info

- **Title, description** (rich text), **event type**, **category**.
- **Schedule:** Registration window, start/end dates, key milestone dates.
- **Rules:** "View Rules" opens the rules **PDF / external link** in an in-app browser or system viewer.
- **Awards:** Prize / points / fan-award breakdown.
- **Coordinator contacts:** Name + role + quick-contact (email, masked WhatsApp revealed on tap — mirrors Contact Directory convention).
- **Event Status indicator:** Prominent Upcoming / Ongoing / Past badge.

### 6.3 Sponsor Leaderboard Preview

- Shown when the event is **active** (Ongoing) and tied to the sponsor-fan system.
- Displays which sponsor is currently leading in fan contributions for this event type, with a compact ranked preview (top 3) and a "View full leaderboard" link to the Leaderboards / Sponsor page.
- Hidden for events without sponsor association.

### 6.4 Registration Section (Authenticated)

The participant-facing registration form (spec §5.5). Guests see a "Log in to register" CTA in place of the form.

| Field | Type | Notes |
|---|---|---|
| Name | Text (prefilled from profile) | Editable display name for the event |
| Game name / IGN | Text | In-game name where relevant (esports) |
| Role | Segmented control | **Team Captain** or **Team Member** |
| Team name | Text | Captain only; shown when Role = Captain |
| Invite code | Text | Captain generates; Member can enter a code to join |
| Joining parameters | Inputs | Captain-defined constraints (size, criteria) |
| Team participant count | Read-out | Live count of members in the captain's team |
| Team status toggle | Segmented control | **Open / Invite Only / Closed** (captain controls discoverability) |

- **Solo events** collapse the team fields and register the user directly (MVP scope is solo registration; team formation surfaces are gated behind league/team events).
- **Registration states:** Open → form enabled; Closed / past deadline → form disabled with reason; Full → waitlist or disabled; Already registered → shows current registration with an "Edit / Withdraw" affordance.
- Submitting shows a confirmation snackbar ("You're registered") and updates the card's registration status.

### 6.5 Team Formation Section (Authenticated)

- View **own team details** and incoming **team invites** (accept / decline).
- **Send team invites** to users marked "Open to join".
- **Search registered teams** with multi-faceted filters (team status, size, open slots).
- **User availability toggle:** **Open / Closed / Invite Only** — controls whether others can invite the current user to teams.

### 6.6 Event Leaderboard

- Embedded live ranking when the event has an **active, enabled** leaderboard (`LE` / `ALL` / `DLL`).
- Read-only preview here; deep-link to the full Leaderboards Page for format-specific views and points investment.

### 6.7 Event Results & Post-Event Sponsor Update

- After completion, the section shows final **results / standings**.
- **Post-Event Sponsor Update:** Users who won earn virtual fans for their sponsor. Display a celebratory line: **"+X fans earned for [Sponsor Name]"** for the viewing user, plus the event-level sponsor outcome.

---

## 7. League-Specific Registration

Leagues (`ALL` / `DLL`) extend the standard registration (§6.4) with:

### 7.1 Captain Request Flow

- During the registration window, users can **apply for the Team Captain role**.
- Applications are **reviewed by the Core members** assigned to that league (review happens off-device / web console).
- Application states surfaced on mobile: **Not applied → Pending review → Approved → Rejected**.
- Approved captains appear in the auction system / team availability list.

### 7.2 Auction-Based Leagues (`ALL`)

- **Team Captain:** No additional fields required.
- **Team Member:** **Starting cost / base price** input.
- The form shows pricing guidance computed from the pool: **Average price, deviation, and variance**, to help members price themselves sensibly.

---

## 8. Spectator Bracket View

Drill-in from league events (read-only on mobile).

- Renders a **styled, real-time match bracket tree**: Round Robin grids, Single / Double Elimination brackets, bypass / bye rounds.
- **Tap any match node** → match detail: scheduled venue, date, team roster sheets, historical head-to-head stats, and real-time score feed.
- **Operational boundary:** Coordinators/Admins see a **"Manage on Web" redirect anchor** instead of any on-device editing — all bracket configuration, rulesets, and score entry happen strictly in the Web Console (prevents mobile layout bloat).
- Live updates animate in without a full reload.

---

## 9. Auction Spectator View

Drill-in from an auction-based league (`ALL`) when an auction room is live. Mobile is **spectator-only**.

```
┌──────────────────────────────────┐
│  Player on the block             │
│  [Avatar] Name · base price      │
│  ⏱ 0:05  (per-bid countdown)     │
├──────────────────────────────────┤
│  Live Bid Log                    │
│   • Captain A — ₹/pts …          │
│   • Captain B — ₹/pts …          │
├──────────────────────────────────┤
│  Captain wallets & rosters       │
└──────────────────────────────────┘
```

- **Live player currently on the block** with base price.
- **Live bid log** updating in real time.
- **5-second countdown timer** per bid.
- **Bid history** of captains.
- **Captain wallets and rosters** (read-only).
- No bidding controls on mobile — bid operation lives in the Web Console.

---

## 10. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| Login button (status bar) | Tap (Guest) | Navigates to `/login` |
| Profile avatar (status bar) | Tap (Auth) | Opens Account Actions Popup |
| Category tab | Tap or horizontal swipe | Switches active category |
| Status filter chip | Tap | Toggles that status (multi-select) |
| Status filter chip (last active) | Tap | No-op (≥1 filter must remain) |
| Event card | Tap | Opens Event Detail Screen |
| "View bracket" (league card/detail) | Tap | Opens Spectator Bracket View |
| "Auction" (auction league) | Tap | Opens Auction Spectator View |
| Rules link | Tap | Opens rules PDF / external link |
| Coordinator WhatsApp | Tap | Reveals masked number / opens contact |
| Sponsor leader chip / "View full leaderboard" | Tap | Opens Leaderboards / Sponsor page |
| Register CTA | Tap (Auth) | Opens / focuses Registration Section |
| Register CTA | Tap (Guest) | Redirects to `/login` |
| Role segmented control | Tap | Switches Captain / Member fields |
| Team status toggle | Tap | Sets Open / Invite Only / Closed |
| "Apply for Captain" | Tap (Auth, league) | Submits captain request (Pending review) |
| Send team invite | Tap | Sends invite to an "Open to join" user |
| Accept / Decline invite | Tap | Updates team membership |
| Availability toggle | Tap | Sets Open / Closed / Invite Only |
| Bracket match node | Tap | Opens match detail (venue, rosters, H2H, scores) |
| "Manage on Web" anchor | Tap (Coordinator+) | Opens web console redirect |
| Share (detail) | Tap | Opens system share sheet with event deep-link |
| Event list | Pull down | Pull-to-refresh |
| Event list | Scroll to bottom | Loads next page |

---

## 11. States

| State | Behaviour |
|---|---|
| Guest | Full browse of tabs, filters, cards, detail, brackets, auction. Register / captain-apply / team-invite / invest CTAs redirect to `/login` |
| Authenticated | All read actions plus registration, team formation, captain request, points investment |
| Coordinator+ | Same participant experience, plus a "Manage on Web" redirect anchor in bracket / config surfaces (no on-device editing) |
| Registration closed / past deadline | Registration form disabled with an explanatory label |
| Event full | Registration disabled or waitlist affordance |
| Already registered | Registration section shows current entry with Edit / Withdraw |

---

## 12. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Event list (per tab + filter combo) | Illustration + context message, e.g. "No upcoming events in Leagues yet" | Retry button with message |
| Event Detail — Leaderboard | "Leaderboard not active yet" | Inline retry |
| Event Detail — Results | "Results not published yet" | Inline retry |
| Team search | "No teams match your filters" | Retry button |
| Bracket view | "Bracket not generated yet" | Retry button |
| Auction view | "Auction hasn't started" | Retry button |

- The empty list message is **context-aware** of the active category and selected status filters so it never reads as a generic dead end.

---

## 13. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching live content shape), consistent with the Home Page:

- Event list: 3 skeleton event cards while fetching the active tab.
- Event Detail: skeleton banner + info blocks on first open.
- Leaderboard / bracket / auction: section-level skeletons; live regions show a small inline spinner for incremental updates.
- "Load more" at list bottom: small inline spinner.
