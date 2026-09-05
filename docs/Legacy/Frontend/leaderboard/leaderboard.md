# Leaderboards — UI/UX Specification

**Platform:** Mobile (React Native / Expo)  
**Route:** `/(drawer)/leaderboards` (`src/app/(drawer)/leaderboards.tsx`)  
**Visibility:** Public (view) · Authenticated (participate / invest points)  
**Developer Assignee:** `[satyam]`  
**Source:** Complete Feature Specification & Architecture §5.6 (F: Leaderboards Page), §5.7 (Points Investment), §5.8 (Sponsor Leaderboard), §5.5 (Spectator Bracket View), §11.3 (Dynamic Rule Scoring Engine); Navigation Drawer "Leaderboards"  
**Design Tokens Reference:** `design-system.md`

---

## 1. Page Structure & Master Viewport Architecture

The **Leaderboards** mobile screen implements the same **Segmented View-Swapping Architecture (Approach B)** with **60fps Directional Screen Sliding Animations** used by `feedback-contact-page.md`. A top fixed Dynamic Status Bar and sticky segmented navigation bar allow users to toggle between three unified in-line screen views:

```text
┌────────────────────────────────────────────────────────┐
│ [☰]                 [ BGSC LOGO ]            [Profile] │ ← Fixed Dynamic Status Bar
├────────────────────────────────────────────────────────┤
│    SEGMENTED TABS: [ Events | Standings | Sponsors ]   │ ← Sticky Segmented Bar
├────────────────────────────────────────────────────────┤
│ ▼ ACTIVE TAB VIEW (Wrapped in KeyboardAvoidingView)    │
│                                                        │
│  [Tab 0: Leaderboard Event Browser]                    │
│   • Search Bar ('Search leaderboards...')              │
│   • Filter Chips: Tags, Participation, Event Type      │
│   • Event Leaderboard Cards (Top 3 Preview + Your Rank)│
│   • Threshold-Locked, Empty & Offline States           │
│                                                        │
│  [Tab 1: Live Standings & Points Investment]           │
│   • Format Badge (RR / DE / UL / Elim-after-N)         │
│   • Podium Block + Ranked Standings Rows               │
│   • Sticky 'Your Rank' Row + [ Invest Points ]         │
│   • Collapsible Bracket View + Score Breakdown         │
│                                                        │
│  [Tab 2: Sponsor Leaderboard]                          │
│   • Sort Chips: Total Fans, Events Won, Affiliated     │
│   • Time Filter: Semester / Year / All Time            │
│   • Horizontal Fan Distribution Bar Chart              │
│   • Your Sponsor Affiliation + Prize Eligibility       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar & Segmented Tab Navigation

### 2.1 Fixed Dynamic Status Bar
- **Component**: Rendered by `mobile/src/components/dynamic-status-bar.tsx` (shared, unmodified).
- **Positioning**: Fixed at the top of the screen viewport (`headerShown: true` / `position: 'fixed'`, `zIndex: 100`).
- **Slots**:
  - **Left Slot**: Standard Drawer Hamburger trigger **`☰`** (three horizontal bars) rendered in `colors.text` (#DAF1DE) / `colors.accent` (#E8662A) (`fontSize: 24`, `width: 32`) → Opens navigation drawer.
  - **Center Slot**: BGSC / Community Emblem (Height: 28pt).
  - **Right Slot**: Guest mode renders `"Login"` pill; Authenticated mode renders 36pt circular user profile avatar.

### 2.2 Sticky Segmented Navigation Bar & Sliding Transitions
- **Positioning**: Sticky directly below the status bar (`zIndex: 90`).
- **Container Styling**: `backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */` with 1 dp `colors.border` solid border, `borderRadius: 24`, `padding: 4`, `marginHorizontal: 16`, `marginVertical: 12`.
- **Tabs (Clean Text-Only)**:
  - `Index 0`: **Events**
  - `Index 1`: **Standings**
  - `Index 2`: **Sponsors**
- **Interaction & Feedback**:
  - Tapping fires `Haptics.selectionAsync()`.
  - Active sliding pill indicator (`backgroundColor: colors.accent /* #E8662A */`, `borderRadius: 20`, `height: 36`) glides smoothly behind the active tab via `react-native-reanimated` spring physics (`damping: 18, stiffness: 150`).
  - Active tab text renders in `Inter_600SemiBold` (`colors.text` (#DAF1DE)), while inactive tabs render in `Inter_600SemiBold` (`colors.textMuted` (#8EB69B)).
- **Directional Screen Slide Animation**:
  - Tapping a tab or swiping triggers a 60fps horizontal slide of the main viewport:
    - **Moving Forward (e.g. Tab 0 → Tab 1)**: Incoming tab enters from `+SCREEN_WIDTH` to `0`, while previous tab exits to `-SCREEN_WIDTH`.
    - **Moving Backward (e.g. Tab 2 → Tab 1)**: Incoming tab enters from `-SCREEN_WIDTH` to `0`, while previous tab exits to `+SCREEN_WIDTH`.
    - Driven by `Animated.timing` (`duration: 220ms`, `useNativeDriver: true`) or `react-native-reanimated`.
- **Tab 1 Context Rule**: **Standings** is event-scoped. Entering it without a selected event renders the *No Event Selected* state (§4.7) rather than an empty table. Selecting a card in Tab 0 sets `selectedEventId` and auto-advances to Tab 1 using the forward slide direction.
- **Live Sync Pill**: A small capsule pinned to the right edge of the segmented bar row displays connection state — `● Live` (`colors.accent` (#E8662A) dot, pulsing `opacity: 0.4 → 1.0`, `duration: 1200ms`), `◌ Reconnecting`, or `○ Offline` (`colors.textMuted` (#8EB69B)). Detailed socket behaviour in §10.

---

## 3. Tab 0: Leaderboard Event Browser (In-Line Screen View)


### 3.0 Live Now Strip (above search bar)

A horizontally scrollable strip of glass cards pinned directly below the screen title, showing only events with `status === 'ongoing'` and `needs_leaderboard === true`. Renders only when ≥ 1 live event exists; hidden entirely otherwise.

```text
 LIVE NOW ●  ─────────────────────────────────────────────
 ╭─────────────────────╮  ╭─────────────────────╮
 │ ● Airball Premier   │  │ ● Valorant Clash     │
 │   #12 · 610 pts     │  │   Spectating         │
 │   [ View → ]        │  │   [ View → ]         │
 ╰─────────────────────╯  ╰─────────────────────╯  →
