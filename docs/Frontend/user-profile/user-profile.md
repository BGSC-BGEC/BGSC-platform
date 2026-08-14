# User Profile Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** Drill-in stack screen (`src/app/(stack)/user-profile.tsx` or equivalent)
**Visibility:** Authenticated only (spec §5.3). Unauthenticated users see a Login prompt instead of this page.

> **Note — Public Player Card (Phase 1 roadmap):** Spec §5.3 lists "Shareable Card export" and the Phase 1 roadmap (spec §16) mentions "Public player card with sponsor badge." The deep-link share target for a user's Player Card image is intended to be publicly accessible without login. This page itself remains authenticated-only; only the exported card image is public. Design and routing for the public card endpoint are TBD.

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│        Custom Status Bar            │  ← fixed top, full width
│  [← Back] [Account Actions] [Pic]   │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │         Player Card         │    │
│  │    (Avatar, Bio, Stats)     │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │       User Info Panel       │    │
│  │  (Contact, Activity,        │    │
│  │   Sponsor Stats)            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Event Suggestions       │    │
│  │   (Horizontal scroll)       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Friend Suggestions      │    │
│  │   (Horizontal scroll)       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │          History            │    │
│  │  (Sub-tabs + vertical list) │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

- The entire body below the status bar is vertically scrollable.
- Status bar remains fixed; page content scrolls beneath it.

---

## 2. Custom Status Bar

Rendered by `components/dynamic-status-bar.tsx` with a context-aware variant for this screen.

| Slot | Component | Behaviour |
|---|---|---|
| Left | Back arrow (←) | Tap → pops navigation stack and returns to previous screen |
| Center | "Account Actions" text button | Tap → opens **Account Actions Popup** (Edit/Actions tabs) |
| Right | Current user’s profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

> **Visitor mode removed:** Spec §5.3 defines this page as authenticated-only with a single self-view. The "Visitor mode" status bar variant (showing another user’s display name) was speculative and has been removed. Viewing another user’s profile is a future design decision not yet specified.

**Theme:** Follows active colour scheme (light/dark) from `themeStore`.

---

## 3. Player Card (Hero Section)

### 3.1 Layout

```
┌──────────────────────────────────────────┐
│  [Cover Gradient / Image]                │
│       ┌──────────────┐                   │
│       │              │  Display Name     │
│       │   Avatar     │  @username        │
│       │   (96 dp)    │  [Sponsor Badge]  │
│       │              │                   │
│       └──────────────┘                   │
│                                          │
│  "Bio text goes here, max 3 lines..."    │
│                                          │
│  [Sports] [Esports] [Game Dev]           │
│  [Coordinator] [Core]                    │
│                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Events│ │Wins │ │Fans │ │Rating│       │
│  │  12  │ │  5  │ │1.2k │ │ 4.8  │       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                          │
│  [Edit Profile]  [Share Card]            │
└──────────────────────────────────────────┘
```

### 3.2 Components

#### Cover
- Full-width gradient or optional cover photo (if uploaded).
- Self mode: long-press or edit menu to update cover (future).

#### Avatar
- **Size:** 96 dp circle, bordered with a 3 dp ring in the brand accent colour.
- **Self mode:** Tap → opens **Profile Picture Popup** (camera/gallery, crop/zoom, preview, save).
- **Visitor mode:** Tap → opens full-screen image viewer with pinch-to-zoom.

#### Name & Identity
- **Display Name:** 20 sp, bold.
- **Username:** 14 sp, muted (`@handle`).
- **Sponsor Badge:** Pill-shaped chip showing current sponsor logo + name. Tap → navigates to that sponsor's detail page.

#### Bio
- 14 sp, muted, max 3 lines with a "more" expand button.
- Tap "more" → expands inline to full height (max 8 lines).
- Empty state: placeholder text "No bio yet." (Self mode: "Tap Edit Profile to add a bio").

#### Interest Chips
- Horizontal list of interest pills from the user's **Interest Fields** (Sports, Esports, Gaming Industry, Game Dev).
- Non-interactive; purely informational.

#### Role Tags
- Role tags rendered as small coloured pills: e.g., green for `Founder`, blue for `Coordinator`, purple for `Core`, grey for `Member`.
- Multiple roles stack horizontally.

#### Custom Tags
- User-defined game/sport-specific tags set during profile edit (e.g., `Striker`, `IGL`, `Support`).
- Displayed as outlined pills in a neutral colour, distinct from role pills.
- Managed via the Edit Profile flow (Account Actions Popup → Edit tab).

