# Sponsor & Newsletters Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/sponsors` (`src/app/(drawer)/sponsor.tsx`)
**Visibility:** Mixed (Public sections & Authenticated-only sections)

---

## 1. Page Structure Overview

The page is a vertically scrolling dashboard. Sections stack below each other like visible cards. 

```text
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│                                     │
│ ▼ MAIN SCROLL VIEW (Vertical)       │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    User Affiliation (Auth)    │  │
│  │  • Current Sponsor Badge      │  │
│  │  • Personal Stats & Impact    │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Active Sponsors (Public)   │  │
│  │  • [ Horizontal Carousel ]    │  │
│  │  • Fan counts & Countdowns    │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Sponsor Leaderboard (Pub)  │  │
│  │  • Ranked List 1, 2, 3...     │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Sponsor Prizes (Public)    │  │
│  │  • Prize Pool details         │  │
│  │  • Claim Status               │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Newsletters (Auth)         │  │
│  │  • Sub/Unsub Toggles          │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Sponsor Archive (Public)   │  │
│  │  • Past Sponsors list         │  │
│  │  • Social Links               │  │
│  ╰───────────────────────────────╯  │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. User Affiliation

**Visibility:** Authenticated Users Only. (Hidden completely for Guests).

### 2.1 Layout

```text
┌──────────────────────────────────────┐
│  Your Current Sponsor                │
│                                      │
│  ┌─────┐                             │
│  │Badge│  Sponsor Name               │
│  └─────┘  "Proud Supporter"          │
│                                      │
│  Your Impact:                        │
│  ↳ 1,250 Fans Contributed            │
│  ↳ Top 5% of Affiliated Users        │
│                                      │
│  [ Change Sponsor ]                  │
└──────────────────────────────────────┘
```

### 2.2 Components & Behaviour
- **Current Sponsor Badge:** High-resolution sponsor logo and title reflecting the user's active choice.
- **Personal Fan Contribution Breakdown:** Displays the specific point/fan contribution the user has made to their sponsor during the current period.
- **"Change Sponsor" Button:** 
  - Action is restricted to **once per semester**.
  - **State:** If unused, standard outlined button. If already used this semester, disabled state with a lock icon and "Available next semester" tooltip/label.

---

## 3. Active Sponsors

**Visibility:** Public.

### 3.1 Layout

```text
┌──────────────────────────────────────┐
│  Active Sponsors                     │
│  (Horizontal Scroll / Carousel)      │
│                                      │
│  ┌───────────────────────────────┐   │
│  │ [Sponsor Logo / Cover Image]  │   │
│  │ Sponsor Name           #1     │   │
│  │                               │   │
│  │ 👥 5,000 Fans                 │   │
│  │ 🏆 12 Events Won              │   │
│  │ 🔗 340 Affiliated Users       │   │
│  │                               │   │
│  │ ⏱️ Tenure ends in: 14d 2h     │   │
│  └───────────────────────────────┘   │
└──────────────────────────────────────┘
```

### 3.2 Components & Behaviour
- **Sponsor Cards:** Displayed in a horizontally scrolling list. Snap-to-center pagination recommended.
- **Key Content:** 
  - Fan count.
  - Overall ranking (#1, #2).
  - Number of affiliated users.
  - Events won.
- **Tenure Countdown:** Live ticking timer (e.g., `14d 02h`) showing the remaining duration of the sponsor's active campaign.

---

## 4. Sponsor Leaderboard

**Visibility:** Public.

### 4.1 Layout

```text
┌──────────────────────────────────────┐
│  Sponsor Leaderboard                 │
│                                      │
│  Sort by: [Total Fans ▼] [Time ▼]    │
│                                      │
│  1. [Badge] Sponsor A  - 10,200 Fans │
│  2. [Badge] Sponsor B  -  8,400 Fans │
│  3. [Badge] Sponsor C  -  5,100 Fans │
│                                      │
│  [Scrollable List downwards]         │
└──────────────────────────────────────┘
```

### 4.2 Components & Behaviour
- **Ranked List:** Vertical stack displaying all active sponsors ordered by the chosen metric.
- **Filter / Sort Toggles:** 
  - **Sort By:** "Total Fans", "Events Won", or "Affiliated Users".
  - **Time Filter:** Enables historic or rolling timeframes (e.g., "This Month", "All Time").

---

## 5. Sponsor Prizes

**Visibility:** Public.

### 5.1 Layout

```text
┌──────────────────────────────────────┐
│  Sponsor Prizes                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🎁 Grand Prize Pool            │  │
│  │ Sponsored by: [Sponsor Badge]  │  │
│  │                                │  │
│  │ Criteria: Most fans referred   │  │
│  │ Leader: @username              │  │
│  │                                │  │
│  │ Status: [ 🟢 Available ]       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🎮 Gaming Peripherals          │  │
│  │ Sponsored by: [Sponsor Badge]  │  │
│  │                                │  │
│  │ Criteria: Top scorer Event X   │  │
│  │ Leader: @player_two            │  │
│  │                                │  │
│  │ Status: [ 🔴 Claimed ]         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 5.2 Components & Behaviour
- **Prize Pool Per Sponsor:** A dedicated section displaying rewards attached to specific sponsors.
- **Criteria & Current Leader:** Text outlining how the prize is won and indicating the current front-runner.
- **Claim Status:** Visual tags (e.g., green "Available", grey "Locked", red "Claimed") showing the real-time availability of the prize.

