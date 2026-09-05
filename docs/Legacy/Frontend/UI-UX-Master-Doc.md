# BGSC Platform — UI/UX Master Document

> **The single source of truth for all frontend design and implementation decisions.**
> Hand this doc to any AI or developer before building any screen. It supersedes all earlier style notes.
> Cross-reference the per-screen specs in `docs/FrontendGuide/Screens Master Doc/` for layout-level detail.

**Last updated:** 2026-08-08
**Status:** Active — all new screens must conform to this doc.

---

## 0. How To Use This Document

When prompting an AI to build or modify any screen, prepend:

```
Read UI-UX-Master-Doc.md in full before writing any code.
Then read the specific screen spec from Screens Master Doc/.
Follow the glassmorphism token system exactly — never hardcode hex.
Use the component recipes in §7. Match every spacing, radius, and type rule.
```

**Golden rules (memorise these):**
1. **Never hardcode colours** — use semantic tokens via `useColors()` / CSS variables.
2. **Glass surfaces over dark base** — every card, sheet, and input is a frosted glass panel.
3. **Heavy display font for hero text only.** Body and UI always use the regular face.
4. **One primary CTA per view** — accent-filled pill. Everything else is ghost/outline.
5. **Skeletons, not spinners** for first-load. Spinners only for in-flight button actions.
6. **Auth gating** — guest reads freely; any write action redirects to `/login`.
7. **MVVM strict** — no business logic in components; all data lives in ViewModels/repositories.

---

## 1. Application Overview

### 1.1 Mission

BGSC Platform is the digital hub for the BITS Goa sports and esports communities. It unifies event discovery, gamified participation (points, challenges, leaderboards), community social features, and an internal organiser workspace — all in one product.

### 1.2 Use Cases

| Use Case | Who |
|---|---|
| Discover and register for sports/esports events | Students (User, Guest) |
| Track points balance and redeem in the store | Authenticated User |
| Complete challenges and earn Hall of Fame entries | Authenticated User |
| Follow friends, post content, react to announcements | Authenticated User |
| Manage events, publish announcements, run tasks | Coordinator / Core / Founder |

### 1.3 Core Feature Set

**Public / User-facing:**
- Event discovery, registration, results
- Announcements feed (BGEC, FitSoc, Airball, Offside, PowerPlay, etc.)
- General social feed (posts, likes, comments)
- Points dashboard + transaction history
- Challenge browser + submission flow
- Leaderboard + investment mechanic
- Sponsor affiliation + newsletter
- Friend system + friend matchmaking
- Hall of Fame (top performers per season)
- Store (redeem points for merch/games)
- Media page (highlight videos, photos)
- User profile + settings

### 1.4 Target Audience & User Roles

| Role                | Who they are                       | Primary Screens                                       |
| ------------------- | ---------------------------------- | ----------------------------------------------------- |
| **Guest**           | Unauthenticated campus visitor     | Home, Events, Leaderboards (read), Media              |
| **User**            | Authenticated BITS Goa student     | All public screens, Points, Challenges, Friends, Feed |
| **Member**          | BGSC/BGEC crew with assigned tasks | All User screens                                      |
| **Core**            | Event/workspace manager            | Announcement tools, all User screens                  |
| **Coordinator**     | Top-level ops manager              | All screens including admin tools                     |
| **Founder / Admin** | Absolute system access             | Everything                                            |

---

## 2. Frontend Architecture

### 2.1 Platform Split

| App | Folder | Stack | Audience |
|---|---|---|---|
| Mobile (primary) | `mobile/` | React Native + Expo SDK 56, Expo Router | Students (iOS + Android + PWA) |
| Web Admin Console | `web/` | React 19 + Vite 8 + Tailwind CSS v4 | Coordinators / Founders |

Both apps share the **same MVVM core** (`src/core/`) — tokens, stores, repositories, ViewModels. Keep them in sync until a shared package exists.

### 2.2 MVVM Pattern

```
┌─────────────────────────────────────────────────────────┐
│  VIEW  (React/RN components — display only)             │
│    useViewModel(vm) → reads state, calls vm methods     │
├─────────────────────────────────────────────────────────┤
│  VIEWMODEL  (BaseViewModel<S> — business logic)         │
│    runAsync(key, task) → AsyncState<T>                  │
│    setState(patch) → triggers re-render                 │
├─────────────────────────────────────────────────────────┤
│  REPOSITORY  (typed API surface)                        │
│    AuthRepository / UserRepository / PointsRepository … │
│    TanStack Query hooks wrap repositories               │
├─────────────────────────────────────────────────────────┤
│  ApiClient  (fetch wrapper)                             │
│    Bearer injection, 401→refresh→retry                  │
└─────────────────────────────────────────────────────────┘
```

**Rule:** Zero business logic in screen components. Components call ViewModel methods and read ViewModel state only.

### 2.3 Mobile Directory Structure

```
mobile/src/
├── app/                   ← Expo Router (file-based routes)
│   ├── _layout.tsx        ← Root: QueryClientProvider, ThemeProvider, SafeAreaProvider
│   ├── login.tsx / register.tsx
│   ├── auth/callback.tsx
│   └── (drawer)/          ← All main screens behind side-drawer navigator
│       ├── _layout.tsx    ← Drawer config + DynamicStatusBar header
│       ├── index.tsx      ← Home (tabs: Intro | Announcements | Feed)
│       ├── events.tsx
│       ├── points.tsx     ← Points & Challenges (tabs: Points | Challenges)
│       ├── sponsors.tsx / friends.tsx / leaderboards.tsx
│       ├── hall-of-fame.tsx / store.tsx / media.tsx
│       └── feedback.tsx / profile.tsx
├── components/            ← Shared UI components
│   ├── dynamic-status-bar.tsx
│   ├── drawer-content.tsx
│   ├── GlassCard.tsx      ← Reusable glassmorphism card
│   ├── PillButton.tsx     ← Primary / outline pill button
│   ├── ChipFilter.tsx     ← Filter chip row
│   └── SkeletonBlock.tsx  ← Shimmer skeleton
├── hooks/
│   ├── use-color-scheme.ts
│   └── use-colors.ts      ← Returns active ThemeColors from tokens
├── viewmodels/            ← One ViewModel per screen/module
└── core/                  ← Shared MVVM core (mirrors web/src/core)
    ├── api/ repositories/ stores/ theme/ viewmodel/
    └── types.ts
```

