# BGSC Platform — Design System & Theming Rules

**Scope:** Mobile (React Native / Expo). The web admin console should mirror these tokens.
**Purpose:** The single source of truth for color, typography, spacing, components, and motion. **Hand this doc to AI (or any developer) when building a new screen so the output matches the BGSC theme.**
**Derived from:** the auth mockups (`screens/assets/auth-screens-light.png`), the modal mockups (`screens/assets/modals-*.png`), and the implemented Home Page. Values are **approximate** where read from mockups — adjust once final brand values are provided.

> ✅ **Applied.** `mobile/src/core/theme/tokens.ts` and `web/src/core/theme/tokens.ts` now implement this warm theme (warm cream surfaces + dark-ink `primary` + burnt-orange `accent`) with the extended semantic tokens below, and the existing mobile screens/components were swept to use `accent` for links/active-states/FAB/hero/highlights. Remaining brand-hex confirmation and dark-mode sign-off are tracked in §11.

---

## 0. How to Use This Doc With AI

When prompting AI to build/modify a screen, prepend something like:

```
Follow design-system.md. Use semantic theme tokens via useColors() — never hardcode hex.
Surfaces = warm cream/white; primary action = dark ink pill; accent = burnt orange (links,
active states). Inputs and buttons are fully-rounded pills. Section labels are UPPERCASE,
muted, letter-spaced. Use skeletons (not spinners) for loading. 4pt spacing scale,
16pt screen padding. Match the component recipes in §6.
```

**Golden rules**
1. **Never hardcode colors** in screens — read from `useColors()` (semantic tokens). Only the design-system/token file holds raw hex.
2. **Pills everywhere:** inputs and primary/secondary buttons use full pill radii; cards are softly rounded.
3. **One primary action per view** (dark-ink filled). Everything else is outline/text/ghost.
4. **Accent is for meaning** (links, active chips, selection, highlights) — not for large fills.
5. **Loading = skeletons**, not spinners (spinners only for inline "load more" / in-flight buttons).
6. **Light + dark** must both work; pull every color from tokens so dark mode is automatic.

---

## 1. Brand & Principles

- **Personality:** warm, playful-retro (pixel-art mascots), community-first, but clean and editorial in the UI chrome.
- **Contrast model:** soft warm neutral canvas → crisp white cards → **high-contrast dark-ink** primary actions → **burnt-orange** accent for emphasis.
- **Restraint:** color does the talking through accent + semantic states; the layout stays neutral and uncluttered.
- **Consistency:** the same component recipes (pill input, dark button, chip, card, sheet) repeat across every screen.

---

## 2. Color System

Semantic tokens extend the existing `ThemeColors` interface. **Use the token name, not the hex.**

### 2.1 Core tokens (mapped to `ThemeColors`)

| Token | Role | Light | Dark |
|---|---|---|---|
| `background` | App canvas | `#FAF7F2` (warm cream) | `#14110D` |
| `surface` | Cards, sheets, inputs | `#FFFFFF` | `#201C17` |
| `surfaceMuted` *(new)* | Filled inputs / chip backs / subtle fills | `#F2EEE7` | `#2A251F` |
| `text` | Primary ink | `#1B1714` | `#F5F0E8` |
| `textMuted` | Secondary / labels / helper | `#8C857A` | `#A39B8D` |
| `border` | Hairlines, input borders, dividers | `#E7E1D6` | `#342E26` |
| `primary` | Primary action fill (dark-ink button) | `#1F1B17` | `#F1EADE` |
| `primaryText` | Text/icon on `primary` | `#FFFFFF` | `#1B1714` |

> In **light** mode the primary button is dark ink on light. In **dark** mode it inverts to a warm off-white pill with dark text (keeps the high-contrast "strong action" feel). A subtle vertical gradient on the primary button is optional (deep plum → warm dark) per the auth mockups.

### 2.2 Accent & semantic tokens *(new — add to `ThemeColors`)*

