# Union Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/union` (`src/app/(drawer)/union.tsx`)
**Visibility:** Member+ only (Users and guests redirected away)

> Full Union workspace (Kanban, Gantt, Calendar, strict task creation) is **Web-only**. Mobile shows a "Manage on Web" redirect card for those views. This document covers only the mobile subset.

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│  Task Reminder Banner               │  ← conditional, below status bar
├─────────────────────────────────────┤
│                                     │
│  My Tasks section (scroll)          │
│                                     │
│  On-Duty Calendar section           │
│                                     │
│  Automated Task Chats section       │
│                                     │
│  "Manage on Web" redirect card      │
│                                     │
└─────────────────────────────────────┘
│  FAB  [+ Quick Add]                 │  ← fixed bottom-right
└─────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (≡) | Tap → opens the Side Drawer overlay |
| Center | "Union" wordmark | Non-interactive |
| Right | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

---

## 3. Task Reminder Banner

Shown inline directly below the status bar **only** when the user has at least one task with a deadline within 24 hours.

```
┌──────────────────────────────────────────────┐
│  ⚠  "Design Poster" due in 6 hours  [View →] │
└──────────────────────────────────────────────┘
```

- Single-line, full-width, accent amber background.
- If multiple tasks are near-deadline, the banner cycles through them with a 4-second auto-scroll. A dot indicator shows current position (e.g., ● ○ ○).
- Tapping **View →** scrolls to that task in the My Tasks list below.
- Dismissible per task via swipe-up. Dismissed state is session-only (reappears on next app open).

---

## 4. My Tasks Section

### 4.1 Layout

```
┌──────────────────────────────────────┐
│  My Tasks                  [Filter ▾]│  ← section header
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ Task Row                       │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Task Row                       │  │
│  └────────────────────────────────┘  │
│  …                                   │
└──────────────────────────────────────┘
```

Only tasks **explicitly assigned to the logged-in user** are shown here.

### 4.2 Task Row