#### Stats Row
Four evenly spaced stat blocks:

| Stat | Value | Example |
|---|---|---|
| Events | Total events participated | `12` |
| Wins | Total wins / 1st placements | `5` |
| Fans | Total fans contributed to sponsor | `1.2k` |
| Rating | Average community rating (1–5) | `4.8 ⭐` |

- Tap any stat block → subtle scale animation; no drill-in for MVP.

#### Action Buttons
- **Edit Profile:** Filled primary button. Tap → opens **Account Actions Popup** (Edit tab).
- **Share Card:** Outlined button. Shareable Card export flow (spec §5.3 — image generation for social media):
  1. User taps **Share Card**.
  2. Share button enters loading state (spinner replaces icon; button disabled).
  3. System renders the Player Card to an image server-side or client-side.
  4. A preview sheet appears showing the generated card image with a native share button.
  5. User taps the share button in the preview sheet → native OS share sheet opens with the image attached.
  - Error state: preview sheet shows error message with a retry option.

### 3.3 Animations (spec §5.3)

Spec §5.3 explicitly calls out **entrance** and **idle** animations on the Player Card. Specific animation style and timing are design decisions (TBD by design team).

- **Entrance animation:** Triggers when the Player Card first enters the viewport (initial page load or scroll-to-card). Plays once per page visit.
- **Idle animation:** Loops while the Player Card remains in view (e.g., subtle floating, shimmer, or particle effect on the card). Pauses when card scrolls out of view.

### 3.4 Rating Section (spec §5.3: "Fixed Rating Section — computed metrics")

The Rating stat block in the Stats Row displays a **server-side computed** aggregate score; it is not directly user-editable. Visual format is a design placeholder — options include a numeric score (e.g., `4.8`) with a star icon, a progress bar, or a segmented indicator. Design team to finalize. The value is read-only from the client's perspective.

### 3.5 States

| State | Behaviour |
|---|---|
| Loading | Skeleton shimmer for avatar (circle), text lines (name, bio), and stat blocks |
| Empty bio | Placeholder prompt encouraging the user to edit ("Tap Edit Profile to add a bio") |
| Share Card — generating | Spinner on Share Card button; button disabled |
| Share Card — ready | Preview sheet shown with card image and native share button |
| Share Card — error | Error message in preview sheet with retry option |

---

## 4. User Info Panel

Expandable/collapsible card. Default: expanded.

### 4.1 Layout

```
┌──────────────────────────────────────────┐
│  ℹ️ User Info                    [v/^]   │
├──────────────────────────────────────────┤
│  Tags from friends                       │
│  [Clutch Player] [Always Late] [GOAT]    │
├──────────────────────────────────────────┤
│  Email          rahul@bgsc.in            │
│  Contact        +91 98xxx xxxxx          │
│  Newsletters    Gaming News · Indie      │
├──────────────────────────────────────────┤
│  🏃 Strava                               │
│  Type: Run · 5 km · 32 min · 280 kcal   │
│  Pace: 6:24/km · [Map thumbnail]        │
│  [Connect Strava] (Self, if unlinked)    │
│                                          │
│  🎮 Steam                                │
│  Recently played: CS2 (4h), Dota 2 (2h) │
│  Last 2 weeks: 18h · Total: 1,240h      │
│  Achievements: 142 public               │
│  Games owned: 87                        │
│  [Connect Steam] (Self, if unlinked)     │
├──────────────────────────────────────────┤
│  Sponsor Stats                           │
│  [Logo] TechCorp                         │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │  Rank  │ │  Fans  │ │ Events │       │
│  │  #3    │ │ 1,240  │ │   4    │       │
│  │ (of 12)│ │Contributed│ │  Won  │       │
│  └────────┘ └────────┘ └────────┘       │
├──────────────────────────────────────────┤
│  Social Links                            │
│  [Discord] [Instagram] [LinkedIn] [X]    │
└──────────────────────────────────────────┘
```

### 4.2 Components

#### Tags from Friends
- Horizontally scrollable row of freeform tags that friends have applied to this user (e.g., `Clutch Player`, `Always Late`, `GOAT`).
- **Self mode:** Visible; cannot edit own tags (only friends can tag you).
- **Visitor mode:** Visible if the profile owner's privacy allows it.
- Empty state: section hidden entirely.

**Tag-addition flow (how friends tag you):** Tagging a friend is triggered from the Friends page → Tab 1 conversation row long-press → "Add Tag" option, which opens a freeform text input. Tags submitted by friends are applied immediately and appear in this panel. The tagging user's identity is not disclosed to the tagged user. Tags can be disputed (self-report via long-press → "Remove tag" request) which flags them for admin review.