| Token | Role | Light | Dark |
|---|---|---|---|
| `accent` | Brand emphasis: links, active chip, selection, highlights | `#E8662A` (burnt orange) | `#F2783C` |
| `accentText` | Text/icon on `accent` fill | `#FFFFFF` | `#1B1714` |
| `accentMuted` | Accent tint backgrounds (active chip bg, highlight) | `#E8662A1F` (12% accent) | `#F2783C24` |
| `success` | Positive / toggle-on | `#22C55E` | `#34D27B` |
| `danger` | Destructive (Delete/Disable), errors | `#E5484D` | `#F2686C` |
| `info` | Informational (Discord-style links) | `#3B82F6` | `#5B9CF8` |

### 2.3 Category / tag colors (announcements & events)

Keep the existing `TAG_COLORS` map (`home-page.md`): BGEC `#3b82f6`, FitSoc `#22c55e`, Airball `#f59e0b`, Offside `#ef4444`, PowerPlay `#8b5cf6`, Around The Net `#06b6d4`, Deuce `#f97316`, Highlight Events `#ec4899`, Teams `#14b8a6`. Status colors: **upcoming = blue**, **ongoing = green**, **past = grey**.

### 2.4 Usage rules

- **Do** use `accent` for: text links, active filter chips, selected radio/checkbox, "highlighted" cards, FAB.
- **Don't** flood large areas with `accent`; large filled CTAs use `primary` (dark ink).
- **Destructive** actions always use `danger`, with a confirmation step.
- **On warm cream backgrounds**, cards are pure `surface` white for separation; on dark, cards are one step lighter than `background`.

---

## 3. Typography

**Font:** System default (SF Pro on iOS, Roboto on Android) for body/UI. Optional display face for big headings (friendly geometric sans, e.g. Inter/Poppins) — keep it to screen titles only.

| Role | Size (sp) | Weight | Color | Notes |
|---|---|---|---|---|
| Screen title / hero heading | 24–28 | 700 | `text` | e.g. "Choose Your Sponsor", "Verification Code" |
| Section heading | 18–20 | 700 | `text` | "What Our Heads Have to Say" |
| Card title | 16 | 600–700 | `text` | 1–2 lines, ellipsis |
| Body | 14–15 | 400 | `text` | Default paragraph/input text |
| Helper / subtitle | 12–13 | 400 | `textMuted` | Under headings & fields |
| **Field label** | 11–12 | 600 | `textMuted` | **UPPERCASE**, letter-spacing ~0.5 |
| Button label | 15–16 | 600 | per button | — |
| Caption / meta | 11–12 | 400–500 | `textMuted` | timestamps, counts |
| Link | 12–14 | 600 | `accent` | optionally underlined |

- **Line-height:** ~1.35–1.45× for body. Headings tighter (~1.2×).
- **Numerals:** use tabular figures for counts/timers where alignment matters (auction timer, OTP).

---

## 4. Spacing, Layout, Radius, Elevation

### 4.1 Spacing scale (4pt base)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`

- **Screen horizontal padding:** 16.
- **Gap between cards / list items:** 12.
- **Inside-card padding:** 14.
- **Section vertical rhythm:** 20–24 between major sections.
- **Field stack gap:** 6 (label→input), 12–14 between fields.

### 4.2 Radius

| Element | Radius |
|---|---|
| Pill input / pill button | `999` (fully rounded) or ~24–28 |
| Card | 14 |
| Chip / tag pill | 20 |
| Bottom sheet (top corners) | 20 |
| Small control (OTP cell, thumb) | 10–12 |
| Avatar | circle |

### 4.3 Elevation / shadow
Soft and sparing. FAB, bottom sheets, and the active segmented pill get a subtle shadow (`shadowOpacity ~0.1–0.25`, `radius 6`, `offset {0,2–3}`, Android `elevation 4–6`). Cards rely on `border` + surface contrast, not heavy shadows.

---

