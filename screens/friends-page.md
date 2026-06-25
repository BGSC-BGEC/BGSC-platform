# Friends Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/friends` (`src/app/(drawer)/friends.tsx`)
**Visibility:** Authenticated only (guests redirected to `/login`)

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│  Tab Bar  [Chats|Activity|Achieve|  │
│            Challenge|Team Up]       │  ← sticky below status bar
├─────────────────────────────────────┤
│                                     │
│         Active Tab Content          │  ← scrollable
│                                     │
├─────────────────────────────────────┤
│   FAB (Tab 1 only — Compose btn)    │  ← fixed bottom-right
└─────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header.

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (≡) | Tap → opens the Side Drawer overlay |
| Center | "Friends" wordmark | Non-interactive; confirms current module context |
| Right | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

**Theme:** Background colour and icon/text colour follow the active colour scheme (light/dark) from `themeStore`.

---

## 3. Tab Bar

Five tabs sit in a horizontal segmented control pinned directly below the status bar.

| Index | Label | Icon (suggested) |
|---|---|---|
| 0 | Chats | Chat bubble outline |
| 1 | Activity | Pulse / activity outline |
| 2 | Achievements | Trophy outline |
| 3 | Challenges | Flag outline |
| 4 | Team Up | People outline |

- Tapping a tab label or swiping horizontally switches the active tab with a slide animation.
- Active tab label is bold and underlined with the brand accent colour; inactive labels are muted.
- Tab bar does **not** scroll away — remains sticky throughout.

### Overflow Handling

On narrow screens (<360dp width), the tab bar switches to **icon-only mode** to prevent horizontal scroll. Labels are hidden; only icons remain visible. The active tab icon is filled and tinted with the accent colour; inactive icons are outlined.

On very narrow screens (<320dp width), tabs compress further with 8dp padding instead of 16dp. If still overflowing, the tab bar becomes **horizontally scrollable** with snap-to-tab behaviour.

---

## 4. Tab 1 — General Chats & Search

### 4.1 Layout (top-to-bottom)

```
┌──────────────────────────────────┐
│  Search Bar                      │  ← sticky, below tab bar
├──────────────────────────────────┤
│  Currently Active  ● N online    │  ← collapsed chip; expands to list of
│  [Avatar●][Avatar●][Avatar●] …   │    online friends (green dot = online)
├──────────────────────────────────┤
│  Friend Requests  [N pending]    │  ← collapsed chip; expand to list
├──────────────────────────────────┤
│  Pinned / Recent Conversations   │
│  ┌──────────────────────────┐    │
│  │ Conversation Row     [●] │    │  ← green dot if friend is online
│  └──────────────────────────┘    │
│  …                               │
├──────────────────────────────────┤
│  Community Servers               │
│  ┌──────────────────────────┐    │
│  │ Server Row               │    │
│  └──────────────────────────┘    │
│  …                               │
└──────────────────────────────────┘

(fixed bottom-right)
│       [FAB ✏]                    │
```

**Online status:** A green dot (8 dp) overlaid on the bottom-right of a friend's avatar indicates they are currently active. Online status is updated in real time via the same WebSocket connection used for chat. Users can disable broadcasting their own online status from Account Settings (privacy).

**Currently Active section:** A collapsed chip "● N Active Now" appears between the Search Bar and Friend Requests chip when at least one friend is online. Tap → expands inline into a horizontal avatar strip (32 dp circles) with green dots; tapping an avatar opens that DM conversation. Chip is hidden when zero friends are online.

### 4.2 Search Bar

- Full-width rounded input pinned below the tab bar; placeholder: "Search users, chats, servers…".
- **Typing** → filters the visible conversation/server list in real time by display name or @username.
- **Search submit** → triggers a user search across the platform (not just friends). Results list replaces the conversation list with user rows:
  - Avatar, display name, @username
  - Mutual count ("X mutuals")
  - Shared interest tags (e.g. `⚽ Football`, `🎮 FPS`) — up to 3 shown, overflow as "+N more"
  - Sponsor affiliation badge — sponsor logo (16 dp) + sponsor name, shown if user has an active sponsor
  - **Player Card preview link** — "View Player Card →" tappable link; navigates to that user's full Player Card page (not an inline render)
  - Tap anywhere else on the row → that user's Profile Page.
