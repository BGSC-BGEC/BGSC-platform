# Home Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/index` (`src/app/(drawer)/index.tsx`)
**Visibility:** Public (Guest + Authenticated)

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│     Tab Bar  [Intro | Announce | Feed]  ← sticky below status bar
├─────────────────────────────────────┤
│                                     │
│         Active Tab Content          │  ← scrollable
│                                     │
├─────────────────────────────────────┤
│   FAB (Tab 3 only — Add Post btn)   │  ← fixed bottom-right
└─────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header. Present on every drawer screen; behaviour on the Home Page is:

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (≡) | Tap → opens the Side Drawer overlay |
| Center | BGSC logo (image) | Non-interactive; confirms current module context |
| Right — Guest | "Login" text button | Tap → navigates to `/login` |
| Right — Authenticated | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

**Theme:** Background colour and icon/text colour follow the active colour scheme (light/dark) from `themeStore`. Status-bar system icons (battery, clock, etc.) are tinted to contrast.

---

## 3. Tab Bar

Three tabs sit in a horizontal segmented control pinned directly below the status bar.

| Index | Label | Icon (suggested) |
|---|---|---|
| 0 | Introduction | Home outline |
| 1 | Announcements | Megaphone outline |
| 2 | Feed | Newspaper outline |

- Tapping a tab label or swiping horizontally switches the active tab with a slide animation.
- The active tab label is bold and underlined with the brand accent colour; inactive labels are muted.
- Tab bar does **not** scroll away — it remains sticky throughout.

---

## 4. Tab 1 — Introduction / Landing

### 4.1 Layout (top-to-bottom scroll)

```
┌──────────────────────────────────┐
│  Hero Banner                     │
│  BGSC / BGEC / FitSoc logos      │
│  Tagline / one-liner             │
├──────────────────────────────────┤
│  "What Our Heads Have to Say"    │
│  Coordinator Comic Strip         │
│    [portrait] [speech bubble]    │
│    [portrait] [speech bubble]    │
│    …                             │
├──────────────────────────────────┤
│  "See all announcements →"       │
│  CTA button                      │
└──────────────────────────────────┘
```

### 4.2 Components

#### Hero Banner
- Full-width image or gradient block at the top.
- Displays the BGSC wordmark/logo prominently with subsidiary logos for BGEC and FitSoc below it.
- Below the logos: a short punchy one-liner (e.g., "Where Campus Sports Meets Esports").
- Static — no tap interaction.

#### Coordinator Comic Strip — "What Our Heads Have to Say"
- Vertical list of coordinator cards, one per coordinator.
- Each card:

  ```
  ┌────────────────────────────────────────┐
  │  [Portrait]   [Speech bubble]          │
  │  (pixelated   "Latest announcement     │
  │   / photo)     text truncated to       │
  │                2 lines..."             │
  │               Coordinator Name · Role  │
  └────────────────────────────────────────┘
  ```

  - **Portrait:** Square/circular crop, pixelated art style or stylised photograph, ~72×72 dp.
  - **Speech bubble:** Comic-style callout pointing left toward the portrait. Contains the coordinator's most recent announcement body, capped at 2 lines with a "..." overflow ellipsis.
  - **If no announcement exists for a coordinator:** The speech bubble displays a meme/placeholder image instead of text.
  - **Coordinator name and role label** appear below the speech bubble in small muted text.
  - Tap on the **speech bubble or the card** → navigates to Tab 2 (Announcements), scrolled to and highlighting that coordinator's latest announcement.
  - Tap on the **portrait** → navigates to that coordinator's User Profile Page (Authenticated only; if Guest, redirects to `/login`).

#### "See All Announcements" CTA
- Full-width outlined button at the bottom of the section.
- Label: "See all announcements →"
- Tap → switches active tab to Tab 2 (Announcements).

### 4.3 States

| State | Behaviour |
|---|---|
| Loading | Skeleton shimmer for portrait + speech bubble per card |
| Empty (no coordinators) | Hero banner only; CTA button hidden |
| Guest | Portrait tap → Login redirect; speech bubble tap → Tab 2 (no auth required) |

---

## 5. Tab 2 — Announcements

### 5.1 Layout