### 2.4 Routing (Mobile — Expo Router)

| Route | Screen | Auth |
|---|---|---|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/auth/callback` | Google OAuth callback | Public |
| `/(drawer)/` | Home | Public (guest read) |
| `/(drawer)/events` | Events | Public (guest read) |
| `/(drawer)/points` | Points & Challenges | **Auth required** |
| `/(drawer)/sponsors` | Sponsors | Public |
| `/(drawer)/friends` | Friends | **Auth required** |
| `/(drawer)/leaderboards` | Leaderboards | Public |
| `/(drawer)/hall-of-fame` | Hall of Fame | Public |
| `/(drawer)/store` | Store | **Auth required** |
| `/(drawer)/media` | Media | Public |
| `/(drawer)/feedback` | Feedback & Contact | Public |
| `/(stack)/challenge/[id]` | Challenge Detail | **Auth required** |
| `/(stack)/challenge/[id]/submission` | Submission | **Auth required** |

### 2.5 State Management

| Concern | Tool | Location |
|---|---|---|
| Auth token + user | Zustand `authStore` | `core/stores/authStore.ts` |
| Theme (light/dark/system) | Zustand `themeStore` | `core/stores/themeStore.ts` |
| Server data (fetch, cache, mutations) | TanStack Query v5 | Per-screen hooks |
| Local UI state | `useState` / ViewModel | Component / ViewModel |

**Token persistence:** `expo-secure-store` on mobile; `localStorage` on web.
**Refresh:** `ApiClient` transparently refreshes on `401` using the httpOnly cookie, then retries once.

---

## 3. Design Theme & Methodology

### 3.1 Decided Theme: Minimalism + Glassmorphism

The BGSC visual language combines two principles:

**Minimalism** — ruthless reduction. Every element earns its place. Whitespace is structural, not decorative. One primary action per view. No visual noise.

**Glassmorphism** — depth through frosted glass. Cards and panels are semi-transparent, blurred layers floating over a rich dark background. The background bleeds through surfaces, creating depth without heavy shadows or flat fills.

Inspiration: **Lusion** (lusion.studio) — clean dark canvas, heavy display type for impact, glassy UI panels, smooth motion. That energy is the design north star.

### 3.2 Design Principles

1. **Dark canvas first.** The app lives on a deep dark background. Content surfaces are glass panels above it.
2. **Type does the talking.** Heavy display font for hero headings. Everything else is restrained. No decorative type treatments.
3. **Colour is reserved for meaning.** Accent (burnt orange) marks active state, links, and CTAs only. No accent floods.
4. **Motion is invisible.** Transitions feel natural, not showy. 150–280 ms. Spring physics for sheets and modals.
5. **Content shapes layout.** Spacing scales up around important content; it doesn't fill a rigid grid.
6. **Always accessible.** Glassmorphism must not compromise contrast. Text on glass must pass WCAG AA (4.5:1 body, 3:1 large). Blur is a visual treat — provide solid fallback for `reduce-motion` and low-end devices.

### 3.3 Visual Language

| Element | Treatment |
|---|---|
| App background | Deep dark teal gradient — not pure black |
| Cards / panels | Frosted glass: semi-transparent bg + `backdrop-filter: blur()` + hairline border |
| Primary CTA | Fully opaque dark-ink or accent-fill pill — glass not used here (must have clear contrast) |
| Inputs | Glass surface, slightly lighter than cards |
| Hero text | Heavy display font, large (32–64 sp), light colour on dark canvas |
| Section labels | UPPERCASE, letter-spaced, muted — 11–12 sp |
| Icons | Outline style, single weight, 24 dp |
| Dividers | 1 px, rgba glass-border colour — barely visible |
| Illustrations | Pixel-art retro mascots (existing); warm coral/cream — fade into background with gradient |

---

## 4. Color System

### 4.1 Glassmorphism Base Palette

These are the raw hex values. **Never use them directly in components** — always reference the semantic tokens in §4.2.

```
/* ─── Dark Canvas (Page Background) ─── */
--color-canvas-deepest:   #060D0E;   /* Near-black teal — darkest bg */
--color-canvas-dark:      #0A1A1B;   /* Primary app background */
--color-canvas-mid:       #0F2426;   /* Slightly lighter bg variant */

/* ─── Teal Brand Palette (from auth screens) ─── */
--color-teal-900:         #051F20;
--color-teal-800:         #0B2B26;
--color-teal-700:         #163832;
--color-teal-600:         #235347;   /* Rich teal — brand identity */
--color-teal-300:         #8EB69B;   /* Sage green — secondary accent */
--color-teal-100:         #DAF1DE;   /* Lightest mint — text on dark */

/* ─── Warm Accent ─── */
--color-accent:           #E8662A;   /* Burnt orange — CTA, active, links */
--color-accent-light:     #F2783C;   /* Slightly lighter for dark mode */

/* ─── Glass Surface Values ─── */
--glass-bg:               rgba(15, 36, 38, 0.55);     /* Card/panel bg */
--glass-bg-light:         rgba(20, 50, 52, 0.40);     /* Input, lighter panel */
--glass-border:           rgba(142, 182, 155, 0.15);  /* Sage-tinted hairline */
--glass-border-active:    rgba(142, 182, 155, 0.40);  /* Focus / selected state */
--glass-blur:             20px;                        /* Standard blur radius */
--glass-blur-heavy:       32px;                        /* Modals, sheets */