- Clear (×) button appears when input is non-empty. Clearing resets to conversation list.

### 4.3 Friend Requests Panel

- Collapsed by default into a tappable chip: "**N Friend Requests**" with a notification badge.
- Tap chip → expands inline into a vertical list of pending requests.
- **Request Row (incoming):**

  ```
  ┌──────────────────────────────────────┐
  │ [Avatar]  Display Name               │
  │           @username · Mutual: X      │
  │           [Accept ✓]  [Decline ✗]   │
  └──────────────────────────────────────┘
  ```

  - **Accept:** Adds friend, row animates out, conversation opens immediately.
  - **Decline:** Removes row with dismiss animation. No confirmation required.

- **Outgoing Request Row** (requests sent by the current user, not yet accepted):

  ```
  ┌──────────────────────────────────────┐
  │ [Avatar]  Display Name               │
  │           @username · Pending        │
  │           [Cancel ✗]                 │
  └──────────────────────────────────────┘
  ```

  - **Cancel:** Withdraws the sent friend request immediately; row animates out. No confirmation required. The recipient's incoming request is also removed.

- Tap avatar or name → navigates to that user's Profile Page.
- If 0 pending requests (incoming or outgoing), chip is hidden.

**Removing an existing friend:** Long-press a conversation row → context menu appears with **Remove Friend** option. A confirmation dialog ("Remove [Name] as a friend?") requires confirmation before proceeding. On confirm: friendship is dissolved, the conversation is archived (messages retained), and both users' friend counts update. The former friend's DM thread moves to an "Archived" section accessible via Tab 1 search.

### 4.4 Conversation List

Vertically scrollable list combining DMs and group chats, ordered by most recent activity.

**Conversation Row:**

```
┌────────────────────────────────────────┐
│ [Avatar / Group Icon]  Display Name    │
│                        Last message    │
│                        preview (1 line,│
│                        truncated)      │
│                                [Time]  │
│                          [Unread dot]  │
└────────────────────────────────────────┘
```

- **Avatar:** 48 dp circle for DMs; rounded square for group chats. Tap → opens conversation.
- **Last message preview:** Sender prefix for groups ("You:", "Rahul:"). Media placeholder text for non-text messages ("[Photo]", "[Video]").
- **Time:** Relative format ("5m", "2h", "Mon"); absolute on long-press.
- **Unread dot:** Accent-coloured dot with unread count (capped at "99+") on the right when messages are unread.
- **Swipe right on row:** Reveals "Pin" action. Pinned conversations move to top of list with a pin icon.
- **Swipe left on row:** Reveals "Mute" and "Delete" actions.
  - Mute → silences notifications for this conversation; moon icon overlays avatar.
  - Delete → confirmation alert before removal.
- **Tap row** → opens the **Chat View** (see §4.6).

### 4.5 Community Servers Section

Below the DM/group list, a sub-section header "Community Servers" separates platform-level group servers.

**Server Row:**

```
┌────────────────────────────────────────┐
│ [Server Icon]  Server Name             │
│                Last activity · N members│
│                                [Time]  │
└────────────────────────────────────────┘
```

- Servers are pre-defined platform channels (e.g., general, esports, sports, game dev).
- Tap row → opens the server's **Chat View** in a read-all / reply mode.
- Users cannot create or delete community servers.

> **Scope note:** Community Servers shown here are read-all / reply channels. Creation, moderation, and channel management are admin-only and web-console only. The mobile view is read + reply only; no admin actions are available on mobile.

### 4.6 Chat View (Drill-In)

Navigated to from any conversation or server row.

```
┌──────────────────────────────────────┐
│  [← Back]  [Name / Avatar]  [Info ℹ]│  ← custom nav bar
├──────────────────────────────────────┤
│                                      │
│  [Date divider — "Today"]            │
│                                      │
│             [Message bubble] (them)  │
│  [Message bubble] (you)              │
│             [Message bubble] (them)  │
│  …                                   │
│                                      │
├──────────────────────────────────────┤
│  [+ Attach] [Input field…] [Send ▶]  │  ← fixed bottom
└──────────────────────────────────────┘
```