```
┌──────────────────────────────────┐
│  Category Filter Chips (scroll)  │
│  [All] [BGEC] [FitSoc] [Airball] │
│  [Offside] [PowerPlay] [+ more]  │
├──────────────────────────────────┤
│  Announcement Feed (scroll)      │
│  ┌──────────────────────────┐    │
│  │ Announcement Card        │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ Announcement Card        │    │
│  └──────────────────────────┘    │
│  …                               │
├──────────────────────────────────┤
│  [Load older / end of feed msg]  │
└──────────────────────────────────┘

(Core+ only — top-right corner of tab)
│  [+ New Announcement] icon btn   │
```

### 5.2 Category Filter Chips

- Horizontally scrollable single-row chip list, pinned below the tab bar.
- Chips: **All · BGEC · FitSoc · Airball · Offside · PowerPlay · Around The Net · Deuce · Highlight Events · Teams**
  - "Teams" chip is visible only to authenticated users with **Core+** role (Coordinator, Founder, or Core); hidden from User and Guest roles.
- **"All"** chip is selected by default.
- Selecting a chip filters the feed to show only announcements with that tag. Multiple chips cannot be selected simultaneously (single-select).
- Active chip: filled background with accent colour. Inactive: outlined.
- Tap selected chip again → deselects (reverts to "All").

### 5.3 Announcement Card

```
┌──────────────────────────────────────┐
│  [Tag pill(s)]          [Timestamp]  │
│                                      │
│  Title (bold, 1–2 lines)             │
│                                      │
│  Body preview (3 lines, ellipsis)    │
│                                      │
│  [Avatar] Author name · Role         │
└──────────────────────────────────────┘
```

- **Tag pills:** Small coloured capsule labels matching the announcement's category tags (e.g., blue for BGEC, green for FitSoc). Multiple tags stack inline.
- **Timestamp:** Relative format ("2 hours ago", "3 days ago"); absolute on long-press tooltip.
- **Title:** Bold, 16 sp, max 2 lines.
- **Body preview:** 14 sp muted text, max 3 lines then "…".
- **Author avatar:** 28 dp circle. Tap avatar → User Profile Page of that coordinator.
- **Author name + role:** e.g., "Rahul Mehta · Coordinator".
- **Card tap** → opens **Announcement Detail Sheet** (bottom sheet or full-screen modal):
  - Full title, full rich-text body, all tags, author, timestamp, and WhatsApp share button.
  - Share button: copies a deep-link to the announcement or shares via system share sheet.
  - Dismiss: swipe down or tap backdrop.

### 5.4 Feed Behaviour

- **Pagination:** Infinite scroll. Loads next page of 20 items as user nears the bottom.
- **Retention filter:** Only announcements from the past 4 months are shown. A horizontal divider labelled "Older announcements are no longer shown" appears at the bottom of the feed when the retention boundary is reached.
- **Pull-to-refresh:** Dragging the list down triggers a refresh indicator and re-fetches the latest announcements.
- **Real-time updates:** When a new announcement is published, a banner chip appears at the top of the feed: "1 new announcement — tap to refresh". Tapping it scrolls to the top and shows the new card.

### 5.5 New Announcement Button (Core+ only)

- Small `+` icon button in the top-right corner of the Announcements tab, visible only when the user's role is `Coordinator`, `Founder`, or `Core` with announcement permission explicitly granted (spec §6.4: "Core (with permission)"). Core members without this permission do not see the button.
- Tap → opens the **Make Announcement Popup** (see §8).

### 5.6 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton cards |
| Empty (no announcements) | Illustration + "Nothing posted yet" message |
| Error | Retry button with error message |
| Guest | All read actions available; New Announcement button hidden |

---

## 6. Tab 3 — General Social Feed

### 6.1 Layout

```
┌──────────────────────────────────┐
│  Social Feed (scroll)            │
│  ┌──────────────────────────┐    │
│  │  Post Card               │    │
│  └──────────────────────────┘    │
│  …                               │
└──────────────────────────────────┘

(fixed bottom-right)
│       [FAB +]                    │
```

### 6.2 Post Card

```
┌──────────────────────────────────────┐
│  [Avatar]  Display Name              │
│            @username · Timestamp     │
│                                      │
│  [Media block — image / video]       │
│   (single image or carousel)         │
│                                      │
│  Caption text (2 lines, expandable)  │
│                                      │
│  [Tags: #event #sponsor …]           │
│                                      │
│  [♥ Like] [💬 Comment] [↗ Share]     │
└──────────────────────────────────────┘
```