```
┌──────────────────────────────────────────────────┐
│  [Status dot]  Task Title (bold, 1 line truncated)│
│  [Type badge]  Event tag · Priority chip          │
│  Deadline                                         │
│  [View Chat →]                                    │
└──────────────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| Status dot | ● Green (Active) · ● Amber (On-Hold) · ● Red (Abandoned) · ● Grey (Completed) |
| Type badge | Pill indicating task type: `Quick` (teal) · `Standard` (blue) · `Pathway` (violet) · `Event Task` (orange). Always visible so users can distinguish task types at a glance. |
| Event tag | Name of linked event, if any; hidden if task has no event association |
| Priority chip | 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low |
| Deadline | Relative format ("3 days left", "Overdue" in red). Pathway tasks show "Abandoned" in muted grey when auto-transitioned due to inactivity. |
| View Chat → | Tappable link; opens the automated task group chat (see §6) |

#### Pathway Task
Pathway tasks represent continuous, trackable operational pathways with deadlines. The task row displays dynamic track updates in the description line when available. When a Pathway task's track becomes inactive, it auto-transitions to **Abandoned** status — the status dot turns red and the deadline area shows "Abandoned (auto)" to distinguish from a manually abandoned task.

- **Tap row** → opens Task Detail Sheet (see §7).
- **Swipe left on row** → reveals "Mark Complete" and "Mark On-Hold" quick actions. Members can only quick-action their own tasks; Core+ can quick-action any task.

### 4.3 Filter

Tapping **Filter ▾** in the section header opens a bottom sheet with:

- **Status:** Active · On-Hold · Abandoned · Completed (multi-select, default: Active + On-Hold)
- **Priority:** All · Critical · High · Medium · Low (single-select, default: All)
- **Task Type:** All · Quick · Standard · Pathway · Event Task (single-select, default: All)

Applying filter filters the already-loaded task list client-side; no additional network request.

Supports pull-to-refresh to reload assigned tasks from the server.

### 4.4 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton task rows |
| Empty | "You have no tasks assigned" |
| Empty (filtered) | "No tasks match your filters" + Clear link |
| Error | Retry button |

---

## 5. On-Duty Calendar Section

### 5.1 Layout

```
┌──────────────────────────────────────┐
│  On-Duty                             │  ← section header
├──────────────────────────────────────┤
│  ◄  June 2026  ►                     │  ← month navigator
├─────┬─────┬─────┬─────┬─────┬───────┤
│ Mon │ Tue │ Wed │ Thu │ Fri │ ...   │
├─────┼─────┼─────┼─────┼─────┼───────┤
│  22 │  23 │  24 │  25 │  26 │ ...   │
│     │     │     │ [●] │ [●] │       │
│  29 │  30 │   1 │   2 │   3 │ ...   │
│ [●] │     │     │ [●] │     │       │
└─────┴─────┴─────┴─────┴─────┴───────┘
│  Today's Duty:  Dhruvin, Kashyap     │
└──────────────────────────────────────┘
```

- A compact monthly grid showing which days have an assigned coordinator on duty. Week starts Monday.
- **[●] dot** on a day indicates at least one crew member is on duty that day.
- Dot colour reflects role: Coordinator (brand blue) · Core (purple) · Member (grey).
- **Tap a day** → expands a popover listing all on-duty members for that day with their name, role badge, and a "Message" shortcut.
- **Today's Duty strip** below the grid always shows today's on-duty members at a glance.
- Month navigation arrows (◄ ►) fetch the previous/next month's duty roster.

### 5.2 My Duty Days

Days on which the **logged-in user** is on duty are highlighted with a filled accent circle (not just a dot) so they stand out.

Supports pull-to-refresh to reload the current month's duty roster.

### 5.3 Google Calendar Sync

Google Calendar sync is a two-way integration defined in spec §5.13. Mobile/web boundary:

- **Configuration** is done on the web console (connect Google account, select calendars, choose sync direction).
- **Sync notifications** (e.g., a new task deadline exported, or a meeting imported) appear on mobile via background sync.
- Task deadline exports and meeting imports are reflected in the mobile On-Duty Calendar view automatically — no user action required on mobile after initial setup on web.
- The mobile calendar is **read-only** with respect to Google Calendar sync; edits to synced events must be made on Google Calendar or the web console.

### 5.4 States

| State | Behaviour |
|---|---|
| Loading | Shimmer over the calendar grid |
| No duty assigned this month | "No on-duty assignments this month" in place of grid |
| Error | Retry button |

---

## 6. Automated Task Chats Section

### 6.1 Layout

```
┌──────────────────────────────────────┐
│  Task Chats                          │  ← section header
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ Chat Row                       │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Chat Row                       │  │
│  └────────────────────────────────┘  │
│  …                                   │
└──────────────────────────────────────┘
```

Only task-linked group chats where the user is an assignee are listed here. Tasks where the user is creator but not an assignee are excluded; the creator must explicitly assign themselves to see the chat here. **Chat rooms are visible only to assigned members; non-assignees do not see the chat link** on the task row or in this section.

### 6.2 Chat Row

```
┌──────────────────────────────────────────────┐
│  [Task icon]  Task Name (bold)               │
│              Last message preview (1 line)   │
│                              [Time] [Unread] │
└──────────────────────────────────────────────┘
```

- **Tap row** → opens the Chat View within the Friends Page chat stack (same UI, navigated from union context with back arrow returning here).
- **Unread badge:** Accent-coloured dot with count (capped at "99+").
- Chat rooms are **auto-created** when a task is assigned; they cannot be manually created or deleted from mobile.

Supports pull-to-refresh to reload task chats.

### 6.3 States

| State | Behaviour |
|---|---|
| Loading | 3 skeleton chat rows |
| Empty | "No task chats yet — chats appear when you're assigned a task" |

---

## 7. "Manage on Web" Redirect Card

Displayed at the bottom of the scrollable content, always visible regardless of role.

```
┌──────────────────────────────────────────────────┐
│  🖥  Full Union Workspace                        │
│  Kanban, Gantt, Calendar, strict task creation,  │
│  and Crew Allocation Heatmap are available on    │
│  the web console.                                │
│                                                  │
│              [Open Web Console →]                │
└──────────────────────────────────────────────────┘
```

- **Open Web Console →** opens the web admin URL in the system browser.
- Card is non-dismissible.
- **Crew Allocation Heatmap** (spec §5.13): web-console only. Shows crew member workload distribution across events. Not available on mobile.

---

## 8. FAB — Quick Add Task

- Circular button, fixed bottom-right, 56 dp, brand accent colour. Icon: **+**.
- Tap → opens the **Quick Add Sheet** (see §9).

---

## 9. Quick Add Sheet

A lightweight bottom sheet for rapid task logging without full details.

```
┌──────────────────────────────────────┐
│  Quick Add Task              [✕]     │
│  ─────────────────────────────────── │
│  Task title *                        │
│  [________________________]          │
│                                      │
│  Priority                            │
│  [Low ▾]                             │
│                                      │
│  Assign to (optional)                │
│  [Search member…]                    │
│                                      │
│  Link to event (optional)            │
│  [Select event…]                     │
│                                      │
│     [Save as Unassigned / Save ▸]    │
└──────────────────────────────────────┘
```

| Field | Required | Detail |
|---|---|---|
| Task title | Yes | Free text, max 120 chars |
| Priority | No | Low (default) · Medium · High · Critical |
| Assign to | No | Searchable member list; multi-select |
| Link to event | No | Searchable dropdown of active events |

- Button label is conditional: **"Save as Unassigned"** when Assign to is empty (creates task with no assignee, status `Active`, appears in web console's List View for later assignment); **"Save"** when at least one assignee is selected (task appears in each assignee's My Tasks immediately).
- If **Assign to** is filled, task appears in that member's My Tasks list immediately.
- Sheet dismisses on save or on tapping ✕ / dragging down.
- No sub-tasks, deadlines, or privacy settings — those require the web console's Strict Task Creation Form.
- **Deadline field is not available in Quick Add.** To set a deadline, use Strict Add on the web console.

---

## 10. Task Detail Sheet

Opens when tapping a task row in My Tasks. A bottom sheet covering ~85% of screen height, scrollable.

```
┌──────────────────────────────────────┐
│  [← Back]  Task Title        [⋯]    │
├──────────────────────────────────────┤
│  Status:   [Active ▾]               │
│  Priority: [High]                    │
│  Deadline: Jun 28, 2026              │
│  Event:    Offside 2026              │
│  Assignees: [Avatar] [Avatar]        │
├──────────────────────────────────────┤
│  Description                         │
│  Lorem ipsum…                        │
├──────────────────────────────────────┤
│  Sub-tasks  (1 / 3 complete)         │
│  ☑ Design cover art                  │
│  ☐ Write description                 │
│  ☐ Get approval                      │
├──────────────────────────────────────┤
│  Updates (thread)                    │
│  ┌─────────────────────────────────┐ │
│  │ [Avatar] Dhruvin · 2h ago       │ │
│  │ "Posted draft on drive"         │ │
│  └─────────────────────────────────┘ │
│  [Add update…]                       │
├──────────────────────────────────────┤
│  [Open Task Chat]                    │
└──────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Status dropdown [Active ▾] | Tap → inline picker: Active · On-Hold · Abandoned · Completed. Member can only change status of their own tasks; Core+ can change any. Pathway tasks may show "Abandoned (auto)" as a read-only entry when auto-transitioned by the system; manual status changes to Abandoned are still allowed. |
| ⋯ actions | Edit (web redirect) · Copy link · Report issue |
| Sub-task checkboxes | Tap to toggle complete/incomplete for own tasks |
| Add update | Opens an inline text input; submits a threaded comment with optional file attachment (same media types as post attachments — images, PDFs, documents). |
| Open Task Chat | Navigates to the task's auto-generated group chat |