/* ─── Light Mode Override (if needed) ─── */
/* Light mode uses warm cream canvas (#FAF7F2) with white glass cards.
   Glass effect on light: rgba(255,255,255,0.70) + blur(16px) + border rgba(0,0,0,0.08) */
```

### 4.2 Semantic Token Map

Tokens are the layer components consume. Both light and dark modes must be implemented even though dark is primary.

| Token | Dark (primary) | Light (override) | Usage |
|---|---|---|---|
| `background` | `#060D0E` | `#FAF7F2` | App canvas |
| `backgroundMid` | `#0F2426` | `#F2EEE7` | Subtle section bg |
| `surface` | `rgba(15,36,38,0.55)` + blur | `rgba(255,255,255,0.70)` + blur | Glass card / panel |
| `surfaceSolid` | `#163832` | `#FFFFFF` | Non-blurred fallback for low-perf |
| `surfaceMuted` | `rgba(10,26,27,0.40)` | `#F2EEE7` | Input bg, chips |
| `text` | `#DAF1DE` | `#1B1714` | Primary body text |
| `textMuted` | `#8EB69B` | `#8C857A` | Labels, subtitles, helpers |
| `border` | `rgba(142,182,155,0.15)` | `#E7E1D6` | Hairlines, dividers |
| `borderActive` | `rgba(142,182,155,0.40)` | `#235347` | Focus / selected border |
| `primary` | `#DAF1DE` | `#1F1B17` | Primary button fill |
| `primaryText` | `#060D0E` | `#FFFFFF` | Text on primary button |
| `accent` | `#E8662A` | `#E8662A` | Links, active chips, highlights |
| `accentText` | `#FFFFFF` | `#FFFFFF` | Text on accent fill |
| `accentMuted` | `rgba(232,102,42,0.15)` | `rgba(232,102,42,0.12)` | Accent tint bg |
| `success` | `#34D27B` | `#22C55E` | Positive / complete |
| `danger` | `#F2686C` | `#E5484D` | Error / destructive |
| `info` | `#5B9CF8` | `#3B82F6` | Informational |

### 4.3 Glass Surface — React Native Recipe

```tsx
// components/GlassCard.tsx
import { BlurView } from 'expo-blur';

export function GlassCard({ children, style }) {
  const colors = useColors();
  return (
    <BlurView
      intensity={60}            // 0–100; tune per device
      tint="dark"               // or 'light' in light mode
      style={[
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          padding: 14,
        },
        style,
      ]}
    >
      {/* Semi-transparent overlay to control opacity */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
      {children}
    </BlurView>
  );
}
```

**Web (Tailwind CSS v4) equivalent:**
```css
.glass-card {
  background: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 16px;
}
```

**Fallback rule:** On devices that do not support `backdrop-filter`, use `surfaceSolid` as the background. Use `@supports (backdrop-filter: blur(1px))` for CSS, or check with the expo-blur `BlurView` fallback on RN.

### 4.4 Category / Tag Colours

Unchanged from existing system. Use these for event/announcement category pills only.

| Category         | Colour             |
| ---------------- | ------------------ |
| BGEC             | `#3B82F6` (blue)   |
| FitSoc           | `#8B5CF6` (purple) |
| Airball          | `#F59E0B` (amber)  |
| Offside          | `#EF4444` (red)    |
| PowerPlay        | `#22C55E` (green)  |
| Around The Net   | `#06B6D4` (cyan)   |
| Deuce            | `#F97316` (orange) |
| Highlight Events | `#EC4899` (pink)   |
| Teams            | `#14B8A6` (teal)   |

Status colours: **upcoming** = blue · **ongoing** = green · **past** = muted grey.

---

## 5. Typography & Font Palette

### 5.1 Font Families

| Role | Font | Weight(s) | Notes |
|---|---|---|---|
| **Display / Hero titles** | **Bebas Neue** | 400 (only weight) | Heavy condensed — Impact-style. Used exclusively for large hero headings (32 sp+). Load via `expo-font` / `@font-face`. |
| **UI headings (18–28 sp)** | **Barlow Condensed** | 700, 800 | Semi-condensed bold for section titles and screen headers where Bebas is too aggressive. |
| **Body / All UI text** | **Inter** | 400, 500, 600, 700 | Google Fonts. Primary typeface for all body, labels, buttons, inputs. Fallback: `"Helvetica Neue", Helvetica, Arial, sans-serif`. |
| **Monospace** | **JetBrains Mono** | 500 | OTP boxes, code snippets, timestamps needing alignment. |

> **Why Bebas Neue?** It's freely available on Google Fonts, ships as a single `.ttf`, loads well via `expo-font`, and achieves the Heavy Impact style from the design reference with strong baseline legibility at large sizes.

> **Note on Helvetica Neue:** The auth spec specifies Helvetica Neue. This master doc supersedes it — migrate auth screens to Inter when rebuilding. Helvetica Neue is a system font on iOS only and is not reliably available cross-platform.

### 5.2 Type Scale

| Role | Font | Size | Weight | Colour | Notes |
|---|---|---|---|---|---|
| Hero / splash heading | Bebas Neue | 48–64 sp | 400 | `text` | Screen titles, landing hero |
| Screen / page title | Barlow Condensed | 28–32 sp | 700 | `text` | Top of screen, modal title |
| Section heading | Inter | 18–20 sp | 700 | `text` | Section dividers |
| Card title | Inter | 16 sp | 600 | `text` | 1–2 lines, ellipsis clamp |
| Body | Inter | 14–15 sp | 400 | `text` | Paragraphs, descriptions |
| Helper / subtitle | Inter | 12–13 sp | 400 | `textMuted` | Under headings, field captions |
| **Field label** | Inter | 11–12 sp | 600 | `textMuted` | **UPPERCASE**, letter-spacing 0.5–0.8 |
| Button label | Inter | 15–16 sp | 600 | per button | — |
| Caption / meta | Inter | 11–12 sp | 400–500 | `textMuted` | Timestamps, counts |
| Link | Inter | 12–14 sp | 600 | `accent` | Optionally underlined |