- **Avatar (32 dp):** Tap → User Profile Page. Guest → `/login`.
- **Display name / @username:** Tap → User Profile Page.
- **Timestamp:** Relative ("5 min ago"). Long-press → absolute tooltip.
- **Media block:**
  - Single image: full-width, aspect-ratio locked (max 4:5 portrait / 16:9 landscape). Tap → opens full-screen image viewer with pinch-to-zoom.
  - Multiple images: horizontal swipe carousel with dot indicator. Tap image → full-screen viewer.
  - Video: inline player with play button overlay. Tap → plays inline with sound off by default; unmute button overlaid.
  - No media: section hidden.
- **Caption:** Max 2 lines collapsed. Tap "more" → expands full caption inline.
- **Tags:** Horizontal scrollable capsule list. Tap a tag → triggers global search filtered to that tag.
- **Action row:**
  - **Like (♥):** Tap (Authenticated) → toggles like state; heart animates (scale bounce). Count shown if post author enabled like count visibility. Guest tap → `/login` redirect.
  - **Comment (💬):** Tap → opens Comment Sheet (bottom sheet) showing comments thread and a reply input field. Behaviour matches post-level comment visibility setting.
  - **Share (↗):** Tap → opens native share sheet with post deep-link. Disabled if post author turned off sharing.

### 6.3 Feed Behaviour

- Shows only **Public**-visibility posts. Posts with Protected/Private/ephemeral visibility are not shown here.
- Ordered by recency (newest first).
- **Infinite scroll** with 20-post pages.
- **Pull-to-refresh** supported.

### 6.4 Floating Action Button (FAB)

- Circular button, bottom-right corner, 56 dp, brand accent colour.
- Icon: `+` (plus / compose).
- Fixed position — does not scroll with the list.
- **Guest tap:** Navigates to `/login` with a snackbar message "Log in to post".
- **Authenticated tap:** Opens the **Add Post Popup** (see §9).

### 6.5 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton post cards |
| Empty | Illustration + "No posts yet — be the first!" (Authenticated) or "Log in to join the conversation" (Guest) |
| Error | Retry button |
| Guest | Feed readable; Like/Comment/Post actions redirect to `/login` |

---

## 7. Side Drawer Overlay

Triggered from the hamburger icon in the status bar.

- Slides in from the left, covering ~80% of screen width. Right edge is a semi-transparent scrim.
- **Tap scrim or swipe left** → closes drawer.
- **Drawer body (top-to-bottom):**
  1. App logo + version label (top)
  2. Nav links in order: Home · Events · Points & Challenges · Sponsors · Friends · Leaderboards · Hall of Fame · Store · Media · Feedback & Contact
  3. Divider
  4. Role-gated links (visible based on role):
     - **Member+:** Union Page
     - **Coordinator+:** Users Page
  5. Bottom: Theme toggle (Light / Dark / System) + currently logged-in user's name and avatar, or "Guest" with Login button.
- Active route is highlighted with accent colour.

---

## 8. Make Announcement Popup (Core+ only)

**Trigger:** `+` icon on Announcements tab (Tab 2).
**Permissions:** Coordinator, Founder, or Core with announcement permission granted (spec §6.4). Core without explicit permission cannot open this popup.
**Appearance:** Full-screen bottom sheet with handle.

### Fields (top-to-bottom)

| Field | Type | Notes |
|---|---|---|
| Title | Single-line text input | Required; max 120 chars; char counter shown |
| Body | Rich-text editor | Bold, italic, bullet list, inline links; min 1 char |
| Announcement Type | Multi-select tag chips | BGEC, FitSoc, Airball, Offside, PowerPlay, Around The Net, Deuce, Highlight Events, Teams — at least 1 required; Teams chip visible Core+ only |
| Schedule toggle | Switch | Default: off (send immediately) |
| Scheduled date/time | Date + time picker | Shown only when Schedule toggle is on |

### Action Buttons

- **Cancel** (outlined, left): dismisses popup; prompts a "Discard draft?" confirmation if any field has been filled.
- **Post / Schedule** (filled, right): validates all required fields; on success — publishes immediately or schedules; popup dismisses; snackbar confirmation appears ("Announcement posted" or "Scheduled for [datetime]"). WhatsApp API broadcast fires in background (if integration active).

