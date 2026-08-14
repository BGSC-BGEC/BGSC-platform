# Point System & Challenge Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/points` (`src/app/(drawer)/points.tsx`)
**Drill-in Routes:**
- `/(stack)/challenge/[id]` — Challenge Detail Screen
- `/(stack)/challenge/[id]/submission` — Submission Screen

**Visibility:** Authenticated only (guests redirected to `/login`)

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│   Tab Bar  [Points | Challenges]    │  ← sticky below status bar
├─────────────────────────────────────┤
│                                     │
│         Active Tab Content          │  ← scrollable
│                                     │
└─────────────────────────────────────┘
```

- Status bar fixed at top.
- Tab bar sticks directly below the status bar and does not scroll away.
- Each tab maintains its own independent scroll position.
- Unauthenticated users who reach this route are immediately redirected to `/login`. The return path is preserved so the user lands back here after sign-in.

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header.

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (≡) | Tap → opens the Side Drawer overlay |
| Center | "Points & Challenges" wordmark | Non-interactive; confirms current module context |
| Right — Guest | "Login" text button | Tap → navigates to `/login` |
| Right — Authenticated | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

**Theme:** Background colour and icon/text colour follow the active colour scheme (light/dark) from `themeStore`.

---

## 3. Tab Bar

Two tabs in a horizontal segmented control pinned below the status bar.

| Index | Label | Icon (suggested) |
|---|---|---|
| 0 | Points | Coin / wallet outline |
| 1 | Challenges | Lightning bolt outline |

Active tab: accent-coloured label and bottom underline indicator. Inactive: muted. Switching tabs is instant (no additional network call if the tab data was already loaded).

---

## 4. Tab 0 — Points Dashboard

```
┌─────────────────────────────────────┐
│  ┌───────────────────────────────┐  │
│  │      Balance Card             │  │
│  │   1,450 pts                   │  │
│  │   [Earn more ↓]  [Store →]   │  │
│  └───────────────────────────────┘  │
│                                     │
│  How to Earn                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │Event│ │Chall│ │Engag│ │Spons│  │
│  └─────┘ └─────┘ └─────┘ └─────┘  │
│                                     │
│  How to Spend                       │
│  ┌─────┐ ┌─────┐                   │
│  │Store│ │Board│                   │
│  └─────┘ └─────┘                   │
│                                     │
│  Transaction History                │
│  [Filter: All | Earned | Spent | Refunded]
│  ┌───────────────────────────────┐  │
│  │  Transaction Row              │  │
│  └───────────────────────────────┘  │
│  …                                  │
└─────────────────────────────────────┘
```

### 4.1 Balance Card

Prominent card at the top of the tab; always the first visible element on load.

```
┌──────────────────────────────────────────┐
│  Your Points                             │
│                                          │
│         1,450 pts                        │
│         (large, bold, accent colour)     │
│                                          │
│  [Earn more ↓]          [Go to Store →]  │
└──────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| Label | "Your Points" in muted 12 sp |
| Balance | 32 sp bold accent-coloured number. Refreshes via real-time update (see §10); also updates optimistically after any in-session spend. |
| "Earn more ↓" | Outlined button; smooth-scrolls to the How to Earn tiles below |
| "Go to Store →" | Filled primary button; navigates to `/(drawer)/store` |

### 4.2 How to Earn (Earning Sources)

Section header "How to Earn" followed by a horizontally scrollable row of icon-tiles. Informational only — no tap interaction. Each tile:

```
┌─────────────┐
│   [Icon]    │
│  Source     │
│  name       │
│             │
│  varies     │
│  per event  │
└─────────────┘
```

| Tile | Icon | Subtitle |
|---|---|---|
| Event Participation | Calendar | Awarded on registration and completion |
| Challenge Completion | Lightning bolt | Awarded when submission is approved |
| Platform Engagement | Users / heart | Posts, friend invites, newsletter opens |
| Sponsor Bonus | Trophy | Bonus for winning events as a sponsor affiliate |

Actual point values are configured per-event by admin via the Web Console scoring engine (spec §5.15.3). Tiles show "varies per event" rather than hardcoded values.

### 4.3 How to Spend (Spending Sources)