- Line-height: **1.35–1.45×** body · **1.15–1.2×** headings.
- Use **tabular figures** (`fontVariantNumeric: 'tabular-nums'`) for counts, timers, balances.

### 5.3 Loading Fonts in Expo

```tsx
// app/_layout.tsx
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

export default function RootLayout() {
  const [loaded] = useFonts({
    BebasNeue_400Regular,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
  });
  if (!loaded) return null; // show splash
  // ...
}
```

**Required packages:**
```bash
npx expo install @expo-google-fonts/bebas-neue @expo-google-fonts/barlow-condensed \
  @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono expo-font
```

---

## 6. Spacing, Layout & Radius

### 6.1 Spacing Scale (4pt base)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72`

| Usage | Value |
|---|---|
| Screen horizontal padding | 16 |
| Gap between cards / list items | 12 |
| Inside-card padding | 14–16 |
| Section vertical gap | 20–24 |
| Field stack gap (label → input) | 6 |
| Gap between fields | 12–14 |
| Status bar height (safe area) | Platform-provided |

### 6.2 Border Radius

| Element | Radius |
|---|---|
| Pill input / pill button | 999 (fully rounded) |
| Glass card | 16 |
| Chip / tag pill | 20 |
| Bottom sheet (top corners) | 24 |
| Small control (OTP cell, toggle thumb) | 10–12 |
| Avatar | circle (9999) |
| Section badge / status pill | 8 |

### 6.3 Glass Elevation

Glass surfaces convey depth via **layering and blur intensity**, not drop-shadows.

| Layer | Blur | Opacity |
|---|---|---|
| Base cards | `blur(20px)` | 55% opacity bg |
| Modals / bottom sheets | `blur(32px)` | 65% opacity bg |
| Toasts / snackbars | `blur(24px)` | 70% opacity bg |
| Inputs (on card) | `blur(12px)` | 40% opacity bg |

On RN, BlurView `intensity` maps approximately: `blur(20px)` ≈ `intensity={55}`, `blur(32px)` ≈ `intensity={80}`.

---

## 7. Component Recipes

All components read colour from `useColors()`. Sizes are guidelines; never hardcode hex.

### 7.1 Pill Buttons

**Primary (accent fill):**
Full-width or auto-width, `backgroundColor: accent`, `accentText` label, height ~52 dp, radius 999, Inter 600 15–16 sp.
One per view. Disabled → `border` bg + `textMuted` (0.5 opacity). In-flight → spinner + "Please wait…".

**Primary (light / on dark canvas):**
`backgroundColor: primary` (= `#DAF1DE` in dark mode), `primaryText` label. Use for the single dominant CTA on dark screens.

**Ghost / outline:**
Transparent bg, `1px borderColor: border`, `text` label. For secondary actions.

**Destructive:**
`danger` text (ghost) or `danger` fill for hard-delete actions. Always add a confirm step.

### 7.2 Glass Input Field

```
Glass surface bg (rgba + blur) · 1px borderColor: border
radius 999 (pill) · horizontal padding 14 · height ~48 dp
UPPERCASE label above (Inter 11/600, textMuted, letterSpacing 0.6)
Focus → borderColor: borderActive  (sage tint, brighter)
Password: trailing eye-icon toggle
```

Error state: `danger`-coloured border + small error text below.

### 7.3 Glass Card

```
BlurView (intensity ~55) + rgba bg overlay
borderRadius: 16 · borderWidth: 1 · borderColor: border
padding: 14 · gap: 8–12 between children
```

Selected card → `accentMuted` bg tint + `borderActive` border.
Pressable → subtle scale(0.98) + opacity(0.9) on press. 120 ms spring.

### 7.4 Filter Chip

**Inactive:** outline pill, `border` colour, `textMuted` label.
**Active (single-select):** `accent` fill, `accentText` label.
**Active (tag/category chip):** tag-colour fill, white label.

Tap active single-select chip → deselects (reverts to default).

### 7.5 Bottom Sheet

Rounded-top corners (24), glass surface (heavy blur ~32px), drag handle (40×4 rounded, `border` colour) centered at top, `rgba(0,0,0,0.55)` scrim beneath.
Spring-in animation (tension 90, friction 14). Dismiss: swipe-down, scrim tap, or ✕/Cancel.

### 7.6 Segmented Toggle

Pill track (`surfaceMuted`), equal segments, active = elevated white/light pill with subtle shadow, Inter 600 `text` label; inactive `textMuted`.

### 7.7 FAB

56 dp circle, `accent` bg, `+` icon, bottom-right (bottom 24, right 20), glass-shadow, fixed position.

### 7.8 Skeleton Shimmer

Rounded blocks matching content shape. Opacity pulse: `0.3 ↔ 0.7`, ~750 ms each direction using `Animated.loop`. Colour: `border`. Use `useNativeDriver: true`.

### 7.9 Toast / Snackbar

Bottom of screen, above tab bar. Glass surface (blur 24px), `text` label, auto-dismiss after 2.5–3 s with fade. Action link (accent) optional on right. One at a time (queue internally).

---

## 8. Motion & Animation