### Error States

| Error | UI Behaviour |
|---|---|
| WhatsApp rate limit exceeded (max 1 announcement per tag per hour) | Submit is blocked; an inline error label appears beneath the affected tag chip(s): "Rate limit reached — try again in [N] minutes." The Post/Schedule button remains disabled until all selected tags are within the hourly limit. No toast or full-screen error; the label is dismissible once the cool-down expires. |
| Required field missing | Inline validation highlight on the empty field; Post/Schedule button remains disabled. |
| Network error on submit | Toast: "Failed to post — check your connection and retry." Popup stays open with data intact. |

---

## 9. Comment Sheet (Authenticated only)

**Trigger:** Tap the Comment (💬) button on any Post Card in Tab 3 (Feed).
**Appearance:** Bottom sheet with handle, covers ~75% of screen height. Keyboard pushes the input field up.

### Layout

```
┌──────────────────────────────────────┐
│  ━━━  (drag handle)                  │
│  Comments                   [Close ✕]│
├──────────────────────────────────────┤
│                                      │
│  [Avatar]  Display Name · 2h ago     │
│            Comment text here         │
│            [♥ 3]  [Reply]            │
│                                      │
│    ↳ [Avatar]  Reply Name · 1h ago   │
│               Reply text here        │
│               [♥ 1]  [Reply]         │
│                                      │
│  [Avatar]  Display Name · 5m ago     │
│            Another comment           │
│            [♥ 0]  [Reply]            │
│                                      │
│  [Load more comments…]               │
│                                      │
├──────────────────────────────────────┤
│ [Avatar] [Write a comment…]  [Send▶] │
└──────────────────────────────────────┘
```

### Components

#### Comment Thread
- **Flat list with one level of nesting.** Top-level comments are shown in order. Replies are indented beneath their parent and collapsed by default if > 2 replies — "View X more replies" expands inline.
- **Comment Row:** Author avatar (32 dp) + display name (bold) + relative timestamp + comment body. Tap avatar → User Profile Page.
- **Like (♥):** Tap to toggle like on a comment. Count shown if > 0.
- **Reply:** Tap → prefills the input field with `@username` and scrolls to it.
- **Long-press a comment:**
  - Own comment: **Delete** (confirmation snackbar with undo).
  - Others' comment: **Report** (opens report sheet).
- **Comment visibility** respects the post author's setting:
  - **Public:** All users see all comments.
  - **Private:** Only post author sees comments (others see "Comments are private").
  - **Protected:** All users (including guests) can see comments, but the post author cannot see comments on their own post.

#### Input Field
- Fixed at the bottom. Full-width rounded input with placeholder "Write a comment…".
- **Send button:** Disabled when empty; enabled once 1+ character is typed. Tap → posts comment; input clears; new comment animates into list at top.
- **Character limit:** 500 chars. Counter shown at 400+.
- **Keyboard behaviour:** Sheet rises with keyboard; list scrolls to show the input area.

### Pagination
- **Initial load:** 20 most recent top-level comments.
- **"Load more"** link at top of list loads previous 20. Comments are ordered oldest-first once loaded (chronological, not reverse).
- **Real-time:** New comments from others push in at the bottom without full reload while sheet is open.

### States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton comment rows |
| Empty | "No comments yet — be the first!" |
| Comments disabled | "Comments are turned off for this post" — input hidden |
| Comments private | "Comments are private" — full list hidden for non-authors |
| Comments protected (author viewing own post) | Post author cannot see any comments when visibility is Protected. The comment list is replaced with an empty-state notice: "Comments are hidden from you on this post." Input field is also hidden (author cannot reply to comments they cannot see). Other users see comments normally. |
| Error | Inline retry link |

---

## 10. Add Post Popup (Authenticated only)

**Trigger:** FAB on Tab 3 (Feed).
**Appearance:** Full-screen modal with three sequential tabs at the top.

### Tab 1 — Media Selection

- Two primary action tiles, full-width:
  - **Camera:** Opens device camera (requests permission if not granted). Captured photo/video added to selection grid.
  - **Gallery:** Opens system photo/video picker. Multi-select enabled.
- **Selection preview grid:** 3-column grid of chosen media thumbnails below the action tiles.
  - Each thumbnail has a close (×) button to remove it.
  - Drag-to-reorder supported.
  - Max 10 items.
