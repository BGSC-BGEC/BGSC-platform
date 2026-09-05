# Users Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/users` (`src/app/(drawer)/users.tsx`)
**Drill-in Routes:**
- `/(stack)/users/[id]` — User Detail (taps through to `user-profile.md`)
**Visibility:** Coordinator+ role only — hidden from the drawer for User, Member, and Guest roles.
**Developer Assignee:** `[TBD]`
**Source:** Complete Feature Specification & Architecture §5.3 (Profile / Account); Navigation Drawer "Users Page (Coordinator+)"
**Design Tokens Reference:** `UI-UX-Master-Doc.md §4`

> **Purpose:** The Users page is the coordinator's roster management dashboard. It provides a searchable, filterable view of every registered account on the platform, with quick-access actions for role assignment, account status changes, and profile inspection — all without needing to navigate to individual profiles one at a time.

---

## 1. Page Structure & Master Viewport Architecture

```text
┌────────────────────────────────────────────────────────┐
│ [☰]                 [ BGSC LOGO ]            [Profile] │ ← Fixed Dynamic Status Bar
├────────────────────────────────────────────────────────┤
│  USERS                                                  │ ← Screen Title (BebasNeue, 48sp)
├────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐   │ ← Stats Banner (glass card)
│ │  1,284 total  ·  342 active this week  ·  +18↑   │   │
│ └──────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────┤
│  SEARCH:  [ 🔍 Search by name, username, email... ] [x]│ ← Search bar
├────────────────────────────────────────────────────────┤
│  FILTER CHIPS (horizontal scroll):                      │ ← Sticky filter row
│  [ All ] [ User ] [ Member ] [ Core ] [ Coord ] [+ more]│
│  [ Active ] [ Disabled ] [ Pending Delete ]             │
├────────────────────────────────────────────────────────┤
│ ▼ MAIN SCROLL VIEW                                      │
│                                                         │
│  Sort: [ Recent Activity ▼ ]                            │
│                                                         │
│  ╭──────────────────────────────────────────────────╮  │
│  │ [av]  Rahul Mehta          @rahul_m        [Core] │  │ ← User card
│  │       📍 Nexus Energy · ⭐ 2,140 pts             │  │
│  │       Joined 12 Mar 2025 · Active 2h ago          │  │
│  ╰──────────────────────────────────────────────────╯  │
│  ╭──────────────────────────────────────────────────╮  │
│  │ [av]  Priya Sharma         @priya_s        [User] │  │
│  │       📍 Cafe Verde · ⭐ 890 pts                  │  │
│  │       Joined 3 Jan 2026 · Active 1d ago           │  │
│  ╰──────────────────────────────────────────────────╯  │
│  …                                                      │
└────────────────────────────────────────────────────────┘
```