| Interaction | Spec |
|---|---|
| Screen / tab slide | `translateX`, 220 ms, `easeInOut` |
| Bottom sheet spring-in | `tension: 90, friction: 14` |
| Bottom sheet dismiss | 260 ms ease-out |
| Glass card press | `scale: 0.98, opacity: 0.9`, 120 ms spring |
| Like/react heart | scale bounce `1 → 1.5 → 1`, spring |
| Skeleton shimmer | opacity loop 750 ms each direction |
| Toast in/out | fade 200 ms in · 300 ms out |
| Balance update pop | `scale: 1 → 1.15 → 1`, 200 ms spring |
| Snackbar | fade + translateY (from bottom) 200 ms |
| Chip select | opacity + scale 150 ms |

**Rules:**
- All `opacity` and `transform` animations use `useNativeDriver: true` on RN.
- Keep durations 150–280 ms. Nothing over 350 ms unless it's a page transition.
- Respect `prefers-reduced-motion` on web and `AccessibilityInfo.isReduceMotionEnabled()` on RN — disable or simplify animations.
- Use Framer Motion on web for page-level transitions and spring physics.
- Use GSAP on web for more complex entrance sequences (hero text reveal, stagger lists).
- Use Lenis for smooth scroll momentum on web long-scroll pages.

---

## 9. Screen-by-Screen UI/UX Plan

Each screen entry lists: purpose, primary audience, main sections, and the dedicated spec file to read for full detail.

| Screen | Route | Audience | Primary Sections | Spec File |
|---|---|---|---|---|
| **Home** | `/(drawer)/` | All | Intro (hero, coordinator strip), Announcements feed, General feed | `home-page.md` |
| **Login / Register** | `/login`, `/register` | Guest | Auth forms, Google OAuth, OTP, onboarding flow | `login-register-page.md`, `Auth/handoffSpec.md` |
| **Events** | `/(drawer)/events` | All | Filter chips, event cards, event detail, registration | `events-page.md`, `Events/events-page1.md` |
| **Points & Challenges** | `/(drawer)/points` | User+ | Balance card, earn/spend tiles, transaction history, challenge browser, challenge detail, submission | `points-challenge-page.md` |
| **Sponsors** | `/(drawer)/sponsors` | All | Sponsor cards, newsletters, affiliation | `sponsor-newsletters-page.md` |
| **Friends** | `/(drawer)/friends` | User+ | Friend list, friend requests, matchmaking, invite | `friends-page.md` |
| **Leaderboards** | `/(drawer)/leaderboards` | All | Season leaderboard, investment mechanic, podium | `leaderboards-page.md` |
| **Hall of Fame** | `/(drawer)/hall-of-fame` | All | Season hall entries, categories | `hall-of-fame.md` |
| **Store** | `/(drawer)/store` | User+ | Item grid, redemption flow, order history | `store-page.md` |
| **Media** | `/(drawer)/media` | All | Hero reel, highlight strips, event albums, community masonry, memories | `media-page-design.md` |
| **Feedback & Contact** | `/(drawer)/feedback` | All | Form fields, WhatsApp CTA, submission | `Feedback and contact us screen/feedback-contact-page.md` |
| **User Profile** | `/(drawer)/profile` | User+ | Avatar, stats, activity, settings, social links | `user-profile.md` |
| **Popups & Modals** | (overlay) | All | Account actions, make announcement, add post, change photo | `popups-and-modals.md` |
| **Challenge Detail** | `/(stack)/challenge/[id]` | User+ | Full spec, stat row, resource links, accept sheet | `points-challenge-page.md §6–7` |
| **Submission** | `/(stack)/challenge/[id]/submission` | User+ | Proof upload, notes, submit, deadline countdown | `points-challenge-page.md §8` |

### 9.1 Screen-level UI Target Audience Notes

**Home:** Must be engaging and informative for a first-time guest. The Introduction tab is the storefront — coordinator quotes + hero banner establish credibility and community energy immediately.

**Events:** Scanning and filtering is the primary interaction. Cards must surface the most relevant info (status, sport, date, sponsor) at a glance. Mobile-first card layout.

**Points & Challenges:** Gamification screen — makes the reward loop visible. Balance card is the emotional hook; challenge browser drives repeat engagement. Authenticated-only; guest sees redirect.

**Store:** Conversion-focused. Items must feel desirable (quality images, clear price/point cost). Low friction to redemption.

**Leaderboards:** Social comparison + investment mechanic. Must feel exciting, competitive. Top-3 podium is a visual hero.

**Media:** Cinematic archive — dark canvas, editorial horizontal strips (Highlights, Event Albums, Sponsors), 2-col community masonry, auto-play Hero Reel. Full design in `media-page-design.md`.

---

## 10. Tech Stack

### 10.1 Mobile (React Native / Expo)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Expo | SDK 56 | Use versioned docs: docs.expo.dev/versions/v56.0.0/ |
| Language | TypeScript | 5+ | Strict mode; no `any` without explicit comment |
| Routing | Expo Router | v3 | File-based, matches `app/` directory |
| State | Zustand | v5 | Auth + theme global stores |
| Server state | TanStack Query | v5 | All API data — queries, mutations, cache |
| Forms | React Hook Form + Zod | latest | Schema-validated inputs |
| Animations | React Native Reanimated | v3 | `useNativeDriver` worklets |
| Glass blur | expo-blur | latest | `BlurView` component |
| Haptics | expo-haptics | latest | Light feedback on confirm actions |
| Secure store | expo-secure-store | latest | Token persistence |
| Push notifications | expo-notifications + FCM | latest | Real-time point updates |
| Icons | @expo/vector-icons (Ionicons) | latest | Outline style; match single set |
| Fonts | expo-font + @expo-google-fonts | latest | Bebas Neue, Barlow Condensed, Inter, JetBrains Mono |
| Image | expo-image | latest | Cached, progressive loading |
| Camera/media | expo-camera, expo-image-picker | latest | Challenge submission proof upload |
| In-app browser | expo-web-browser | latest | Resource links in challenge detail |