## 5. Iconography & Imagery

- **Icons:** outline style, consistent stroke; pair with text where meaning isn't obvious. Tab/nav icons may use the existing emoji glyphs as a placeholder but should migrate to a single outline icon set.
- **Hero art:** pixel-art retro mascots (warm orange/coral/cream) that **fade into the page background** via a vertical gradient (auth screens). Static, non-interactive.
- **Avatars:** circle; initials-on-color fallback (`avatarColor` + uppercase initial) when no image.
- **Empty states:** friendly illustration or large emoji + one-line message (see §8).

---

## 6. Component Recipes

> All examples read colors from `useColors()`. Sizes are guidance, not pixel law.

### 6.1 Buttons

- **Primary (pill):** full-width, `backgroundColor: primary`, `primaryText` label, ~52 dp tall, radius pill, 600 weight. One per view. Disabled → `border` bg + `textMuted` label (or 0.5 opacity). In-flight → inline spinner + "Please wait…".
- **Outline / secondary (pill):** transparent bg, `1px border`, `text` label. Used for Google sign-in, "See all announcements", Cancel.
- **Destructive:** `danger` text (ghost) or `danger` fill for hard actions; always confirm.
- **Text link:** `accent`, 600, optional underline.

### 6.2 Inputs (pill field)
White/`surface` (or `surfaceMuted`) fill, `1px border`, radius pill, horizontal padding 14, height ~48. **Label above** in UPPERCASE muted. Password fields get a trailing eye toggle. Char counters bottom-right in `textMuted`. Focus → `accent` (or darker) border.

### 6.3 Chips
- **Filter chip (single/multi-select):** pill, outline when inactive (`border` / tag color @ ~50%), filled `accent` (or tag color) when active with contrasting text. Tap active → deselect (where allowed).
- **Selectable interest chip:** same, leading glyph optional.
- **Tag pill (display):** small, tag-color tint bg + tag-color border + text.

### 6.4 Cards
`surface` bg, `1px border`, radius 14, padding 14, gap 8–12. Highlighted/selected card → `accentMuted` bg + `accent` border. Pressable cards animate a subtle scale/opacity on press.

### 6.5 Bottom sheet
Rounded-top (20), `surface` bg, drag handle (40×4, `border`) centered at top, over a `rgba(0,0,0,0.45)` scrim. Spring-in (tension ~90, friction ~14). Dismiss: handle swipe-down, scrim tap, or ✕/Cancel. Heights ~0.6–0.8 of screen.

### 6.6 Full-screen form modal
Header row: **Cancel** (left, text) · **Title** (center, 700) · **Action** (right, filled pill — Post/Done/Finish) — or a pinned bottom primary for stepped flows. Keyboard-aware. Dirty-state → "Discard?" confirm on dismiss.

### 6.7 Segmented toggle
Pill track (`surfaceMuted`), equal segments, active = elevated white pill with shadow, `text` label; inactive label `textMuted`. (Auth Login/Sign Up, New Post Media/Details.)

### 6.8 Switch / Radio / Checkbox
- **Switch:** track `accent`/`success` when on, neutral when off.
- **Radio:** ring `border` → `accent` ring + filled dot when selected.
- **Checkbox:** square, `accent` fill + check when checked; label/links to the right.