```

| Element | Spec |
|---|---|
| **Section label** | `"LIVE NOW"` + `●` live dot — `Inter_600SemiBold`, 11sp, `colors.textMuted`, `letterSpacing: 0.6`, UPPERCASE |
| **Card surface** | Glass card (`colors.surface` + blur 20px), `borderRadius: 16`, `borderWidth: 1`, `borderColor: colors.borderActive` (`rgba(142,182,155,0.40)`) — the active border signals live state |
| **Card width** | `180 dp` fixed; `height: 96 dp` |
| **Event name** | `BarlowCondensed_700Bold`, 15sp, `colors.text` — 1 line, ellipsis |
| **Your rank / Spectating** | `JetBrainsMono_500Medium`, 13sp, `colors.textMuted` |
| **View button** | Ghost pill, `height: 28dp`, `borderColor: colors.border` |
| **Live dot** | 8dp circle, `colors.success` (#34D27B), pulsing `opacity: 0.35 → 1.0`, 1200ms loop |
| **Horizontal scroll** | `showsHorizontalScrollIndicator: false`; strip does not scroll with the main list — it is fixed above the search bar |
| **Tap** | Sets `selectedEventId` and forward-slides to Tab 1 |
| **Strip missing** | When zero live events: strip is unmounted (no empty row, no padding remnant) |

---

### 3.1 In-Line Screen Wireframe
Selecting the **`[ Events ]`** tab displays every active event that has `needs_leaderboard = true`, rendered directly in the viewport:

```text
┌────────────────────────────────────────────────────────┐
│  LEADERBOARDS                                          │
│  "Track live standings across events and leagues."     │
│                                                        │
│  SEARCH BAR:                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Search leaderboards...                       [x] │  │ ← Real-time search + clear
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  FILTER CHIP ROW (horizontal scroll):                  │
│  [ All ] [ LE ] [ ALL ] [ DLL ] [ Joined ] [ Live ] →  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Airball Premier League            [ ● LIVE ]     │  │ ← Status pill (Live/Upcoming/Ended)
│  │ [LE] · Round Robin · 24 participants             │  │
│  │ ──────────────────────────────────────────────── │  │
│  │  1. Vortex FC ───────────────────────── 940 pts  │  │ ← Top-3 podium preview
│  │  2. Iron Wolves ─────────────────────── 872 pts  │  │
│  │  3. Night Owls ──────────────────────── 815 pts  │  │
│  │ ──────────────────────────────────────────────── │  │
│  │  Your Rank: #12  ·  610 pts        [ View → ]    │  │ ← Only when participating
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Valorant Winter Clash          [ ○ UPCOMING ]    │  │
│  │ [ALL] · Double Elimination · 8/16 registered     │  │
│  │ ──────────────────────────────────────────────── │  │
│  │  🔒 Leaderboard activates at 12 participants     │  │ ← Threshold-locked card
│  │     ████████████░░░░░░░░  8 / 12                 │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ Deuce Doubles Ladder              [ ✓ ENDED ]    │  │
│  │ [DLL] · Elimination after 2 · 32 participants    │  │
│  │ ──────────────────────────────────────────────── │  │
│  │  🏆 Winner: Sharma / Iyer            [ View → ]  │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### 3.2 Search & Filter Specification Table