- **Message bubble:** Sender avatar (group only), display name (group only), text body, timestamp (shown on tap).
- **Long-press bubble:** React (emoji picker), Reply, Copy, Delete (own messages only).
- **Attach (+):** Opens picker — Camera, Gallery, File.
- **Info (ℹ):** Opens conversation info sheet — member list, mute toggle, leave group, report.
- DMs support voice notes (hold microphone icon, release to send).

### 4.7 FAB — Compose

- Circular button, bottom-right, 56 dp, brand accent colour. Icon: pencil / compose.
- Tap → opens **New Conversation Sheet**: search field + friend list to select recipients.
  - Single recipient → opens DM.
  - Multiple recipients → prompts group name + opens group chat.

### 4.8 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton conversation rows |
| Empty (no conversations) | Illustration + "No chats yet — add friends to start!" |
| Empty search results | "No users found for '[query]'" |
| Error | Retry button with error message |

### 4.9 Weekly / Monthly Interest Update Prompt

Per-user settings control how often the interest update prompt fires (weekly or monthly). When the interval elapses, a modal popup is shown on next app open or return to the Friends page:

```
┌──────────────────────────────────────┐
│  Update Your Interests               │
│  ─────────────────────────────────── │
│  Keep your friend suggestions fresh! │
│  Your current interests:             │
│  [⚽ Football] [🎮 FPS] [🏊 Swimming]│
│                                      │
│  [Edit Interests]     [Maybe Later]  │
└──────────────────────────────────────┘
```

- **Edit Interests:** Opens the Interests selection screen (same flow as onboarding). On save, the friend suggestion algorithm re-runs immediately using the updated interest tags.
- **Maybe Later:** Dismisses the popup. The prompt will not re-appear for 7 days regardless of the user's base interval setting.
- The popup does **not** appear if the user has updated their interests within the current interval window.

---

## 5. Tab 2 — Activities & Events

### 5.1 Layout

```
┌──────────────────────────────────┐
│  Filter Chips [All | Live | Past]│  ← sticky, single-select
├──────────────────────────────────┤
│  Activity Feed (scroll)          │
│  ┌──────────────────────────┐    │
│  │ Activity Card            │    │
│  └──────────────────────────┘    │
│  …                               │
└──────────────────────────────────┘
```

### 5.2 Filter Chips

- Three chips: **All · Live · Past** — single-select, sticky below tab bar.
- **All** (default): shows all events friends have joined, ordered by recency.
- **Live:** only events currently ongoing.
- **Past:** only completed events.
- Active chip: filled accent. Inactive: outlined.

### 5.3 Activity Card

```
┌──────────────────────────────────────┐
│  [Event Cover Thumbnail]             │
│  Event Title (bold, 1 line)          │
│  Date · Venue                        │
│                                      │
│  [Avatar][Avatar][Avatar] +N friends │
│  "Rahul, Aarav and 4 others joined"  │
│                                      │
│  [Status pill: Live / Upcoming / Done]│
└──────────────────────────────────────┘
```

- **Event Cover:** Full-width image at top of card, aspect ratio 16:9.
- **Friend avatars:** Up to 3 overlapping 24 dp circles; "+N" label for overflow.
- **Status pill:** Colour-coded — green (Live), blue (Upcoming), grey (Done).
- **Card tap** → Event Details View for that event.
- **Friend avatar tap** → that friend's User Profile Page.

### 5.4 Feed Behaviour

- Ordered by event start date (Live first, then Upcoming, then Past by recency).
- **Infinite scroll** (20 items per page).
- **Pull-to-refresh** supported.

### 5.5 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton activity cards |
| Empty | Illustration + "None of your friends have joined events yet" |
| Empty (Live filter) | "No live events right now" |
| Empty (Past filter) | "No past events to show" |
| Error | Retry button |

---

## 6. Tab 3 — Recent Achievements

### 6.1 Layout

```
┌──────────────────────────────────┐
│  Achievement Feed (scroll)       │
│  ┌──────────────────────────┐    │
│  │ Achievement Card         │    │
│  └──────────────────────────┘    │
│  …                               │
└──────────────────────────────────┘
```

### 6.2 Achievement Card

```
┌──────────────────────────────────────┐
│  [Avatar]  Display Name              │
│            @username · Timestamp     │
│                                      │
│  [Trophy icon]  Achievement Title    │
│  "Won 1st place in League 2026"      │
│  +X pts · +Y fans for [Sponsor]      │
│                                      │
│  [♥ React]  [↗ Share]               │
└──────────────────────────────────────┘
```