### 10.2 Web Admin Console

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | 19.2 | With concurrent features |
| Build | Vite | 8+ | Fast HMR; use vite.config.ts |
| Language | TypeScript | 6 | Strict mode |
| Styling | Tailwind CSS | v4 | Via `@tailwindcss/vite` plugin |
| Routing | React Router | v7 | `src/app/router.tsx` |
| State | Zustand | v5 | Shared with mobile tokens |
| Server state | TanStack Query | v5 | Same pattern as mobile |
| Animations | Framer Motion | v11 | Page transitions, spring |
| Smooth scroll | Lenis | v1.1 | Long admin pages |
| PWA | vite-plugin-pwa | v1.3 | Installable admin console |
| Icons | Heroicons or Lucide | latest | Outline, consistent stroke |

### 10.3 Backend (consumed by frontend)

| Service | Port | Protocol |
|---|---|---|
| API Gateway | 3000 | HTTP/S REST → downstream |
| Auth Service | 3001 | REST (proxied via gateway) |
| User Service | 3002 | REST (proxied via gateway) |
| Sponsor Service | 3003 | REST (proxied via gateway) |
| Points Service | 3005 | REST (proxied via gateway) |

All frontend HTTP traffic goes **only** through `http://localhost:3000` (dev) / production gateway URL. Never call microservices directly from the frontend.

---

## 11. Package Registry

All packages that have been decided for use. Pin exact versions. Do not add new packages without updating this list.

### 11.1 Mobile (`mobile/package.json`)

```json
{
  "dependencies": {
    "expo": "~56.0.0",
    "expo-router": "~3.0.0",
    "expo-blur": "latest",
    "expo-font": "latest",
    "expo-haptics": "latest",
    "expo-secure-store": "latest",
    "expo-notifications": "latest",
    "expo-image": "latest",
    "expo-camera": "latest",
    "expo-image-picker": "latest",
    "expo-web-browser": "latest",
    "@expo-google-fonts/bebas-neue": "latest",
    "@expo-google-fonts/barlow-condensed": "latest",
    "@expo-google-fonts/inter": "latest",
    "@expo-google-fonts/jetbrains-mono": "latest",
    "react": "19.x",
    "react-native": "0.76.x",
    "react-native-reanimated": "~3.x",
    "react-native-gesture-handler": "~2.x",
    "react-native-safe-area-context": "latest",
    "@tanstack/react-query": "^5.101.0",
    "zustand": "^5.0.14",
    "react-hook-form": "latest",
    "zod": "latest"
  }
}
```

### 11.2 Web (`web/package.json`)

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.18.0",
    "@tanstack/react-query": "^5.101.0",
    "zustand": "^5.0.14",
    "react-hook-form": "latest",
    "zod": "latest",
    "framer-motion": "^11.x",
    "gsap": "^3.12.0",
    "lenis": "^1.1.0"
  },
  "devDependencies": {
    "vite": "^8.0.0",
    "@vitejs/plugin-react": "latest",
    "@tailwindcss/vite": "^4.3.1",
    "vite-plugin-pwa": "^1.3.0",
    "typescript": "^6.0.0"
  }
}
```

---

## 12. API Bus — Frontend-Backend Integration

### 12.1 ApiClient (Transport Layer)

`core/api/ApiClient.ts` is the **only** HTTP client in the app. Never use `fetch` directly in components or ViewModels.

```ts
// Usage pattern:
const client = new ApiClient(env.API_URL);

// GET
const user = await client.get<User>('/users/me');

// POST
const tx = await client.post<TransactionResponse>('/points/award', { body: dto });

// Throws ApiError on non-2xx — catch in ViewModel:
try {
  await client.post('/points/award', { body: dto });
} catch (e) {
  if (e instanceof ApiError) {
    // e.status, e.message
  }
}
```

**Key behaviours:**
- Injects `Authorization: Bearer <token>` from `authStore` automatically.
- On `401`: calls `authStore.refresh()` once (httpOnly cookie), retries the original request.
- On second `401`: clears auth state, navigates to `/login`.
- `credentials: 'include'` is always set (for refresh cookie).

### 12.2 Repository Pattern

One repository per backend service domain. Repositories hold typed method calls only — no caching, no state.

```
core/repositories/
├── AuthRepository.ts       — register, login, logout, refresh, changePassword
├── UserRepository.ts       — getMe, getUser, updateProfile, uploadAvatar
├── EventRepository.ts      — listEvents, getEvent, register, unregister
├── PointsRepository.ts     — getBalance, listTransactions, (admin) awardPoints
├── ChallengeRepository.ts  — listChallenges, getChallenge, acceptChallenge, submitProof
├── LeaderboardRepository.ts
├── StoreRepository.ts
├── FriendRepository.ts
└── SponsorRepository.ts
```

### 12.3 TanStack Query — Hooks Pattern

Wrap repositories in hooks with query keys for caching and invalidation.

```ts
// hooks/usePointsBalance.ts
export function usePointsBalance(userId: string) {
  return useQuery({
    queryKey: ['points', 'balance', userId],
    queryFn: () => pointsRepo.getBalance(userId),
    staleTime: 30_000,   // 30 s — balance updates via FCM push, not polling
  });
}

