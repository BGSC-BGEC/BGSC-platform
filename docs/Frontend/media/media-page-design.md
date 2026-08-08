# Media Page — Design & Implementation Guide

> **Supersedes** `media-page.md` (sparse spec). This doc is the canonical design + implementation reference.
> Read `UI-UX-Master-Doc.md` in full before using this doc. All tokens, fonts, and component recipes from the Master Doc apply here.

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/media`
**Drill-in Routes:**
- `/(stack)/media/album/[id]` — Album Detail Screen
**Visibility:** Public (public media); Authenticated (friends-only media)

---

## 0. Design Concept — Cinematic Archive

The Media Page is the platform's visual showreel. It should feel like opening a sports magazine or a film archive — dark, editorial, immersive. Content is the hero; chrome is invisible until you need it.

**Inspiration:** Lusion-style dark canvas + editorial strip layout. Think streaming platform homepage (Netflix/Apple TV+) crossed with a sports photo archive.

### Visual Direction

| Principle | Application |
|---|---|
| **Dark canvas first** | Pure dark background (#060D0E). Media fills it with colour and life. |
| **Content is chrome-free** | Thumbnails bleed edge-to-edge. No borders, no shadows on the images themselves. |
| **Glass appears on interaction** | Overlays (title, actions) slide in on long-press / tap. At rest, the grid is clean. |
| **Horizontal strips over flat grid** | Sections scroll horizontally (film-strip pattern). Community masonry is the exception. |
| **Type carries section identity** | Bebas Neue section headers ("HIGHLIGHTS", "EVENT ALBUMS") make sections feel editorial. |
| **Hero Reel anchors the page** | Auto-playing muted featured clip at top — cinematic entrance, not a banner. |

---

## 1. Page Structure Overview

```
┌─────────────────────────────────────────┐
│          Dynamic Status Bar             │  ← fixed, full width
├─────────────────────────────────────────┤
│   [Glass Filter Bar — sticky]           │  ← pinned below status bar
│   🔍  [All] [Albums] [Community] [...]  │
├─────────────────────────────────────────┤
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │         HERO REEL               │   │  ← ~55% screen height
│   │     (auto-play muted video)     │   │
│   │                                 │   │
│   │  ▶  [Glass pill: Event name]    │   │
│   └─────────────────────────────────┘   │
│                                         │
│   HIGHLIGHTS                            │  ← Bebas Neue 32sp
│   ──────────────────────────────────    │
│   ┌────────┐ ┌────────┐ ┌────────┐     │  ← horizontal scroll
│   │ Video  │ │ Video  │ │ Video  │     │
│   │ (tall) │ │ (tall) │ │ (tall) │     │
│   └────────┘ └────────┘ └────────┘     │
│                                         │
│   EVENT ALBUMS                          │
│   ──────────────────────────────────    │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │  ← horizontal scroll
│   │Album │ │Album │ │Album │ │Album │  │
│   └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │    ✨ YOUR MEMORIES  2025-26    │   │  ← auth only, full-width
│   └─────────────────────────────────┘   │
│                                         │
│   COMMUNITY                             │
│   ──────────────────────────────────    │
│   ┌───────┐  ┌───────────┐             │  ← 2-col masonry
│   │ Photo │  │   Video   │             │
│   │ (sq)  │  │  (tall)   │             │
│   ├───────┤  │           │             │
│   │ Video │  └───────────┘             │
│   │ (rec) │  ┌───────┐                 │
│   └───────┘  │ Photo │                 │
│              └───────┘                 │
│                                         │
│   SPONSORS                              │
│   ──────────────────────────────────    │
│   ┌──────┐ ┌──────┐ ┌──────┐           │
│   │Spons │ │Spons │ │Spons │           │
│   └──────┘ └──────┘ └──────┘           │
│                                         │
└─────────────────────────────────────────┘
```

**Scroll behaviour:** The entire page (excluding status bar and filter bar) scrolls as one unified vertical feed. Section strips scroll horizontally within the vertical scroll — standard nested scroll pattern.

**Category chip filter:** When a chip is selected (e.g. Albums), the page collapses to show only that category's content, replacing the editorial multi-section layout with a single filtered masonry/grid view.

---

## 2. Dynamic Status Bar

Behaviour is identical to other drawer screens.

| Slot | Component | Behaviour |
|---|---|---|
| Left | Hamburger (≡) | Opens Side Drawer |
| Center | "Media" wordmark (Barlow Condensed 700, 20sp) | Non-interactive |
| Right — Guest | "Login" text button | → `/login` |
| Right — Auth | User profile picture (36dp circle) | Opens Account Actions Popup |

---

## 3. Glass Filter Bar (Sticky)

Pinned directly below the status bar. Does not scroll away.

```
┌────────────────────────────────────────────┐
│  ┌──────────────────────────────────────┐  │
│  │ 🔍  Search media, tags, events...    │  │  ← glass pill input
│  └──────────────────────────────────────┘  │
│                                            │
│  [All] [Highlights] [Albums] [Community]   │  ← glass chips, h-scroll
│  [Memories] [Sponsors]  ·  [⚙ Filter]     │
└────────────────────────────────────────────┘
```

### 3.1 Search Input

Glass pill — `BlurView intensity={50}` + `rgba` overlay + `borderColor: border` + `borderRadius: 999`. Placeholder: `Search media, tags, events…`. Clears with ✕ button. On submit → filters entire page grid by keyword.

### 3.2 Category Chips

Single-select. Default: **All**. Tap selected chip → deselects (back to All).

| Chip | What it shows |
|---|---|
| All | Full editorial layout (all sections) |
| Highlights | Highlights-only full-page grid |
| Albums | All event albums in a grid |
| Community | Community uploads masonry |
| Memories | Memories section (auth required) |
| Sponsors | Sponsor galleries |

Active chip: `accent` fill, `accentText` label.
Inactive chip: glass surface + `border` outline + `textMuted` label.

**⚙ Filter:** Right-most chip, always visible. Opens Advanced Filter Sheet (§10).

### 3.3 Filter Bar Glassmorphism

```tsx
// components/media/GlassFilterBar.tsx
<BlurView intensity={50} tint="dark" style={styles.bar}>
  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
  <GlassSearchInput ... />
  <ChipRow chips={CATEGORY_CHIPS} ... />