- **Achievement types:** Event win (1st/2nd/3rd), challenge completion, sponsor milestone, Hall of Fame entry.
- **Trophy icon colour:** Gold (1st), Silver (2nd), Bronze (3rd), accent colour (challenge / milestone).
- **Points & fans row:** Hidden if zero.
- **Avatar tap** → that friend's User Profile Page.
- **React (♥):** Toggles congratulations reaction. Count shown if > 0. Animates with scale bounce.
- **Share (↗):** Opens native share sheet with a deep-link to the relevant event/challenge result.

### 6.3 Feed Behaviour

- Ordered by recency (newest first).
- **Infinite scroll** (20 items per page).
- **Pull-to-refresh** supported.
- **Real-time:** New achievements push a banner chip at top: "New achievement from [Name] — tap to refresh".

### 6.4 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton achievement cards |
| Empty | Illustration + "No recent achievements — challenge your friends!" |
| Error | Retry button |

---

## 7. Tab 4 — Challenge Friends

### 7.1 Layout

```
┌──────────────────────────────────┐
│  Domain Filter Chips (scroll)    │
│  [All][Physical][Digital]        │
├──────────────────────────────────┤
│  Difficulty Filter [All|Easy|    │
│  Medium|Hard|Legend]             │
├──────────────────────────────────┤
│  Challenge Cards (scroll)        │
│  ┌──────────────────────────┐    │
│  │ Challenge Card           │    │
│  └──────────────────────────┘    │
│  …                               │
├──────────────────────────────────┤
│  Incoming Invitations [N]        │
│  ┌──────────────────────────┐    │
│  │ Invitation Row           │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

### 7.2 Filter Chips

- **Domain:** All · Physical · Digital — horizontal scrollable, single-select.
- **Difficulty:** All · Easy · Medium · Hard · Legend — horizontal scrollable, single-select.
- Both filter rows are sticky below the tab bar; applying either re-fetches the challenge list.

### 7.3 Challenge Card

```
┌──────────────────────────────────────┐
│  [Domain icon]  Challenge Name       │
│  Domain · Difficulty pill            │
│  +X pts on completion                │
│  Time limit: 48 hrs (if applicable)  │
│  [Resource link]                     │
│                                      │
│  [Challenge a Friend →]              │
└──────────────────────────────────────┘
```

- **Domain icon:** Dumbbell (Physical) or controller (Digital).
- **Difficulty pill:** Colour-coded — green (Easy), yellow (Medium), orange (Hard), red (Legend).
- **Resource link:** Tappable URL if a reference resource is attached; opens in system browser.
- **Challenge a Friend button:** Tap → opens **Send Challenge Invite Sheet** (see §7.5).
- **Card tap** → Challenge detail view in Challenge Browser (read-only).
- **In-progress indicator:** If the viewing user has already accepted this challenge and it is In Progress, an amber "In Progress" pill appears in the top-right corner of the card and the "Challenge a Friend" button is replaced with "View Progress →" (navigates to the Submission Screen). Cross-reference: Points & Challenges page §9.1 (Active Challenges strip) for the full in-progress badge behavior and countdown display.

### 7.4 Incoming Challenge Invitations

**Notification delivery:** When a friend sends a challenge invite, the recipient receives an FCM push notification: "[Username] challenged you to [Challenge Name]." Tapping the notification deep-links directly to Tab 4 (Challenge Friends), scrolling to and auto-expanding the Pending Invitations section. If the app is in the foreground, an in-app banner appears instead.

**Pending Invitations section** — collapsed chip "**N Incoming Challenge Invites**" shown at the bottom of the tab content (below challenge cards).

- Tap chip → expands inline into a list of invitation rows.
- Chip is hidden when there are zero pending invitations.

**Invitation Row:**

```
┌──────────────────────────────────────┐
│ [Avatar]  Display Name               │
│           Challenge Name · Difficulty│
│           Sent: 2 hours ago          │
│           [Accept]  [Decline]        │
└──────────────────────────────────────┘
```

- **Accept** → marks the challenge as **In Progress** for the accepting user (the challenge now appears in their active challenges on the Point System page). Both the acceptor and inviter receive a confirmation notification. Row animates out.
- **Decline** → dismisses row with animation. Inviter is notified. No confirmation required.
- Invitations expire after 48 hours if unanswered; an "Expired" badge replaces the Accept/Decline buttons before the row auto-dismisses.

### 7.5 Send Challenge Invite Sheet

**Appearance:** Bottom sheet with handle.

```
┌──────────────────────────────────────┐
│  Challenge: [Challenge Name]         │
│  ─────────────────────────────────── │
│  Search friends…  [input]            │
│  ┌─────────────────────────────────┐ │
│  │ [Avatar]  Name    [Invite →]    │ │
│  └─────────────────────────────────┘ │
│  …                                   │
│            [Send Invites]            │
└──────────────────────────────────────┘
```

- Lists friends not already invited to this challenge.
- Multi-select: tap "Invite →" toggles selection (filled accent icon).
- **Send Invites:** Dispatches invitations to all selected friends; snackbar "Invites sent". Sheet dismisses.

### 7.6 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton challenge cards |
| Empty (filtered) | "No challenges match your filters" |
| Empty (all) | "No challenges available yet" |
| No invitations | Invitations chip hidden |
| Error | Retry button |

---

## 8. Tab 5 — Team Up For Event

### 8.1 Layout

```
┌──────────────────────────────────┐
│  Event Selector (dropdown/chip)  │
│  [Select an Event…]              │
├──────────────────────────────────┤
│  Your Team Status                │
│  ┌──────────────────────────┐    │
│  │ Team Panel               │    │
│  └──────────────────────────┘    │
├──────────────────────────────────┤
│  Open Public Teams               │
│  ┌──────────────────────────┐    │
│  │ Team Row                 │    │
│  └──────────────────────────┘    │
│  …                               │
├──────────────────────────────────┤
│  Friends Available for This Event│
│  ┌──────────────────────────┐    │
│  │ Friend Row               │    │
│  └──────────────────────────┘    │
│  …                               │
└──────────────────────────────────┘
```

### 8.2 Event Selector

- Full-width dropdown chip at top: "Select an Event…".
- Tap → opens a searchable modal sheet listing upcoming events the user is registered for or eligible to join.
- Once selected, all sub-sections below filter to that event.
- Persists last-selected event across tab re-visits during the session.

### 8.3 Your Team Status Panel

Shown only after an event is selected.

```
┌──────────────────────────────────────┐
│  🏆 [Event Name]                     │
│  ─────────────────────────────────── │
│  Team: Alpha                         │
│  Members (3/5):                      │
│  [Avatar][Avatar][Avatar][+][+]      │
│  Status: Open · Looking for 2 more   │
│                                      │
│  [Invite Friends]  [Toggle Visibility]│
└──────────────────────────────────────┘
```

- **No team yet:** Shows "You haven't formed a team for this event yet." with a "Register for Event" CTA if not registered, or "Create / Join a Team" CTA if registered.
- **Members:** Up to 5 slots shown as circles. Empty slots are greyed-out rings with a `+` icon.
- **Toggle Visibility:** Switch between Public (joinable by others) and Private (invite-only). Reflects immediately.
- **Invite Friends:** Tap → opens **Send Team Invite Sheet** (see §8.7).

#### Incoming Join Requests (Captain Only)

Shown below the team members row when the team status is **Open** (Public) and there are pending join requests.

```
┌──────────────────────────────────────┐
│  Join Requests (3)                   │
│  ┌─────────────────────────────────┐ │
│  │ [Avatar]  Display Name          │ │
│  │           @username             │ │
│  │           [Accept ✓] [Decline ✗]│ │
│  └─────────────────────────────────┘ │
│  …                                   │
└──────────────────────────────────────┘
```

- **Request Row:** Avatar (32 dp), display name, @username.
- **Accept (✓):** Adds member to team immediately; request row animates out; snackbar "Added [Name] to team". If team reaches max members, status auto-switches to **Closed**.
- **Decline (✗):** Removes request with dismiss animation; requester is notified.
- **Avatar tap:** Opens that user's User Profile Page.
- **Empty state (no requests):** Section hidden.

### 8.4 Open Public Teams

Horizontally scrollable list of teams for the selected event that are publicly open and accepting members.

**Team Row:**

```
┌──────────────────────────────────────┐
│  Team Name                           │
│  [Avatar][Avatar][Avatar] +N         │
│  Captain: Display Name               │
│  Slots open: X                       │
│  [Request to Join]                   │
└──────────────────────────────────────┘
```

- **Request to Join:** Tap → sends join request to team captain. Button changes to "Requested" (disabled outlined). Captain accepts/declines via their Team Status Panel.
- **If already on a team for this event:** "Request to Join" replaced with "Already Teamed" (disabled).

### 8.5 Friends Available for This Event

Vertical list of friends who are registered for the selected event but not yet on a team (or on a public team with open slots).

**Friend Row:**

```
┌──────────────────────────────────────┐
│ [Avatar●]  Display Name              │
│            @username  [● online]     │
│            Team: None / [Team Name]  │
│            [Send Team-Up Request]    │
└──────────────────────────────────────┘
```

- **Online status dot (●):** Green 8 dp dot overlaid on the avatar bottom-right, visible when the friend is currently active (same real-time WebSocket source as Tab 1). Hidden when offline.
- **Send Team-Up Request:** Tap → sends invite; button changes to "Requested" (disabled). The recipient receives an FCM push notification: "[Username] invited you to team up for [Event Name]." Tapping the notification deep-links to Tab 5 → the sending user's name appears in a "Pending Team Invites" chip at the top of the tab (above the Event Selector); tapping the chip expands inline rows with **Accept** / **Decline** per invite. If the app is in foreground, an in-app banner appears instead.
- **Avatar tap** → that friend's User Profile Page.

### 8.6 Team-Join Preference Toggle

Displayed at the top of Tab 5 content, above the Event Selector, as a persistent user preference row:

```
┌──────────────────────────────────────┐
│  Team Invites from Others            │
│  [Open] [Closed] [Invite Only]  ←→  │
└──────────────────────────────────────┘
```

- **Open:** Any registered user can send you a team-up invite for any event.
- **Closed:** No one can send you team invites (existing teams and requests are unaffected).
- **Invite Only:** Only friends can send you team invites.
- Selection is persisted to the user's profile and takes effect immediately. Other users' "Send Team-Up Request" and "Invite" buttons are disabled or hidden for you according to your preference.
- Default: **Open**.

### 8.7 Send Team Invite Sheet

**Appearance:** Bottom sheet with handle.

```
┌──────────────────────────────────────┐
│  Invite to: [Team Name]              │
│  Event: [Event Name]                 │
│  ─────────────────────────────────── │
│  Search friends…  [input]            │
│  ┌─────────────────────────────────┐ │
│  │ [Avatar]  Name  Status [Invite]  │ │
│  └─────────────────────────────────┘ │
│  …                                   │
│            [Send Invites]            │
└──────────────────────────────────────┘
```

- Lists friends registered for the event who are not already on the user's team.
- Friends already on another team shown with their team name and greyed "Invite" button.
- **Send Invites:** Dispatches invitations; snackbar "Team invites sent". Sheet dismisses.

### 8.8 States

| State | Behaviour |
|---|---|
| No event selected | Placeholder illustration + "Select an event to find teammates" |
| Loading (after selection) | Skeleton team panel + 3 skeleton rows |
| No upcoming events available | "No upcoming events to team up for" |
| No open public teams (event selected) | "No open teams for this event yet" |
| No available friends | "None of your friends are registered for this event — invite them!" |
| Error | Retry button per section |

---

## 9. Popups & Modals Triggered from This Page

### 9.1 Account Actions Popup
**Trigger:** Tap viewer's profile picture in status bar.
**Behaviour:** Standard Account Actions Popup (Edit + Actions tabs) — see User Profile spec §8.1.

### 9.2 New Conversation Sheet
**Trigger:** FAB on Tab 1.
**Appearance:** Full-screen modal.

- Search field at top.
- Friend list below; multi-select with checkboxes.
- Single selection → "Start DM" button. Multiple → prompts group name field, then "Create Group" button.

### 9.3 Send Challenge Invite Sheet
See §7.5.

### 9.4 Send Team Invite Sheet
See §8.7.

### 9.5 FAB Scope Clarification

The FAB visible on Tab 1 opens the **New Conversation Sheet** (compose DM / group chat) — see §9.2. It does **not** open an Add Post Popup.

The **Add Post Popup** (spec §6.5) is triggered by the FAB on the **Home page**, not on the Friends page. The Friends page has no Add Post entry point; users create posts from the Home page FAB.

---

## 10. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap | Opens Account Actions Popup |
| Tab bar item | Tap or horizontal swipe | Switches active tab |
| Search bar (Tab 1) | Type | Filters conversation list |
| Search bar (Tab 1) | Submit | Platform-wide user search |
| Active Now chip (Tab 1) | Tap | Expands online friends strip |
| Friend Request chip | Tap | Expands request list |
| Accept button (incoming request) | Tap | Adds friend; row removes |
| Decline button (incoming request) | Tap | Dismisses row |
| Cancel button (outgoing request) | Tap | Withdraws sent request; row removes |
| Conversation row | Tap | Opens Chat View |
| Conversation row | Swipe right | Reveals Pin action |
| Conversation row | Swipe left | Reveals Mute / Delete actions |
| Server row | Tap | Opens server Chat View |
| FAB (Tab 1) | Tap | Opens New Conversation Sheet (DM compose) |
| Message bubble | Long-press | React / Reply / Copy / Delete menu |
| Filter chips (Tab 2) | Tap | Filters activity feed |
| Activity card | Tap | Event Details View |
| Activity card friend avatar | Tap | Friend's User Profile |
| Achievement card avatar | Tap | Friend's User Profile |
| React button | Tap | Toggles congratulations reaction |
| Share button | Tap | Native share sheet |
| Domain / difficulty chip (Tab 4) | Tap | Filters challenge list |
| Challenge card | Tap | Challenge detail view |
| Challenge a Friend button | Tap | Opens Send Challenge Invite Sheet |
| Incoming challenge invite Accept | Tap | Marks challenge In Progress; both users notified |
| Incoming challenge invite Decline | Tap | Declines invite; inviter notified |
| Challenge invite expiry (48 hrs) | Auto | "Expired" badge shown; row auto-dismissed |
| Send Invites (challenge) | Tap | Dispatches challenge invitations |
| Event Selector (Tab 5) | Tap | Opens event picker modal |
| Team-join preference toggle (Tab 5) | Tap | Sets Open / Closed / Invite Only preference |
| Toggle Visibility | Toggle | Switches team public/private |
| Invite Friends (team) | Tap | Opens Send Team Invite Sheet |
| Request to Join (team) | Tap | Sends join request to captain |
| Send Team-Up Request | Tap | Sends team invite to friend |
| Send Invites (team) | Tap | Dispatches team invitations |
| History list / feeds | Pull down | Pull-to-refresh |
| History list / feeds | Scroll to bottom | Loads next page |

---

## 11. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Conversation list (Tab 1) | "No chats yet — add friends to start!" | Retry button |
| Search results (Tab 1) | "No users found for '[query]'" | — |
| Friend requests | Chip hidden | — |
| Active Now strip (Tab 1) | Chip hidden | — |
| Activity feed (Tab 2) | "None of your friends have joined events yet" | Retry button |
| Achievement feed (Tab 3) | "No recent achievements" | Retry button |
| Challenge list (Tab 4) | "No challenges match your filters" | Retry button |
| Incoming challenge invitations (Tab 4) | Chip hidden | — |
| Team status (Tab 5, no team) | Prompt to register or create team | — |
| No upcoming events (Tab 5) | "No upcoming events to team up for" | Retry button |
| Open public teams (Tab 5, event selected) | "No open teams for this event yet" | Retry button |
| Available friends (Tab 5) | "None of your friends are registered for this event — invite them!" | Retry button |

---

## 12. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching live content shapes):

- Conversation list (Tab 1): 3 skeleton rows (circle + 2 text lines + time).
- Activity feed (Tab 2): 3 skeleton cards (rect image + 3 text lines + avatar row).
- Achievement feed (Tab 3): 3 skeleton cards (avatar circle + 3 text lines).
- Challenge list (Tab 4): 3 skeleton cards (icon + 3 text lines + button).
- Team Up sections (Tab 5): skeleton team panel + 3 skeleton friend rows.

No spinners in main body; pull-to-refresh uses the native platform refresh indicator. "Load more" at list bottoms uses a small inline spinner.