#### Contact Info
- **Email**, **Contact**, and **Newsletters** rows.
- **Email / Contact:** Tap row → copies to clipboard; snackbar confirmation.
- **Newsletters (spec §5.3):** Read-only display of active newsletter subscriptions (e.g., "Gaming News · Indie Spotlights"). Managed via Account Actions → Edit tab.

#### Activity Connections

**Strava (spec §9.1):**
Displayed fields when linked: activity type, distance, duration, calories, pace, and route map thumbnail (last recorded activity).

| State | Behaviour |
|---|---|
| Not connected | "Connect Strava" OAuth button (self only); row hidden for visitor |
| Connected, loading | Spinner / skeleton placeholder |
| Connected, no activity | "No activity recorded yet" |
| Connected, data loaded | Latest activity card with all fields above |

**Steam (spec §9.2):**
Displayed fields when linked: games owned count, playtime for last 2 weeks and total, public achievements count, recently played games list.

| State | Behaviour |
|---|---|
| Not connected | "Connect Steam" OpenID button (self only); row hidden for visitor |
| Connected, loading | Spinner / skeleton placeholder |
| Connected, no activity | "No activity recorded yet" |
| Connected, data loaded | Stats and recently played list as above |

#### Sponsor Stats
**Header:** Current sponsor logo (32 dp) + sponsor name displayed above the stat boxes (spec §5.3: "Current sponsor name and logo").

Four elements total:
- **Sponsor logo + name:** Header row above stat boxes. Tap → navigates to sponsor detail page.
- **Rank:** User's rank among all users affiliated with the same sponsor (e.g., `#3 of 12`).
- **Fans Contributed:** Lifetime fan count contributed to the sponsor.
- **Events Won:** Count of events won while affiliated with this sponsor.

#### Social Links
- Horizontal row of platform icons (Discord, Instagram, LinkedIn, X, YouTube, etc.).
- Tap → opens external URL in system browser.
- Self mode: managed via Edit Profile.

### 4.3 States

| State | Behaviour |
|---|---|
| Loading | Skeleton text lines and placeholder stat boxes |
| No connections | "No connected accounts yet" (Self mode only) |
| No sponsor | "Not affiliated with a sponsor yet" with "Choose Sponsor" CTA (Self mode) |

---

## 5. Event Suggestions Section

### 5.1 Layout

```
┌──────────────────────────────────────────┐
│  📅 Event Suggestions          [See All→]│
├──────────────────────────────────────────┤
│  ┌───────────────────────────────────┐   │
│  │ [Image]  Event Name               │   │
│  │          Date · [Register]        │   │
│  │  ┌─────────────────────────────┐  │   │
│  │  │ 👥 Team Alpha               │  │   │
│  │  │    Looking for 2 more       │  │   │
│  │  │    [Invite]  [Manage]       │  │   │
│  │  └─────────────────────────────┘  │   │
│  └───────────────────────────────────┘   │
│  ┌───────────────────────────────────┐   │
│  │ [Image]  Event Name               │   │
│  │          Date · [Register]        │   │
│  └───────────────────────────────────┘   │
│          (Horizontal scroll)             │
└──────────────────────────────────────────┘
```

### 5.2 Components

#### Suggestion Cards
- Horizontal snap-scrolling list of event cards.
- Each card: cover image, event name (1 line), date, and a "Register" button if registration is open.
- **Personalization:** Events are ranked by overlap with user's **Interest Fields** and current sponsor.
- Tap card → Event Details View. Tap "Register" → opens registration flow directly.

#### Open Public Teams (spec §5.3 — inline under event card)
For teamed tournaments, any open public teams the user belongs to are shown **inline below the relevant event card**, not in a separate section.

- Shown only when the user is part of a team for that event that has public slots open.
- Each inline team row: team name, "Looking for X more members".
- Action buttons: **Invite** (opens share sheet with team invite link) and **Manage** (opens Team Formation section of Event Details).
- Event cards for non-teamed tournaments show no team row.

### 5.3 States

| State | Behaviour |
|---|---|
| Loading | Skeleton cards (3) |
| Empty | "No upcoming events match your interests" + "Browse all events" link |
| Error | Inline retry button |

---

## 6. Friend Suggestions Section

### 6.1 Layout