- **Next →** button (bottom-right): disabled until at least 1 item is selected. Advances to Tab 2.

### Tab 2 — Post Details

| Field | Type | Notes |
|---|---|---|
| Caption / Header | Single-line text input | Optional; max 150 chars |
| Description | Multi-line text input | Optional; max 2 000 chars |
| Tags | Multi-select chip picker | Event tags, interest tags, sponsor tag |

- **Back ←** (bottom-left): returns to Tab 1.
- **Next →** (bottom-right): always enabled (description optional). Advances to Tab 3.

### Tab 3 — Privacy & Interaction Controls

| Control | Type | Options / Default |
|---|---|---|
| Post Visibility | Radio group | Public (default) · Protected · Private · Non-Judgmental (24h) · Close (24h) · General (24h) |
| Likes enabled | Switch | On by default |
| Show like count | Switch | On by default (disabled if Likes is off) |
| Comments enabled | Switch | On by default |
| Comment visibility | Radio group | Public (default) · Private · Protected |
| Sharing enabled | Switch | On by default |

- **Back ←** (bottom-left): returns to Tab 2.
- **Post** (filled primary button, bottom-right): submits post. Popup dismisses; feed refreshes; new post appears at top; snackbar "Post published".

---

## 11. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| BGSC logo (status bar) | — | Non-interactive |
| Profile picture (status bar) | Tap (Auth) | Opens Account Actions Popup |
| "Login" button (status bar) | Tap (Guest) | Navigates to `/login` |
| Tab bar item | Tap or horizontal swipe | Switches active tab |
| Coordinator portrait | Tap (Auth) | Opens coordinator's User Profile |
| Coordinator portrait | Tap (Guest) | Redirects to `/login` |
| Coordinator speech bubble / card | Tap | Switches to Tab 2 (Announcements) scrolled to and highlighting that coordinator's latest announcement |
| "See all announcements" CTA | Tap | Switches to Tab 2 |
| Category filter chip | Tap | Filters announcement feed |
| Category filter chip (active) | Tap | Deselects; resets to "All" |
| Teams category chip | — (User / Guest) | Not rendered; hidden for User and Guest roles |
| Announcement card | Tap | Opens Announcement Detail Sheet |
| Author avatar (announcement) | Tap | Opens coordinator's User Profile |
| "New announcement" + btn | Tap (Core+) | Opens Make Announcement Popup |
| Feed list | Pull down | Triggers pull-to-refresh |
| Feed list | Scroll to bottom | Loads next page |
| Post avatar / username | Tap (Auth) | Opens poster's User Profile |
| Post avatar / username | Tap (Guest) | Redirects to `/login` |
| Post image | Tap | Opens full-screen image viewer |
| Post image (multi) | Swipe | Cycles carousel |
| Post video | Tap | Plays inline, muted |
| Post "more" (caption) | Tap | Expands full caption |
| Post tag chip | Tap | Opens Global Search filtered to tag |
| Like button | Tap (Auth) | Toggles like with animation |
| Like button | Tap (Guest) | Redirects to `/login` |
| Comment button | Tap | Opens Comment Sheet |
| Share button | Tap | Opens system share sheet |
| FAB (+) | Tap (Auth) | Opens Add Post Popup |
| FAB (+) | Tap (Guest) | Snackbar + redirect to `/login` |
| Announcement Detail Sheet | Swipe down / backdrop tap | Dismisses sheet |
| Comment Sheet | Swipe down / backdrop tap | Dismisses sheet |

---

## 12. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Coordinator strip (Tab 1) | Hero banner only | Retry inline |
| Announcement feed (Tab 2) | Illustration + "Nothing posted yet" | Retry button |
| Social feed (Tab 3) | "No posts yet" with context-aware message | Retry button |
| Comment Sheet | "No comments yet — be the first!" | Retry button |
| Announcements — Teams chip filter | "No team announcements yet" | Retry button |

---

## 13. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching the shape of live content) rather than spinners, to preserve layout stability. Skeletons appear for:

- Coordinator strip cards (Tab 1).
- Announcement cards (Tab 2, first 3 cards while fetching).
- Post cards (Tab 3, first 3 posts while fetching).
- "Load more" indicator at list bottom: small spinner inline.