| Control | Component Type | Options / Rules | Default / Notes |
|---|---|---|---|
| **Search Bar** | Single-line text input with clear affordance | Debounced 250 ms. Matches against event title, tags, and participating team names. | Placeholder `'Search leaderboards...'`. `height: 48`, `borderRadius: 24`, `/* glass surface: rgba(15,36,38,0.55) + blur(20px) */`, `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `paddingHorizontal: 16`, `color: colors.text /* #DAF1DE */`. Clear `[x]` pinned right when query length > 0. |
| **Event Type Filter** | Horizontal scrolling chip row (single-select) | `All`, `LE` (Leaderboard Event), `ALL` (Auction Leaderboard League), `DLL` (Direct Leaderboard League) | Default: `All`. `DE` (Direct Event) is **never** listed — those events carry no leaderboard by definition. Active chip: `colors.accent` (#E8662A) fill, `colors.text` text. |
| **Participation Filter** | Chip toggle (multi-select with type filter) | `Joined` (user is a registered participant), `Spectating` (not registered) | Default: none active (shows all). Hidden entirely in Guest mode. |
| **Status Filter** | Chip toggle | `Live`, `Upcoming`, `Ended` | Default: none active. Multi-select enabled — `Live` + `Upcoming` can be combined. |
| **Tag Filter** | Chip row sourced from `Event.tags[]` | Dynamic, e.g. `Football`, `Valorant`, `Cricket`, `Badminton`, `TT`, `CS`, `Tekken` | Multi-select. Tags exceeding the viewport scroll horizontally (`showsHorizontalScrollIndicator={false}`). |
| **Sort Order** | Inline label + dropdown selector | `Live First` (default), `Most Participants`, `Recently Updated`, `Ending Soon` | Label `"Sort: "` in `Inter_600SemiBold` (`colors.text` (#DAF1DE)). Trigger pill on right (`borderRadius: 20`, `height: 36`, `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`). |
| **Reset Filters** | Text button | Appears only when ≥ 1 filter active | `[ Clear filters ]` in `colors.accent` (#E8662A), 12 sp. Restores every control to default and re-collapses the chip row scroll to offset 0. |

---

### 3.3 Event Leaderboard Card Anatomy

- **Container**: glass surface (rgba(15,36,38,0.55) + blur(20px)), `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `borderRadius: 30`, `padding: 16`, `marginBottom: 12`, `overflow: 'hidden'`.
- **Header Row**: Event title in `Inter_600SemiBold` (`colors.text` (#DAF1DE), 16 sp) on the left; status pill on the right.
  - **Status Pills**: `Live` (`colors.text` (#DAF1DE) bg / `colors.accent` (#E8662A) text with pulsing dot), `Upcoming` (`colors.surfaceMuted` bg / `colors.textMuted` (#8EB69B) text), `Ended` (glass surface (rgba(15,36,38,0.55) + blur(20px)) bg / `colors.textMuted` (#8EB69B) text, 1 dp `colors.border` border).
- **Meta Row**: `[TYPE] · Format · N participants` in Inter_400Regular (`colors.textMuted` (#8EB69B), 13 sp). Type token rendered as an inline badge (`borderRadius: 6`, `height: 20`, `paddingHorizontal: 8`, `backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */`).
- **Top-3 Podium Preview**: Three rank rows with rank numeral (``JetBrainsMono_500Medium``, 13 sp), participant/team name (`colors.text` (#DAF1DE), 14 sp), and right-aligned normalized score (``JetBrainsMono_500Medium``, 13 sp). A hairline `colors.border` divider separates the preview from the header and footer.
- **Your Rank Footer**: Rendered only when the authenticated user is a participant — `Your Rank: #12 · 610 pts` on the left, `[ View → ]` tertiary button on the right. Guests and non-participants see only `[ View → ]`.
- **Threshold-Locked Variant**: When `participant_count < min_participant_threshold`, the podium preview is replaced by a lock row and progress meter (`height: 6`, `borderRadius: 3`, track `colors.surfaceMuted`, fill `colors.accent` (#E8662A)). The card is non-navigable; tapping fires `Haptics.notificationAsync(Warning)` and a snackbar: *"Leaderboard activates at N participants."*
- **Tap Target**: Whole card is pressable (`activeOpacity: 0.85`, scale `0.985` on press-in via spring `stiffness: 280, damping: 28`) → sets `selectedEventId` and forward-slides to Tab 1.

---

### 3.4 Browser States Matrix

| State / Scenario | Trigger Condition | Visual & Functional Behavior |
|---|---|---|
| **Loading State** | Initial mount / cold cache | Skeleton shimmer search bar, chip row, and 3 skeleton event cards with pulsating podium rows. Animated linear shimmer while fetching from read replica. |
| **Guest State** | User not logged in | • Full read access to every card and standing.<br>• Participation filter chips hidden.<br>• "Your Rank" footer replaced by `[ View → ]` only.<br>• Tapping `[ Invest Points ]` anywhere downstream routes to Login. |
| **Empty Filter Result** | Query / filters match 0 events | Centered message: *"No leaderboards match your filters."* with `[ Clear filters ]` button. |
| **No Active Leaderboards** | Zero events with `needs_leaderboard = true` | Centered message: *"No active leaderboards this term."* with a CTA to browse the Events page. |
| **Threshold-Locked** | `participant_count < min_participant_threshold` | Card renders lock row + progress meter; navigation suppressed; warning snackbar on tap. |
| **Error State** | API failure | Text: *"Unable to load leaderboards."* with inline `[ Retry ]` button. Falls back to the cached roster in `AsyncStorage`. |
| **Offline Cache** | Device offline | Loads last-synced standings from `AsyncStorage`. Subtle banner: *"Showing cached standings · last updated [HH:MM]"*. Live pill renders `○ Offline`. |

---

## 4. Tab 1: Live Standings & Points Investment

### 4.1 In-Line Screen Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  ‹ Airball Premier League                              │ ← Back chevron returns to Tab 0
│  [LE] · Round Robin · 24 participants · ● LIVE         │
│                                                        │
│  PODIUM BLOCK:                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         ╭────╮                                   │  │
│  │  ╭────╮ │ 1  │ ╭────╮                            │  │ ← 2nd / 1st / 3rd staggered
│  │  │ 2  │ │    │ │ 3  │                            │  │
│  │  │Iron│ │Vor-│ │Nite│                            │  │
│  │  │Wolf│ │tex │ │Owls│                            │  │
│  │  │872 │ │940 │ │815 │                            │  │
│  │  ╰────╯ ╰────╯ ╰────╯                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  STANDINGS TABLE:                                      │
│  ┌────┬──────────────────────┬──────┬──────┬────────┐  │
│  │ #  │ Team / Player        │ P  W │ Δ    │ Score  │  │ ← Column header row
│  ├────┼──────────────────────┼──────┼──────┼────────┤  │
│  │ 4  │ [av] Red Titans      │ 9  6 │ ▲ 2  │  788   │  │
│  │ 5  │ [av] Blue Strikers   │ 9  5 │ ▼ 1  │  742   │  │
│  │ 6  │ [av] Sunset XI       │ 9  5 │ —    │  731   │  │
│  │ …  │                      │      │      │        │  │
│  └────┴──────────────────────┴──────┴──────┴────────┘  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ YOUR RANK  #12  ·  610 pts  ·  ▲ 3 this week     │  │ ← Sticky pinned row
│  │              [ Invest Points ]                    │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ [button] Bracket View                        [+] │  │ ← Collapsed accordion
│  ╰──────────────────────────────────────────────────╯  │
│  ╭──────────────────────────────────────────────────╮  │
│  │ [button] Score Breakdown                     [+] │  │ ← Collapsed accordion
│  ╰──────────────────────────────────────────────────╯  │
│  ╭──────────────────────────────────────────────────╮  │
│  │ [button] How Scoring Works                   [+] │  │ ← Collapsed accordion
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### 4.2 Supported Leaderboard Formats Matrix

| Format | Spec Token | Standings Column Set | Bracket Rendering | Notes |
|---|---|---|---|---|
| **Round Robin** | `round_robin` | `#`, Name, `P` (played), `W` (won), `Δ` (rank delta), `Score` | Grid matrix — rows × columns of every pairing, each cell showing the result or `—` for unplayed. | Auto-calculates match count from team count. Ties broken by head-to-head, then score differential. |
| **Direct Elimination** | `single_elim` | `#`, Name, `Round Reached`, `Score` | Single-elimination tree with seed numerals and bye-round markers. | Eliminated entrants render at `opacity: 0.55` with a strikethrough rank numeral. |
| **Upper-Lower Bracket** | `double_elim` | `#`, Name, `Bracket` (U/L), `L` (losses), `Score` | Split tree — Upper bracket above, Lower bracket below, converging at the grand final node. | Bracket badge `U` (`colors.text` (#DAF1DE)/`colors.accent` (#E8662A)) or `L` (`#FFEDD5`/`#C2410C`). |
| **Elimination after N fails** | `elim_after_n` | `#`, Name, `Fails` (`x / N`), `Score` | Linear survival ladder with per-entrant fail pips (`● ● ○` for 2 of 3 used). | `N` is configured per-event by admin. Entrant is eliminated when `fails === N`. |

- **Format Badge**: Rendered in the sub-header as an inline badge (`borderRadius: 6`, `height: 20`, `paddingHorizontal: 8`, `backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */`, `color: colors.textMuted /* #8EB69B */`, 12 sp `Inter_600SemiBold`).
- **Min Participant Threshold**: If the event drops below threshold mid-run (withdrawals), standings freeze and a banner renders: *"Leaderboard paused — participant count below minimum."*

---

### 4.3 Podium Block & Standings Row Specification

**Podium Block**
- **Layout**: Three columns in visual order 2 · 1 · 3. First-place column is 16 dp taller with `marginTop: 0`; second and third sit at `marginTop: 16`.
- **Tiles**: `borderRadius: 12`, `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `/* glass surface: rgba(15,36,38,0.55) + blur(20px) */`, `padding: 12`, `flex: 1`.
- **Rank Medallion**: 28 dp circle centered at the tile top. Rank 1 `#F5C518` fill / `colors.text` (#DAF1DE) numeral; Rank 2 `#C7CBD1` fill / `colors.text` (#DAF1DE); Rank 3 `#D9A066` fill / `colors.text` (#DAF1DE). Numeral in `BarlowCondensed_700Bold`, 14 sp.
- **Avatar**: 40 dp circular team crest or player avatar with fallback initials (`backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */`).
- **Name & Score**: Name in `Inter_600SemiBold` (`colors.text` (#DAF1DE), 13 sp, `numberOfLines: 1`, `ellipsizeMode: 'tail'`); score in ``JetBrainsMono_500Medium`` (`colors.accent` (#E8662A), 14 sp).
- **Entry Animation**: On mount, tiles stagger in — `translateY: 12 → 0`, `opacity: 0 → 1`, spring `stiffness: 340, damping: 32, mass: 0.9`, delayed 0 ms / 60 ms / 120 ms for ranks 1 / 2 / 3.

**Standings Row**
- **Container**: `height: 56`, `flexDirection: 'row'`, `alignItems: 'center'`, `paddingHorizontal: 12`, `/* glass surface: rgba(15,36,38,0.55) + blur(20px) */`, separated by a 1 dp `colors.border` hairline. Rows 4+ only — the top 3 live in the podium block.
- **Rank Column** (`width: 32`): Numeral in ``JetBrainsMono_500Medium`` (`colors.textMuted` (#8EB69B), 13 sp).
- **Identity Column** (`flex: 1`): 28 dp circular avatar + name in `colors.text` (#DAF1DE), 14 sp.
- **Stat Columns** (`width: 48` each): Format-dependent per §4.2, rendered in ``JetBrainsMono_500Medium`` (`colors.textMuted` (#8EB69B), 13 sp).
- **Delta Column** (`width: 40`): `▲ n` in `colors.accent` (#E8662A), `▼ n` in `colors.danger` (#F2686C), `—` in `colors.textMuted` (#8EB69B). Reflects movement since the last published score sync.
- **Score Column** (`width: 64`, right-aligned): Normalized score in ``JetBrainsMono_500Medium`` (`colors.text` (#DAF1DE), 14 sp).
- **Current-User Highlight**: The authenticated user's own row renders with `backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */` and a 3 dp `colors.accent` (#E8662A) left accent bar.
- **Row Tap**: Opens the participant detail sheet — full score breakdown by scoring parameter, match history, and head-to-head record.
- **Live Rank Change**: When a socket update reorders rows, affected rows animate `translateY` to their new offset (spring `stiffness: 300, damping: 30`) and flash `backgroundColor` to `rgba(52,210,123,0.12)` for 600 ms before settling.

---

### 4.4 Points Investment Mechanics

Available only when **all** of the following hold: user is authenticated, user is a registered participant of the event, and the event config permits investment (`points_pool.investment_enabled = true`).

**Invest Points Bottom Sheet**

```text
┌────────────────────────────────────────────────────────┐
│  INVEST POINTS                                     [x] │
│  "Boost your standing in Airball Premier League."      │
│                                                        │
│  Your Balance:  1,240 pts                              │
│                                                        │
│  AMOUNT TO INVEST *                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  250                                             │  │
│  └──────────────────────────────────────────────────┘  │
│  [ 50 ]   [ 100 ]   [ 250 ]   [ Max ]                  │ ← Quick-amount pills
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Projected Rank:   #12  →  #9   (▲ 3)            │  │ ← Live projection
│  │  Projected Score:  610  →  685                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ⚠ Investments are final and cannot be refunded.       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │              [ Confirm Investment ]              │  │ ← Full-width Primary CTA
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

| Field / Control | Component Type | Options / Rules | Default / Notes |
|---|---|---|---|
| **Balance Display** | Read-only stat row | Sourced from `User.points_balance`. | ``JetBrainsMono_500Medium`` (`colors.text` (#DAF1DE), 16 sp). Refreshed on sheet open. |
| **Amount Input** | Numeric text input | Integer only. Min 10 pts, max = `min(points_balance, event_investment_cap)`. | Background glass surface (rgba(15,36,38,0.55) + blur(20px)), `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `borderRadius: 8`, focus 2 dp `colors.accent` (#E8662A). Invalid entry turns border `colors.danger` (#F2686C). |
| **Quick Amount Pills** | Segmented pill group | `50`, `100`, `250`, `Max` | Capsule (`borderRadius: 16`, `height: 32`). Tapping sets the input and re-computes the projection. Pills exceeding balance render disabled at `opacity: 0.4`. Active pill: `colors.accentMuted` bg, `colors.accent` border and text. |
| **Projection Panel** | Read-only computed card | Recomputed on every keystroke (debounced 150 ms) against current standings. | `backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */`, `borderRadius: 8`, `padding: 12`. Rank arrow in `colors.accent` (#E8662A). Shows `— no rank change` when the amount is insufficient to overtake anyone. |
| **Confirm Button** | Full-width Primary Action Button | Dispatches a `PointTransaction` (`type: spend`, `source: leaderboard`, `reference_id: event_id`). | `borderRadius: 8`, `height: 48`, `backgroundColor: colors.accent /* #E8662A */`, `color: colors.accentText /* #FFFFFF */`, `marginTop: 16`. Disabled while amount is invalid or a request is in flight. |

**Investment Rules**
1. **Non-refundable** — the irreversibility warning is always visible above the CTA; confirming fires `Haptics.notificationAsync(Warning)` then a native confirm dialog: *"Invest 250 points? This cannot be undone."*
2. **Projection is advisory, not guaranteed** — other participants may invest concurrently. On success the sheet closes and the standings apply the real post-settlement rank, which may differ from the projection. A snackbar states the actual outcome: *"Invested 250 pts · you are now #10."*
3. **Balance sync** — a successful investment optimistically decrements the local balance and writes a `PointTransaction` row visible in the Points & Challenge page transaction history.
4. **Insufficient balance** — `[ Invest Points ]` remains tappable but the sheet opens with the input disabled and a CTA reading `[ Earn Points ]`, routing to the Challenge browser.
5. **Rate guard** — max 5 investments per user per event per hour. On HTTP 429: *"Investment limit reached. Please wait [MM:SS]."*

---

### 4.5 Collapsible Detail Accordions & Motion Mechanics

Three accordions sit below the standings table, using the identical motion system as the FAQ accordion in `feedback-contact-page.md`.

1. **Bracket View** — Renders the real-time match tree for the event format (§4.2). Horizontally scrollable canvas with pinch-to-zoom (`minScale: 0.6`, `maxScale: 2.5`). Tapping any match node opens the match detail sheet: scheduled venue, date, both team roster sheets, historical head-to-head record, and the real-time score feed.
2. **Score Breakdown** — Per-participant table of the event's custom scoring parameters as configured by the admin Dynamic Rule Scoring Engine (e.g. `goals: int`, `assists: int`, `mvp: bool` for Airball; `kills: int`, `deaths: int`, `bomb_defuses: int` for esports). Shows the raw metric alongside its normalized contribution.
3. **How Scoring Works** — Read-only explainer: base participation points, winner multiplier, sponsor affinity bonus, and the score normalization window (lower limit `≥ 0`, upper limit `≤ 1000`) that converts diverse sport metrics into standard platform values.

**Multi-Layered Spring Animation Physics (Derived from `motion-faqs-accordion.tsx`)**

| Layer / Element | Animation Property | Closed / Collapsed | Open / Expanded | Physics / Timing Spec |
|---|---|---|---|---|
| **1. Item Card Scale** | `scale` (Breathing) | `0.985` | `1.0` | **Spring**: `stiffness: 280`, `damping: 28`, `mass: 0.9` (`originX: 0.5, originY: 0`) |
| **2. Toggle Icon Morph** | `rotate` & `scale` | `rotate: 0deg`, `scale: 1.0` (Plus `+` SVG) | `rotate: 180deg`, `scale: 1.05` (Minus `−` SVG) | **Spring**: `stiffness: 480`, `damping: 28` |
| **3. Content Panel Height** | `height` | `0` | `contentHeight` (Measured via `ResizeObserver` / `onLayout`) | **Spring**: `stiffness: 340`, `damping: 34`, `mass: 0.9` with `style={{ overflow: "hidden" }}` |
| **4. Content Opacity** | `opacity` | `0.0` | `1.0` | **Timing**: `duration: 0.2s`, `easing: "easeOut"` |
| **5. Inner Text Slide** | `translateY` (`y`) | `-8px` | `0px` | **Spring**: `stiffness: 360`, `damping: 30`, `mass: 0.8` |

**SVG Toggle Icon Vector Paths**
- **Collapsed / Plus (`+`)**: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>`
- **Expanded / Minus (`−`)**: `<svg width="14" height="14" viewBox="0 0 14 2" fill="none"><path d="M1 1h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>`

**Accessible Deterministic ID Structure & ARIA Semantics**
- **Base ID**: Generated uniquely per accordion container: `const baseId = 'accordion-' + rawId.replace(/:/g, "")`.
- **Trigger Button**: `id={`${baseId}-trigger-${i}`}`, `aria-controls={`${baseId}-panel-${i}`}`, `aria-expanded={isOpen}` (React Native: `accessibilityRole="button"`, `accessibilityState={{ expanded: isOpen }}`).
- **Expandable Region**: `id={`${baseId}-panel-${i}`}`, `role="region"`, `aria-labelledby={`${baseId}-trigger-${i}`}`, `style={{ overflow: "hidden" }}`.

**Mutually Exclusive Single-Expand State Management**
```typescript
// Detail accordions single-expand toggle
const toggleSection = (i: number) => setOpenSectionIndex((prev) => (prev === i ? null : i));
```

**Layout & Scroll Rule**
- The outer accordion container uses `borderRadius: 34`, `padding: 12`, `gap: 10`.
- Each accordion card uses `borderRadius: 30`, `/* glass surface: rgba(15,36,38,0.55) + blur(20px) */`, `overflow: 'hidden'`, `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`.
- The bracket canvas is the **single sanctioned exception** to the nested-scroll prohibition: it is a horizontal-only `ScrollView` inside the vertical parent, which produces no gesture-axis collision.

---

### 4.6 Admin & Coordinator Boundary

- Users holding Coordinator or Admin roles see an additional **`[ Manage on Web ↗ ]`** anchor pinned below the standings table.
- Tapping opens the Web Console deep link for that event's leaderboard configuration in the system browser.
- **No on-device editing.** All structural layouts, ruleset definitions, bracket configurations, and score parameter mapping take place strictly inside the dedicated Web Console to prevent layout bloat on mobile screens. Score entry, seed overrides, and result publishing are unavailable on mobile by design.

---

### 4.7 Standings States Matrix

| State / Scenario | Trigger Condition | Visual & Functional Behavior |
|---|---|---|
| **No Event Selected** | Tab 1 opened directly from the drawer | Centered message: *"Select a leaderboard to view standings."* with `[ Browse Leaderboards ]` button that back-slides to Tab 0. |
| **Loading State** | Standings fetch in flight | Skeleton podium (3 shimmer tiles) + 6 skeleton standings rows with pulsating rank and score columns. |
| **Guest State** | User not logged in | • Full standings, podium, and bracket are visible.<br>• Sticky "Your Rank" row is replaced by a `[ Log in to participate ]` prompt.<br>• `[ Invest Points ]` is absent. |
| **Spectator State** | Authenticated, not a participant | • Full read access.<br>• Sticky row reads *"You are spectating this event."*<br>• `[ Invest Points ]` is absent. |
| **Investment Disabled** | `points_pool.investment_enabled = false` | Sticky row shows rank only. Helper text: *"Point investment is not enabled for this event."* |
| **Insufficient Balance** | `points_balance < 10` | Sheet opens with input disabled; CTA becomes `[ Earn Points ]` routing to the Challenge browser. |
| **Below Threshold** | Participants drop under minimum mid-run | Standings freeze at last published state. Banner: *"Leaderboard paused — participant count below minimum."* Investment disabled. |
| **Event Ended** | `status = past` | Live pill replaced by `✓ ENDED`. Podium renders the final result with a 🏆 marker on rank 1. Investment permanently disabled; delta column hidden. |
| **Socket Disconnected** | WebSocket drop | Live pill shows `◌ Reconnecting`. Standings remain interactive from last-known state. Auto-retry per §10.3. |
| **Investment Failure** | API error on confirm | Sheet stays open with the amount preserved. Inline banner: *"Unable to complete investment. Points were not deducted."* CTA becomes `[ Retry Investment ]`. |
| **Offline Cache** | Device offline | Loads cached standings from `AsyncStorage`. Banner: *"Showing cached standings · last updated [HH:MM]"*. Investment disabled until reconnect. |

---

## 5. Tab 2: Sponsor Leaderboard

### 5.1 In-Line Screen Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  SPONSOR LEADERBOARD                                   │
│  "Fan standings across the current sponsor tenure."    │
│                                                        │
│  Tenure ends in 42 days                                │
│                                                        │
│  SORT CHIPS:   [ Total Fans ] [ Events Won ] [ Users ] │
│  TIME FILTER:  [ Semester ] [ Year ] [ All Time ]      │
│                                                        │
│  FAN DISTRIBUTION:                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Nexus Energy   ████████████████████████  12,480  │  │
│  │ Cafe Verde     ██████████████████         9,120  │  │
│  │ RiseWear       ████████████               6,340  │  │
│  │ ByteForge      ███████                    3,905  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ ┌──────┐  1. Nexus Energy         [ ★ YOURS ]    │  │
│  │ │ LOGO │  12,480 fans · 18 events won            │  │
│  │ │ 48dp │  342 affiliated users                   │  │
│  │ └──────┘                                         │  │
│  │  ──────────────────────────────────────────────  │  │
│  │  You have earned 240 fans for Nexus Energy       │  │
│  │  ┌────────────┐ ┌─────────────────────────────┐  │  │
│  │  │ [ Visit ↗ ]│ │   [ Change Sponsor ]        │  │  │
│  │  └────────────┘ └─────────────────────────────┘  │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ ┌──────┐  2. Cafe Verde                          │  │
│  │ │ LOGO │  9,120 fans · 11 events won             │  │
│  │ └──────┘  208 affiliated users      [ Visit ↗ ]  │  │
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
│  ╭──────────────────────────────────────────────────╮  │
│  │ [button] Prizes & Rewards                    [+] │  │ ← Collapsed accordion
│  ╰──────────────────────────────────────────────────╯  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 5.2 Sort & Time Filter Mechanics

| Control | Options | Behavior |
|---|---|---|
| **Sort By** | `Total Fans` (default), `Events Won`, `Affiliated Users` | Single-select capsule chips (`borderRadius: 20`, `height: 36`). Active: `colors.accent` (#E8662A) fill / `colors.text` text. Inactive: transparent, 1 dp `colors.border`, `colors.text` (#DAF1DE) text. Changing sort re-orders both the bar chart and the ranked card list with a spring re-layout (`stiffness: 300, damping: 30`). |
| **Time Filter** | `This Semester` (default), `This Year`, `All Time` | Single-select capsule chips, same geometry. Re-queries aggregate fan counts for the selected window. `All Time` additionally surfaces a **Sponsor Dynasty** badge on any sponsor with consecutive tenure wins. |
| **Tenure Countdown** | Read-only | `"Tenure ends in N days"` in `Inter_600SemiBold` (`colors.textMuted` (#8EB69B), 13 sp), computed from the active sponsor tenure end date. Renders *"Tenure ended"* once elapsed, and the list becomes a historical archive. |

### 5.3 Fan Distribution Bar Chart

- **Container**: glass surface (rgba(15,36,38,0.55) + blur(20px)), `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `borderRadius: 30`, `padding: 16`, `marginBottom: 12`.
- **Rows**: One horizontal bar per active sponsor, `height: 28`, `gap: 10`. Label (sponsor name, `Inter_600SemiBold`, `colors.text` (#DAF1DE), 13 sp) left-aligned above the bar; value (``JetBrainsMono_500Medium``, `colors.accent` (#E8662A), 13 sp) right-aligned on the same line.
- **Bar Geometry**: Track `colors.surfaceMuted`, `borderRadius: 6`, full width. Fill `colors.accent` (#E8662A), `borderRadius: 6`, width proportional to `value / maxValue` — never below 4 dp so a non-zero sponsor is always visible.
- **User's Sponsor Emphasis**: The bar for the user's affiliated sponsor renders with a 2 dp `colors.text` (#DAF1DE) outline and a `★` glyph preceding the label.
- **Entry Animation**: Bars grow from `width: 0` on mount, staggered 50 ms per row, spring `stiffness: 320, damping: 30, mass: 0.9`.
- **Accessibility**: Each row carries `accessibilityRole="progressbar"` with `accessibilityValue={{ min: 0, max: maxValue, now: value }}` and an `accessibilityLabel` reading `"[Sponsor], [N] fans, rank [R] of [Total]"`. Rank is never conveyed by color alone — numerals and values are always present.

### 5.4 Sponsor Card Anatomy & User Affiliation

- **Container**: glass surface (rgba(15,36,38,0.55) + blur(20px)), `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `borderRadius: 30`, `padding: 16`, `marginBottom: 12`.
- **Logo**: 48 dp rounded square (`borderRadius: 8`) with fallback initials tile (`backgroundColor: colors.surfaceMuted /* rgba(10,26,27,0.40) */`).
- **Rank & Name**: `1. Nexus Energy` in `Inter_600SemiBold` (`colors.text` (#DAF1DE), 16 sp), with rank numeral in ``JetBrainsMono_500Medium``.
- **Stat Lines**: `N fans · N events won` and `N affiliated users` in Inter_400Regular (`colors.textMuted` (#8EB69B), 13 sp).
- **Yours Badge**: `[ ★ YOURS ]` capsule (`borderRadius: 16`, `height: 24`, `backgroundColor: colors.background /* #060D0E */`, `color: colors.accent /* #E8662A */`, 12 sp `Inter_600SemiBold`) pinned top-right on the user's affiliated sponsor only.
- **Fan Contribution Row**: Rendered only on the user's own sponsor card — *"You have earned 240 fans for Nexus Energy"* in `colors.text` (#DAF1DE), 13 sp, above a hairline divider.
- **Action Row**:
  1. **`[ Visit ↗ ]`** — `borderRadius: 6`, `height: 36`, `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `flex: 1`. Opens the sponsor website / sponsor video in the system browser.
  2. **`[ Change Sponsor ]`** — same geometry, own-card only. Limited to **once per semester**; opens a confirmation dialog: *"Change your sponsor? You can only do this once per semester."* When the allowance is spent, the button renders disabled at `opacity: 0.4` with helper text *"Sponsor change already used this semester."*
- **Guest Mode**: Cards render identically minus the Yours badge, contribution row, and Change Sponsor button.

### 5.5 Prizes & Rewards Accordion

Collapsed by default, using the §4.5 motion system. Expands to the preset prize pool configured by admin for the current sponsor tenure.

| Prize Category | Criteria | Display |
|---|---|---|
| **Top Fan Contributor** | Individual user who earned the most fans across the tenure | Prize name, description, image, plus a live *"You are currently #4"* standing line for authenticated users. |
| **Top Winning Sponsor** | Sponsor with the most event wins | Prize name, description, image, current leader name. |
| **Highest Ranked Sponsor** | Sponsor with the highest composite score | Prize name, description, image, current leader name. |
| **Random Draw** | Random selection among users who earned more than `N` fans | Prize name, description, image, plus an eligibility pill: `✓ Eligible` (`colors.text` (#DAF1DE)/`colors.accent` (#E8662A)) or `Need N more fans` (`colors.surfaceMuted`/`colors.textMuted` (#8EB69B)). |

- **Prize Card**: `borderRadius: 12`, `borderWidth: 1`, `borderColor: colors.border /* rgba(142,182,155,0.15) */`, `padding: 12`, with a 56 dp rounded prize image on the left and text stack on the right.
- **Settlement Note**: Footer text in `colors.textMuted` (#8EB69B), 12 sp — *"Prizes are settled automatically at tenure end."*

### 5.6 Sponsor Leaderboard States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | Skeleton chip rows, shimmer bar chart with 4 pulsating tracks, and 3 skeleton sponsor cards. | Animated linear shimmer while aggregating fan counts. |
| **Guest Mode** | Identical chart and ranked list to authenticated users. | Yours badge, contribution row, prize eligibility pills, and Change Sponsor button are hidden. `[ Visit ↗ ]` works identically. |
| **No Sponsor Selected** | Banner above the chart: *"You haven't picked a sponsor yet."* | Displays `[ Choose Sponsor ]` CTA routing to the onboarding sponsor selection flow. |
| **Sponsor Change Locked** | `[ Change Sponsor ]` at `opacity: 0.4`. | Helper text: *"Sponsor change already used this semester."* Tapping fires a snackbar restating the limit. |
| **No Active Sponsors** | Centered message: *"No sponsors active for this tenure."* | Chart and card list suppressed; Prizes accordion hidden. |
| **Tenure Ended** | Countdown replaced by *"Tenure ended"*; results frozen. | List becomes a read-only archive. Change Sponsor disabled until the next tenure opens. |
| **Error State** | Text: *"Unable to load sponsor standings."* | Displays inline `[ Retry ]` button. Falls back to cached local storage. |
| **Offline Cache** | Loads cached sponsor aggregates from `AsyncStorage`. | Displays subtle offline indicator: *"Showing cached standings"*. |

---

## 6. Scrolling, Gestures & Viewport Behavior Rules

1. **Header Pinning**: Dynamic Status Bar and Segmented Tab Bar remain fixed and sticky at the top (`position: 'fixed'` / `headerShown: true`, `zIndex: 100`).
2. **Main Scroll Container**: Each of the 3 active tab views is wrapped in a `KeyboardAvoidingView` (`behavior: Platform.OS === 'ios' ? 'padding' : 'height'`) containing a single vertical `ScrollView` (`showsVerticalScrollIndicator={false}`, `keyboardShouldPersistTaps="handled"`).
3. **Directional Screen Slide Animation**:
   - Tab transitions animate horizontally using `translateX` (`duration: 220ms`, `useNativeDriver: true`).
   - Forward tabs slide in from `+SCREEN_WIDTH` to `0`; backward tabs slide in from `-SCREEN_WIDTH` to `0`.
4. **Horizontal Swipe Gesture Support**:
   - Swipe gestures between tabs enforce horizontal priority (`Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2`) to ensure fluid vertical scrolling inside standings tables, accordions, and cards without gesture collisions.
   - **Bracket Canvas Exemption**: While a pan originates inside the expanded bracket canvas, tab-swipe capture is disabled (`setPanEnabled(false)`) so horizontal bracket panning never triggers a tab change. Capture re-enables on gesture release.
5. **Sticky "Your Rank" Row**: In Tab 1 the user's rank row detaches and pins to the bottom of the viewport (`position: 'absolute'`, `bottom: 0`, `zIndex: 80`) whenever the in-list row scrolls out of view, and re-docks in place when it scrolls back. The transition cross-fades over 150 ms.
6. **Horizontal Scroll Sub-Components**: Filter chip rows, sort chips, and time filters use horizontal scrolling (`horizontal={true}`, `showsHorizontalScrollIndicator={false}`).
7. **Nested Scroll Prohibition**: Standings rows, sponsor cards, and accordions render inline via `.map()`; nested `FlatList` or `ScrollView` instances are strictly prohibited. The bracket canvas (horizontal-only, §4.5) is the sole sanctioned exception.
8. **Long-List Virtualization Exception**: Standings exceeding 100 rows render the first 50 inline followed by a `[ Load More ]` tertiary button that appends the next 50. This preserves the no-nested-scroll rule while bounding mount cost.
9. **Pull-to-Refresh**: Each tab's `ScrollView` supports `RefreshControl` (`tintColor: colors.accent /* #E8662A */`) forcing a full re-fetch and socket re-subscribe.
10. **Cross-Tab Deep Linking**: Tapping an event card in Tab 0 forward-slides to Tab 1 with `selectedEventId` set. The Tab 1 back chevron (`‹`) back-slides to Tab 0 preserving prior scroll offset and active filters.

---

## 7. Typography & Font Configuration

> Fonts are defined in `UI-UX-Master-Doc.md §5`. Load all in `app/_layout.tsx` via `@expo-google-fonts/*`. Reference from a `FONTS` constant — never inline family strings.

### 7.1 Font Families & Loading Architecture
1. **Display Font**: `BebasNeue_400Regular` — screen title (48 sp+) and any numeral ≥ 32 sp. Installed via `@expo-google-fonts/bebas-neue`.
2. **UI Heading Font**: `BarlowCondensed_700Bold` — event titles, section headers, sponsor names, accordion triggers (18–28 sp). Installed via `@expo-google-fonts/barlow-condensed`.
3. **Body / UI Font**: `Inter` family (400/500/600/700) — buttons, labels, body text, form inputs, chips. Installed via `@expo-google-fonts/inter`.
4. **Monospace / Numerics**: `JetBrainsMono_500Medium` — rank numerals, scores, fan counts, point balances. Always pair with `fontVariantNumeric: 'tabular-nums'` so digit columns stay optically flush on live updates. Installed via `@expo-google-fonts/jetbrains-mono`.
5. **Fallback**: `Platform.select({ ios: 'Helvetica Neue', android: 'sans-serif' })`.

### 7.2 Font Family Application Rules Table

| UI Context | Font | Size (sp) | Example |
|---|---|---|---|
| Screen Title | `BebasNeue_400Regular` | 48 | "LEADERBOARDS" |
| Section Headers | `BarlowCondensed_700Bold` | 22–24 | "Sponsor Leaderboard", "Live Standings" |
| Event Titles, Sponsor Names | `BarlowCondensed_700Bold` | 18–20 | "Airball Premier League" |
| Accordion Triggers | `BarlowCondensed_700Bold` | 16–18 | "Bracket View", "Score Breakdown" |
| Podium Rank Medallion | `BarlowCondensed_700Bold` | 14 | `1`, `2`, `3` |
| Buttons & Action Pills | `Inter_600SemiBold` | 14–16 | "Invest Points", "View →" |
| Type / Format / Status Badges | `Inter_600SemiBold` | 12–13 | `[LE]`, `● LIVE`, `★ YOURS` |
| Body & Descriptions | `Inter_400Regular` | 14 | Prize descriptions, helper text |
| Search & Input Text | `Inter_400Regular` | 14–15 | Search bar, investment input |
| Ranks, Scores, Fans, Balances | `JetBrainsMono_500Medium` | 13–14 | `#12`, `940 pts`, `12,480` |


## 8. Palette & Colour System

> **Tokens from `UI-UX-Master-Doc.md §4`.** Always consume via `useColors()` — never hardcode hex in components. Dark mode is primary; light override values are in the master doc §4.2.

```typescript
// Reference values only — use useColors() in all component code
export const leaderboardThemeTokens = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  background:           '#060D0E',               // App canvas            (token: background)
  backgroundMid:        '#0F2426',               // Section bg variant    (token: backgroundMid)

  // ── Glass Surfaces ─────────────────────────────────────────────────────────
  surface:              'rgba(15,36,38,0.55)',   // Card/panel + blur(20px) (token: surface)
  surfaceMuted:         'rgba(10,26,27,0.40)',   // Inputs, chips, badge bg (token: surfaceMuted)
  surfaceSolid:         '#163832',               // No-blur fallback        (token: surfaceSolid)

  // ── Borders ────────────────────────────────────────────────────────────────
  border:               'rgba(142,182,155,0.15)',// Hairline               (token: border)
  borderActive:         'rgba(142,182,155,0.40)',// Focus / selected       (token: borderActive)
  borderMuted:          'rgba(142,182,155,0.10)',// Faint row divider

  // ── Typography ─────────────────────────────────────────────────────────────
  text:                 '#DAF1DE' /* colors.text */,               // Primary text           (token: text)
  textMuted:            '#8EB69B',               // Labels, captions       (token: textMuted)

  // ── Interactive ────────────────────────────────────────────────────────────
  accent:               '#E8662A',               // CTAs, active tab, links (token: accent)
  accentText:           glass surface: rgba(15,36,38,0.55),               // Text on accent fill    (token: accentText)
  accentMuted:          'rgba(232,102,42,0.15)', // Accent tint bg         (token: accentMuted)
  primary:              '#DAF1DE' /* colors.text */,               // Primary button fill    (token: primary)
  primaryText:          '#060D0E',               // Text on primary fill   (token: primaryText)

  // ── Podium Medallions ──────────────────────────────────────────────────────
  rankGold:             '#F5C518',               // Rank 1 medallion fill
  rankSilver:           '#C7CBD1',               // Rank 2 medallion fill
  rankBronze:           '#D9A066',               // Rank 3 medallion fill
  rankNumeral:          '#060D0E',               // Numeral on medallion (dark on bright)

  // ── Rank Movement Deltas ───────────────────────────────────────────────────
  deltaUp:              '#34D27B',               // ▲ rank gained          (token: success)
  deltaDown:            '#F2686C',               // ▼ rank lost            (token: danger)
  deltaNeutral:         '#8EB69B',               // — no change            (token: textMuted)

  // ── Live Status ────────────────────────────────────────────────────────────
  liveDot:              '#34D27B',               // Pulsing live socket dot (token: success)
  liveBg:               'rgba(52,210,123,0.15)', // Live pill bg tint
  rowFlash:             'rgba(52,210,123,0.12)', // 600 ms flash on rank change

  // ── Bracket Semantics ─────────────────────────────────────────────────────
  bracketUpperBg:       'rgba(232,102,42,0.12)', // Upper bracket badge bg
  bracketUpperText:     '#E8662A',               // Upper bracket badge text
  bracketLowerBg:       'rgba(91,156,248,0.12)', // Lower bracket badge bg
  bracketLowerText:     '#5B9CF8',               // Lower bracket badge text
  eliminatedOpacity:    0.40,                    // Eliminated entrant row opacity

  // ── States ─────────────────────────────────────────────────────────────────
  success:              '#34D27B',               //                        (token: success)
  danger:               '#F2686C',               //                        (token: danger)
  info:                 '#5B9CF8',               //                        (token: info)
  warningBg:            'rgba(251,191,36,0.15)', // Threshold warnings bg
  warningText:          '#FCD34D',               // Threshold warnings text
};
```


## 9. Button & Surface Geometry System

All colours via `useColors()`. Never hardcode hex values in component files.

| Button / Surface | Tier | Shape & Radius | Height (dp) | Fill | Border | Text Style |
|---|---|---|---|---|---|---|
| **`[ Invest Points ]`** | Primary | Slightly rounded (`8 dp`) | `48 dp` full-width | `colors.accent` (#E8662A) | None | `15 sp` `Inter_600SemiBold` `colors.accentText` (#FFFFFF) |
| **`[ Confirm Investment ]`** | Primary | Slightly rounded (`8 dp`) | `48 dp` full-width | `colors.accent` (#E8662A) | None | `15 sp` `Inter_600SemiBold` `colors.accentText` (#FFFFFF) |
| **Drawer Toggle (`☰`)** | Primary | Borderless icon | `32 dp` | Transparent | None | `24 sp` `colors.text` (#DAF1DE) |
| **Active Tab Pill** | Secondary | Capsule (`20 dp`) | `36 dp` | `colors.accent` (#E8662A) | None | `13 sp` `Inter_600SemiBold` `colors.accentText` (#FFFFFF) |
| **Inactive Tab Item** | Secondary | Capsule (`20 dp`) | `36 dp` | Transparent | None | `13 sp` `Inter_600SemiBold` `colors.textMuted` (#8EB69B) |
| **Active Filter / Sort Chip** | Secondary | Capsule (`20 dp`) | `36 dp` | `colors.accent` (#E8662A) | None | `12 sp` `Inter_600SemiBold` `colors.accentText` (#FFFFFF) |
| **Inactive Filter / Sort Chip** | Secondary | Capsule (`20 dp`) | `36 dp` | Transparent | 1 dp `colors.border` | `12 sp` `Inter_400Regular` `colors.textMuted` (#8EB69B) |
| **Quick Amount Pill (`50` / `Max`)** | Secondary | Capsule (`16 dp`) | `32 dp` | `colors.accentMuted` when active; transparent when inactive | 1 dp `colors.border` | `12 sp` `Inter_600SemiBold` |
| **Event Card Surface** | Glass card | Rounded (`16 dp`) | Auto | `colors.surface` + `blur(20px)` | 1 dp `colors.border` | Press-in `scale: 0.98`, 120 ms spring |
| **Podium Tile** | Glass card | Rounded (`12 dp`) | Auto | `colors.surface` + `blur(20px)` | 1 dp medal-colour @ 40% opacity | 28 dp medallion + 40 dp avatar |
| **Standings Row** | Glass surface | None (flat in list) | `56 dp` | Transparent (own row: `colors.surfaceMuted`) | Bottom 1 dp `colors.borderMuted` | Rank + name + stats + score |
| **Rank Medallion** | Filled circle | Circle (`14 dp` radius) | `28 dp` | `rankGold` / `rankSilver` / `rankBronze` | None | `14 sp` `BarlowCondensed_700Bold` `colors.background` |
| **Status Pill `● LIVE`** | Secondary | Capsule (`12 dp`) | `24 dp` | `colors.liveBg` | None | `11 sp` `Inter_600SemiBold` `colors.success` |
| **Status Pill `○ UPCOMING`** | Secondary | Capsule (`12 dp`) | `24 dp` | `colors.surfaceMuted` | 1 dp `colors.border` | `11 sp` `Inter_600SemiBold` `colors.textMuted` |
| **Status Pill `✓ ENDED`** | Secondary | Capsule (`12 dp`) | `24 dp` | `colors.surfaceMuted` | 1 dp `colors.border` | `11 sp` `Inter_600SemiBold` `colors.textMuted` |
| **Type / Format Badge `[LE]`** | Tertiary | Soft rect (`6 dp`) | `20 dp` | `colors.surfaceMuted` | None | `12 sp` `Inter_600SemiBold` `colors.textMuted` |
| **`[ View → ]`** | Tertiary | Soft rect (`6 dp`) | `36 dp` | Transparent | 1 dp `colors.border` | `12 sp` `Inter_400Regular` `colors.text` |
| **`[ Visit ↗ ]` / `[ Change Sponsor ]`** | Tertiary | Soft rect (`6 dp`) | `36 dp` | Transparent | 1 dp `colors.border` | `12 sp` `Inter_400Regular` `colors.text` |
| **`[ Manage on Web ↗ ]`** | Tertiary | Soft rect (`6 dp`) | `36 dp` | Transparent | 1 dp `colors.border` | `12 sp` `Inter_400Regular` `colors.accent` |
| **`[ Load More ]`** | Tertiary | Soft rect (`6 dp`) | `36 dp` full-width | Transparent | 1 dp `colors.border` | `12 sp` `Inter_600SemiBold` `colors.accent` |
| **Accordion Trigger `+` / `−`** | Tertiary | Borderless icon | `24 dp` | Transparent | None | `14×14` SVG `strokeWidth: 1.75` `colors.textMuted` |
| **`[ Clear x ]` (Search)** | Tertiary | Borderless icon | `24 dp` | Transparent | None | `colors.textMuted` |


## 10. Real-Time Data & Socket Architecture

### 10.1 Live Update Channel
- **Transport**: `Socket.io` client with the Redis adapter backing multi-instance fan-out, per the platform Real-Time layer.
- **Subscription**: Entering Tab 1 emits `leaderboard:subscribe` with `{ eventId }`. Leaving the tab, backgrounding the app, or selecting a different event emits `leaderboard:unsubscribe` to avoid orphaned rooms.
- **Inbound Events**:
  - `leaderboard:score_update` → `{ eventId, entries[], revision }` — triggers the row re-order animation (§4.3).
  - `leaderboard:investment` → `{ eventId, participantId, newScore }` — applies another user's investment to the standings.
  - `leaderboard:status` → `{ eventId, status }` — flips the Live / Ended pill and toggles investment availability.
  - `bracket:match_update` → `{ matchId, scoreA, scoreB, status }` — updates the bracket canvas node and match detail sheet in place.
- **Revision Guard**: Every payload carries a monotonically increasing `revision`. Out-of-order packets (`incoming.revision <= current.revision`) are discarded so a delayed frame cannot roll standings backward.

### 10.2 Read Path & Caching
- **Initial Load**: Standings and event lists are served from **database read replicas**, keeping leaderboard queries off the primary.
- **Hot Standings**: Live rank sets are backed by Redis sorted sets, so rank reads stay O(log N) under load.
- **Local Persistence**: The last successful payload per event is written to `AsyncStorage` under `leaderboard:<eventId>` with a timestamp, powering every Offline Cache state in §3.4, §4.7, and §5.6.

### 10.3 Reconnection & Degradation Policy
1. On disconnect, the Live pill switches to `◌ Reconnecting` and standings remain fully interactive from the last-known state.
2. Reconnect uses exponential backoff — `1s, 2s, 4s, 8s`, capped at `15s`, with jitter.
3. After 3 consecutive failures the pill settles on `○ Offline` and a banner appears: *"Live updates paused · showing last known standings."*
4. On successful reconnect the client requests a full snapshot rather than replaying missed deltas, then reconciles by `revision`. A brief snackbar confirms: *"Standings up to date."*
5. **Investment is hard-disabled while offline.** The CTA renders at `opacity: 0.4` with helper text *"Reconnect to invest points."* — no optimistic point spending is ever queued offline.

---

## 11. Accessibility Compliance

| Requirement | Implementation |
|---|---|
| **Contrast** | All text pairs meet WCAG AA minimum; primary text (`colors.text` (#DAF1DE) on `colors.text` (#DAF1DE)) reaches 12:1 AAA. |
| **Rank Never Color-Only** | Podium position, rank movement, and bracket state always carry a numeral, arrow glyph, or text label alongside color. |
| **Touch Targets** | Every interactive element is ≥ 36 dp on its smallest axis; icon-only triggers use `hitSlop: { top: 8, bottom: 8, left: 8, right: 8 }`. |
| **Screen Reader — Standings Row** | `accessibilityLabel`: `"Rank 4, Red Titans, 9 played, 6 won, up 2 places, 788 points"`. |
| **Screen Reader — Accordions** | `accessibilityRole="button"` with `accessibilityState={{ expanded }}`; panels use `role="region"` bound via `aria-labelledby` (§4.5). |
| **Live Region Announcements** | Rank changes affecting the current user announce via `AccessibilityInfo.announceForAccessibility()` — *"Your rank changed to 10."* Other users' updates stay silent to avoid announcement flooding. |
| **Reduced Motion** | When `AccessibilityInfo.isReduceMotionEnabled()` is true, tab slides, podium stagger, bar growth, and row re-order animations collapse to instant state changes with a 100 ms cross-fade. |
| **Dynamic Type** | Layout tolerates up to 200% font scaling; standings columns reflow to a stacked two-line row above 150% rather than truncating scores. |
| **Focus Order** | Tab bar → search/filters → podium → standings rows → sticky rank row → accordions. The investment sheet traps focus until dismissed. |

## 12. Animation Reference

All animations use `react-native-reanimated` v3 unless noted. All `opacity` and `transform` animations use `useNativeDriver: true`.

| # | Name | Trigger | Library | Spec |
|---|---|---|---|---|
| 12.1 | **Tab Slide** | User taps a segment or swipes | `react-native-reanimated` `translateX` | `duration: 220ms`, `easeInOut`. Forward: `+SCREEN_WIDTH → 0`; backward: `-SCREEN_WIDTH → 0`. |
| 12.2 | **Active Tab Pill Glide** | Segment active index changes | `react-native-reanimated` spring | `damping: 18, stiffness: 150`. Pill slides behind new active tab. |
| 12.3 | **Event Card Press** | User presses a card | `react-native-reanimated` spring | `scale: 1.0 → 0.98`, `opacity: 1.0 → 0.9`, 120 ms. Revert on release. |
| 12.4 | **Podium Tile Entry** | Tab 1 mounts / event selected | `react-native-reanimated` spring | `translateY: 12 → 0`, `opacity: 0 → 1`, `stiffness: 340, damping: 32, mass: 0.9`. Delays: rank 1 = 0 ms, rank 2 = 60 ms, rank 3 = 120 ms. |
| 12.5 | **Standings Row Re-order** | Socket `leaderboard:score_update` | `react-native-reanimated` `translateY` layout animation | Spring `stiffness: 300, damping: 30`. Row background flashes `rowFlash` for 600 ms then settles. |
| 12.6 | **Sponsor Bar Chart Grow** | Tab 2 mounts | `react-native-reanimated` spring | `width: 0 → finalWidth`, `stiffness: 320, damping: 30, mass: 0.9`. Stagger 50 ms per row. |
| 12.7 | **Investment Sheet Spring-In** | User taps `[ Invest Points ]` | `react-native-reanimated` | `translateY: 100% → 0%`, `tension: 90, friction: 14`. Dismiss: 260 ms ease-out. |
| 12.8 | **Live Dot Pulse** | Socket connected + event live | `react-native-reanimated` loop | `opacity: 0.35 → 1.0 → 0.35`, `duration: 1200ms`, `easing: easeInOut`. Stops when socket disconnects. |
| 12.9 | **Accordion Open/Close** | User taps accordion trigger | `react-native-reanimated` spring | Height `0 → contentHeight`, `stiffness: 340, damping: 34, mass: 0.9`. Icon rotates `0° → 180°`, `stiffness: 480, damping: 28`. |
| 12.10 | **Skeleton Shimmer** | Loading states across all tabs | `react-native-reanimated` loop | Opacity `0.3 ↔ 0.7`, 750 ms each direction. Shape matches live content. |
| — | **Reduced Motion** | `AccessibilityInfo.isReduceMotionEnabled()` = true | — | Tab slides, podium stagger, bar growth, and row re-order collapse to instant 100 ms cross-fades. Pulse loops stop. |