- **Screen title** is not sticky — it scrolls away with the page.
- **Stats banner** scrolls away with the page (it's context, not navigation).
- **Search bar + filter chips** are sticky below the status bar once the title scrolls out.
- **User cards list** is the only scrollable body region.

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx` as the drawer navigator's header.

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger icon (☰) | Tap → opens the Side Drawer overlay |
| Center | "Users" wordmark | Non-interactive |
| Right | User's profile picture (circular, 36 px) | Tap → opens **Account Actions Popup** |

**Access gate:** The `users` drawer item only renders for roles ≥ Coordinator. If a user with a lower role somehow navigates to this route directly, they are immediately redirected to `/(drawer)/` with a snackbar: *"Access restricted to coordinators."*

---

## 3. Stats Banner

A single full-width glass card directly below the screen title. Renders one aggregate row of platform-wide stats. Data comes from `GET /users?summary=true`.

```text
┌──────────────────────────────────────────────────────┐
│  1,284 total  ·  342 active this week  ·  +18 this month │
└──────────────────────────────────────────────────────┘
```

| Stat | Value Source | Format |
|---|---|---|
| **Total** | `summary.total` | Plain number, e.g. `1,284 users` |
| **Active this week** | `summary.activeThisWeek` | Count of users with `last_seen` within 7 days |
| **New this month** | `summary.newThisMonth` | Count of users with `created_at` within 30 days, prefixed `+` |

- Stats are separated by `·` (middle dot) in a single line.
- Font: `Inter_600SemiBold` (14 sp, `colors.textMuted`), numbers in `JetBrainsMono_500Medium` (14 sp, `colors.text`).
- Card surface: `colors.surface` + `blur(20px)`, `borderRadius: 12`, `borderColor: colors.border`, `padding: 12`.
- Tapping any stat cell is **non-interactive** (no drill-in for these aggregates).
- The banner scrolls away with the page — it's informational, not sticky.

---

## 4. Search & Filter System

### 4.1 Search Bar

- **Positioning**: Sticky below status bar once the screen title has scrolled out of view. Before the title scrolls away, the search bar sits inline as part of the page flow.
- **Styling**: `height: 48`, `borderRadius: 24`, `backgroundColor: colors.surfaceMuted`, `borderWidth: 1`, `borderColor: colors.border`, `paddingHorizontal: 16`, `color: colors.text`. Magnifier icon left (16 dp, `colors.textMuted`). Clear `[x]` right when query > 0.
- **Behaviour**: Debounced 300 ms. Queries `GET /users?search=` against `display_name`, `username`, and `email` simultaneously. Results replace the full list inline.
- **Keyboard**: `returnKeyType="search"`. `KeyboardAvoidingView` wraps the scroll region so the bottom of the list is always reachable.

### 4.2 Filter Chip Rows

Two horizontally scrollable chip rows sit directly below the search bar, separated by a 6 dp gap.

**Row 1 — Role Filter** (single-select)

| Chip | Filters to |
|---|---|
| **All** | All roles (default) |
| **User** | `role === 'user'` |
| **Member** | `role === 'member'` |
| **Core** | `role === 'core'` |
| **Coordinator** | `role === 'coordinator'` |
| **Founder** | `role === 'founder'` — visible only to Founder+ |
| **Admin** | `role === 'admin'` — visible only to Admin |

**Row 2 — Status Filter** (multi-select)

| Chip | Filters to |
|---|---|
| **Active** | `status === 'active'` (default selected) |
| **Disabled** | `status === 'disabled'` |
| **Pending Delete** | `status === 'pending_deletion'` |
| **All Statuses** | Clears all status chips |

**Row 3 — Sponsor Filter** (optional; single-select — hidden by default, expandable via `[ + Sponsor ]` chip)

Dynamically populated from active sponsors. Narrows to users affiliated with that sponsor.

**Chip styles:** Active = `colors.accent` fill / `colors.accentText`. Inactive = transparent + 1 dp `colors.border` + `colors.textMuted` text. Capsule (`borderRadius: 999`, `height: 36`). `Inter_600SemiBold` 12 sp.

### 4.3 Sort Control

A single-line sort selector sits at the top of the list area (below filters, scrolls with content):

| Option | Sort by |
|---|---|
| **Recent Activity** (default) | `last_seen` descending |
| **Newest First** | `created_at` descending |
| **Oldest First** | `created_at` ascending |
| **Most Points** | `points_balance` descending |
| **Alphabetical** | `display_name` ascending |

Rendered as: label `"Sort:"` (`Inter_600SemiBold`, 12 sp, `colors.textMuted`) + pill trigger on the right (`borderRadius: 20`, `height: 36`, `borderColor: colors.border`). Tapping opens a bottom action sheet listing the options.

---

## 5. User Card Anatomy

```text
╭──────────────────────────────────────────────────────╮
│ [av]  Rahul Mehta          @rahul_m      [Core] ·  ● │
│       📍 Nexus Energy · ⭐ 2,140 pts                  │
│       Joined 12 Mar 2025   Active 2h ago              │
╰──────────────────────────────────────────────────────╯
```

| Element | Spec |
|---|---|
| **Card surface** | `colors.surface` + `blur(20px)`, `borderRadius: 16`, 1 dp `colors.border`, `padding: 14`. Press-in: `scale: 0.98`, 120 ms spring. |
| **Avatar** | 44 dp circle, `borderWidth: 1.5`, `borderColor: colors.border`. Fallback initials tile (`colors.surfaceMuted` bg, `BarlowCondensed_700Bold`, `colors.textMuted`). |
| **Display Name** | `BarlowCondensed_700Bold`, 16 sp, `colors.text`, `numberOfLines: 1`. |
| **@username** | `Inter_400Regular`, 13 sp, `colors.textMuted`, inline after display name, 6 dp gap. |
| **Role Badge** | Capsule chip, `borderRadius: 999`, `height: 22`, `paddingHorizontal: 8`. Colour per role (see §5.1). `Inter_600SemiBold`, 11 sp. |
| **Status Dot** | 8 dp circle, right of role badge. Active: `colors.success` (#34D27B). Disabled: `colors.danger` (#F2686C). Pending delete: `colors.textMuted`. |
| **Sponsor line** | `Inter_400Regular`, 12 sp, `colors.textMuted`. Format: `📍 [Sponsor Name] · ⭐ [N,NNN] pts`. Points in `JetBrainsMono_500Medium`. |
| **Meta line** | `Inter_400Regular`, 11 sp, `colors.textMuted`. Format: `Joined [date]   Active [relative time]`. |

**Card tap:** Navigates to `/(stack)/users/[id]` (the same `user-profile.md` screen, in "coordinator view" mode — shows all fields including contact details, admin notes).

**Card long-press:** Opens **Quick Actions Sheet** (see §7) with haptic feedback `Haptics.impactAsync(Medium)`.

### 5.1 Role Badge Colours

| Role | Fill | Text |
|---|---|---|
| User | `colors.surfaceMuted` | `colors.textMuted` |
| Member | `rgba(91,156,248,0.15)` | `colors.info` (#5B9CF8) |
| Core | `rgba(232,102,42,0.15)` | `colors.accent` (#E8662A) |
| Coordinator | `rgba(245,197,24,0.15)` | `#F5C518` |
| Founder | `rgba(52,210,123,0.15)` | `colors.success` (#34D27B) |
| Admin | `rgba(242,104,108,0.15)` | `colors.danger` (#F2686C) |

---

## 6. User Quick-View Sheet

**Trigger:** Long-press on any user card.
**Appearance:** Bottom sheet (~65% screen height), glass surface (`blur(32px)`), `borderTopLeftRadius: 24`, `borderTopRightRadius: 24`, drag handle at top.

```text
┌────────────────────────────────────────────────────────┐
│            ━━━  (drag handle)                          │
│  [avatar 72dp]  Rahul Mehta                     [✕]   │
│                 @rahul_m · Core · ● Active             │
│                 📍 Nexus Energy · ⭐ 2,140 pts         │
│                 Joined 12 Mar 2025                     │
├────────────────────────────────────────────────────────┤
│  CONTACT                                               │
│  📧  rahul.mehta@example.com                           │
│  📱  +91 98765 43210  (blurred — tap to reveal)        │
├────────────────────────────────────────────────────────┤
│  ACTIONS                                               │
│  ┌────────────────────┐  ┌────────────────────────┐   │
│  │  [ View Full Profile ]  │  │   [ Change Role ]          │   │
│  └────────────────────┘  └────────────────────────┘   │
│  ┌────────────────────┐  ┌────────────────────────┐   │
│  │  [ Send Message ]      │  │   [ Disable Account ]      │   │
│  └────────────────────┘  └────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

| Field / Action | Spec |
|---|---|
| **Avatar** | 72 dp, same fallback as card |
| **Display name** | `BarlowCondensed_700Bold`, 20 sp, `colors.text` |
| **@username · Role · Status** | `Inter_400Regular`, 13 sp, `colors.textMuted` — inline, `·` separator |
| **Sponsor + points** | `Inter_400Regular`, 13 sp, `colors.textMuted` |
| **Join date** | `Inter_400Regular`, 12 sp, `colors.textMuted` |
| **Email** | Shown plain. Tap → opens `mailto:` in system mail client. |
| **Phone** | Blurred (`BlurView`, `intensity: 20`) by default — tap to unblur (haptic, then reveal). |
| **View Full Profile** | Ghost button → navigates to `/(stack)/users/[id]`. |
| **Change Role** | Opens **Role Management Sheet** (§7). Only rendered if current user's role > target user's role. |
| **Send Message** | Ghost button → opens a direct-message compose flow (Phase 2 — stub with "Coming soon" snackbar). |
| **Disable Account** | Destructive ghost button (`colors.danger` text). Tap → confirmation dialog: *"Disable Rahul Mehta's account? They will be unable to log in until re-enabled."* Confirm → `PATCH /account/disable`. Only rendered for roles strictly below the current user. Founders cannot be disabled by Coordinators. |

---

## 7. Role Management Sheet

**Trigger:** "Change Role" button in the Quick-View Sheet (§6).
**Condition:** Only rendered when the acting coordinator's role is strictly higher than the target user's current role. A Coordinator cannot elevate anyone to Coordinator or above; only a Founder can do that.

```text
┌────────────────────────────────────────────────────────┐
│  ━━━  (drag handle)                                    │
│  Change Role — Rahul Mehta                       [✕]  │
│  Current role: Core                                    │
├────────────────────────────────────────────────────────┤
│  ○  User         — Standard student account            │
│  ○  Member       — BGSC crew member                    │
│  ●  Core         — Current                             │
│  ○  Coordinator  — (requires Founder approval)         │
├────────────────────────────────────────────────────────┤
│  ⚠  Role changes take effect immediately. The user     │
│     will be notified by the platform.                  │
├────────────────────────────────────────────────────────┤
│  [ Cancel ]                [ Confirm Change ]          │
└────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| **Role options** | Radio list. Each row: role name (`Inter_600SemiBold`, 14 sp, `colors.text`) + short description (`Inter_400Regular`, 12 sp, `colors.textMuted`). Active role row highlighted with `colors.accentMuted` fill + `colors.accent` radio fill. |
| **Coordinator option** | Shown but grayed out for Coordinators — tapping it shows an inline note: *"Elevating to Coordinator requires Founder approval."* |
| **Downgrade guard** | Downgrading from Core or Member to User requires a second confirmation if the user has active tasks in the Union workspace. |
| **Warning banner** | `warningBg` + `warningText` colour, `borderRadius: 8`, `padding: 10`, `Inter_400Regular`, 12 sp. |
| **Cancel** | Ghost button, dismisses sheet. |
| **Confirm Change** | `colors.accent` fill, `colors.accentText` text. Disabled until a role different from the current one is selected. On success: sheet closes, user card role badge updates in-place, system notification queued for the target user. |
| **API** | `PATCH /users/:id` with `{ role: newRole }` (Coordinator+ required). |

---

## 8. States Matrix

### 8.1 Main List States

| State | Visual | Behaviour |
|---|---|---|
| **Loading** | 6 skeleton user cards (shimmer: avatar circle + 3 text lines each). Stats banner also shimmers. | `Animated.loop`, 750 ms opacity `0.3 ↔ 0.7`. |
| **Empty — no users** | Centered: 🧑‍💻 icon + *"No users have registered yet."* | Informational only. |
| **Empty — filtered** | Centered: *"No users match your current filters."* + `[ Clear Filters ]` ghost button. | Clears all chips + query; re-fetches. |
| **Search — no results** | Centered: *"No results for "[query]"."* + `[ Clear Search ]`. | Tap clears the search input only (filters remain). |
| **Error** | Centered: *"Unable to load users."* + `[ Retry ]` button. | `GET /users` retry on tap. |
| **Offline / Cache** | Loads last-cached list from `AsyncStorage`. Banner: *"Showing cached users · last updated [HH:MM]"*. | All write actions (role change, disable) are disabled with tooltip: *"Reconnect to make changes."* |
| **Unauthorized** | Snackbar: *"Access restricted to coordinators."* Immediately redirects to `/(drawer)/`. | Happens only on direct navigation attempt. |

### 8.2 Quick-View Sheet States

| State | Visual | Behaviour |
|---|---|---|
| **Loading contact details** | Spinner in contact section. | `GET /users/:id` extended fields on sheet open. |
| **Role change in-flight** | Confirm button spinner + disabled. | Sheet stays open. |
| **Role change success** | Sheet closes; role badge on card updates; snackbar: *"Rahul Mehta is now Core."* | — |
| **Role change failure** | Inline banner under role list: *"Failed to update role. Try again."* | Sheet stays open, previous role pre-selected again. |
| **Disable success** | Sheet closes; status dot on card turns `colors.danger`; snackbar: *"Account disabled."* | — |
| **Disable failure** | Alert: *"Could not disable account. Please try again."* | — |

---

## 9. Scrolling, Gestures & Viewport Behavior

1. **Search + filter sticky**: Once the screen title (`BebasNeue_400Regular`, 48 sp) and stats banner scroll past the top edge, the search bar + two filter chip rows become sticky below the status bar (`zIndex: 90`).
2. **Main ScrollView**: Single vertical `ScrollView` (`showsVerticalScrollIndicator: false`, `keyboardShouldPersistTaps: "handled"`). Wrapped in `KeyboardAvoidingView` (`behavior: Platform.OS === 'ios' ? 'padding' : 'height'`).
3. **Horizontal chip rows**: `horizontal: true`, `showsHorizontalScrollIndicator: false`. Chips do not wrap; overflow is scrollable.
4. **Nested scroll prohibition**: User cards render via `.map()` or a `FlatList`. Never a `FlatList` inside a `ScrollView`. If the list exceeds 200 items the root `ScrollView` becomes a `FlatList` with `windowSize: 5`, `maxToRenderPerBatch: 10`.
5. **Pull-to-refresh**: `RefreshControl` (`tintColor: colors.accent`) on the root scroll view; fires a full re-fetch and invalidates `['users', 'list']` query cache.
6. **Sheet dismissal**: Bottom sheets dismiss on swipe-down, `✕` tap, or backdrop tap. No other gesture interferes.

---

## 10. Typography & Font Configuration

> All fonts defined in `UI-UX-Master-Doc.md §5`. Load in `app/_layout.tsx` via `@expo-google-fonts/*`.

| UI Context | Font | Size (sp) | Example |
|---|---|---|---|
| Screen Title | `BebasNeue_400Regular` | 48 | "USERS" |
| Section Headers | `BarlowCondensed_700Bold` | 22–24 | "CONTACT", "ACTIONS" |
| Card Display Name | `BarlowCondensed_700Bold` | 16 | "Rahul Mehta" |
| Sheet Display Name | `BarlowCondensed_700Bold` | 20 | "Rahul Mehta" |
| Buttons, Labels, Chips | `Inter_600SemiBold` | 12–15 | "Change Role", role chips |
| Body Text, Descriptions | `Inter_400Regular` | 12–14 | Role descriptions, warnings |
| Usernames, Meta, Helpers | `Inter_400Regular` | 11–13 | "@rahul_m", "Active 2h ago" |
| Points, Counts, Dates | `JetBrainsMono_500Medium` | 12–14 | `2,140 pts`, `1,284 users` |

---

## 11. Palette & Colour System

> **Tokens from `UI-UX-Master-Doc.md §4`.** Always consume via `useColors()`.

```typescript
// Reference values only — use useColors() in component code
export const usersThemeTokens = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  background:          '#060D0E',               // (token: background)
  backgroundMid:       '#0F2426',               // (token: backgroundMid)

  // ── Glass Surfaces ─────────────────────────────────────────────────────────
  surface:             'rgba(15,36,38,0.55)',   // Cards + blur(20px)       (token: surface)
  surfaceMuted:        'rgba(10,26,27,0.40)',   // Inputs, chips             (token: surfaceMuted)
  surfaceSolid:        '#163832',               // No-blur fallback           (token: surfaceSolid)

  // ── Borders ────────────────────────────────────────────────────────────────
  border:              'rgba(142,182,155,0.15)',// Hairline                  (token: border)
  borderActive:        'rgba(142,182,155,0.40)',// Focus / selected          (token: borderActive)

  // ── Typography ─────────────────────────────────────────────────────────────
  text:                '#DAF1DE',               // Primary text              (token: text)
  textMuted:           '#8EB69B',               // Labels, meta              (token: textMuted)

  // ── Interactive ────────────────────────────────────────────────────────────
  accent:              '#E8662A',               // CTAs, active chips        (token: accent)
  accentText:          '#FFFFFF',               // Text on accent fill       (token: accentText)
  accentMuted:         'rgba(232,102,42,0.15)', // Accent tint               (token: accentMuted)
  primary:             '#DAF1DE',               // Primary button fill       (token: primary)
  primaryText:         '#060D0E',               // Text on primary fill      (token: primaryText)

  // ── Role Badge Tints ───────────────────────────────────────────────────────
  roleMemberBg:        'rgba(91,156,248,0.15)',
  roleMemberText:      '#5B9CF8',               // info token
  roleCoreBg:          'rgba(232,102,42,0.15)',
  roleCoreText:        '#E8662A',               // accent token
  roleCoordBg:         'rgba(245,197,24,0.15)',
  roleCoordText:       '#F5C518',
  roleFounderBg:       'rgba(52,210,123,0.15)',
  roleFounderText:     '#34D27B',               // success token
  roleAdminBg:         'rgba(242,104,108,0.15)',
  roleAdminText:       '#F2686C',               // danger token

  // ── States ─────────────────────────────────────────────────────────────────
  success:             '#34D27B',               // Active status dot         (token: success)
  danger:              '#F2686C',               // Disabled status, destructive (token: danger)
  info:                '#5B9CF8',               //                           (token: info)
  warningBg:           'rgba(251,191,36,0.15)',
  warningText:         '#FCD34D',
};
```

---

## 12. Button & Surface Geometry

| Button / Surface | Tier | Shape | Height | Fill | Border | Text |
|---|---|---|---|---|---|---|
| **`[ Confirm Change ]`** | Primary | Slightly rounded (`8dp`) | `48dp` full-width | `colors.accent` | None | `Inter_600SemiBold` 15sp `colors.accentText` |
| **`[ View Full Profile ]`** | Primary | Slightly rounded (`8dp`) | `48dp` full-width | `colors.surface` + blur | 1dp `colors.border` | `Inter_600SemiBold` 15sp `colors.text` |
| **Active Role / Status Chip** | Secondary | Capsule (`999dp`) | `36dp` | `colors.accent` | None | `Inter_600SemiBold` 12sp `colors.accentText` |
| **Inactive Filter Chip** | Secondary | Capsule (`999dp`) | `36dp` | Transparent | 1dp `colors.border` | `Inter_400Regular` 12sp `colors.textMuted` |
| **User Card Surface** | Glass card | Rounded (`16dp`) | Auto | `colors.surface` + `blur(20px)` | 1dp `colors.border` | Press-in `scale: 0.98` 120ms |
| **Sort Trigger Pill** | Tertiary | Soft rect (`20dp`) | `36dp` | Transparent | 1dp `colors.border` | `Inter_600SemiBold` 12sp `colors.textMuted` |
| **`[ Cancel ]`** | Tertiary | Soft rect (`8dp`) | `48dp` | Transparent | 1dp `colors.border` | `Inter_600SemiBold` 15sp `colors.textMuted` |
| **`[ Disable Account ]`** | Destructive tertiary | Soft rect (`8dp`) | `44dp` | Transparent | 1dp `colors.danger` @ 40% | `Inter_600SemiBold` 14sp `colors.danger` |
| **`[ Send Message ]`** | Tertiary | Soft rect (`8dp`) | `44dp` | Transparent | 1dp `colors.border` | `Inter_400Regular` 14sp `colors.text` |
| **`[ Retry ]` / `[ Clear Filters ]`** | Tertiary | Soft rect (`8dp`) | `40dp` | Transparent | 1dp `colors.border` | `Inter_600SemiBold` 14sp `colors.accent` |

---

## 13. API Reference

All requests through the API Gateway at `EXPO_PUBLIC_API_URL`. Coordinator+ JWT required for every endpoint on this page.

| Method | Path | Auth | Description | Used by |
|---|---|---|---|---|
| `GET` | `/users` | JWT (Coordinator+) | Paginated user list. Query params: `page`, `limit`, `role`, `status`, `search`, `sort`, `sponsor`, `summary`. | Main list, search, filters |
| `GET` | `/users/:id` | JWT | Full user profile (extended view for coordinator — includes contact fields). | Quick-View Sheet detail |
| `PATCH` | `/users/:id` | JWT (Coordinator+) | Update `role` field. Body: `{ role: UserRole }`. | Role Management Sheet |
| `PATCH` | `/account/disable` | JWT (Coordinator+) | Disable a target account. Body: `{ userId: string, reason?: string }`. | Disable action in Quick-View Sheet |
| `PATCH` | `/account/enable` | JWT (Coordinator+) | Re-enable a disabled account. | Potential future action |

**Response shape for list (`GET /users`):**
```ts
{
  data: UserResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary?: {         // only when ?summary=true
      total: number;
      activeThisWeek: number;
      newThisMonth: number;
    };
  };
}
```

**`UserResponseDto` (public fields):**
```ts
{
  id: string;
  displayName: string;
  username: string;
  email: string;               // visible to Coordinator+
  phone?: string;              // visible to Coordinator+ (may be null)
  role: UserRole;
  status: UserStatus;
  sponsorId?: string;
  sponsorName?: string;
  pointsBalance: number;
  createdAt: string;           // ISO 8601
  lastSeen?: string;           // ISO 8601; nullable
  avatarUrl?: string;
}
```

---

## 14. Animation Reference

| # | Name | Trigger | Spec |
|---|---|---|---|
| 14.1 | **Card Press** | Tap/press on any user card | `scale: 1.0 → 0.98`, `opacity: 1.0 → 0.9`, spring `stiffness: 280, damping: 28`, 120ms. Reverts on release. |
| 14.2 | **Filter Chip Select** | Tap active/inactive chip | `scale: 0.95 → 1.0`, `backgroundColor` crossfade, 150ms spring. |
| 14.3 | **Quick-View Sheet Rise** | Long-press card | `translateY: 100% → 0%`, `tension: 90, friction: 14`. Backdrop fades in `rgba(0,0,0,0.55)` over 220ms. |
| 14.4 | **Role Selection** | Tap role row in management sheet | Radio fill scales in (`scale: 0 → 1`) with spring `stiffness: 480, damping: 28`. Row bg fades to `accentMuted`. |
| 14.5 | **Skeleton Shimmer** | Loading state | Opacity loop `0.3 ↔ 0.7`, 750ms each direction, `useNativeDriver: true`. Shape matches card layout. |
| 14.6 | **Status Dot (Active)** | Ongoing — not a transition | Pulsing: `opacity: 0.35 → 1.0 → 0.35`, 1200ms loop, only for `status === 'active'` dots. |
| — | **Reduced Motion** | `AccessibilityInfo.isReduceMotionEnabled()` | All transitions collapse to 100ms instant cross-fades. Pulse loop stops. |

---

## 15. Accessibility

| Requirement | Implementation |
|---|---|
| **Touch targets** | Cards ≥ 44 dp tall; chip `hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }`. |
| **Role badge** | `accessibilityLabel` reads full role name, e.g. *"Core member"* — not just the abbreviated label. |
| **Status dot** | Never color-only — also shown as text in the Quick-View Sheet (*"● Active"* / *"⛔ Disabled"*). |
| **Screen reader** | Card `accessibilityLabel`: *"[Display Name], @[username], [Role], [Status], [Sponsor], [Points] points, joined [date], active [relative]."* |
| **Destructive confirm** | `[ Disable Account ]` always requires a secondary confirmation dialog before the API call fires. |
| **Role elevation guard** | UI hides or disables options a coordinator cannot use; backend enforces the same rule independently. |
| **Focus order** | Status bar → search → role filter row → status filter row → sort → user cards → FAB (none on this screen). |

---

*End of users-page.md. Cross-reference `user-profile/user-profile.md` for the self-profile view, `Auth/handoffSpec.md` for account creation, and `docs/user-service.md` for the full backend API reference.*