Same tile layout as §4.2, with a "How to Spend" section header.

| Tile | Icon | Subtitle |
|---|---|---|
| Store Redemption | Shopping bag | Redeem for merch and indie games |
| Leaderboard Investment | Chart up | Invest points to boost your rank |

> **Note:** Full leaderboard investment flow is detailed in the Leaderboards Page spec (§6). The Points Dashboard tile is informational — tapping navigates to `/(drawer)/leaderboards`.

### 4.4 Transaction History

#### Filter Row

Single horizontally scrollable row of single-select chips above the list. Default: **All**.

| Chip | Filters to |
|---|---|
| All | All transactions |
| Earned | `type = earn` |
| Spent | `type = spend` |
| Refunded | `type = refund` |

Selecting a chip re-fetches the list with that filter applied. If the user taps the currently active single-select chip, it reverts to **All** rather than leaving zero chips selected.

#### Transaction Row

```
┌──────────────────────────────────────────┐
│  [Source Icon]  Description              │
│                 Reference context        │
│                            +50 pts       │
│                 12 Jun 2026, 14:32       │
└──────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| Source icon | Small icon matching source type: calendar (event), lightning (challenge), bag (store), chart (leaderboard) |
| Description | e.g. "Event Participation — Offside S3" or "Challenge Completed — Build a Platformer" |
| Reference context | Muted 12 sp. Event name, challenge name, or store item tied to this transaction |
| Amount | Right-aligned. `+N pts` green for earn/refund; `−N pts` red for spend |
| Timestamp | Muted 12 sp absolute date + time |
| Row tap | Navigates to the related entity (event detail / challenge detail / store order) if it still exists; if the target entity no longer exists, shows snackbar "This [event/challenge] is no longer available" |

#### Pagination

- Initial load: 30 most recent transactions.
- Scroll to bottom → loads next 30.
- Pull-to-refresh → re-fetches from most recent.

---

## 5. Tab 1 — Challenge Browser

```
┌─────────────────────────────────────┐
│  [Domain row chips]                 │  ← sticky filter bar
│  [Difficulty row chips]             │
├─────────────────────────────────────┤
│                                     │
│  Challenge Cards (scroll)           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Challenge Card             │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Challenge Card             │   │
│  └─────────────────────────────┘   │
│  …                                 │
└─────────────────────────────────────┘
```

### 5.1 Filter Bar

Two rows of chips pinned directly below the tab bar (sticky). Both rows are horizontally scrollable.

#### Row 1 — Domain

Single-select. Default: **All**.

| Chip | `domain` value |
|---|---|
| All | (no filter) |
| Sports | `sports` |
| Esports | `esports` |
| Game Dev | `game_dev` |
| General | `general` |

#### Row 2 — Difficulty

Multi-select. Default: all four selected (no filter applied). At least one chip must remain selected.

| Chip | Colour |
|---|---|
| Easy | Green |
| Medium | Yellow / amber |
| Hard | Orange |
| Legend | Red / gold gradient |

Active chips: filled accent background. Inactive: outlined.

### 5.2 Challenge Card

```
┌──────────────────────────────────────────┐
│  [Domain Pill]          [Difficulty Pill] │
│                                          │
│  Challenge Title (bold, 2 lines max)     │
│                                          │
│  Short description (muted, 2 lines max)  │
│                                          │
│  ──────────────────────────────────────  │
│  👥 Team: up to N    ⏱ Time: X days     │
│  ⭐ +250 pts on completion               │
│                                          │
│  [Legend only]  🏆 Hall of Fame eligible │
│  [If accepted]  ✅ In Progress           │
└──────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| Domain pill | Coloured capsule: Sports = green, Esports = blue, Game Dev = purple, General = grey |
| Difficulty pill | Colour matches Row 2 filter chips |
| Title | 16 sp bold, 2-line clamp with ellipsis |
| Description | 13 sp muted, 2-line clamp |
| Team limit | `👥 Solo` when `team_limit = 1`; `👥 Up to N` for team play |
| Time limit | `⏱ N days` or `⏱ No limit`. Digital challenges show `⏱ Revealed on accept` (spec §5.7) |
| Award points | `⭐ +N pts on completion` |
| Hall of Fame badge | `🏆 Hall of Fame eligible` — Legend-tier only (spec §5.7). Completing a Legend-tier challenge automatically enrolls the user in the Hall of Fame "Challenge Legends" category; enrollment is triggered on admin approval of the submission. |
| In-progress badge | `✅ In Progress` — shown when the viewing user has accepted this challenge but not yet submitted (see §9 for full in-progress state spec) |

