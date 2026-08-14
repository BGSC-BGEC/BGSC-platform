# Hall of Fame — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/hall-of-fame` (`src/app/(drawer)/hall-of-fame.tsx`)
**Visibility:** Public (Guest + Authenticated)

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│     Page Header — "Hall of Fame"    │  ← below status bar
├─────────────────────────────────────┤
│   Filter Bar  [Year ▼] [Type ▼]    │  ← sticky horizontal filter row
│   [Sport ▼] [Sponsor ▼]            │
├─────────────────────────────────────┤
│                                     │
│       Category Sections (scroll)    │  ← scrollable content
│                                     │
│  ┌────────────────────────────────┐ │
│  │  League Winners                │ │
│  ├────────────────────────────────┤ │
│  │  Highlight Event Winners       │ │
│  ├────────────────────────────────┤ │
│  │  Challenge Legends             │ │
│  ├────────────────────────────────┤ │
│  │  Sponsor Champions             │ │
│  └────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header. Behaviour identical to Home Page:

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (≡) | Tap → opens the Side Drawer overlay |
| Center | BGSC logo (image) | Non-interactive |
| Right — Guest | "Login" text button | Tap → navigates to `/login` |
| Right — Authenticated | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

---

## 3. Page Header

- Full-width header area directly below the status bar.
- Title: **"Hall of Fame"** — bold, 24 sp, centered.
- Subtitle: *"Celebrating our champions"* — 14 sp muted text, centered.
- Optional decorative element: trophy icon or gradient banner background using brand accent colours.
- Static — no tap interaction.

---

## 4. Filter Bar

Horizontally scrollable row of dropdown filter chips, pinned below the page header. Filters narrow the winner cards displayed across all category sections.

| Filter | Type | Options |
|---|---|---|
| Year | Single-select dropdown | All Years (default) · 2024 · 2023 · 2022 · … (dynamically populated from data) |
| Type | Single-select dropdown | All Types (default) · League · Highlight · Challenge · Sponsor |
| Sport | Single-select dropdown | All Sports (default) · Cricket · Football · Basketball · Badminton · Valorant · CS2 · … (populated from event tags) |
| Sponsor | Single-select dropdown | All Sponsors (default) · list of all sponsors (current + archived) |

- Active filter: filled chip with accent colour and selected value label.
- Inactive filter: outlined chip with placeholder label.
- Tap any chip → opens a bottom sheet with the option list; single-select; selecting an option closes the sheet and applies the filter immediately.
- Tap an active chip's clear (×) icon → resets that filter to "All".
- Filters compound — selecting Year: 2024 + Type: League shows only 2024 league winners.
- When filters result in no matches, each empty section shows inline "No results" text instead of hiding the section entirely.

---

## 5. Category Sections

Each category is a collapsible section with a header and a horizontal or vertical list of winner cards. Sections appear in the following order:

### 5.1 League Winners

**Section header:** "League Winners" with a trophy icon.

- Displays winners of league events grouped by sport/esport.
- **Layout:** Horizontal carousel of winner cards. Swipe left/right to browse.
- Each sub-group (per sport) has a small label above its card cluster (e.g., "Cricket", "Valorant").
- If a sport has multiple seasons/years, cards are ordered newest-first within that group.

### 5.2 Highlight Event Winners

**Section header:** "Highlight Event Winners" with a star icon.

- Displays winners of special/highlight events (e.g., Waves, one-off tournaments).
- **Layout:** Horizontal carousel of winner cards.
- Ordered by date, newest-first.

### 5.3 Challenge Legends

**Section header:** "Challenge Legends" with a flame icon.

- Displays users who achieved Legend-level difficulty in the challenge system.
- **Layout:** Vertical list of legend cards (slightly different card variant — see §6.2).
- Ordered by achievement date, newest-first.

### 5.4 Sponsor Champions

**Section header:** "Sponsor Champions" with a crown icon.

- The most visually rich section; broken into sub-sections:

#### 5.4.1 Top Sponsors

- Cards for the winning sponsor per semester/year.
- Card shows: Sponsor name, logo, total fan count, tenure period, "Champion" badge.
- Horizontal carousel.

#### 5.4.2 MVP Contributors