### 6.9 FAB
56 dp circle, `accent` (or `primary`) bg, `+` glyph, bottom-right (bottom 24, right 20), soft shadow, fixed (doesn't scroll).

### 6.10 Skeleton
Rounded blocks matching content shape, gentle opacity pulse (0.4↔1, ~750ms each way), color `border`. Used for first loads.

---

## 7. Motion

| Interaction | Spec |
|---|---|
| Tab switch / slide | translateX, ~220ms timing |
| Bottom sheet in/out | spring in; ~260ms timing out |
| Like heart | scale spring bounce (1→1.5→1) |
| Skeleton shimmer | opacity loop ~750ms each direction |
| Snackbar | fade in 200ms, hold ~2.2s, fade out 300ms |
| Press feedback | subtle scale/opacity |

Keep durations 150–280ms. Prefer `useNativeDriver` for transform/opacity.

---

## 8. State Patterns (every data view)

| State | Pattern |
|---|---|
| **Loading** | Skeleton placeholders (3 cards/rows typical). No full-page spinners. |
| **Empty** | Illustration / large emoji + one-line message, context-aware (e.g. "No upcoming events in Leagues yet"). |
| **Error** | Icon + short message + **Retry** button (or inline retry link). |
| **Disabled** | Muted (`textMuted` / `border`) or 0.5 opacity; not interactive. |
| **Guest gating** | Read actions allowed; write actions (post/like/register/invest) → redirect to `/login` (often with a snackbar). |
| **"Load more"** | Small inline spinner at list bottom. |
| **Pull-to-refresh** | Native refresh indicator. |

---

## 9. Accessibility

- **Contrast:** body/text vs background ≥ 4.5:1; large text ≥ 3:1. Verify `textMuted` on `background` passes.
- **Touch targets:** ≥ 44×44; use `hitSlop` (8–12) on small controls.
- **Labels:** every interactive element gets `accessibilityRole` + `accessibilityLabel`; tabs use `accessibilityState={{ selected }}`.
- **Dynamic type:** avoid fixed heights that clip scaled text; let content wrap.
- **Don't rely on color alone:** pair status colors with text/icon (e.g. status pill label, not just hue).

---

## 10. Code Mapping

Tokens live in `mobile/src/core/theme/tokens.ts` and are consumed via `useColors()`:

```ts
// Proposed extended interface (adds accent + semantic tokens)
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;   // new
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  accent: string;         // new
  accentText: string;     // new
  accentMuted: string;    // new
  success: string;        // new
  danger: string;         // new
  info: string;           // new
}
```

```tsx
// In screens — always read from the hook, never hardcode:
const colors = useColors();
<View style={{ backgroundColor: colors.background }}>
  <Pressable style={{ backgroundColor: colors.primary, borderRadius: 999 }}>
    <Text style={{ color: colors.primaryText }}>Continue</Text>
  </Pressable>
</View>
```

- `colorsFor(mode)` returns the light/dark set; `useColors()` resolves the active scheme automatically.
- Web admin should import the same token values to stay in sync.

---

## 11. Open Items / Migration

1. ~~**Update `tokens.ts`** from purple/slate → the warm values in §2.~~ ✅ Done (mobile + web), plus the component `accent` sweep.
2. **Confirm brand hex** for accent (burnt orange) and the optional primary-button gradient — current values are eyeballed from mockups; adjust in `tokens.ts` once finalized.
3. **Dark mode** values in §2 are a proposed mirror (only light mockups exist) — confirm.
4. **Display font** decision (system vs. Inter/Poppins for headings).
5. **Icon set** to replace placeholder emoji glyphs.

---

## 12. Quick Reference (cheat sheet)

```
CANVAS    background #FAF7F2 (warm cream)      dark #14110D
CARD      surface    #FFFFFF                   dark #201C17
INK       text       #1B1714                   muted #8C857A
LINE      border     #E7E1D6
ACTION    primary    #1F1B17 (dark ink pill)   text #FFFFFF
ACCENT    accent     #E8662A (burnt orange)    links / active / selection
STATE     success #22C55E · danger #E5484D · info #3B82F6
RADIUS    pill 999 · card 14 · chip 20 · sheet-top 20 · small 10
SPACE     4·8·12·16·20·24·32·40   (screen pad 16, card gap 12, card pad 14)
TYPE      title 24–28/700 · section 18–20/700 · card 16/600 · body 14–15/400
          LABEL 11–12/600 UPPERCASE muted · button 15–16/600 · link accent/600
LOADING   skeletons, not spinners
RULE      never hardcode hex — use useColors() tokens
```