---

## 6. Newsletters

**Visibility:** Authenticated Users Only.

### 6.1 Layout

```text
┌──────────────────────────────────────┐
│  Manage Subscriptions                │
│                                      │
│  Gaming News           [ Toggle On ] │
│  Indie Spotlights      [ Toggle Off] │
│  Game Dev              [ Toggle On ] │
│  Campus Studio         [ Toggle Off] │
└──────────────────────────────────────┘
```

### 6.2 Components & Behaviour
- **Category Toggles:** Switch components for the exact predefined categories: Gaming News, Indie Spotlights, Game Dev, Campus Studio.
- **Immediate Action:** Toggling sends a background API request to update preferences instantly. A subtle snackbar ("Subscribed to Gaming News") confirms success.

---

## 7. Sponsor Archive

**Visibility:** Public.

### 7.1 Layout

```text
┌──────────────────────────────────────┐
│  Sponsor Archive                     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ [Badge] Past Sponsor Name A    │  │
│  │                                │  │
│  │ Tenure: Spring 2025            │  │
│  │ Linked Events: Campus Cup 25   │  │
│  │                                │  │
│  │ Links: [🌐 Web] [IG] [X]       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ [Badge] Past Sponsor Name B    │  │
│  │                                │  │
│  │ Tenure: Fall 2024              │  │
│  │ Linked Events: Indie Game Jam  │  │
│  │                                │  │
│  │ Links: [🌐 Web] [💼 LinkedIn]  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 7.2 Components & Behaviour
- **Historical List:** A streamlined list showing past/inactive sponsors.
- **Key Content:** Displays tenure dates and linked events.
- **Social Links:** Actionable icon buttons (Instagram, Website, etc.) linking to the archived sponsor's external pages.

---

## 8. Modals & Bottom Sheets

### 8.1 Change Sponsor Confirmation Modal (Authenticated only)

**Trigger:** Tapping the "Change Sponsor" button in the User Affiliation section (Section 2).
**Appearance:** Center-aligned alert dialogue/modal.

- **Title:** "Change Sponsor?"
- **Body Text:** "Are you sure you want to change your sponsor? You can only do this once per semester. This action cannot be undone."
- **Actions:**
  - **Cancel** (outlined, left): Dismisses modal.
  - **Confirm** (filled primary, right): Submits choice, dismisses modal, triggers a success snackbar, and instantly disables the "Change Sponsor" button with a lock icon for the rest of the semester.

### 8.2 Leaderboard Filter Sheet (Public)

**Trigger:** Tapping the "Sort by" or "Time" filter dropdowns in the Sponsor Leaderboard (Section 4).
**Appearance:** Bottom sheet with handle.

- **Sort By Options (Radio list):** Total Fans (Default), Events Won, Affiliated Users.
- **Time Filter Options (Radio list):** This Week, This Month, All Time (Default).
- **Behaviour:** Selecting an option immediately applies the filter, refreshes the leaderboard data below, and dismisses the sheet.

---

## 9. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon (status bar) | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap (Auth) | Opens Account Actions Popup |
| "Login" button (status bar) | Tap (Guest) | Navigates to `Login screen` |
| "Change Sponsor" Button | Tap (Auth) | Opens confirmation modal. Disabled with lock icon if already used this semester. |
| Leaderboard Sort/Time Filter| Tap | Opens bottom sheet to select metric/timeframe. |
| Active Sponsor Card | Tap | Navigates to detailed Sponsor Profile Page. |
| Newsletter Toggle | Tap (Auth) | Updates preference instantly + triggers snackbar confirmation. |
| Archive Social Link | Tap | Opens external URL in default OS browser. |

---

## 10. Empty, Error, & Auth States

| Location / Section | Guest State | Empty / Error State (Authenticated) |
|---|---|---|
| **User Affiliation** | Hidden completely. | Shows "You have no active sponsor" with a primary "Choose a Sponsor" CTA. |
| **Active Sponsors** | Visible. | "No active sponsors at this time." / Retry button on error. |
| **Leaderboard** | Visible. | "Not enough data to generate leaderboard." / Retry button on error. |
| **Sponsor Prizes**| Visible. | "No prizes active currently." |
| **Newsletters** | Hidden completely. | N/A (Toggles default to off). Retry inline link if API fails. |
| **Sponsor Archive**| Visible. | "No past sponsors to display." |

---

## 11. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching the shape of live content) rather than spinners, to preserve layout stability. Skeletons appear for:

- **User Affiliation:** 1 skeleton badge block and 2 stat text lines.
- **Active Sponsors:** 2 horizontally scrolling skeleton cards while fetching active campaigns.
- **Leaderboard:** 5 skeleton rows mimicking the rank, badge, and fan count.
- **Sponsor Prizes:** 2 skeleton blocks for the prize pool section.
- **Sponsor Archive:** Standard list skeleton items.