// hooks/useAcceptChallenge.ts
export function useAcceptChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => challengeRepo.accept(challengeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
      qc.invalidateQueries({ queryKey: ['points', 'balance'] });
    },
  });
}
```

**Query key conventions:**
- `['auth', 'me']` — current user
- `['points', 'balance', userId]` — balance
- `['points', 'transactions', userId, filter]` — transaction list
- `['challenges', { domain, difficulty[] }]` — challenge list
- `['challenges', 'detail', id]` — single challenge
- `['events', filters]` — event list
- `['events', 'detail', id]` — single event

### 12.4 Real-Time: FCM Push → Cache Invalidation

Points balance updates are pushed via Firebase Cloud Messaging (FCM) silent background push. On receiving a `POINTS_UPDATED` payload:

```ts
// In _layout.tsx — register FCM handler once
Notifications.addNotificationReceivedListener((notif) => {
  if (notif.request.content.data?.type === 'POINTS_UPDATED') {
    queryClient.invalidateQueries({ queryKey: ['points', 'balance'] });
    queryClient.invalidateQueries({ queryKey: ['points', 'transactions'] });
  }
});
```

The Balance Card re-renders automatically via TanStack Query's reactive cache.

---

## 13. API Method Documentation

All routes are accessed through the API Gateway at `EXPO_PUBLIC_API_URL` (mobile) / `VITE_API_URL` (web). Base: `http://localhost:3000` in development.

### 13.1 Auth Endpoints (`/auth/**`)

| Method | Path | Auth | Description | Called from |
|---|---|---|---|---|
| POST | `/auth/register` | None | Register new user (email+password) | Register screen |
| POST | `/auth/login` | None | Login, returns access token | Login screen |
| POST | `/auth/refresh` | Cookie | Refresh access token using httpOnly cookie | ApiClient auto-refresh |
| POST | `/auth/logout` | JWT | Invalidate current session | Account actions popup |
| POST | `/auth/logout-all` | JWT | Invalidate all sessions | Settings |
| GET | `/auth/google` | None | Initiate Google OAuth | Login/Register screen |
| GET | `/auth/google/callback` | None | OAuth redirect — handled by `AuthCallback.tsx` | System |
| POST | `/auth/totp/setup` | JWT | Begin TOTP 2FA setup | Security settings |
| POST | `/auth/totp/verify` | JWT | Verify TOTP code | Login (2FA step) |
| POST | `/auth/forgot-password` | None | Send password reset email | Login screen |
| POST | `/auth/reset-password` | None | Reset password with token | Reset password screen |
| POST | `/auth/change-password` | JWT | Change password (authed) | Security settings |

### 13.2 User Endpoints (`/users/**`)

| Method | Path | Auth | Description | Called from |
|---|---|---|---|---|
| GET | `/users/me` | JWT | Fetch own profile | App boot, profile screen |
| PATCH | `/users/me` | JWT | Update profile fields | Edit profile |
| POST | `/users/me/avatar` | JWT | Upload profile picture | Change photo |
| GET | `/users/:id` | JWT | Fetch another user's public profile | Profile view |
| GET | `/users` | JWT (coordinator+) | List all users | Web admin console |

### 13.3 Points Endpoints (`/points/**`)

| Method | Path | Auth | Roles | Description | Called from |
|---|---|---|---|---|---|
| GET | `/points/balance/:userId` | JWT | Self or core+ | Get user's point balance | Balance card |
| GET | `/points/transactions/:userId` | JWT | Self or core+ | List transactions with filter | Transaction history |
| POST | `/points/award` | JWT | Coordinator+ | Award points manually | Admin console |
| POST | `/points/participation` | JWT | Coordinator+ | Award 10-pt event participation | Admin console (temp) |

**Frontend data shapes:**
```ts
// Balance
{ userId: string; balance: number }

// Transaction
{
  id: string;
  userId: string;
  amount: number;
  type: 'earn' | 'spend' | 'refund';
  source: 'event' | 'challenge' | 'store' | 'leaderboard';
  referenceId?: string;
  createdAt: string; // ISO
}
```

### 13.4 Events Endpoints (`/events/**`) *(Phase 1 — live)*

| Method | Path | Auth | Description | Called from |
|---|---|---|---|---|
| GET | `/events` | None | List events with filters | Events screen |
| GET | `/events/:id` | None | Event detail | Event detail |
| POST | `/events/:id/register` | JWT | Register for event | Event detail CTA |
| DELETE | `/events/:id/register` | JWT | Unregister from event | Event detail (registered state) |
| GET | `/events/:id/registrations` | JWT (core+) | List registrations for event | Admin console |
| POST | `/events` | JWT (coordinator+) | Create new event | Web admin — event form |

### 13.5 Challenge Endpoints (`/challenges/**`) *(Phase 2 — upcoming)*

| Method | Path | Auth | Description | Called from |
|---|---|---|---|---|
| GET | `/challenges` | JWT | List challenges (filter: domain, difficulty) | Challenge browser |
| GET | `/challenges/:id` | JWT | Challenge detail | Challenge detail screen |
| POST | `/challenges/:id/accept` | JWT | Accept a challenge | Accept challenge sheet |
| GET | `/challenges/:id/submission` | JWT | Get own submission | Submission screen |
| POST | `/challenges/:id/submission` | JWT | Submit/update proof | Submission screen |

### 13.6 Typical Flow: User Accepts a Challenge

```
1. User taps "Accept Challenge" on Challenge Detail screen
2. AcceptChallengeSheet opens → fetches live time limit
   GET /challenges/:id  (live fetch, not cached)

3. User taps "Confirm — Start"
   → useAcceptChallenge mutation fires
   → POST /challenges/:id/accept
   → ApiClient injects Bearer token
   → Gateway verifies JWT, forwards x-user-id header
   → Challenge service validates + records acceptance

4. On success (201):
   → React Query invalidates ['challenges', 'detail', id]
   → Challenge detail action area re-renders to "View Submission" state
   → Toast: "Challenge accepted! Good luck."

5. On error (409 already accepted, 400 validation, 503):
   → ApiError caught in ViewModel
   → Error toast shown, sheet stays open for retry
```

---

## 14. Debug Console Methods

### 14.1 Auth Debug