- Cards for top individual fan-earners per sponsor.
- Card shows: User avatar, display name, sponsor badge, total fans contributed, rank (#1, #2, #3).
- Horizontal carousel.

#### 5.4.3 Sponsor Dynasty Timeline

- A vertical visual timeline showing consecutive sponsor wins across semesters/years.
- Each node: Sponsor logo + semester label + fan count.
- Connected by a vertical line with accent colour highlights for consecutive wins (dynasty streaks).
- Scroll vertically within the section; the timeline can be long for sponsors with multi-semester dominance.

```
  ┌──────────────────────────────────┐
  │  👑 Sponsor Champions            │
  ├──────────────────────────────────┤
  │                                  │
  │  Top Sponsors (carousel →)       │
  │  [Card] [Card] [Card]           │
  │                                  │
  │  MVP Contributors (carousel →)   │
  │  [Card] [Card] [Card]           │
  │                                  │
  │  Dynasty Timeline                │
  │  ● Spring 2024 — Team Alpha     │
  │  │  Fans: 1,240                  │
  │  ● Fall 2023 — Team Alpha       │
  │  │  Fans: 980   ★ 2-sem streak  │
  │  ● Spring 2023 — Team Beta      │
  │  │  Fans: 1,102                  │
  │  …                               │
  └──────────────────────────────────┘
```

---

## 6. Winner Cards

### 6.1 Standard Winner Card (League / Highlight / Sponsor)

```
┌──────────────────────────────────────┐
│                                      │
│  🏆  [Trophy / Category Icon]        │
│                                      │
│  Event Name (bold, 16 sp)            │
│  Winner: Team/Player Name            │
│                                      │
│  Date (muted, 12 sp)                 │
│                                      │
│  "Winner's quote here…"             │
│  (italic, 13 sp, max 2 lines)       │
│                                      │
│  [Sponsor badge — if applicable]     │
│                                      │
│  [Share ↗]                           │
└──────────────────────────────────────┘
```

- **Card dimensions:** Fixed width ~280 dp in carousels; full-width in vertical lists.
- **Trophy / Category Icon:** Colour-coded per category (gold for league, silver for highlight, bronze for challenge).
- **Event Name:** Bold, 16 sp. Max 2 lines with ellipsis.
- **Winner name:** 14 sp, regular weight. Shows team name for team events, individual name for solo events.
- **Date:** 12 sp muted text. Format: "Month Year" (e.g., "March 2024").
- **Quote:** Optional. Italic, 13 sp, max 2 lines with ellipsis. Sourced from winner data; if no quote exists, section is hidden.
- **Sponsor badge:** Small sponsor logo pill shown if the winner was affiliated with a sponsor at the time. Hidden if not applicable.
- **Share button (↗):** Bottom-right corner. Tap → generates a shareable card image (winner card rendered as a branded image with BGSC watermark) and opens the native share sheet. The shareable image includes the event name, winner, date, and BGSC branding.
- **Card tap (full card):** Opens a detail bottom sheet with the full winner information (full quote, event details link, team roster if applicable).

### 6.2 Legend Card (Challenge Legends)

```
┌──────────────────────────────────────┐
│  [Avatar 48dp]  Display Name         │
│                 @username            │
│                                      │
│  🔥 Challenge: "Challenge Title"     │
│  Achieved: March 2024               │
│                                      │
│  [Sponsor badge]         [Share ↗]   │
└──────────────────────────────────────┘
```

- **Avatar:** 48 dp circular. Tap → User Profile Page (Authenticated) or `/login` (Guest).
- **Display name / @username:** Bold name, muted username below.
- **Challenge title:** The legend-level challenge that was completed.
- **Achieved date:** Month Year format.
- **Sponsor badge + Share:** Same behaviour as standard winner card.

---

## 7. Section Collapse / Expand

- Each category section header is tappable.
- Tap → toggles collapse/expand with a smooth height animation.
- Collapsed state shows only the section header with a chevron (▸).
- Expanded state shows full content with a chevron (▾).
- **Default state:** All sections expanded on first load.

---

## 8. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap (Auth) | Opens Account Actions Popup |
| "Login" button (status bar) | Tap (Guest) | Navigates to `/login` |
| Filter chip | Tap | Opens filter bottom sheet |
| Filter chip clear (×) | Tap | Resets that filter to "All" |
| Section header | Tap | Toggles section collapse/expand |
| Winner card (full card) | Tap | Opens winner detail bottom sheet |
| Winner card share (↗) | Tap | Generates shareable image + opens share sheet |
| Legend card avatar | Tap (Auth) | Opens user's Profile Page |
| Legend card avatar | Tap (Guest) | Redirects to `/login` |
| Sponsor dynasty timeline node | Tap | Scrolls to that sponsor's Top Sponsor card |
| Carousel | Horizontal swipe | Browses cards within a category |
| Page content | Vertical scroll | Scrolls through all category sections |
| Page content | Pull down | Triggers pull-to-refresh |

---

## 9. Winner Detail Bottom Sheet

**Trigger:** Tap on any winner card.
**Appearance:** Bottom sheet with handle, covers ~60% of screen height.

### Layout

```
┌──────────────────────────────────────┐
│  ━━━  (drag handle)                  │
│                            [Close ✕] │
├──────────────────────────────────────┤
│                                      │
│  🏆  Event Name (bold, 20 sp)        │
│                                      │
│  Category: League / Highlight / …    │
│  Date: March 15, 2024               │
│                                      │
│  Winner: Team/Player Name            │
│                                      │
│  Team Roster (if team event):        │
│    • Player 1 (Captain)              │
│    • Player 2                        │
│    • Player 3                        │
│    …                                 │
│                                      │
│  "Full winner's quote displayed      │
│   here without truncation."          │
│                                      │
│  Sponsor: [Logo] Sponsor Name        │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [View Event Details]        │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Share ↗]                           │
│                                      │
└──────────────────────────────────────┘
```

- **View Event Details:** Outlined button. Tap → navigates to the Event Details page for that event (if the event still exists in the system). Disabled with "Event archived" label if the event has been removed.
- **Share:** Full-width outlined button at the bottom. Same shareable card behaviour as the card-level share.
- **Dismiss:** Swipe down or tap close (✕) or tap backdrop scrim.

---

## 10. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Entire page (no data) | Illustration (empty trophy case) + "No champions yet — check back soon!" | Retry button with error message |
| League Winners section | "No league winners recorded yet" (inline text) | Retry inline |
| Highlight Event Winners section | "No highlight event winners yet" | Retry inline |
| Challenge Legends section | "No legends yet — will you be the first?" | Retry inline |
| Sponsor Champions section | "No sponsor champions yet" | Retry inline |
| Filtered results (any section) | "No results match your filters" | — |

---

## 11. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching the shape of live content) rather than spinners:

- **Filter bar:** Skeleton chips (4 rounded rectangles).
- **Section headers:** Skeleton text block per section.
- **Winner cards:** 3 skeleton cards per carousel (rounded rectangle with inner shimmer lines for title, name, date).
- **Legend cards:** 3 skeleton rows (circle + text lines).
- **Dynasty timeline:** 3 skeleton nodes (circles connected by a vertical line with shimmer text beside each).
- **"Load more" at section end:** Small inline spinner if paginated data is being fetched.