> **Digital challenge visibility note:** Only the time limit is hidden pre-accept for Digital challenges. Title and description are always visible on the card and detail screen.
| Card tap | Navigates to **Challenge Detail Screen** `/(stack)/challenge/[id]` |

---

## 6. Challenge Detail Screen

Full-screen stack screen navigated to from any Challenge Card.

### 6.1 Page Structure

```
┌──────────────────────────────────────┐
│  [← Back]  Challenge Title   [Share] │  ← custom nav bar
├──────────────────────────────────────┤
│  [Domain Pill]      [Difficulty Pill] │
│  Challenge Title (24 sp, bold)        │
│  Full description (rich text, scrolls)│
├──────────────────────────────────────┤
│  Stat Row: Team · Time · Points       │
├──────────────────────────────────────┤
│  [Legend only] Hall of Fame banner    │
├──────────────────────────────────────┤
│  Resource Links (if any)              │
│  ┌────────────────────────────────┐  │
│  │  [Link icon]  Resource Name →  │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  Challenge Status pill                │
│  Active / Completed / Archived        │
├──────────────────────────────────────┤
│  Action Area (Authenticated only)     │
│  See §6.5                            │
└──────────────────────────────────────┘
```

### 6.2 Custom Nav Bar

| Slot | Component | Behaviour |
|---|---|---|
| Left | Back arrow (←) | Pops back to Challenge Browser |
| Center | Challenge title (truncated with ellipsis) | Non-interactive |
| Right | Share icon (↗) | Opens native share sheet with deep-link to this challenge |

### 6.3 Stat Row

Three evenly spaced stat blocks below the description.

| Stat | Examples |
|---|---|
| Team | `Solo` / `Up to 4` |
| Time | `7 days` / `No limit` / `Revealed on accept` (Digital, pre-accept only) |
| Award | `+250 pts` |

> **Post-accept time reveal:** After a Digital challenge is accepted, this stat row updates to show the actual time limit. It no longer shows "Revealed on accept".

### 6.4 Resource Links

List of help links / guides attached by the challenge creator. Each row:

```
┌──────────────────────────────────────┐
│  [Link icon]  Resource Name       →  │
└──────────────────────────────────────┘
```

Tap → opens URL in in-app browser. Section is hidden entirely when no resource links exist.

### 6.5 Action Area (Authenticated only)

The bottom-fixed action area renders differently based on the user's current state with this challenge.

| User state | UI |
|---|---|
| Not yet accepted; challenge Active | `[Accept Challenge]` filled primary button |
| Accepted, proof not yet submitted | `[View Submission]` outlined button + in-progress pill (see §9) |
| Submitted, under admin review | `[View Submission]` outlined button + "Under Review" status pill |
| Submission rejected by admin | `[View Submission]` outlined button + red "Rejected" pill + "Reason: [admin note if provided]" muted text below |
| Completed and points awarded | Disabled green `[Completed ✓]` + `+N pts earned` label |
| Challenge Archived or globally Completed | Greyed "Challenge closed" notice — no action available |

Tapping **Accept Challenge** → opens **Accept Challenge Sheet** (§7).  
Tapping **View Submission** → navigates to **Submission Screen** (§8).

---

## 7. Accept Challenge Sheet

**Trigger:** "Accept Challenge" button in the Challenge Detail Screen action area (§6.5).

**Conditions:** User must be authenticated and the challenge status must be Active. Sheet is unavailable if challenge is Archived or Completed.

**Appearance:** Bottom sheet with drag handle, covers ~65% of screen height.