```ts
import { useAuthStore } from 'src/core/stores/authStore';
// Print current auth state
const { token, user } = useAuthStore.getState();
console.log('[AUTH]', { token: token?.slice(0, 20) + '…', user });
// Force logout
useAuthStore.getState().clearAuth();
// Decode JWT payload (no signature check)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('[JWT]', payload);
```

### 14.2 Query Cache Debug

```ts
import { useQueryClient } from '@tanstack/react-query';
const qc = useQueryClient();
// List all cached queries and their status
console.table(qc.getQueryCache().getAll().map(q => ({
  key: JSON.stringify(q.queryKey),
  status: q.state.status,
  updatedAt: new Date(q.state.dataUpdatedAt).toISOString(),
})));
// Force-invalidate points
qc.invalidateQueries({ queryKey: ['points'] });
// Nuclear: invalidate everything
qc.invalidateQueries();
```

### 14.3 Theme Debug

```ts
import { useThemeStore } from 'src/core/stores/themeStore';
useThemeStore.getState().setTheme('dark');   // force dark
useThemeStore.getState().setTheme('light');  // force light
console.log('[THEME]', useThemeStore.getState().theme);
```

### 14.4 Navigation Debug (Expo Router)

```ts
import { router, usePathname } from 'expo-router';
console.log('[ROUTE]', usePathname());
router.push('/(drawer)/points');   // navigate
router.replace('/login');          // replace (no back)
```

### 14.5 API Smoke Tests (curl)

```bash
# Health check
curl http://localhost:3000/health

# Get own balance (replace with real values)
curl http://localhost:3000/points/balance/$USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Award test points (requires coordinator token)
curl -X POST http://localhost:3000/points/award \
  -H "Authorization: Bearer $COORD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"$USER_ID","amount":100,"source":"challenge"}'
```

---

## 15. Onboarding Documentation

### 15.1 Reading Order for New Contributors

**Start here, in this sequence:**

1. `docs/FrontendGuide/UI-UX-Master-Doc.md` ← **this file** — all design and architecture decisions
2. `docs/SystemDesignDocs/BGSC Platform — Complete Feature Specification & Architecture.md` — full product spec
3. `docs/mobile.md` — mobile app structure and run instructions
4. `docs/web.md` — web admin structure and run instructions
5. `docs/api-gateway.md` — gateway routing, JWT flow, rate limiting
6. `docs/design-system.md` — base tokens (note: §4 of this doc extends and overrides them)
7. `docs/FrontendGuide/Auth/handoffSpec.md` — pixel-level auth screen spec
8. `docs/FrontendGuide/Screens Master Doc/<screen>.md` — whichever screen you're building
9. `docs/Backend Documentation/<service>.md` — relevant service API reference

### 15.2 Environment Setup

```bash
# Backend (Docker required)
docker compose up -d

# Mobile
cd mobile && npm install && npx expo start
# Android emulator: set EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# Web admin
cd web && npm install && npm run dev
# http://localhost:5173
```

### 15.3 Branching Convention

| Branch | Purpose |
|---|---|
| `main` | Production-ready releases |
| `dev` | Integration (all PRs target here) |
| `feature/<name>` | New feature work |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, docs, config |

### 15.4 Code Conventions

- **TypeScript strict.** No `any` without an explicit comment explaining why.
- **MVVM.** Zero data fetching inside component bodies.
- **Colours.** `useColors()` everywhere. Zero hardcoded hex in component files.
- **Fonts.** Reference from a `FONTS` constant — never inline family name strings.
- **Accessibility.** Every interactive element needs `accessibilityRole` + `accessibilityLabel`. Min touch target: 44 × 44 dp.
- **Tests.** New repositories and ViewModels require unit tests.

### 15.5 Known Gotchas

| Issue | Detail |
|---|---|
| Expo SDK 56 breaking changes | Read versioned docs at `docs.expo.dev/versions/v56.0.0/` before editing native config |
| Refresh token on mobile | httpOnly cookies don't persist reliably in RN `fetch`. Access token + best-effort refresh. |
| BlurView on Android | Test on real/low-end Android; use `surfaceSolid` fallback when blur isn't supported |
| TanStack Query v5 | Use object syntax `useQuery({ queryKey, queryFn })` — no positional args |
| Tailwind v4 | No `tailwind.config.js`; uses `@tailwindcss/vite` plugin and CSS variable system |
| Docker locked vs dev | `docker compose up` (with override) = direct port access. `-f docker-compose.yml` only = gateway-locked |
| Points service Phase 2 | Challenge points and full spend flow are Phase 2 — stubs exist but aren't live |

---

## Appendix: Quick Reference

```
CANVAS      background  #060D0E (dark)     #FAF7F2 (light)
GLASS       surface     rgba(15,36,38,0.55) + blur(20px)
BORDER      hairline    rgba(142,182,155,0.15) sage
INK         text        #DAF1DE (dark)     #1B1714 (light)
MUTED       textMuted   #8EB69B sage       #8C857A warm grey
ACCENT      #E8662A burnt orange — links / active chips / primary CTA
PRIMARY     button fill: #DAF1DE (dark) · #1F1B17 (light)
STATE       success #34D27B · danger #F2686C · info #5B9CF8

FONTS       Hero: Bebas Neue 400 (32 sp+ only)
            Head: Barlow Condensed 700/800 (18–28 sp)
            Body: Inter 400/500/600/700
            Mono: JetBrains Mono 500

RADIUS      pill 999 · card 16 · chip 20 · sheet 24 · small 10
SPACE       4·8·12·16·20·24·32·40  (screen pad 16, card gap 12)
BLUR        cards 20px · modals 32px · inputs 12px
MOTION      150–280 ms · spring physics · useNativeDriver: true

RULES       1. useColors() — never hardcode hex
            2. Glass over dark canvas — no flat card fills
            3. Bebas Neue for hero titles ONLY
            4. One primary CTA per view
            5. Skeletons not spinners on data load
```
