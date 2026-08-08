# Leaderboards Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/leaderboards` (`src/app/(drawer)/leaderboards.tsx`)
**Drill-in Route:** `/(stack)/leaderboard/[id]` (`src/app/(stack)/leaderboard/[id].tsx`)
**Visibility:** Public (view), Authenticated (invest points)

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│  Filter Bar (Type · Status · Tags)  │  ← sticky below status bar
├─────────────────────────────────────┤
│                                     │
│   Leaderboard Event Cards (scroll)  │  ← scrollable
│                                     │
│   ┌─────────────────────────────┐   │
│   │  Leaderboard Event Card     │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │  Leaderboard Event Card     │   │
│   └─────────────────────────────┘   │
│   …                                 │
│                                     │
└─────────────────────────────────────┘
```

- Status bar is fixed at top.
- Filter bar sticks directly below the status bar and does not scroll away.
- Card list is the only scrollable region.

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header.

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (≡) | Tap → opens the Side Drawer overlay |
| Center | "Leaderboards" wordmark | Non-interactive; confirms current module context |
| Right — Guest | "Login" text button | Tap → navigates to `/login` |
| Right — Authenticated | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

**Theme:** Background colour and icon/text colour follow the active colour scheme (light/dark) from `themeStore`.

---

## 3. Filter Bar

Four filter rows pinned directly below the status bar, each horizontally scrollable. Applying any filter re-fetches the list.

### 3.1 Row 1 — Event Type

Single-select chips. Default: **All**.

| Chip | Filters to |
|---|---|
| All | All leaderboard events |
| Leagues | Events with type `ALL` or `DLL` |
| BGEC | Esports events |
| FitSoc | Fitness / physical sport events |
| General | Highlight events and sponsored general events |

### 3.2 Row 2 — Status

Multi-select enabled — user can view any combination simultaneously. Default: **Active** only.

| Chip | Meaning |
|---|---|
| Active | Event underway; leaderboard accepting scores |
| Upcoming | Event not yet started; leaderboard not yet open |
| Completed | Event concluded; final standings frozen |

Active chips: filled accent background. Inactive: outlined. Selecting an already-active chip deselects it (unless it would leave zero chips selected — at least one must remain active).

### 3.3 Row 3 — Participation Status (Authenticated only)

Single-select chips. Hidden entirely for guests (guests always see all events).

| Chip | Meaning |
|---|---|
| All | All events regardless of registration status |
| Registered | Events the authenticated user is registered for |
| Not Registered | Events the authenticated user is not registered for |

Default: **All**.

### 3.4 Row 4 — Tags

Horizontally scrollable multi-select interest/sport tags pulled from the active event catalogue. Examples: Football, Valorant, Cricket, CS, Badminton, Minecraft, etc. Default: none selected (all tags shown). Selecting one or more tags narrows the list to events carrying those tags.

---

## 4. Leaderboard Event Card

Each card in the list represents one event that has an active or completed leaderboard.

```
┌──────────────────────────────────────────────┐
│  [Event Cover Thumbnail]                     │
│                              [Format Badge]  │
├──────────────────────────────────────────────┤
│  Event Title (bold, 1 line)                  │
│  [Type Pill]  [Status Pill]                  │
│                                              │
│  Participants: 24    Score: 0 – 1 000        │
│                                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  (Authenticated + registered only)           │
│  Your Rank: #7   Your Score: 640             │
│  [Invest Points →]                           │
└──────────────────────────────────────────────┘
```

### 4.1 Components

#### Event Cover Thumbnail
- Full-width image at top of card, aspect ratio 16:9. Falls back to a branded gradient if no cover is set.

#### Format Badge
- Small pill overlaid on the top-right corner of the thumbnail.
- Values and colours (spec uses both "Direct Elimination / Upper-Lower Bracket" in §5.6 and "Single / Double Elimination" in §5.15; both name pairs refer to the same formats):

  | Badge label | Also known as | Colour |
  |---|---|---|
  | Round Robin | — | Indigo |
  | Direct Elim | Single Elimination | Orange |
  | Upper-Lower | Double Elimination | Purple |
  | Elim after N | Elimination after N fails | Red |

#### Event Title
- 16 sp bold. Single line with ellipsis overflow.

#### Type Pill + Status Pill
- **Type pill:** Small coloured capsule (blue = BGEC, green = FitSoc, purple = Leagues, grey = General).
- **Status pill:** Green "Active", blue "Upcoming", grey "Completed". Matches Row 2 filter colours.

#### Participants Count
- Live count of registered participants. Updates on pull-to-refresh and also via FCM silent background push → React Query invalidation, consistent with the platform §16.3 low-velocity pattern.

#### Score Range
- Displays the normalised score bounds configured for this leaderboard: e.g., `Score: 0 – 1 000`. Hidden if not yet configured.

#### Your Rank / Your Score (Authenticated + registered only)
- Shown only when the viewing user is registered for that event.
- **Your Rank:** `#7 of 24` — user's current position.
- **Your Score:** Normalised score value (0–1000 range).