```
┌──────────────────────────────────────┐
│  ━━━  (drag handle)                  │
│  Accept Challenge         [Close ✕]  │
├──────────────────────────────────────┤
│  [Domain Pill]  [Difficulty Pill]    │
│  Challenge Name (bold)               │
│                                      │
│  👥 Team: up to N                    │
│  ⭐ Award: +250 pts on completion     │
│                                      │
│  ⏱ Time limit: 7 days               │  ← Physical: shown always
│  ⏱ Time limit: 7 days               │  ← Digital: REVEALED HERE (spec §5.7)
│                                      │
│  [Physical only]                     │
│  ⚠️ Requires dedicated space / time  │
│                                      │
│  [Legend only]                       │
│  🏆 Completing this earns a          │
│     Hall of Fame entry               │
│                                      │
├──────────────────────────────────────┤
│  [Cancel]   [Confirm — Start →]      │
└──────────────────────────────────────┘
```

### 7.1 Digital Challenge Time Reveal

Per spec §5.7: "Digital (timeline-based, details revealed upon acceptance)." The time limit row is hidden on the Challenge Card and the Challenge Detail stat row for Digital challenges. This sheet is the first place the user sees it. The reveal is intentional — do not pre-expose it.

> **Live fetch note:** The time limit shown in this sheet is fetched live when the sheet opens, not served from cached card data, to prevent stale display.

### 7.2 Actions

| Button | Behaviour |
|---|---|
| Cancel | Dismisses sheet. No state change. |
| Confirm — Start | API call → on success: sheet closes, Challenge Detail action area updates to "View Submission" state, snackbar "Challenge accepted! Good luck." On failure: snackbar with error, sheet stays open. |

### 7.3 States

| State | Behaviour |
|---|---|
| Default | Full sheet as above |
| Confirm in-flight | "Confirm" button shows spinner; disabled. Cancel disabled. |
| Error | Snackbar; sheet stays open for retry |

---

## 8. Challenge Submission Screen

**Route:** `/(stack)/challenge/[id]/submission`

**Trigger:** "View Submission" button in Challenge Detail action area (§6.5). Only reachable after accepting the challenge.

**Appearance:** Full-screen stack screen.

```
┌──────────────────────────────────────┐
│  [← Back]  Submission                │  ← custom nav bar
├──────────────────────────────────────┤
│  Challenge: [Name]  [Difficulty Pill] │
│  Status: In Progress / Under Review  │
│  Deadline: 19 Jun 2026, 18:00        │
│           or "No deadline"           │
│  [Countdown timer if deadline exists]│
├──────────────────────────────────────┤
│  Proof / Evidence                    │
│                                      │
│  ┌───────┐ ┌───────┐ ┌───────┐  [+] │
│  │ img 1 │ │ img 2 │ │ vid 1 │      │
│  └───────┘ └───────┘ └───────┘      │
│  (upload preview grid, reorderable)  │
│                                      │
│  [📷 Camera]  [🖼 Gallery]  [🔗 Link] │
├──────────────────────────────────────┤
│  Notes (optional)                    │
│  ┌────────────────────────────────┐  │
│  │  Free-text textarea            │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  [Submit for Review]                 │
└──────────────────────────────────────┘
```

### 8.1 Header

| Element | Detail |
|---|---|
| Challenge name | Bold 16 sp; non-interactive |
| Difficulty pill | Same colour as challenge card |
| Status pill | "In Progress" (amber) or "Under Review" (blue) |
| Deadline | Absolute date + time. If `time_limit` is set, derived from `accepted_at + time_limit`. "No deadline" if no time limit. |
| Countdown | `HH:MM:SS` or `N days N hours` countdown when deadline exists and is <72 hours away. Turns red inside 1 hour. Hidden if more than 72 hours remain. |

### 8.2 Proof Upload

- Supports photo (JPG/PNG/WebP), video (MP4/MOV), or a URL link per spec §15.1.
- Preview grid: thumbnails in a 3-column grid. Tap a thumbnail → full-screen preview. Long-press → "Remove" action.
- `[+]` button at end of grid → opens upload picker (same three options as the row of buttons below).
- **Camera:** opens in-app camera; captured media added to grid.
- **Gallery:** multi-select from device photos/videos; selected items added to grid.
- **Link:** text input dialog for a URL (e.g. GitHub repo, YouTube video). Saved links appear as link cards in the grid.
- Multiple uploads allowed. No explicit limit specified; consistent with post attachment behaviour (spec §6.5 Media Selection).
- **File size limits (spec §15.1):** images ≤10 MB, videos ≤50 MB. Client-side validation rejects oversized files before upload with an inline error message.