```
┌──────────────────────────────────────────┐
│  👥 Friend Suggestions        [See All→] │
├──────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  [Pic]  │ │  [Pic]  │ │  [Pic]  │   │
│  │  Name   │ │  Name   │ │  Name   │   │
│  │Mutual: 2│ │Mutual: 1│ │Mutual: 5│   │
│  │[✚ Add]  │ │[✚ Add]  │ │[✚ Add]  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│          (Horizontal scroll)             │
└──────────────────────────────────────────┘
```

### 6.2 Components

- Horizontal snap-scroll of user cards (120 dp width).
- **Avatar:** 56 dp circle. Tap → navigates to that user's profile.
- **Name:** 1 line, bold.
- **Mutual count:** "Mutual: X" based on shared friends or shared event participation.
- **Add button:** Tap → sends friend request.
  - Immediate local state change to `Requested` (spinner → outlined disabled).
  - Error → reverts to `Add` with snackbar.

**Suggestion ranking signals (spec §5.4 Friends System Logic):**
1. Shared friends (mutual count)
2. Shared interests / interest field overlap
3. Event co-participation
4. Shared sponsor affiliation (spec §5.4: "similar interests + sponsor affiliation")

### 6.3 States

| State | Behaviour |
|---|---|
| Loading | Skeleton circles + lines |
| Empty | "No suggestions right now" |
| All caught up | Small celebratory illustration when user has sent requests to all suggestions |

---

## 7. History Section

**Visibility:**
- **Self mode:** All tabs and full history visible.
- **Visitor mode:** **Events** and **Matches** tabs visible; **Challenges** and **Sponsor** tabs hidden (privacy-protected).

### 7.1 Layout

```
┌──────────────────────────────────────────┐
│  📜 History                              │
├──────────────────────────────────────────┤
│  [Events] [Matches] [Challenges][Sponsor]│  ← sticky segmented tabs
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ History Item Card                │   │
│  │ Title, meta, result, points      │   │
│  └──────────────────────────────────┘   │
│  …                                       │
│                                          │
│  [Load older / end of list msg]          │
└──────────────────────────────────────────┘
```

### 7.2 Sub-tabs

Four sticky horizontal tabs directly below the section header. Tapping switches content with a cross-fade animation.

#### Tab A — Events
Vertical list of past events the user registered for.

**Event History Card:**
```
┌──────────────────────────────────────────┐
│  [Event Cover]  Event Title              │
│                 12 Mar 2026              │
│  Role: Captain · Team: Alpha             │
│  Result: 2nd Place · +180 pts            │
│  +45 fans for [Sponsor]                  │
└──────────────────────────────────────────┘
```

- Tap card → Event Details View (past state).
- Shows participation points and sponsor fan contributions if applicable.

#### Tab B — Matches
Individual match records from league brackets.

**Match History Card:**
```
┌──────────────────────────────────────────┐
│  League 2026 — Round of 16               │
│  Alpha  3 : 1  Beta                      │
│  ✅ Win · 15 Mar · Field A               │
└──────────────────────────────────────────┘
```

- Tap card → Spectator Bracket View focused on this match.
- Color-coded result: green for Win, red for Loss, yellow for Draw.

#### Tab C — Challenges
Completed challenges only. Challenges accepted but not yet completed (in-progress) do not appear here; they are tracked via the Active Challenges strip on the Points & Challenges page.

> **Goal Achievements vs Challenge completions:** Goal Achievements are in-progress milestones (targets set against a stat, e.g. "Reach 500 fans") and are tracked on the Points Dashboard as live goals — not in this History tab. Challenge completions are submitted proof-of-completion entries reviewed by admins; those appear here once the admin marks them awarded. The two are distinct: goals are milestones, challenges are structured submissions.

**Challenge History Card:**
```
┌──────────────────────────────────────────┐
│  🏆 Challenge Name                       │
│  Domain: Physical · Difficulty: Hard     │
│  Completed: 10 Jan 2026                  │
│  +500 pts awarded                        │
└──────────────────────────────────────────┘
```

- Tap card → Challenge Browser detail view.

#### Tab D — Sponsor
Timeline of sponsor-related contributions.

**Sponsor Contribution Card:**
```
┌──────────────────────────────────────────┐
│  ● Event: League 2026                    │
│    12 Mar 2026                           │
│    Fans contributed: +45                 │
│    ────────────────                      │
│    Running total: 1,240 fans             │
└──────────────────────────────────────────┘
```

- Items connected by a vertical timeline line.
- Shows cumulative fan count after each event.

### 7.3 Feed Behaviour