</BlurView>

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
});
```

---

## 4. Hero Reel

The first visible content below the filter bar. A full-width auto-playing muted video clip — the platform's featured highlight of the week/season.

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│          [Video fills 100% width]           │
│          [~55% of screen height]            │
│                                             │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ gradient fade ▓▓▓▓▓▓▓▓▓▓  │ ← bottom 30% dark fade
│                                             │
│  ▶  Offside Season 3 — Final Highlights     │ ← glass pill, bottom-left
│     [FEATURED] pill · [Mute/Unmute] btn     │ ← top-right corner
└─────────────────────────────────────────────┘
```

### 4.1 Behaviour

| Element | Detail |
|---|---|
| Video | Auto-plays on mount, muted, loops. Uses `expo-av` `Video` component or `expo-video`. Starts playing when screen gains focus; pauses when screen loses focus. |
| Aspect ratio | 16:9, full width. Height = `screenWidth * (9/16)` clamped to max ~55% of screen height. |
| Bottom gradient | `LinearGradient` from `transparent` → `#060D0E` over bottom 35% of card. Ensures text legibility. |
| Event name pill | Glass pill bottom-left. Bebas Neue 16sp, `text` colour. Tap → navigates to the event detail. |
| `[FEATURED]` badge | Small accent-coloured pill top-left. |
| Mute/Unmute | Icon button top-right (🔇/🔊). Persists mute preference for the session. |
| Tap (body) | Opens Full-Screen Media Viewer (§9) in video mode. |
| Swipe left/right | Cycles to next/previous featured reel. Dot indicator below if multiple reels. |
| Fallback | If no video — show a static featured image with the same overlay treatment. |
| Loading | Skeleton rect matching full dimensions while video metadata loads. |

---

## 5. Section: HIGHLIGHTS (Horizontal Film Strip)

```
HIGHLIGHTS                              ← Bebas Neue 32sp, textMuted label below
See all →                               ← accent link, right-aligned

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│                  │ │                  │ │                  │
│   Video thumb    │ │   Video thumb    │ │   Video thumb    │
│   (tall 3:4)     │ │   (tall 3:4)     │ │   (tall 3:4)     │
│                  │ │                  │ │                  │
│▓▓ gradient ▓▓▓▓▓│ │▓▓ gradient ▓▓▓▓▓│ │▓▓ gradient ▓▓▓▓▓│
│ ▶  Airball S2    │ │ ▶  Offside S3    │ │ ▶  PowerPlay W4  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
   [~65% screenWidth]
```

### 5.1 Card Spec