### 8.3 Notes

Optional free-text field for context, explanation, or links that don't fit the grid. 500-character soft limit with a character counter.

### 8.4 Submit for Review

- Button disabled until at least one proof item (upload or link) has been added.
- Tap → confirmation dialog: "Submit proof for [Challenge Name]? You can update your submission until an admin reviews it." **[Cancel]** / **[Submit]**.
- On submit → API call → on success: status pill changes to "Under Review"; submit button replaced by "Awaiting review" greyed notice; snackbar "Submission sent!"; user receives in-app notification when admin approves/rejects.
- If already Under Review: proof grid and notes are still editable (re-submission replaces previous); Submit button label changes to "Update Submission".

### 8.5 Withdrawal Policy

**Withdrawal not supported.** Once a challenge is accepted, it cannot be un-accepted. Once submitted, users can only update their submission (while status is Under Review) — they cannot retract it entirely.

### 8.6 States

| State | Behaviour |
|---|---|
| In Progress | Full editing UI |
| Under Review | Grid and notes still editable; button reads "Update Submission" |
| Completed | All fields read-only; banner "Approved — +N pts awarded on [date]" |
| Rejected | Banner "Submission rejected — [reason if provided]"; fields re-enabled; button reads "Resubmit" |

> Cross-reference §8.5 (Withdrawal Policy): users cannot retract a submission, only update it while Under Review.

---

## 9. In-Progress Challenge State

When a user has accepted a challenge but not yet submitted (or has submitted but awaits review), that "in-progress" status surfaces across three UI locations consistently.

### 9.1 Challenge Card Badge (Tab 1 Browser)

A `✅ In Progress` badge row appears at the bottom of the card below the award-points line (see §5.2). Badge is accent-coloured. Tapping the card still navigates to Challenge Detail.

### 9.2 Challenge Detail Action Area (§6.5)

The action area shows `[View Submission]` outlined button. An amber "In Progress" status pill appears directly above the button. If a deadline exists, a compact countdown (`⏱ Xs left`) is shown beside the pill.

### 9.3 Points Dashboard — Active Challenges Banner

A horizontal scroll strip titled "Your Active Challenges" appears between the How to Spend tiles and the Transaction History section when the user has ≥1 in-progress challenge. Each strip item is a compact card:

```
┌────────────────────────────────┐
│  [Difficulty Pill]             │
│  Challenge Title (1 line)      │
│  ⏱ 3 days left  ⭐ +250 pts   │
└────────────────────────────────┘
```

For challenges with no time limit, the compact card shows `⏱ No deadline` instead of a countdown.

Tap → navigates to that challenge's Submission Screen directly.

Strip is hidden entirely when no challenges are in progress.

---

## 10. Real-Time Points Balance Updates

Points are awarded asynchronously (after admin approval of a challenge submission, or after event scoring runs). The balance shown in the Balance Card (§4.1) must update without requiring the user to manually refresh.

**Mechanism:** Firebase Cloud Messaging (FCM) silent background push → React Query cache invalidation → Balance Card re-renders with new value. Consistent with the low-velocity update pattern described in platform spec §16.3.

**Visual feedback on update:**

1. Balance number briefly scales up (pop animation) when it changes.
2. A transient snackbar appears: "+N pts — [reason, e.g. 'Offside S3 participation']". Auto-dismisses after 3 s.
3. The new transaction appears at the top of the Transaction History list on next scroll or pull-to-refresh.

**Spend path:**

- **Leaderboard Investment:** Balance updates optimistically on confirm and reconciles on API response. If the API returns an error, the balance reverts and a snackbar shows the failure reason.
- **Store Redemption:** Balance waits for API confirmation before deducting (item stock must be confirmed server-side first). If the API returns an error (e.g., item out of stock), the balance is not deducted and a snackbar shows the failure reason.

---

## 11. Interaction Summary Table

