# Home — Complete Multi-Surface UI/UX Handoff Specification

**Platform:** Mobile — React Native / Expo  
**Primary route:** `/(drawer)/index` → `mobile/src/app/(drawer)/index.tsx`  
**Visibility:** Public reading; authenticated and role-gated creation actions  
**Design language:** Glass Forest  
**Status:** Canonical overhaul specification  
**Legacy behaviour source:** `../Screens Master Doc/home-page.md`  
**Related legacy overlays:** `../Screens Master Doc/popups-and-modals.md`  
**New-system references:** `../Events/events-page1.md`, `../Auth/handoffSpec.md`

> The Home experience is not one screen. It is a system of three primary tab surfaces, four immersive overlays, two creation flows, shared media states, and the persistent navigation shell. This document specifies all of them. The old Home document remains the behavioural source where this document does not explicitly change a rule; this document supersedes it for visual design, motion, hierarchy, accessibility, and responsive behaviour.

---

## Table of Contents

1. [Experience Intent](#1-experience-intent)
2. [Surface Inventory and Navigation Architecture](#2-surface-inventory-and-navigation-architecture)
3. [Master Viewport Architecture](#3-master-viewport-architecture)
4. [Global Visual System — Glass Forest](#4-global-visual-system--glass-forest)
5. [Surface 0 — Persistent Home Shell](#5-surface-0--persistent-home-shell)
6. [Surface 1 — Introduction / Landing](#6-surface-1--introduction--landing)
7. [Surface 2 — Announcements Index](#7-surface-2--announcements-index)
8. [Surface 3 — Announcement Detail Sheet](#8-surface-3--announcement-detail-sheet)
9. [Surface 4 — Make Announcement Composer](#9-surface-4--make-announcement-composer)
10. [Surface 5 — Social Feed](#10-surface-5--social-feed)
11. [Surface 6 — Media Viewer and Inline Video](#11-surface-6--media-viewer-and-inline-video)
12. [Surface 7 — Comment Sheet](#12-surface-7--comment-sheet)
13. [Surface 8 — Add Post Flow](#13-surface-8--add-post-flow)
14. [Surface 9 — Guest and Permission Gates](#14-surface-9--guest-and-permission-gates)
15. [Motion and Animation Reference](#15-motion-and-animation-reference)
16. [Typography and Iconography](#16-typography-and-iconography)
17. [Geometry and Component Tokens](#17-geometry-and-component-tokens)
18. [State Matrices](#18-state-matrices)
19. [Accessibility and Reduced Motion](#19-accessibility-and-reduced-motion)
20. [Performance and Implementation Architecture](#20-performance-and-implementation-architecture)
21. [Legacy-to-Overhaul Change Register](#21-legacy-to-overhaul-change-register)
22. [QA Matrix and Definition of Done](#22-qa-matrix-and-definition-of-done)

---

## 1. Experience Intent

Home is the platform's first impression and daily return point. It must accomplish three jobs without feeling like three unrelated applications:

1. **Explain the ecosystem** — BGSC, BGEC, FitSoc, and the people leading them.
2. **Deliver trusted updates** — official announcements must read as authoritative and easy to scan.
3. **Make the community feel alive** — the social feed must feel current, tactile, and safe without becoming visually noisy.

### 1.1 Design principles

- **Impact first, noise never.** The opening viewport gets one memorable hero moment. Lower surfaces become progressively calmer and more content-led.
- **One family, three moods.** Introduction is cinematic, Announcements is editorial, Feed is social. All use the same palette, typography, geometry, and motion grammar.
- **Signal is scarce.** Neon green is reserved for selection, live state, focus, and decisive actions. It must occupy no more than roughly 8% of a viewport.
- **Content remains readable.** Glass is a material treatment, not a reason to reduce contrast or blur dense text.
- **Motion explains.** Directional movement shows navigation, spring movement confirms touch, and continuous motion is reserved for genuinely live content.
- **Public by default, protected at action.** Guests can understand the community before being asked to log in.

---

## 2. Surface Inventory and Navigation Architecture

### 2.1 Complete Home surface map

| ID | Surface | Presentation | Trigger | Exit |
|---|---|---|---|---|
| H0 | Persistent Home Shell | Fixed header + sticky tab rail | Enter `/` | Drawer navigation or route change |
| H1 | Introduction / Landing | Tab 0, vertical scroll | Default Home entry | Select/swipe another tab |
| H2 | Announcements Index | Tab 1, filter row + list | Tab selection, CTA, coordinator update | Select/swipe another tab |
| H3 | Announcement Detail | 78% bottom sheet | Tap announcement card | Swipe down, backdrop, close action |
| H4 | Make Announcement | Page sheet / full-height composer | Core+ create action with permission | Cancel/discard or successful publish |
| H5 | Social Feed | Tab 2, virtualized list | Tab selection | Select/swipe another tab |
| H6 | Media Viewer | Full-screen black overlay | Tap image/carousel item | Close or downward dismiss gesture |
| H6b | Inline Video Player | Embedded feed surface | Tap video play | Pause or scroll off-screen |
| H7 | Comment Sheet | 76% bottom sheet | Tap Comment | Swipe down, backdrop, close action |
| H8 | Add Post — Media | Full-screen step 1 | Authenticated FAB tap | Back/cancel or next |
| H8b | Add Post — Details | Full-screen step 2 | Next from Media | Back or next |
| H8c | Add Post — Privacy | Full-screen step 3 | Next from Details | Back or next |
| H8d | Add Post — Music | Full-screen step 4, optional/future | Next from Privacy | Back or publish |
| H9 | Guest / Permission Feedback | Snackbar then route or hidden action | Protected interaction | Timeout, dismiss, or Login |

### 2.2 State flow

```text
HOME ENTRY
   │
   ├── H1 INTRODUCTION ── coordinator update / CTA ──▶ H2 ANNOUNCEMENTS
   │         └── portrait ──▶ Profile or H9 Login gate
   │
   ├── H2 ANNOUNCEMENTS ── card ──▶ H3 DETAIL ──▶ native share
   │         └── Core+ create ──▶ H4 COMPOSER ──▶ publish ──▶ H2 refreshed
   │
   └── H5 FEED ── media ──▶ H6 VIEWER / H6b VIDEO
             ├── comment ──▶ H7 COMMENTS
             ├── profile ──▶ Profile or H9 Login gate
             ├── like ──▶ local confirmation or H9 Login gate
             └── FAB ──▶ H8a → H8b → H8c → H8d → publish → H5 refreshed
```

### 2.3 Preserved product contract

The following legacy rules remain canonical:

- Tab order is Introduction → Announcements → Feed.
- Tabs switch by tap and horizontal swipe.
- Announcement reading and public-feed reading are available to guests.
- Coordinator portraits and protected social actions gate guests to Login.
- Teams announcements and announcement creation are role-gated.
- Announcement details, comments, and creation use layered surfaces rather than separate drawer routes.
- Feed FAB exists only on the Feed tab.
- Loading uses shape-matched skeletons rather than blocking spinners.

---

## 3. Master Viewport Architecture

```text
┌──────────────────────────────────────────┐
│ SYSTEM SAFE AREA                         │
├──────────────────────────────────────────┤
│ H0 DYNAMIC STATUS BAR                    │ fixed
│ [menu]          BGSC           [account] │
├──────────────────────────────────────────┤
│ H0 GLASS TAB RAIL                        │ sticky
│ [ Introduction ][ Announcements ][ Feed ]│
│      ━━━ active signal underline         │
├──────────────────────────────────────────┤
│                                          │
│ H1 / H2 / H5 ACTIVE SURFACE              │
│ vertically scrollable / virtualized      │
│                                          │
│                                          │
│                                [＋] H5    │ Feed only
├──────────────────────────────────────────┤
│ DEVICE SAFE AREA                         │
└──────────────────────────────────────────┘

Layer order when an overlay opens:
1. Ambient background
2. Active Home surface
3. Dim/blur scrim
4. H3/H4/H6/H7/H8 overlay
5. System keyboard / native share UI
```

### 3.1 Scrolling rules

- Dynamic status bar remains fixed through all three tabs.
- Tab rail remains sticky and never scrolls with tab content.
- Each primary tab owns its own vertical scroll position. Returning to a tab restores that position.
- Horizontal tab swipes activate only when horizontal displacement clearly exceeds vertical intent.
- Filter chips and media carousels own horizontal gestures locally; they must not accidentally switch tabs while the gesture begins inside them.
- Bottom sheets trap interaction and accessibility focus until dismissed.
- FAB clears bottom safe area and the final feed card by at least 24 dp plus its own height.

---

## 4. Global Visual System — Glass Forest

Home adopts the newer Glass Forest language used by the Events and Auth overhaul. This resolves the previous warm cream/orange versus teal/green ambiguity: **the Home overhaul uses Glass Forest.** Existing warm tokens are implementation debt and must be migrated centrally rather than overridden inside Home components.

### 4.1 Canonical palette

```typescript
export const homeGlassForest = {
  // Canvas
  backgroundDeep: '#051F20',
  background: '#0B2B26',
  backgroundMid: '#163B32',
  surfaceSolid: '#163B32',

  // Glass surfaces
  surface: 'rgba(15,36,38,0.55)',
  surfaceQuiet: 'rgba(20,50,52,0.30)',
  surfaceRaised: 'rgba(20,50,52,0.55)',
  surfaceModal: 'rgba(15,36,38,0.82)',

  // Borders
  border: 'rgba(142, 182, 155, 0.18)',
  borderStrong: 'rgba(142, 182, 155, 0.34)',

  // Text
  textPrimary: '#DAF1DE',
  textSecondary: '#B8D8C0',
  textMuted: '#8EB69B',
  textOnSignal: '#051F20',

  // Controlled signal
  accent: '#E8662A',
  accentMuted: 'rgba(232,102,42,0.14)',

  // Semantic
  info: '#68A9FF',
  success: '#49D17D',
  warning: '#F4C95D',
  danger: '#FF6B6B',
  modalBackdrop: 'rgba(5, 31, 32, 0.72)',
};
```

### 4.2 Material rules

- Apply glass to the tab rail, cards, chips, sheets, and floating actions.
- Dense reading blocks use a higher-opacity surface than decorative/summary cards.
- Never place low-opacity text on glass over moving media.
- Use one 1 dp border; do not combine thick borders with heavy shadows.
- Blur is progressive enhancement. Android and reduced-transparency fallbacks use `surfaceSolid` or `surfaceModal`.
- The page background may use a subtle static radial composition. Continuous ambient drift is permitted only in the Introduction hero and freezes under reduced motion.

### 4.3 Accent budget

Use `signal` for:

- Active tab underline.
- Active filter state.
- Keyboard/focus ring.
- Feed FAB.
- Current live indicator.
- One primary action per overlay.
- Short-lived confirmation highlight.

Do not use `signal` for every tag, avatar, border, or paragraph link simultaneously.

---

## 5. Surface 0 — Persistent Home Shell

### 5.1 Dynamic status bar

```text
┌──────────────────────────────────────────┐
│ [Menu]              BGSC        [Login]  │ Guest
│ [Menu]              BGSC        [Avatar] │ Authenticated
└──────────────────────────────────────────┘
```

| Element | Specification | Behaviour |
|---|---|---|
| Container | Safe-area aware, `surfaceModal`, 1 dp bottom border | Fixed; never moves during tab changes |
| Menu | 44×44 dp target, 24 dp outline icon | Opens side drawer |
| BGSC lockup | Centred independent of side-control widths | Non-interactive on Home |
| Login | 44 dp minimum height, compact glass capsule | Routes to `/login` |
| Avatar | 36 dp visual inside 44×44 dp target | Opens account/profile surface |

Replace the current text glyph `☰` with the approved outline icon. The centre lockup must not shift when Login and Avatar have different widths.

### 5.2 Home tab rail

- Height: 52 dp.
- Horizontal page inset: 12 dp.
- Outer radius: 24 dp.
- Active item uses stronger fill, `BarlowCondensed_700Bold`, and a 2 dp signal underline.
- Inactive items use `Helvetica Neue Medium` and `textMuted`.
- Icons are 18–20 dp SVG/vector icons: Home, Megaphone, Newspaper.
- No emoji icons.
- Each tab target occupies at least 44 dp height and exposes `accessibilityRole="tab"` and selected state.

### 5.3 Tab navigation animation

Use **Home Tab Continuity** (§15.2): underline spring plus directional content transition. A swipe follows the finger before settling; a tap enters from the correct directional edge. Nested horizontal controls take gesture priority.

---

## 6. Surface 1 — Introduction / Landing

The Introduction is the most visually distinctive Home surface. It creates impact once, then hands attention to content.

### 6.1 Full layout

```text
┌──────────────────────────────────────────┐
│ HERO — 58–64% of first content viewport │
│                                          │
│  BGSC                                    │
│  Where campus sport meets esports.       │
│                                          │
│  [BGEC]  [FitSoc]             ↓ Explore │
│  subtle field lines / light arc          │
├──────────────────────────────────────────┤
│ WHAT OUR HEADS HAVE TO SAY               │
│ Official voices, latest updates          │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ portrait  coordinator + role         │ │
│ │           “Announcement preview…”    │ │
│ │           2h ago             [→]     │ │
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ next coordinator card                │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [ View all announcements              ] │
│                                          │
│ COMMUNITY PULSE                          │
│ [official updates] [community posts]     │
└──────────────────────────────────────────┘
```

### 6.2 Hero specification

| Layer | Specification |
|---|---|
| Background | Deep teal field with restrained radial light and optional low-speed texture |
| Brand | BGSC lockup, `BarlowCondensed_700Bold`, 48–64 sp depending on width |
| Tagline | 18–22 sp, max two lines, `textPrimary` |
| Ecosystem chips | BGEC and FitSoc as quiet glass chips, not competing CTAs |
| Decorative geometry | Abstract field/court arcs at ≤12% opacity; no stock illustration |
| Explore cue | Small downward cue; hides after first meaningful scroll |

The hero must not be a plain solid accent rectangle. It should look authored even when all animation is disabled.

### 6.3 Coordinator voices

Coordinator cards replace the old speech-bubble-heavy composition with an editorial quote-card pattern while preserving all behaviours.

| Element | Specification |
|---|---|
| Portrait | 72 dp, real/stylised asset, 3:4 or circular crop, meaningful label |
| Identity | Name in 16 sp semibold; role in 12 sp muted |
| Quote | 15 sp, 2–3 lines; opening quote mark may be decorative |
| Timestamp | Relative time; absolute date available through accessible detail |
| Navigation | Card/quote → linked announcement; portrait → profile/Login gate |
| Missing update | “No update yet” designed text state; no meme or shrug emoji |

### 6.4 Community pulse bridge

A compact final section prevents Introduction from ending as a dead end:

- “Official updates” routes to Announcements.
- “Community posts” routes to Feed.
- Each tile previews a count or short descriptor only if real data exists.
- No fabricated activity counters.

### 6.5 Introduction states

| State | Presentation |
|---|---|
| Loading | Hero geometry remains stable; three quote-card skeletons shimmer |
| Empty coordinators | Hero + community bridge; coordinator section becomes a concise “Updates are being prepared” state |
| Partial error | Hero remains; inline error panel and Retry replace coordinator list |
| Offline cached | Cached cards remain with a small “Offline” status chip |
| Guest | Full content; portrait is the only gated interaction |

---

## 7. Surface 2 — Announcements Index

Announcements should feel like an official editorial channel, not another social feed.

### 7.1 Layout

```text
┌──────────────────────────────────────────┐
│ [All] [BGEC] [FitSoc] [Airball] ... [+] │ sticky filters
├──────────────────────────────────────────┤
│ NEW UPDATES — tap to refresh             │ conditional
├──────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ BGEC • OFFICIAL              2h      │ │
│ │ Announcement title                  │ │
│ │ Three-line body preview…             │ │
│ │ [avatar] Name · Coordinator      →   │ │
│ └──────────────────────────────────────┘ │
│ ...                                      │
│ Older announcements are no longer shown │
└──────────────────────────────────────────┘
```

### 7.2 Filter rail

- Single-select; All is default.
- 36 dp visible height inside a 44 dp touch region.
- Active chip uses signal tint + signal border, not a fully neon capsule.
- Category identity may use a small colour dot, but selected state cannot rely on category colour alone.
- Teams is visible only to allowed roles.
- New Announcement control sits at the rail's trailing edge for authorised users and remains visually separate from scrolling chips.

### 7.3 Announcement card

| Element | Rule |
|---|---|
| Category | Up to two visible labels; overflow becomes `+N` |
| Official status | Text/icon treatment; never colour alone |
| Timestamp | Relative in index; absolute in details |
| Title | 18 sp `BarlowCondensed_700Bold`, max two lines |
| Preview | 14–15 sp, three lines maximum |
| Author | 32 dp avatar, name, role |
| Surface | 20 dp radius, high-opacity glass, 16 dp padding |
| Press | Glass Press feedback; entire card opens H3 |

### 7.4 Deep-link highlight

When Introduction opens a coordinator's announcement:

1. Switch to Announcements using Home Tab Continuity.
2. Scroll after list measurement.
3. Apply **Announcement Beacon** (§15.5) once.
4. Keep a static signal-tint border after motion ends for approximately 2.5 seconds.
5. Move screen-reader focus to the card title.

### 7.5 Feed behaviour

- Pull-to-refresh preserves current cards.
- Pagination loads 20 at a time near list end.
- Four-month retention boundary is explicit.
- New real-time content shows a non-disruptive refresh banner; do not insert cards above the user's reading position without consent.

---

## 8. Surface 3 — Announcement Detail Sheet

### 8.1 Layout

```text
╭──────────────────────────────────────────╮
│                ━━━━━                     │
│ [BGEC] [Official]              12 Mar    │
│                                          │
│ Announcement title                       │
│ [avatar] Author · Role                    │
│                                          │
│ Full rich announcement body…             │ scroll
│                                          │
│ [ Share announcement                   ] │ fixed footer
╰──────────────────────────────────────────╯
```

### 8.2 Rules

- Default height: 78% of available viewport; expand to full height for long body or large text.
- Header metadata remains visible while the body scrolls where space permits.
- Share action creates a deep link when available; text fallback includes title and body.
- Sheet dismisses by close action, downward gesture, system Back, or backdrop.
- Do not rely only on tapping the backdrop; provide a labelled close control.
- Restore focus to the source announcement card on close.

---

## 9. Surface 4 — Make Announcement Composer

This is a complete authoring surface, not a small popup.

### 9.1 Permission

Visible only to Coordinator, Founder, or Core with explicit announcement permission. A Core user without permission must not see the trigger.

### 9.2 Layout

```text
┌──────────────────────────────────────────┐
│ Cancel         New Announcement    Post  │
├──────────────────────────────────────────┤
│ TITLE                              0/120  │
│ [                                      ] │
│                                          │
│ BODY                                     │
│ [B] [I] [List] [Link]                    │
│ [                                      ] │
│ [                                      ] │
│                                          │
│ CATEGORIES                               │
│ [BGEC] [FitSoc] [Airball] ...            │
│                                          │
│ ADD VISUAL ASSET                         │
│ [ 16:9 upload / preview                ] │
│                                          │
│ [ ] Schedule for later                   │
│ [date and time — conditional]            │
│                                          │
│ WhatsApp delivery / rate-limit notice    │
└──────────────────────────────────────────┘
```

### 9.3 Reconciled behaviour

The legacy Home doc and later modal mock diverged. The overhaul combines the useful requirements:

- Title: required, 120-character maximum.
- Body: required rich text with bold, italic, list, and link controls.
- Categories: full supported taxonomy; Teams remains role-gated.
- Optional 16:9 visual asset.
- Optional scheduling when backend support exists.
- Clear WhatsApp delivery disclosure and per-category rate-limit errors.
- Post action remains disabled until valid.
- Cancel with content prompts Discard / Keep editing.
- Network failure preserves the draft.
- Successful publish closes composer, refreshes H2, and confirms with snackbar.

### 9.4 Validation

Inline errors belong beneath the relevant field or category. Rate-limit errors identify the blocked tag and remaining cooldown. Never clear entered data after a failed submission.

---

## 10. Surface 5 — Social Feed

The Feed is visually quieter than the hero and more expressive than Announcements.

### 10.1 Layout

```text
┌──────────────────────────────────────────┐
│ ┌──────────────────────────────────────┐ │
│ │ [avatar] Display Name        •••     │ │
│ │          @username · 5m              │ │
│ │                                      │ │
│ │ IMAGE / VIDEO / CAROUSEL             │ │
│ │                                      │ │
│ │ Caption text… more                   │ │
│ │ #event  #sponsor                     │ │
│ │ ──────────────────────────────────── │ │
│ │ [heart 24] [comment 8] [share]       │ │
│ └──────────────────────────────────────┘ │
│ ...                                [＋] │
└──────────────────────────────────────────┘
```

### 10.2 Post card

| Region | Specification |
|---|---|
| Author row | 40 dp avatar, display name, username, timestamp, optional overflow menu |
| Media | Edge-to-edge within card; reserve 220 dp default area before load |
| Caption | Two lines collapsed, explicit More control when needed |
| Tags | Quiet horizontal chips; route to future filtered search only when implemented |
| Actions | 44×44 dp minimum each; accessible toggle state for Like |
| Surface | 20 dp radius, 1 dp border, clips media corners |

### 10.3 Behaviour

- Feed contains Public posts only.
- Order is newest first unless ranking logic is explicitly introduced later.
- Pull-to-refresh and 20-item pagination.
- Like is optimistic for authenticated users and rolls back with feedback on failure.
- Comment opens H7.
- Share opens native share when enabled.
- Avatar/name opens profile or H9 for guests.
- No card entrance animation on every list render.

### 10.4 FAB

- 56 dp visible circle, at least 56×56 dp target.
- Signal fill with deep-teal icon.
- Uses a vector Compose icon, not text `+`.
- Clears bottom and right safe areas.
- Authenticated tap opens H8.
- Guest tap shows H9 feedback before Login.
- Hides while a full-screen viewer or sheet is active.

---

## 11. Surface 6 — Media Viewer and Inline Video

### 11.1 Media carousel

- Single image: tap opens viewer.
- Multiple items: paginated horizontal carousel with compact dot/count indicator.
- Mixed image/video is supported; video controls remain inline.
- Image transition must not flash the page background.
- Media has an accessibility label; purely decorative media is marked accordingly.

### 11.2 Full-screen image viewer

```text
┌──────────────────────────────────────────┐
│ 2 / 4                               [×]  │
│                                          │
│                                          │
│            ZOOMABLE IMAGE                │
│                                          │
│                                          │
│ Pinch · double tap · swipe down          │
└──────────────────────────────────────────┘
```

- Black/deep-teal immersive background.
- Pinch range 1×–5×; double tap toggles 1×/2.5×.
- Pan is enabled only while zoomed.
- Swipe down closes only near 1× zoom.
- Horizontal navigation is disabled while actively zoomed to avoid gesture conflict.
- Close control is labelled and safe-area aware.
- Counter updates accessibly.

### 11.3 Inline video

- Play/pause, mute/unmute, progress, and accessible status.
- Starts muted; never autoplays with sound.
- Pauses when mostly off-screen, when another video starts, or when app backgrounds.
- Progress movement is functional, not decorative, and remains under reduced motion.

---

## 12. Surface 7 — Comment Sheet

### 12.1 Layout

```text
╭──────────────────────────────────────────╮
│                ━━━━━                     │
│ Comments                            [×]  │
├──────────────────────────────────────────┤
│ [Load earlier comments]                  │
│                                          │
│ [avatar] Name · 2h                       │
│          Comment body                    │
│          [Like] [Reply]                  │
│     ↳ [avatar] Reply…                    │
│                                          │
│ [undo deletion snackbar — conditional]   │
├──────────────────────────────────────────┤
│ Replying to @name [×]                    │
│ [Write a comment…]                [Send] │ keyboard-safe
╰──────────────────────────────────────────╯
```

### 12.2 Thread behaviour

- Initial page: 20 top-level comments.
- Chronological reading order after older pages load.
- One visible reply nesting level.
- More than two replies collapse behind “View N replies.”
- Reply pre-fills context without forcing mention text into the editable body.
- Own comment long-press: Delete with four-second Undo.
- Other comment long-press: Report options.
- New comments insert with a restrained one-time reveal and move focus appropriately.

### 12.3 Visibility states

| Configuration | Reader outcome |
|---|---|
| Comments off | Thread notice; input hidden |
| Public | Everyone reads; authenticated users write |
| Private | Only post author reads; others see a clear private notice |
| Protected | Others read; post author sees hidden-comments notice and no input |
| Guest | Reading follows visibility; writing opens H9 Login gate |

### 12.4 Keyboard and dismissal

- Input stays above keyboard and safe area.
- Dragging the sheet must not dismiss while the user is scrolling the thread upward.
- Draft comment survives temporary keyboard dismissal.
- Close restores focus to the source post's Comment action.

---

## 13. Surface 8 — Add Post Flow

The implemented flow contains four surfaces, not three. The fourth Music step is currently a future-feature placeholder and must not block publishing.

### 13.1 Shared step shell

```text
┌──────────────────────────────────────────┐
│ [×]              Create Post             │
├──────────────────────────────────────────┤
│ ● Media ── ● Details ── ● Privacy ── ○ Music
├──────────────────────────────────────────┤
│ ACTIVE STEP CONTENT                      │
│                                          │
├──────────────────────────────────────────┤
│ [Back]                           [Next]   │
└──────────────────────────────────────────┘
```

- Progress uses labels and numbers/checkmarks, not colour alone.
- Back preserves prior step data.
- Close with any entered data prompts Discard / Keep editing.
- Keyboard cannot cover footer actions.
- Draft may be persisted locally after the backend contract is defined.

### 13.2 Step 1 — Media

- Camera and Gallery tiles use vector icons and 48 dp actions.
- Multi-select up to 10 items.
- Selected grid supports remove, reorder, and media-type indicator.
- Next disabled until one item is selected under the current product rule.
- Permission denial shows explanation plus Open Settings; no repeated blind prompt.

### 13.3 Step 2 — Details

| Field | Rule |
|---|---|
| Caption/Header | Optional, max 150 characters |
| Description | Optional, max 2,000 characters |
| Tags | Multi-select event, interest, and sponsor tags |
| Friend tagging | Include only when backend and privacy model are ready |

Counters appear near limits, not from the first character. Labels remain visible; placeholders are examples, never labels.

### 13.4 Step 3 — Privacy and interaction

- Visibility: Public, Protected, Private, Non-Judgmental 24h, Close 24h, General 24h.
- Likes enabled; Show like count depends on Likes.
- Comments enabled; Comment visibility depends on Comments.
- Sharing enabled.
- Each option includes a concise plain-language consequence.
- Invalid combinations are disabled and explained, not silently corrected.

### 13.5 Step 4 — Music

Until music upload/licensing/backend behaviour exists:

- Present as optional “Coming soon” information.
- Allow publishing without selection.
- Do not simulate adding music.
- Do not visually imply that music will be attached.

When implemented, this section requires a separate audio preview, rights, duration, and accessibility specification.

### 13.6 Publish

- Publish button moves to pending state and prevents duplicate submission.
- Upload progress is shown for media.
- Failure preserves the full draft and identifies retryable media.
- Success closes the flow, scrolls Feed to top, inserts the new post, and announces “Post published.”

---

## 14. Surface 9 — Guest and Permission Gates

### 14.1 Guest action pattern

1. User triggers a protected action.
2. Preserve intent and show a readable snackbar: e.g. “Log in to like this post.”
3. Offer explicit `Log in` action; do not auto-redirect so quickly that the message cannot be read.
4. Route to Login with return intent.
5. After successful authentication, return to the source surface. Do not automatically perform irreversible actions.

### 14.2 Permission pattern

- Hide creation controls when the role can never use them.
- If permission changed while the screen is open, disable the action and explain why.
- A server rejection overrides stale client role state.
- Do not reveal private Teams content through counts, skeletons, or cached previews.

---

## 15. Motion and Animation Reference

This is the single source of truth for Home motion. Component sections reference names from this table and must not invent competing animation behaviour.

### 15.1 Ownership

- **React Native Reanimated:** tab continuity, sheet transitions, media gestures, local transforms, list highlight, reduced-motion adaptation.
- **Expo Glass Effect:** material only where supported; not animation ownership.
- **React Native Animated:** existing components may remain temporarily, but new Home work should converge on Reanimated for consistency.
- No web-only animation package is required for the native Home implementation.

### 15.2 Named motions

| # | Name | Trigger | Behaviour | Reduced motion |
|---|---|---|---|---|
| 15.1 | Hero Field Wake | First Introduction mount | Light field resolves from static blur/opacity over 700 ms; brand rises 12 dp over 420 ms | Render final static hero |
| 15.2 | Home Tab Continuity | Tap/swipe tab | Underline spring (`damping 18`, `stiffness 150`); content follows direction and settles within 220 ms | Instant swap + underline position |
| 15.3 | Glass Press | Press interactive glass control | Surface opacity deepens while pressed; no additional scale | Static pressed fill |
| 15.4 | Quote Sequence | Coordinator cards first enter viewport | One 40 ms stagger, 12 dp rise, max 280 ms; once per visit | Render all cards immediately |
| 15.5 | Announcement Beacon | Deep-link reaches a card | Signal border glow expands once and decays in 650 ms | Static signal border for 2.5 s |
| 15.6 | Sheet Rise | H3/H7 opens | Translate from bottom, 300 ms, `bezier(0.32,0.72,0,1)`; scrim fades | Present immediately with scrim |
| 15.7 | Composer Present | H4/H8 opens | Full-height surface rises 280 ms; content does not separately stagger | Present immediately |
| 15.8 | Heart Confirm | Like succeeds optimistically | Heart 1→1.35→1 with short spring; only heart moves | State/icon/colour change only |
| 15.9 | Snackbar Lift | Context feedback | Fade + 8 dp rise in 180 ms; stays ≥3 s when actionable | Instant appearance |
| 15.10 | Skeleton Sweep | Initial loading | 1,200 ms linear shimmer across shape-matched skeleton | Static placeholder |
| 15.11 | New Content Settle | Published post/comment inserts | 8 dp rise + fade over 220 ms once | Instant insertion + focus announcement |
| 15.12 | Viewer Dismiss | Downward image gesture near 1× | Image follows finger; backdrop opacity follows distance; threshold snaps closed | Close without follow animation |

### 15.3 Motion prohibitions

- No perpetual pulsing on ordinary cards, avatars, FAB, or tab labels.
- No feed-card entrance animation during normal scrolling.
- No simultaneous scale and glass distortion on the same press.
- No layout animation that moves the user's reading position when live content arrives.
- No animated width/height for routine transitions.
- No ambient motion behind Announcements or Feed text.

---

## 16. Typography and Iconography

### 16.1 Font architecture

| Use | Font | Size |
|---|---|---|
| Hero brand | `BarlowCondensed_700Bold` | 48–64 sp responsive |
| Screen/overlay title | `BarlowCondensed_700Bold` | 24–34 sp |
| Section title | `BarlowCondensed_700Bold` | 20–24 sp |
| Card title / active tab | `BarlowCondensed_700Bold` | 16–20 sp |
| Body | `Helvetica Neue Regular` | 14–16 sp, 1.45–1.6 line height |
| Button/chip | `Helvetica Neue Medium` | 12–15 sp |
| Metadata | `Helvetica Neue Regular` | 11–13 sp |

Load fonts centrally with `expo-font`; do not import font files from screen folders. Bundle a licensed Android body-font fallback or use the approved system sans fallback.

### 16.2 Icon rules

- Use one outline icon family from installed vector icons or approved SVG assets.
- Standard size: 20–24 dp; close/critical controls remain inside 44×44 dp targets.
- No emoji for tabs, errors, empty states, media, camera, gallery, comments, or share.
- Icon-only controls require accessibility labels.
- Filled icon variants communicate selected state only when paired with accessible state.

---

## 17. Geometry and Component Tokens

### 17.1 Spacing

Use a 4 dp base scale: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.

- Screen horizontal inset: 16 dp.
- Dense card internal spacing: 12–16 dp.
- Major section gap: 32–40 dp.
- Minimum related-control gap: 8 dp.
- Minimum touch target: 44×44 dp.

### 17.2 Radius

| Component | Radius |
|---|---|
| Primary card | 20–24 dp |
| Tab rail / primary capsule | 24 dp |
| Filter chip | 18–20 dp |
| Input | 12–14 dp |
| Bottom sheet top corners | 28 dp |
| Avatar | Circular |
| Media inside card | Inherits/clips card edge |

### 17.3 Controls

| Control | Height | Treatment |
|---|---:|---|
| Primary action | 48 dp | Signal fill, deep text |
| Secondary action | 44–48 dp | Raised glass, strong border |
| Tertiary action | 44 dp target | Text/icon, quiet fill |
| Filter chip | 36 dp visible / 44 dp target | Quiet glass; signal tint active |
| FAB | 56 dp | Signal fill |
| Input | 48 dp minimum | High-opacity glass/solid fallback |

---

## 18. State Matrices

### 18.1 Primary surfaces

| Surface | Loading | Empty | Error | Offline |
|---|---|---|---|---|
| Introduction | Stable hero + quote skeletons | Hero + prepared-updates message + bridges | Inline coordinator retry | Cached content + status chip |
| Announcements | Filter skeleton + 3 cards | “Nothing posted yet” + selected category context | Full content-area retry | Cached list; creation disabled |
| Feed | 3 post skeletons | Auth: create CTA; Guest: Login/join message | Full content-area retry | Cached list; write actions explain offline state |

### 18.2 Overlays

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Announcement Detail | Metadata/body skeleton only if opened by deep link | Not applicable | Preserve sheet with retry |
| Comments | 3 comment skeletons | “No comments yet” + input when allowed | Inline retry; input state preserved |
| Composer | Draft restores without skeleton | Blank form | Inline/server errors; draft preserved |
| Media Viewer | Reserved viewport + progress | Close viewer if no valid media | Error asset + close/retry |
| Add Post | Selected-media processing indicator | Step 1 guidance | Per-file retry and global publish error |

---

## 19. Accessibility and Reduced Motion

### 19.1 Release gates

- Every control has a visible label or accessible name.
- Tab rail exposes tablist semantics where supported and selected state per tab.
- Touch targets are at least 44×44 dp.
- Text contrast meets WCAG AA equivalent targets; primary text targets 4.5:1.
- Dynamic type does not clip titles, tab labels, composer fields, or footer actions.
- Colour is never the only signal.
- Sheets expose modal semantics, a labelled close action, logical focus order, and focus restoration.
- Image media has descriptions when meaningful.
- Video controls expose play state, mute state, and progress.
- Snackbar content is announced and remains long enough to act.
- Reduced-motion preference maps to every row in §15.2.
- Reduced-transparency fallback replaces glass with opaque semantic surfaces.

### 19.2 Screen-reader order

1. Dynamic header controls.
2. Tab rail.
3. Active tab heading.
4. Active content in visual order.
5. Feed FAB after list content but reachable without traversing the entire virtualized list where platform navigation permits.

---

## 20. Performance and Implementation Architecture

### 20.1 Existing component map

| Surface | Current component |
|---|---|
| H0 | `dynamic-status-bar.tsx`, `(drawer)/index.tsx` |
| H1 | `home/IntroTab.tsx` |
| H2 | `home/AnnouncementsTab.tsx` |
| H3 | `home/AnnouncementDetailSheet.tsx`, `home/BottomSheet.tsx` |
| H4 | `home/MakeAnnouncementModal.tsx` |
| H5 | `home/FeedTab.tsx` |
| H6 | `home/MediaCarousel.tsx`, `home/ImageViewer.tsx`, `home/VideoPlayer.tsx` |
| H7 | `home/CommentSheet.tsx` |
| H8 | `home/AddPostModal.tsx` |
| Loading | `home/SkeletonBox.tsx` |

### 20.2 Required architecture rules

- Keep data and state out of visual tokens.
- Virtualize announcement and post lists.
- Memoize stable cards and callbacks after profiling, not speculatively everywhere.
- Reserve media dimensions to prevent layout shift.
- Pause off-screen video and nonessential animation.
- Centralise theme tokens and font registration.
- Centralise motion constants and reduced-motion detection.
- Avoid raw hex values in Home components except media-viewer black and explicitly approved semantic mappings.
- Replace mock data pathways without changing the surface contracts.

### 20.3 Recommended component decomposition

```text
HomeScreen
├── HomeTabRail
├── IntroductionSurface
│   ├── HomeHero
│   ├── CoordinatorVoiceCard
│   └── CommunityBridge
├── AnnouncementsSurface
│   ├── AnnouncementFilterRail
│   ├── AnnouncementCard
│   ├── AnnouncementDetailSheet
│   └── AnnouncementComposer
└── FeedSurface
    ├── PostCard
    ├── MediaCarousel / VideoPlayer / ImageViewer
    ├── CommentSheet
    ├── CreatePostFlow
    └── CreatePostFab
```

---

## 21. Legacy-to-Overhaul Change Register

| Area | Legacy/current state | Canonical overhaul |
|---|---|---|
| Home scope | Often treated as one screen with three tabs | Explicit 10-surface system including overlays and four creation steps |
| Palette | Generic theme; current code uses cream/orange | Glass Forest teal/green, migrated through shared tokens |
| Hero | Solid accent block with logo badges | Authored cinematic field composition with controlled motion |
| Coordinator content | Comic speech bubbles and meme placeholder | Editorial voice cards and designed no-update state |
| Tab icons | Emoji/text glyphs in current implementation | Single vector icon family |
| Empty/error icons | Emoji in current implementation | Vector icons or designed illustrations |
| Announcement index | Functional generic cards | Official editorial hierarchy and deep-link beacon |
| Announcement composer | Conflicting full taxonomy/schedule versus reduced mock | Reconciled rich composer with optional asset and schedule capability |
| Feed | Functional social cards | Calmer glass cards, strict action targets, robust optimistic states |
| Add Post | Legacy says 3 steps; implementation has 4 | Four documented surfaces; Music is explicitly optional/future |
| Guest FAB | Auto-redirect after 1.6 seconds | Actionable Login feedback with preserved return intent |
| Motion | Ad hoc Animated timings | Named motion ownership with reduced-motion variants |
| Glass | Not canonical | Progressive enhancement with opaque fallback |
| Accessibility | Partial labels | Release-gate checklist and focus restoration |

### 21.1 Current implementation gaps to close

1. `index.tsx` uses emoji tab icons.
2. `IntroTab.tsx`, `AnnouncementsTab.tsx`, `FeedTab.tsx`, media, and creation flows contain emoji UI glyphs.
3. Shared mobile tokens still define the warm cream/orange system.
4. The hero is currently a flat accent block.
5. Coordinator content still uses a shrug placeholder.
6. Guest FAB feedback auto-routes too quickly.
7. Bottom-sheet dismissal lacks a consistently visible labelled close action.
8. Reduced-motion and reduced-transparency handling are not centralised.
9. Add Post Music exists as a fourth step but was omitted by the old specification.
10. Current creation surfaces need a single visual and validation language.

---

## 22. QA Matrix and Definition of Done

### 22.1 Functional QA

- [ ] All three tabs switch by tap and swipe in both directions.
- [ ] Nested chip/carousel gestures do not switch tabs accidentally.
- [ ] Each tab restores its own scroll position.
- [ ] Introduction coordinator card, portrait, CTA, and community bridges route correctly.
- [ ] All announcement filters work; Teams and create controls respect permissions.
- [ ] Deep-linked announcement scroll and highlight work after list measurement.
- [ ] Announcement Detail dismisses by every supported method and restores focus.
- [ ] Announcement draft survives validation and network errors.
- [ ] Feed media variants, caption expansion, tags, Like, Comment, and Share work.
- [ ] Viewer pinch, pan, double tap, paging, and downward dismissal do not conflict.
- [ ] Video pauses off-screen/background and never starts with sound.
- [ ] Comment visibility, reply, pagination, delete/undo, report, and keyboard behaviour work.
- [ ] Add Post preserves data through Media, Details, Privacy, and Music steps.
- [ ] Publish prevents duplicates, reports upload progress, preserves failures, and confirms success.
- [ ] Guest intent returns correctly after Login.

### 22.2 Visual QA

- [ ] Home uses only canonical Glass Forest semantic tokens.
- [ ] Hero remains impactful and composed with motion disabled.
- [ ] Signal colour stays within its controlled role.
- [ ] Cards, chips, sheets, inputs, and buttons use the geometry system.
- [ ] No emoji remains as an interface icon or empty/error illustration.
- [ ] Glass fallbacks remain readable on unsupported Android devices.
- [ ] Dynamic type and narrow screens do not clip or overlap controls.
- [ ] Feed final content clears the FAB and safe area.

### 22.3 Motion and accessibility QA

- [ ] Every animation maps to §15.2.
- [ ] No ordinary content pulses continuously.
- [ ] Reduced-motion mode uses the specified fallback for every motion.
- [ ] Reduced-transparency mode replaces blur with opaque surfaces.
- [ ] All controls meet 44×44 dp targets.
- [ ] Screen-reader labels, roles, states, modal focus, and focus restoration are correct.
- [ ] Contrast passes in every normal, pressed, selected, disabled, and error state.
- [ ] Snackbar and live-update announcements are readable without stealing focus.

### 22.4 Definition of done

The Home overhaul is complete only when all of the following are true:

1. All surfaces H0–H9 are implemented or explicitly feature-flagged.
2. Legacy product behaviours are preserved unless this change register supersedes them.
3. Glass Forest tokens, typography, icons, geometry, and motion are shared rather than copied per component.
4. Every loading, empty, error, offline, guest, authenticated, and role-gated state is implemented.
5. The Home opening viewport is visually stronger than the other screen handoffs without making reading surfaces noisy.
6. Motion adds hierarchy and continuity while remaining fully usable with motion disabled.
7. Functional, visual, accessibility, performance, and theme QA pass on representative iOS and Android devices.
8. No unresolved visual-system divergence remains hidden in component-local styles.

---

## Appendix A — Source Priority

When implementing Home, use this order:

1. This document for Home visual design, surface architecture, motion, accessibility, and resolved changes.
2. `../Screens Master Doc/home-page.md` for unchanged product behaviour and edge cases.
3. `../Screens Master Doc/popups-and-modals.md` for legacy overlay context only where this document is silent.
4. `../Events/events-page1.md` for shared Glass Forest consistency.
5. `../Auth/handoffSpec.md` for shared palette and typography consistency.
6. Current source code as an implementation baseline, not as authority when it conflicts with this handoff.

## Appendix B — Explicitly Resolved Questions

| Question | Resolution |
|---|---|
| Is Home one screen? | No. It is the multi-surface system in §2.1. |
| Which colour system does the overhaul use? | Glass Forest teal/green. Warm cream/orange is implementation debt for Home. |
| Does Add Post have three or four steps? | Four in current architecture; Music is optional/future and cannot block publish. |
| Are emoji acceptable as UI icons? | No. Replace them with the approved vector icon family. |
| Should Home use more animation because it is important? | It uses better-directed animation, not more animation. Impact is concentrated in the hero and transitions. |
| Should the hero animate continuously? | Only a subtle field drift may continue; it freezes under reduced motion and does not continue behind reading-heavy tabs. |
| Are announcement and post cards visually identical? | No. They share materials and geometry; Announcements are editorial, Feed cards are social/media-led. |
| What happens when new live content arrives? | Show a user-controlled refresh affordance; never move the current reading position automatically. |