#### Invest Points Button (Authenticated + registered + event allows investment)
- Outlined accent button: "Invest Points →".
- Tap → opens **Points Investment Sheet** (see §6).
- Hidden if: user is not registered, event does not permit investment, or leaderboard status is Completed.

### 4.2 Card Interaction

- **Card tap** → navigates to **Leaderboard Detail Screen** for that event (`/(stack)/leaderboard/[id]`).
- **Invest Points button tap** → opens Points Investment Sheet directly without drilling in.

### 4.3 Minimum Participant Threshold Notice

If a leaderboard has not yet reached its minimum participant threshold to activate rankings, the entire bottom section of the card (both the Participants/Score row and the rank/invest row for registered users) is replaced by a single notice banner:

```
⏳ Needs 8 more participants to activate leaderboard
```

Tapping the card still opens the detail screen in "pending activation" state.

---

## 5. Leaderboard Detail Screen

Navigated to by tapping any Leaderboard Event Card. Full-screen stack screen.

### 5.1 Page Structure

```
┌──────────────────────────────────────────┐
│  [← Back]  Event Title        [Share ↗]  │  ← custom nav bar
├──────────────────────────────────────────┤
│  [Event Cover — 16:9]                    │
│  [Format Badge]  [Status Pill]           │
├──────────────────────────────────────────┤
│  Stat Row: Participants · Format · Range │
├──────────────────────────────────────────┤
│  (Authenticated + registered only)       │
│  Your Position Banner                    │
│  ┌──────────────────────────────────┐   │
│  │ #7 · Your Score: 640             │   │
│  │ [Invest Points →]                │   │
│  └──────────────────────────────────┘   │
├──────────────────────────────────────────┤
│  Rankings Table Header                   │
│  [Rank] [Player / Team]  [Score]         │
├──────────────────────────────────────────┤
│  Rankings List (scroll)                  │
│  ┌──────────────────────────────────┐   │
│  │ #1  [Avatar] Team Alpha   1 000  │   │
│  │ #2  [Avatar] Team Beta      980  │   │
│  │ #3  [Avatar] Name C         960  │   │
│  │ …                                │   │
│  └──────────────────────────────────┘   │
├──────────────────────────────────────────┤
│  [Load more / end of rankings]           │
└──────────────────────────────────────────┘
```

### 5.2 Custom Nav Bar

| Slot | Component | Behaviour |
|---|---|---|
| Left | Back arrow (←) | Tap → pops back to Leaderboards list |
| Center | Event title (truncated) | Non-interactive |
| Right | Share icon (↗) | Tap → opens native share sheet with deep-link to this leaderboard |

### 5.3 Stat Row

Three evenly spaced stat blocks below the cover:

| Stat | Value example |
|---|---|
| Participants | `24 / 32` (current / max) |
| Format | `Round Robin` |
| Score Range | `0 – 1 000` |

Tap any stat block → no drill-in (MVP). Scale animation only.

### 5.4 Your Position Banner (Authenticated + registered only)

- Hidden entirely for guests and for authenticated users not registered in this event.
- Accent-tinted card pinned above the rankings table. Shows `#7 · Score: 640`.
- **Invest Points button** inside this banner. See §6.
- If leaderboard is **Completed**, button is replaced with a greyed "Final" label.
- If below activation threshold, banner shows "Awaiting activation" instead of rank.

### 5.5 Rankings Table

#### Header Row
- Fixed column labels: `#`, `Player / Team`, `Score`. Right-aligned score column.

#### Ranking Row

```
┌──────────────────────────────────────────┐
│  [Medal/Number]  [Avatar]  Display Name  │
│                  @username (solo) or     │
│                  Team Name               │
│                               [Score]   │
└──────────────────────────────────────────┘
```

- **Rank indicator:**
  - `#1` → Gold medal icon.
  - `#2` → Silver medal icon.
  - `#3` → Bronze medal icon.
  - `#4+` → Plain rank number in muted text.
- **Avatar:** 36 dp circle for solo participants; team emblem/initials badge for team events. Tap → User Profile Page (solo) or Team Detail Sheet (team).
- **Display Name:** Bold, 1 line. For team events shows team name; for solo shows display name + `@username` below in muted 12 sp.
- **Score:** Right-aligned, bold. Normalised value (0–1000).
- **Current user's row:** Highlighted with a faint accent-tinted background so the user can identify themselves instantly when scrolling.
- **Tap row** → User Profile Page (solo event) or Team Detail Sheet (team event).

#### Sponsor Fan Contribution Indicator (Active events only)
- A small sponsor logo pill appears below the score for the top 3 ranking rows only, showing the sponsor affiliated with that entry and the projected fan count if standings hold.
- Format: `[Logo] +45 fans` in 10 sp muted text, right-aligned below the score.
- Shown only on active events; hidden once status is Completed or Upcoming.
- Deferred to a future phase if no sponsor is linked to the event (row renders normally with no pill).

### 5.6 Pagination

- Initial load: top 50 rankings.
- "Load more" inline spinner at the bottom when more entries exist. Loads the next 50.
- Pull-to-refresh at the top re-fetches the full list from rank #1.

### 5.7 Real-Time Updates (Active leaderboards only)

- Score changes pushed via Firebase Cloud Messaging silent background push → React Query cache invalidation → list re-renders without manual refresh. (Leaderboard scores are low-velocity — updated after match completion, not per-bid — so FCM + React Query invalidation is appropriate per §16.3 of the platform spec. If a future event requires sub-second score ticks, upgrade to Socket.io at that point.)
- A banner chip appears at the top of the rankings list when the standings have changed since last full load: "Standings updated — pull to refresh". Tapping it scrolls to top and triggers a pull-to-refresh.
- The user's own position banner updates via the same FCM → React Query invalidation path; it re-fetches the user's rank entry only, not the full list.
- **Post-investment rank update:** After a successful points investment (§6), the Your Position Banner re-fetches via the same FCM → React Query invalidation path. Rank may not change immediately — the server recalculates rankings asynchronously after investment confirmation. The banner reflects the updated rank once the recalculation FCM push arrives.

### 5.8 Team Detail Sheet

Opened by tapping a ranking row or row avatar in a team-format leaderboard. A bottom sheet covering ~75% of screen height.