> **[System] entries** are triggered by external events (FCM push), not user gestures.

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap (Auth) | Opens Account Actions Popup |
| Tab: Points | Tap | Switches to Points Dashboard |
| Tab: Challenges | Tap | Switches to Challenge Browser |
| Balance card — "Earn more" | Tap | Smooth-scrolls to How to Earn tiles |
| Balance card — "Go to Store" | Tap | Navigates to `/(drawer)/store` |
| Earning / Spending tile | Tap | No action (informational) |
| Transaction filter chip | Tap | Single-selects filter; re-fetches list |
| Transaction row | Tap | Navigates to related entity |
| Transaction list | Pull down | Pull-to-refresh |
| Transaction list | Scroll to bottom | Loads next 30 transactions |
| Domain filter chip (Tab 1) | Tap | Single-selects domain; re-fetches challenges |
| Difficulty filter chip (Tab 1) | Tap | Toggles difficulty; re-fetches challenges |
| Challenge Card | Tap | Navigates to Challenge Detail Screen |
| Active Challenges strip card | Tap | Navigates directly to Submission Screen |
| Back arrow (detail nav bar) | Tap | Pops back to Challenge Browser |
| Share icon (detail nav bar) | Tap | Opens native share sheet with deep-link |
| Resource link row | Tap | Opens URL in in-app browser |
| "Accept Challenge" (detail) | Tap | Opens Accept Challenge Sheet (§7) |
| Cancel (accept sheet) | Tap | Dismisses sheet; no state change |
| "Confirm — Start" (accept sheet) | Tap | Submits acceptance; detail action row updates |
| "View Submission" (detail) | Tap | Navigates to Submission Screen (§8) |
| Submission thumbnail | Tap | Opens full-screen media preview |
| Submission thumbnail | Long-press | "Remove" action menu |
| Camera button (submission) | Tap | Opens in-app camera |
| Gallery button (submission) | Tap | Opens multi-select gallery picker |
| Link button (submission) | Tap | Opens URL input dialog |
| "Submit for Review" | Tap | Opens submit confirmation dialog |
| Submit — Confirm | Tap | Submits proof; status updates to Under Review |
| Submit — Cancel | Tap | Dismisses dialog; no state change |
| Balance card | FCM silent push [System] | Balance number updates with pop animation + snackbar |
| Challenge browser | Pull down | Pull-to-refresh |
| Challenge browser | Scroll to bottom | Loads next page of challenges |

---

## 12. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Balance card | — | "Could not load balance" + retry link inline |
| How to Earn / Spend tiles | — | Section hidden; no error surface (informational only) |
| Active Challenges strip | Strip hidden | Strip hidden |
| Transaction list | "No transactions yet — earn points by joining events or completing challenges." | Retry button |
| Transaction list (filtered) | "No [Earned/Spent/Refunded] transactions yet." + "Clear filter" link | Retry button |
| Challenge browser | "No challenges available right now — check back soon." | Retry button |
| Challenge browser (filtered) | "No challenges match your filters." + "Clear filters" link | Retry button |
| Challenge detail | — | Retry button; back arrow always functional |
| Resource links | Section hidden | — |
| Submission screen | — | Retry button; back arrow functional |
| Proof grid | Placeholder: "Add photos, videos, or a link as proof" | — |
| Proof grid (Completed, no proof) | "No proof submitted" placeholder (read-only) | — |

---

## 13. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching live content shapes). No full-page spinners anywhere. Pull-to-refresh uses the native platform refresh indicator.

| Location | Skeleton |
|---|---|
| Balance Card | Full-width rect (~120 dp tall) shimmer |
| How to Earn tiles | 4 × square tile skeletons in a horizontal row |
| How to Spend tiles | 2 × square tile skeletons |
| Active Challenges strip | 2 × compact card skeletons (140 dp × 80 dp) |
| Transaction row | Source icon circle (32 dp) + 2 text lines + right-aligned amount block, repeated 3× |
| Challenge Card | Full-width rect (~160 dp) with 2 pill skeletons + 3 text line skeletons + stat line skeleton |
| Challenge Detail | Title skeleton (2 lines) + stat row (3 blocks) + 2 resource row skeletons |
| Submission Screen header | 2 text line skeletons + status pill skeleton + deadline line skeleton |
| Submission proof grid | 3 × thumbnail rect skeletons in a row |