- **Editing title, deadline, assignees, or sub-task structure** is not available on mobile — tapping any of those fields shows a tooltip: "Edit task details on the web console."

---

## 11. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap | Opens Account Actions Popup |
| Task Reminder Banner — item | Tap [View →] | Scrolls to task in My Tasks |
| Task Reminder Banner | Swipe up | Dismisses for session |
| Task row | Tap | Opens Task Detail Sheet |
| Task row | Swipe left | Quick-action strip: Mark Complete / On-Hold |
| Task row — View Chat → | Tap | Opens task's auto-generated group chat |
| Filter ▾ (My Tasks) | Tap | Opens filter bottom sheet |
| Calendar day with duty | Tap | Popover of on-duty members |
| Month arrows ◄ ► | Tap | Navigates calendar month |
| Task Chat row | Tap | Opens Chat View |
| Open Web Console → | Tap | Opens web admin in system browser |
| FAB [+] | Tap | Opens Quick Add Sheet |
| Quick Add — Save | Tap | Creates task; sheet dismisses |
| Task Detail — Status | Tap | Inline status picker |
| Task Detail — sub-task checkbox | Tap | Toggles completion |
| Task Detail — Add update | Tap | Inline comment input |
| Task Detail — Open Task Chat | Tap | Navigates to group chat |
| Scrollable lists | Pull down | Pull-to-refresh |

---

## 12. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| My Tasks | "You have no tasks assigned" | Retry button |
| My Tasks (filtered) | "No tasks match your filters" + Clear link | Retry button |
| On-Duty Calendar | "No on-duty assignments this month" | Retry button |
| Task Chats | "No task chats yet" | Retry button |

---

## 13. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders):

- My Tasks: 3 skeleton rows (status dot + 2 text lines).
- On-Duty Calendar: Shimmer overlay on the full grid.
- Task Chats: 3 skeleton rows (icon circle + 2 text lines + time).

Pull-to-refresh uses the native platform refresh indicator at the top of the scroll view.