```
┌──────────────────────────────────────┐
│  [← ]  Team Alpha              [✕]  │
├──────────────────────────────────────┤
│  [Team Emblem / Initials Badge]      │
│  Team Name (bold, 20 sp)             │
│  Event: [Event Name]  [Status Pill]  │
├──────────────────────────────────────┤
│  Members                             │
│  ┌─────────────────────────────────┐ │
│  │ [Avatar] Display Name  @handle  │ │
│  │           [Captain ★] [Role]    │ │
│  └─────────────────────────────────┘ │
│  ┌─────────────────────────────────┐ │
│  │ [Avatar] Display Name  @handle  │ │
│  │           [Role]                │ │
│  └─────────────────────────────────┘ │
│  …                                   │
└──────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| Team Emblem | Team avatar/initials badge, 64 dp |
| Captain indicator | Star icon (★) next to captain's name |
| Role | Member's union role badge (e.g., Core, Member) |
| Event registration status | Pill showing whether team is Registered / Pending / Not Registered for the event |
| Member row tap | Opens that member's User Profile Page |

> Note: Full team management (editing team name, roster changes) is defined in the events-page spec (not yet written). This sheet is read-only.

### 5.9 Completed Leaderboard State

When `status === Completed`:
- Status pill changes to grey "Completed".
- A "Final Standings" header replaces the "Rankings" header.
- Invest Points button hidden; your position banner shows "Final: #7".
- Top 3 rows have a podium-style visual treatment (slight elevation, larger medal icons).
- Share button in the nav bar shares the final results.

---

## 6. Points Investment Sheet

**Trigger:** "Invest Points →" button on a Leaderboard Event Card or the Your Position Banner inside the detail screen.

**Conditions to show:** User must be authenticated, registered for the event, and the event must have `points_investment_allowed = true`. Sheet is unavailable once leaderboard status is Completed.

**Appearance:** Bottom sheet with handle, covers ~60% of screen height.

```
┌──────────────────────────────────────────┐
│  ━━━  (drag handle)                      │
│  Invest Points               [Close ✕]   │
├──────────────────────────────────────────┤
│  Event: [Event Name]                     │
│  Your Current Rank: #7   Score: 640      │
│                                          │
│  Your Points Balance: 1,450 pts          │
│                                          │
│  Amount to invest                        │
│  ┌──────────────────────────────────┐   │
│  │   [−]      250 pts      [+]      │   │
│  └──────────────────────────────────┘   │
│  Min: [min] pts · Max: [max] pts         │
│  (configured per event by admin)         │
│                                          │
│  [Cancel]          [Invest 250 pts]      │
└──────────────────────────────────────────┘
```

### 6.1 Components

#### Current Rank & Balance
- Read-only display. The balance is **fetched live when the sheet opens** — it is not served from the React Query cache — to prevent a stale balance from allowing apparent over-investment.

#### Amount Stepper
- `[−]` and `[+]` buttons adjust the amount in the event's configured increment step.
- Direct text edit also allowed — tapping the number opens a numeric keyboard.
- Clamped between the per-event minimum and maximum values set by the admin. Min/max shown as help text below the stepper.
- Attempting to invest more than the current balance disables the Invest button and shows inline error: "Insufficient points".

#### Action Buttons
- **Cancel** (outlined): dismisses sheet. No state change.
- **Invest N pts** (filled primary): disabled until amount ≥ event minimum and user has sufficient balance.
  - Tap → confirmation dialog: "Invest N pts in [Event Name]? This cannot be undone." with **Confirm** / **Cancel**.
  - On confirm → API call → on success: sheet dismisses; snackbar "N pts invested — rankings updated soon"; Your Position Banner refreshes via FCM → React Query invalidation.
  - On failure → snackbar with error; sheet stays open.

### 6.2 States

| State | Behaviour |
|---|---|
| Loading balance | Spinner in balance row |
| Insufficient balance | Amount clamped to balance; Invest button disabled; inline error shown |
| Investment in-flight | Invest button shows spinner; stepper disabled |
| Success | Sheet dismisses; snackbar confirmation |
| Error | Snackbar with error; sheet stays open to retry |
| Investment disabled mid-session | If admin disables points investment while the sheet is open, the Confirm button returns: "Investment is no longer available for this event" error toast; sheet closes. |

---

## 7. States

### 7.1 Leaderboards List Page

| State | Behaviour |
|---|---|
| Loading | 3 skeleton cards (rect image + 4 text lines) |
| Empty (no active leaderboards) | Illustration + "No active leaderboards right now — check back when events are underway" |
| Empty (filtered) | "No leaderboards match your filters" + "Clear filters" link |
| Error | Retry button with error message |
| Guest | Full list visible; Invest Points button and Your Rank row hidden entirely (not shown, not redirecting) |

### 7.2 Leaderboard Detail Screen

| State | Behaviour |
|---|---|
| Loading | Skeleton stat row + 5 skeleton ranking rows |
| Awaiting activation (below threshold) | Rankings table hidden; activation threshold banner shown: "Leaderboard activates once N participants register" |
| Active | Full rankings table with real-time updates |
| Completed | Final standings with podium treatment; invest actions hidden |
| Error | Retry button; back arrow always functional |

---

## 8. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap (Auth) | Opens Account Actions Popup |
| "Login" button (status bar) | Tap (Guest) | Navigates to `/login` |
| Event Type chip | Tap | Single-selects type; re-fetches list |
| Status chip | Tap | Toggles status filter; re-fetches list |
| Tag chip | Tap | Toggles tag filter; re-fetches list |
| Leaderboard Event Card | Tap | Navigates to Leaderboard Detail Screen |
| "Invest Points →" (card) | Tap (Auth + registered) | Opens Points Investment Sheet |
| Leaderboard list | Pull down | Pull-to-refresh |
| Leaderboard list | Scroll to bottom | Loads next page |
| Back arrow (detail nav bar) | Tap | Pops back to Leaderboards list |
| Share icon (detail nav bar) | Tap | Opens native share sheet |
| Stat block (detail) | Tap | Scale bounce animation |
| "Invest Points →" (banner) | Tap (Auth + registered) | Opens Points Investment Sheet |
| Ranking row avatar (solo) | Tap | That user's User Profile Page |
| Ranking row avatar (team) | Tap | Team Detail Sheet |
| Ranking row | Tap (solo) | That user's User Profile Page |
| Ranking row | Tap (team) | Team Detail Sheet |
| "Standings updated" banner | Tap | Scrolls to top + triggers pull-to-refresh |
| Rankings list | Pull down | Pull-to-refresh rankings |
| Rankings list | Scroll to bottom | Loads next 50 rankings |
| Ranking row avatar (solo) | Tap | That user's User Profile Page |
| Ranking row avatar (team) | Tap | Team Detail Sheet |
| Amount stepper −/+ | Tap | Decrements / increments by the event-configured step amount |
| Amount value | Tap | Opens numeric keyboard for direct entry |
| Cancel (investment sheet) | Tap | Dismisses sheet |
| Invest N pts | Tap | Opens confirmation dialog |
| Confirm (dialog) | Tap | Submits investment; sheet dismisses on success |

---

## 9. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Leaderboards list | "No active leaderboards right now" | Retry button |
| Leaderboards list (filtered) | "No leaderboards match your filters" + clear link | Retry button |
| Rankings table (awaiting threshold) | Activation threshold banner | Retry button |
| Rankings table (active/completed) | "No participants yet" | Retry button |
| Points balance (investment sheet) | — | Inline "Could not load balance" + retry link |

---

## 10. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching live content shapes):

- Leaderboard Event Card: full-width rect (16:9) + 3 pill skeletons (Format Badge + Type Pill + Status Pill) + 2 text line skeletons + stat line skeleton.
- Leaderboard Detail — stat row: 3 square stat block skeletons.
- Leaderboard Detail — ranking rows: avatar circle (36 dp) + 2 text line skeletons + score block, repeated 5×.
- "Load more" at list bottom: small inline spinner.

No full-page spinners; pull-to-refresh uses the native platform refresh indicator.