- **Pagination:** Infinite scroll (20 items per tab).
- **Pull-to-refresh:** Supported on the active tab's list.
- **Retention:** No hard retention cutoff; full history available.

### 7.4 States

| State | Behaviour |
|---|---|
| Loading | Skeleton list items (3) |
| Empty (Events) | "No events participated yet" |
| Empty (Matches) | "No match records yet" |
| Empty (Challenges) | "No challenges completed yet" |
| Empty (Sponsor) | "No sponsor contributions yet" |
| Error | Retry button per tab |

---

## 8. Popups & Modals Triggered from This Screen

### 8.1 Account Actions Popup
**Trigger:** Tap "Account Actions" (status bar center, self-mode) or current user's profile picture (status bar right).
**Appearance:** Bottom sheet with handle, two top tabs.

#### Edit Tab
| Field | Type | Notes |
|---|---|---|
| Username | Text input | Max 30 chars; unique validation |
| Display Name | Text input | Max 50 chars |
| Email | Email input | Verification required if changed |
| Contact | Phone input | OTP verification if changed |
| Bio | Multi-line text | Max 300 chars |
| Interests | Multi-select grid | Sports, Esports, Gaming Industry, Game Dev |
| Sponsor | Single-select + "Change" | Once-per-semester limit enforced |
| Newsletters | Toggle list | Gaming News, Indie Spotlights, Game Dev, Campus Studio |
| Social Links | Inline add/remove rows | Platform dropdown + URL input |

- **Save** button: validates and queues updates; snackbar "Profile updated".

#### Actions Tab
- **Disable Account:** Opens confirmation dialog. Account becomes dormant; user logged out.
- **Delete Account:** Opens confirmation with 7-day grace period info. Requires password re-entry.
- **Export Data (Account Information Request):** Triggers GDPR-style full data dump including all chat history, posts, points transactions, and sponsor data (spec §6.1). Snackbar "Export request received — check email in 24h".
- **Legal:** Links to ToS and Privacy Policy (external browser).

### 8.2 Profile Picture Popup
**Trigger:** Tap own avatar.
**Flow:** Camera / Gallery → Crop & Zoom (square aspect ratio, 1:1) → Preview → Save.
- Max upload size: 5 MB.
- On save: immediately reflects in status bar and avatar.

---

## 9. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Back arrow (status bar) | Tap | Pops back to previous screen |
| "Account Actions" (status bar center) | Tap | Opens Account Actions Popup |
| Profile picture (status bar right) | Tap | Opens Account Actions Popup |
| Own avatar | Tap | Opens Profile Picture Popup |
| Sponsor badge | Tap | Sponsor detail page |
| Bio "more" | Tap | Expands full bio inline |
| Stats row item | Tap | Scale bounce animation |
| Edit Profile button | Tap | Opens Account Actions Popup (Edit tab) |
| Share Card button | Tap | Generates card image → preview sheet → native share |
| Contact info row | Tap | Copies to clipboard |
| Strava/Steam connect button | Tap (Self, unlinked) | OAuth connection flow |
| Social link icon | Tap | Opens URL in system browser |
| Event suggestion card | Tap | Event Details View |
| Event Register button | Tap | Event registration flow |
| Open Team row / Invite | Tap | Share invite link |
| Friend suggestion avatar | Tap | That user's profile |
| Friend suggestion Add | Tap | Send request |
| History tab | Tap | Switches history list |
| History Event card | Tap | Event Details (past) |
| History Match card | Tap | Spectator Bracket View |
| History Challenge card | Tap | Challenge detail |
| History list | Pull down | Pull-to-refresh active tab |
| History list | Scroll to bottom | Load next page |

---

## 10. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Player Card bio | "No bio yet" (Self: prompt to edit) | — |
| User Info connections | "No accounts linked" | Retry inline |
| Event Suggestions | "No matching events" + browse link | Retry button |
| Friend Suggestions | "No suggestions right now" | Retry button |
| History — Events | "No events yet" | Retry button |
| History — Matches | "No matches yet" | Retry button |
| History — Challenges | "No challenges yet" | Retry button |
| History — Sponsor | "No contributions yet" | Retry button |

---

## 11. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching live content shapes):

- Player Card: circular avatar skeleton, 3 text line skeletons, 4 stat square skeletons.
- User Info: 4 text line skeletons.
- Event Suggestions: 3 rectangular card skeletons.
- Friend Suggestions: 3 circular avatar + 2 line skeletons.
- History: 3 list-item skeletons per active tab.

No spinners in the main body; pull-to-refresh uses the native platform refresh indicator.