| Property | Value |
|---|---|
| Width | `screenWidth * 0.65` (~260dp on 400dp screen) |
| Aspect ratio | 3:4 (portrait) |
| Border radius | 16 |
| Gap between cards | 12 |
| First card left padding | 16 (aligns to screen edge) |
| Last card right padding | 16 |
| Glass overlay | Bottom 40% gradient fade (#060D0E transparent → solid) |
| Play icon | ▶ 28dp outline icon, `text` colour, bottom-left above title |
| Title | Barlow Condensed 700, 16sp, `text`, bottom-left, 1-line ellipsis |
| Duration pill | Glass pill top-right: e.g. "2:34" |
| Video indicator | `▶` play icon centred at rest (full opacity), fades on scroll |

### 5.2 Interaction

- **Tap** → opens Full-Screen Media Viewer (§9) in video mode, starts playback with sound
- **Long-press** → contextual glass bottom sheet: Share · Download · Report
- **"See all →"** → switches to Highlights-filtered full-page grid

### 5.3 Content Source

Highlights are admin-curated. Source: featured event recap videos tagged `category: highlight` in the media service. Ordered by featured flag, then recency. Show max 10 in strip; paginate in full view.

---

## 6. Section: EVENT ALBUMS (Horizontal Strip)

```
EVENT ALBUMS                            ← Bebas Neue 32sp
See all →

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│          │ │          │ │          │ │          │
│  Cover   │ │  Cover   │ │  Cover   │ │  Cover   │
│  (sq)    │ │  (sq)    │ │  (sq)    │ │  (sq)    │
│          │ │          │ │          │ │          │
│▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓│
│ Offside  │ │ Airball  │ │ FitSoc   │ │ Waves    │
│ 142 pics │ │  98 pics │ │  67 pics │ │  54 pics │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
  [~48% screenWidth]
```

### 6.1 Card Spec

| Property | Value |
|---|---|
| Width | `screenWidth * 0.48` |
| Aspect ratio | 1:1 (square) |
| Border radius | 16 |
| Glass overlay | Bottom 35%, gradient fade |
| Album name | Inter 600, 13sp, `text` colour |
| Photo count | Inter 400, 11sp, `textMuted` |
| Stacked-photos icon | Small stacked rectangle icon top-left (indicates it's an album not a single) |

### 6.2 Interaction

- **Tap** → navigates to **Album Detail Screen** `/(stack)/media/album/[id]` (§8)
- **Long-press** → Share Album · Download Album (auth) · Report
- **"See all →"** → Albums-filtered full grid showing all event albums

---

## 7. Section: YOUR MEMORIES (Auth Only)

A full-width special card — the platform's "Year in Review" for the authenticated user. Positioned between Event Albums and Community sections. Hidden entirely for guests.

```
┌─────────────────────────────────────────────┐
│                                             │
│  [Collage of user's top 6 media — mosaic]   │
│                                             │
│  ▓▓▓▓▓▓▓▓▓ gradient fade ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│                                             │
│  ✨  YOUR MEMORIES                          │  ← Bebas Neue 28sp, accent colour
│      BGSC 2025–26                           │  ← Inter 400, 13sp, textMuted
│                          [View all →]       │  ← accent link
└─────────────────────────────────────────────┘
```

### 7.1 Design

| Property | Value |
|---|---|
| Height | `screenWidth * 0.55` (~220dp) |
| Background | Collage of the user's 6 most-liked/recent media items in a mosaic layout |
| Mosaic pattern | 1 large (left, 2/3 width) + 2 stacked small (right, 1/3 width each) — or 6-grid if 6 items |
| Overlay | Full gradient from `transparent` at top → `rgba(6,13,14,0.85)` at bottom |
| Glass accent line | 2px `accent`-coloured left border on the title block |
| Border | 1px `accentMuted` border on entire card |
| Border radius | 20 |
| Empty state | If user has no media: "Start capturing your BGSC journey." + subtle placeholder illustration |
| Tap (body) | Navigates to `/(stack)/media/memories` — Memories slideshow/viewer |
| "View all →" | Same as body tap |

---

## 8. Section: COMMUNITY (Masonry Grid)

```
COMMUNITY                               ← Bebas Neue 32sp

  ┌──────────────┐   ┌─────────────────┐
  │ Photo (sq)   │   │ Video (3:4 tall) │
  │              │   │                 │
  └──────────────┘   │                 │
  ┌──────────────┐   │                 │
  │ Video (16:9) │   └─────────────────┘
  │              │   ┌─────────────────┐
  └──────────────┘   │ Photo (4:3)     │
  ┌──────────────┐   └─────────────────┘
  │ Photo (4:5)  │   ┌─────────────────┐
  │              │   │ Photo (1:1)     │
  └──────────────┘   └─────────────────┘
```

### 8.1 Layout

2-column staggered masonry. Each item's height is computed from its native aspect ratio clamped to a range:
- Min height: 120dp
- Max height: 280dp
- Column width: `(screenWidth - 16*2 - 8) / 2` (~180dp on 400dp screen)
- Gap between items: 8
- Screen horizontal padding: 16

Use `@shopify/flash-list` or a custom masonry implementation (2-column virtualized FlatList with height pre-calculation from the media metadata).

### 8.2 Media Card

```
┌────────────────────────────────┐
│                                │
│    [Thumbnail — full fill]     │  ← no border at rest
│                                │
│  [Glass overlay — hidden]      │  ← slides up on long-press only
│  Avatar  Username  Timestamp   │
│  [Download] [Share] [Report]   │
└────────────────────────────────┘
```

At rest: pure thumbnail, border-radius 12, no overlay visible.
Video items: `▶` play icon centred (white, 28dp, semi-transparent bg circle).
Long-press: glass action overlay slides up from bottom with spring animation (200ms).

### 8.3 Visibility Rules

| User state | Sees |
|---|---|
| Guest | All `visibility: public` items |
| Authenticated | Public + `visibility: friends_only` (if connected to uploader) |

---

## 9. Section: SPONSORS (Horizontal Strip)

```
SPONSORS                                ← Bebas Neue 32sp

┌──────────┐ ┌──────────┐ ┌──────────┐
│  Sponsor │ │  Sponsor │ │  Sponsor │
│  media   │ │  media   │ │  media   │
│  cover   │ │  cover   │ │  cover   │
│──────────│ │──────────│ │──────────│
│ SponsrNm │ │ SponsrNm │ │ SponsrNm │
└──────────┘ └──────────┘ └──────────┘
  [~48% screenWidth]
```

Same card spec as Event Albums (§6.1) but with a small sponsor logo badge overlaid top-right.
Tap → navigates to that sponsor's gallery page (future: `/(stack)/sponsor/[id]/gallery`).

---

## 10. Album Detail Screen

**Route:** `/(stack)/media/album/[id]`
**Trigger:** Tapping an Event Album card.

```
┌──────────────────────────────────────┐
│  [← Back]   Offside Season 3  [Share]│  ← custom nav bar
├──────────────────────────────────────┤
│  [Cover image — full width, 16:9]    │
│  ▓▓▓▓▓▓▓▓▓ gradient ▓▓▓▓▓▓▓▓▓▓▓▓   │
│  OFFSIDE SEASON 3  ← Bebas Neue 28sp │
│  June 2026 · 142 photos + 8 videos   │
├──────────────────────────────────────┤
│  [Download Album ⬇]  [Share Album ↗] │  ← glass pill buttons
├──────────────────────────────────────┤
│  3-column square grid                │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │      │ │ ▶    │ │      │         │
│  └──────┘ └──────┘ └──────┘         │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │      │ │      │ │      │         │
│  └──────┘ └──────┘ └──────┘         │
│  …                                  │
└──────────────────────────────────────┘
```

### 10.1 Header Section

| Element | Detail |
|---|---|
| Cover image | Full-width 16:9, gradient fade at bottom |
| Album title | Bebas Neue 28sp, `text` |
| Metadata | Inter 400, 12sp, `textMuted` — event date, total item count |
| "Download Album" | Ghost pill button (auth only, if permissions allow). Initiates bulk download confirmation. |
| "Share Album" | Ghost pill button. Opens native share sheet with album deep-link. |

### 10.2 Grid

3-column square grid (not masonry — albums are uniform). Item gap: 2dp. No padding between items — edge-to-edge grid. Item size: `screenWidth / 3`.

Videos have `▶` play icon overlay centred. Tap → Full-Screen Media Viewer.
Long-press → Download · Share · Report sheet.

### 10.3 States

| State | Behaviour |
|---|---|
| Loading | 3-column skeleton grid |
| Empty | "This album has no media yet." + illustration |
| Error | Retry button, back arrow always functional |

---

## 11. Full-Screen Media Viewer

**Trigger:** Tap any thumbnail across all sections / the Hero Reel.

```
┌──────────────────────────────────────┐
│  [← ]                    [⋮ More]   │  ← glass bar, fades on inactivity
│                                      │
│                                      │
│           [Media fills screen]       │
│           [Black background]         │
│                                      │
│                                      │
│  [Avatar] @username · 2h ago         │  ← glass bar, bottom, fades on inactivity
│  Caption text (expandable)           │
│  [⬇ Download]  [↗ Share]  [🚩 Report]│
└──────────────────────────────────────┘
```

### 11.1 Behaviour

| Aspect | Detail |
|---|---|
| Background | Always pure `#000000` — not the app canvas |
| Image | Pinch-to-zoom (1×–5×), double-tap to toggle 1×/2×, pan when zoomed |
| Video | Auto-plays with sound on open. Play/pause on tap when overlays hidden. Scrubber appears with overlays. |
| Overlay fade | Tap body → toggles overlay visibility (300ms fade). Overlays auto-hide after 3s of inactivity (video playing). |
| Swipe horizontal | Navigate previous/next item in current context (same album / same grid position) |
| Swipe down | Dismiss viewer — spring-based dismissal with the image following the gesture |
| Download | Auth only. Saves to device camera roll via `expo-media-library`. Guest → snackbar + redirect. |
| Share | Native share sheet with deep-link. |
| Report | Auth only. Opens Report Modal (category select + optional note + submit). |
| "More ⋮" | Top-right. Shows: Add to Memories, View uploader profile, Copy link. |

### 11.2 Progress Dots (horizontal navigation)

When viewing items from a section or album with multiple items, show a dot indicator at the top (below the nav bar overlay) showing position in the sequence.

---

## 12. Advanced Filter Sheet

**Trigger:** ⚙ Filter chip in the sticky filter bar.
**Appearance:** Bottom sheet, glass, `BlurView intensity={80}`, height ~70% screen.

```
┌──────────────────────────────────────┐
│  ━━━  (drag handle)                  │
│  Filters               [Reset all]   │
├──────────────────────────────────────┤
│  DATE RANGE                          │
│  [ From: ──────── ]  [ To: ──────── ]│
│                                      │
│  MEDIA TYPE                          │
│  [Photo ✓] [Video ✓] [GIF ✓]        │
│                                      │
│  UPLOADER                            │
│  [Search users…]                     │
│  [ @nikunj ]  [×]                    │
│                                      │
│  SPONSOR                             │
│  [Select sponsor…  ▼]                │
│                                      │
│  EVENT                               │
│  [Select event…    ▼]                │
├──────────────────────────────────────┤
│  [Cancel]     [Apply Filters]        │
└──────────────────────────────────────┘
```

| Control | Type | Notes |
|---|---|---|
| Date Range | Two date pickers | "From" and "To". Clear-able individually. |
| Media Type | Multi-select chips | Photo, Video, GIF. At least one must remain selected. |
| Uploader | Search-select input | Type to search users; shows selected as removable chips |
| Sponsor | Dropdown | Single-select from active sponsors |
| Event | Dropdown | Single-select from past/ongoing events |
| Reset all | Text button | Clears all filters, closes sheet |
| Apply | Primary pill | Applies filters, closes sheet, updates grid |

---

## 13. Glassmorphism Component Specs

### 13.1 GlassMediaCard (base for all strip cards)

```tsx
// components/media/GlassMediaCard.tsx
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  uri: string;
  title: string;
  subtitle?: string;
  aspectRatio?: number;   // e.g. 3/4, 1, 16/9
  width: number;
  isVideo?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export function GlassMediaCard({ uri, title, subtitle, aspectRatio = 3/4, width, isVideo, onPress, onLongPress }: Props) {
  const colors = useColors();
  const height = width / aspectRatio;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        { width, height, borderRadius: 16, overflow: 'hidden' },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}
    >
      {/* Thumbnail */}
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(6,13,14,0.92)']}
        locations={[0.45, 1]}
        style={[StyleSheet.absoluteFill]}
      />

      {/* Video play icon */}
      {isVideo && (
        <View style={styles.playIcon}>
          <Ionicons name="play" size={22} color="white" />
        </View>
      )}

      {/* Title block (glass pill) */}
      <BlurView intensity={40} tint="dark" style={styles.titleBlock}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,13,14,0.4)' }]} />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>
        )}
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  playIcon: {
    position: 'absolute', top: '50%', left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  titleBlock: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    borderRadius: 10, padding: 8, overflow: 'hidden',
  },
  title: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 14 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
});
```

### 13.2 SectionHeader

```tsx
// components/media/SectionHeader.tsx
export function SectionHeader({ title, onSeeAll }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.text, fontFamily: 'BebasNeue_400Regular' }]}>
        {title}
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={[styles.seeAll, { color: colors.accent, fontFamily: 'Inter_600SemiBold' }]}>
            See all →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  title: { fontSize: 32, lineHeight: 32 },
  seeAll: { fontSize: 13 },
});
```

### 13.3 HeroReel

```tsx
// components/media/HeroReel.tsx
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

export function HeroReel({ reel }) {
  const { width: screenWidth } = useWindowDimensions();
  const height = Math.min(screenWidth * (9/16), screenWidth * 0.55);
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const colors = useColors();

  useFocusEffect(useCallback(() => {
    videoRef.current?.playAsync();
    return () => videoRef.current?.pauseAsync();
  }, []));

  return (
    <Pressable onPress={() => openViewer(reel)} style={{ width: screenWidth, height }}>
      <Video
        ref={videoRef}
        source={{ uri: reel.videoUri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted={muted}
        shouldPlay
      />

      {/* Dark gradient at bottom */}
      <LinearGradient
        colors={['transparent', '#060D0E']}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* FEATURED badge — top left */}
      <View style={[styles.featuredBadge, { backgroundColor: colors.accent }]}>
        <Text style={[styles.badgeText, { color: colors.accentText }]}>FEATURED</Text>
      </View>

      {/* Mute toggle — top right */}
      <Pressable style={styles.muteBtn} onPress={() => setMuted(m => !m)}>
        <BlurView intensity={50} tint="dark" style={styles.muteBlur}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="white" />
        </BlurView>
      </Pressable>

      {/* Event name pill — bottom left */}
      <BlurView intensity={45} tint="dark" style={styles.eventPill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,13,14,0.5)' }]} />
        <Ionicons name="play" size={14} color="white" style={{ marginRight: 6 }} />
        <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
          {reel.eventName}
        </Text>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featuredBadge: { position: 'absolute', top: 12, left: 12,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.5 },
  muteBtn: { position: 'absolute', top: 12, right: 12 },
  muteBlur: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  eventPill: { position: 'absolute', bottom: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  eventName: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 15 },
});
```

### 13.4 Community Masonry Grid

```tsx
// components/media/CommunityMasonry.tsx
// 2-column masonry using two FlatLists side by side

export function CommunityMasonry({ items }) {
  const { width: screenWidth } = useWindowDimensions();
  const colWidth = (screenWidth - 16 * 2 - 8) / 2;

  // Split items into two columns, balancing height
  const [leftCol, rightCol] = useMemo(() => splitMasonry(items, colWidth), [items]);

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flex: 1, gap: 8 }}>
        {leftCol.map(item => (
          <MasonryItem key={item.id} item={item} width={colWidth} />
        ))}
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        {rightCol.map(item => (
          <MasonryItem key={item.id} item={item} width={colWidth} />
        ))}
      </View>
    </View>
  );
}

function splitMasonry(items, colWidth) {
  const left = [], right = [];
  let leftH = 0, rightH = 0;
  for (const item of items) {
    const h = clamp((item.height / item.width) * colWidth, 120, 280);
    if (leftH <= rightH) { left.push({ ...item, renderHeight: h }); leftH += h + 8; }
    else { right.push({ ...item, renderHeight: h }); rightH += h + 8; }
  }
  return [left, right];
}
```

---

## 14. Animation Spec

| Interaction | Spec |
|---|---|
| Page load — sections stagger in | Each section fades + translateY(20→0), 200ms delay between sections, 300ms each |
| Strip card press | `scale: 0.97, opacity: 0.9`, 120ms spring |
| Long-press overlay reveal | Glass overlay `translateY(100%→0)`, 200ms spring |
| Hero Reel swipe | Horizontal `translateX` gesture, snap to next reel, spring settle |
| Full-screen viewer open | Scale from thumbnail position to full screen, 280ms spring |
| Full-screen viewer dismiss | Reverse scale to origin, 240ms spring |
| Overlay fade in/out | `opacity 0→1`, 250ms ease |
| Section header count badge | Number rolls up (animated number) when data loads |
| Filter chip select | `scale: 1.05→1`, background color crossfade, 150ms |
| Memories card entrance | Subtle glow pulse on first view (once per session): `opacity 0.7→1→0.7`, 2s loop × 2 |

All `opacity` / `transform` animations: `useNativeDriver: true`.
Framer Motion equivalents apply on web.

---

## 15. Empty & Error States

| Location | Empty state | Error state |
|---|---|---|
| Hero Reel | Static featured image with overlay (if no video) | Hidden — page degrades gracefully |
| Highlights strip | Strip hidden entirely + no section header | Strip hidden |
| Event Albums strip | "No albums yet" text inline | Strip hidden |
| Memories card | "Start capturing your BGSC journey." placeholder | Hidden |
| Community grid | Large empty state: illustration + "No community media yet." | Retry button |
| Community grid (filtered) | "No media matches your filters." + [Clear filters] | Retry button |
| Sponsors strip | Strip hidden | Strip hidden |
| Album Detail | "This album has no media yet." | Retry + back arrow |

Empty illustration: pixel-art camera/film icon, warm coral tones, ~100dp.

---

## 16. Loading States

All loading uses **skeleton shimmer**, not spinners. Skeletons pulse opacity `0.3 ↔ 0.7` at 750ms.

| Section | Skeleton shape |
|---|---|
| Hero Reel | Full-width rect, height = `screenWidth * 9/16` |
| Highlights strip | 2× tall portrait rects (65% screenWidth × 3:4 height) side by side |
| Event Albums strip | 3× square rects (48% screenWidth) in a row |
| Memories card | Full-width rect, height = `screenWidth * 0.55` |
| Community masonry | 6 rects in 2-col staggered pattern with varied heights |
| Sponsors strip | 2× square rects |
| Album detail grid | 3×N square rects in uniform grid |
| Full-screen viewer | Centred loading indicator on black bg (only if high-res load is slow) |

---

## 17. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger (status bar) | Tap | Opens Side Drawer |
| Profile picture (status bar) | Tap (auth) | Opens Account Actions Popup |
| "Login" (status bar) | Tap (guest) | → `/login` |
| Search input | Type | Filters all sections by keyword |
| Category chip | Tap | Single-selects; collapses to filtered single-section view |
| Category chip (active) | Tap | Deselects; returns to full editorial layout |
| ⚙ Filter chip | Tap | Opens Advanced Filter Sheet |
| Hero Reel | Tap | Opens Full-Screen Viewer in video mode |
| Hero Reel | Swipe left/right | Cycles featured reels |
| Mute/Unmute button | Tap | Toggles hero reel audio |
| Highlight card | Tap | Opens Full-Screen Viewer (video) |
| Highlight card | Long-press | Share · Download · Report sheet |
| "See all" (any section) | Tap | Switches to filtered single-section view |
| Event Album card | Tap | → Album Detail Screen |
| Event Album card | Long-press | Share Album · Download Album · Report |
| Memories card | Tap | → Memories viewer/slideshow |
| Community thumbnail | Tap | Opens Full-Screen Viewer |
| Community thumbnail | Long-press | Glass action overlay: Download · Share · Report |
| Sponsor card | Tap | → Sponsor gallery (future route) |
| Album Detail grid item | Tap | Opens Full-Screen Viewer |
| Album Detail grid item | Long-press | Download · Share · Report |
| Download (auth) | Tap | Saves to device camera roll |
| Download (guest) | Tap | Snackbar + redirect to /login |
| Share | Tap | Native share sheet with deep-link |
| Report | Tap (auth) | Opens Report Modal |
| Full-screen viewer body | Tap | Toggles overlay visibility |
| Full-screen viewer | Pinch | Zoom in/out |
| Full-screen viewer | Swipe left/right | Navigate prev/next item |
| Full-screen viewer | Swipe down | Dismiss viewer |
| Filter Sheet — Apply | Tap | Applies filters, closes sheet |
| Filter Sheet — Reset all | Tap | Clears all filters, closes sheet |

---

## 18. Permission Logic

| Action | Guest | Authenticated (User+) | Notes |
|---|---|---|---|
| View public media | ✅ | ✅ | |
| View friends-only media | ❌ | ✅ (if connected) | Check friendship status |
| Download media | ❌ (redirect) | ✅ (if uploader permits) | Check `downloadable` flag |
| Share | ✅ | ✅ | Deep-link only |
| Report | ❌ (redirect) | ✅ | Requires auth |
| Add to Memories | ❌ | ✅ | |
| View own Memories | ❌ (hidden) | ✅ | |
| Upload (via Add Post) | ❌ | ✅ | Via Home Feed FAB |

---

## 19. File Structure to Create

```
mobile/src/
├── app/(drawer)/media.tsx                    ← screen root, editorial layout
├── app/(stack)/media/album/[id].tsx          ← album detail
├── app/(stack)/media/memories.tsx            ← memories viewer
│
├── components/media/
│   ├── GlassFilterBar.tsx                    ← sticky search + chips
│   ├── HeroReel.tsx                          ← auto-play hero video
│   ├── SectionHeader.tsx                     ← Bebas Neue title + "See all"
│   ├── GlassMediaCard.tsx                    ← base card for strips
│   ├── HorizontalStrip.tsx                   ← horizontal scroll wrapper
│   ├── MemoriesCard.tsx                      ← full-width memories feature
│   ├── CommunityMasonry.tsx                  ← 2-col staggered grid
│   ├── MasonryItem.tsx                       ← single community item
│   ├── FullScreenViewer.tsx                  ← full-screen image/video viewer
│   ├── FilteredGridView.tsx                  ← single-category filtered view
│   ├── AdvancedFilterSheet.tsx               ← filter bottom sheet
│   └── ActionContextSheet.tsx                ← long-press actions sheet
│
├── viewmodels/
│   ├── MediaFeedViewModel.ts                 ← editorial layout data
│   ├── AlbumDetailViewModel.ts               ← album + grid data
│   └── MediaViewerViewModel.ts               ← viewer state + navigation
│
└── core/repositories/
    └── MediaRepository.ts                    ← all media API calls
```

---

## 20. Implementation Checklist

### Phase A — Editorial Home Layout

- [ ] `media.tsx` screen root with vertical scroll
- [ ] `GlassFilterBar` — sticky, search input + category chips + filter button
- [ ] `HeroReel` — auto-play video, mute toggle, event pill, gradient overlay
- [ ] `SectionHeader` — Bebas Neue title + "See all →" link
- [ ] `HorizontalStrip` — generic horizontal scroll wrapper for strip sections
- [ ] `GlassMediaCard` — base card with gradient overlay, play icon, title block
- [ ] Highlights strip (video cards, 65% screen width, 3:4 ratio)
- [ ] Event Albums strip (square cards, 48% screen width)
- [ ] Memories card (auth-only, full-width, mosaic bg, accent border)
- [ ] Community masonry (2-col staggered, varied heights, no chrome at rest)
- [ ] Sponsors strip (same as albums)

### Phase B — Category Filter View

- [ ] Category chip tap → collapses to single-section filtered view
- [ ] `FilteredGridView` — masonry or grid depending on category
- [ ] Animated transition from editorial layout to filtered view (fade)
- [ ] "Clear filter" back to editorial layout

### Phase C — Album Detail Screen

- [ ] `album/[id].tsx` stack screen
- [ ] Cover image header with gradient + Bebas Neue title
- [ ] 3-column square grid with video indicators
- [ ] Download Album (auth, with confirmation) + Share Album
- [ ] Empty / error states

### Phase D — Full-Screen Viewer

- [ ] `FullScreenViewer` modal/screen with black background
- [ ] Pinch-to-zoom + double-tap (images)
- [ ] Video auto-play with sound, scrubber bar
- [ ] Overlay fade in/out on tap
- [ ] Swipe left/right navigation
- [ ] Swipe down dismiss (gesture-based, image follows finger)
- [ ] Download · Share · Report actions
- [ ] "More ⋮" menu (Add to Memories, View profile, Copy link)

### Phase E — Filters & Actions

- [ ] `AdvancedFilterSheet` — all 5 filter controls
- [ ] Apply / Reset filter logic
- [ ] `ActionContextSheet` — long-press sheet for Download · Share · Report
- [ ] Report Modal (category + note + submit)

### Phase F — Polish

- [ ] Section stagger entrance animations
- [ ] Long-press overlay reveal animation on community items
- [ ] Memories card glow pulse (first view)
- [ ] Skeleton shimmer for all sections
- [ ] All empty states with pixel-art illustration
- [ ] All error states with retry
- [ ] Guest download/report → snackbar + redirect
- [ ] Accessibility: `accessibilityRole` + `accessibilityLabel` on all interactive elements
- [ ] Android BlurView fallback
- [ ] Screen focus/blur → play/pause hero reel
- [ ] Dark mode verification (primary)
- [ ] Light mode verification (override)
