# Media Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/media` (`src/app/(drawer)/media.tsx`)
**Visibility:** Mixed (Public for public media; Authenticated for friends-only media)

---

## 1. Page Structure Overview

The Media Page presents a highly visual, continuous masonry grid of images and videos. The layout dynamically adjusts based on the aspect ratio of the content.

```text
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│   Filter & Search Bar (Sticky)      │  ← pinned below status bar
├─────────────────────────────────────┤
│                                     │
│ ▼ MAIN SCROLL VIEW (Masonry Grid)   │
│                                     │
│  ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Album   │ │ Image   │ │ Video  │ │
│  │ Card    │ │ (Tall)  │ │ (Wide) │ │
│  └─────────┘ │         │ └────────┘ │
│  ┌─────────┐ └─────────┘ ┌────────┐ │
│  │ Memory  │ ┌─────────┐ │ Image  │ │
│  │ Card    │ │ Sponsor │ │ (Sq)   │ │
│  └─────────┘ └─────────┘ └────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar

Rendered by `components/dynamic-status-bar.tsx`. Behaviour mirrors the Home Page:
- Left: Hamburger icon (opens Side Drawer).
- Center: "Media" title or App Logo.
- Right (Guest): "Login" text button.
- Right (Auth): User profile picture (opens Account Actions).

---

## 3. Filter & Search Bar (Sticky)

### 3.1 Layout

```text
┌──────────────────────────────────────┐
│  🔍 Search media, tags, events...    │
│                                      │
│  [ Filter ⚙️ ]  [ All ] [ Albums ]   │
│  [ Community ] [ Memories ] [ ... ]  │
└──────────────────────────────────────┘
```

### 3.2 Components
- **Search Input:** Full-width text input to query specific media titles or tags.
- **Filter Button:** Opens a bottom sheet (see §8) for granular filtering (Date, Uploader, Type, Sponsor).
- **Quick Chips (Horizontal Scroll):** - Rapid toggle chips for core categories: All, Albums (Event Albums), Community (User Uploads), Memories ("Year in Review"), Sponsors.
  - Active chip is highlighted; "All" is default.

---

## 4. Main Media Gallery (Masonry Grid)

### 4.1 Layout
A 2-column or 3-column (depending on screen width) staggered masonry layout.

### 4.2 Content Types
The grid populates with distinct card types based on the content source:

- **Event Albums:** Represented by a cover image with an overlaid icon (e.g., stacked photos) and the event title. Tap opens an Album Detail View.
- **Community Uploads:** Individual photos or videos uploaded by users. 
- **Memories ("Year in Review"):** Special curated, auto-generated slideshows. Highlighted with a distinct border or gradient badge.
- **Sponsor Galleries:** Promoted visual content linked to active sponsors.

### 4.3 Gallery Item Card Behaviour
- **Visibility Logic:** - Guests see media marked 'Public'. 
  - Authenticated users see 'Public' media + media tagged 'Friends-Only' (if they are connected to the uploader).
- **Thumbnail Tap:** Opens the **Full-Screen Media Viewer** (see §9).
- **Long-Press:** Triggers a contextual bottom sheet with quick actions (Download, Share, Report).

---

## 5. Album Detail View (Sub-screen)

**Trigger:** Tapping an Event Album card.
**Navigation:** Pushes a new screen onto the stack (e.g., `/(drawer)/media/album/[id]`).

### 5.1 Layout
- **Header:** Album title, date, and description.
- **Grid:** A standard square grid (not masonry) of all items within the album.
- **Actions:** Global "Download Album" (if permissions allow) and "Share Album" buttons at the top.

---

## 6. Full-Screen Media Viewer

**Trigger:** Tapping an individual image or video in the masonry grid or an album.

### 6.1 Components & Behaviour
- **Dark Mode Background:** The viewer always forces a black background for maximum contrast.
- **Gestures:** - Pinch-to-zoom (images).
  - Swipe left/right to navigate to the next/previous item in the current grid context.
  - Swipe down to dismiss the viewer.
- **Overlays (Fade out on tap):**
  - Top Left: Back arrow (Dismiss).
  - Bottom Left: Uploader info and caption/tags.
  - Bottom Right Action Row: 
    - **[Download ⬇️]:** Saves to device camera roll (Auth only, if permitted by uploader).
    - **[Share ↗️]:** Opens native share sheet.
    - **[Report 🚩]:** Opens report modal (Auth only).

---

## 7. Advanced Filter Sheet

**Trigger:** Tapping the [ Filter ⚙️ ] button in the sticky header.
**Appearance:** Bottom sheet.

### 7.1 Controls
- **Date Range:** "From" and "To" date pickers.
- **Uploader:** Search/select specific users.
- **Media Type:** Checkboxes for Image, Video, GIF.
- **Sponsor Tags:** Dropdown to filter by media associated with specific sponsors.
- **Apply / Reset Buttons:** Fixed at the bottom of the sheet.

---

## 8. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Search Bar | Type & Submit | Filters masonry grid by keyword/tag. |
| Quick Chip | Tap | Filters grid by primary category (Albums, Community, etc.). |
| Filter Button | Tap | Opens Advanced Filter Sheet. |
| Event Album Card | Tap | Navigates to Album Detail View. |
| Image/Video Thumbnail| Tap | Opens Full-Screen Media Viewer. |
| Media Thumbnail | Long-Press | Opens contextual actions (Download, Share, Report). |
| Media Viewer | Pinch | Zooms in/out of image. |
| Media Viewer | Swipe Left/Right | Navigates to next/previous media item. |
| Media Viewer | Swipe Down | Dismisses viewer and returns to grid. |
| Download Button | Tap (Auth) | Saves media to device (if permitted). |
| Download Button | Tap (Guest)| Redirects to `Login screen` via snackbar prompt. |
| Share Button | Tap | Opens OS native share sheet with deep link. |
| Report Button | Tap (Auth) | Opens Report Modal. |

---

## 9. Empty & Error States

| Location | Empty | Error |
|---|---|---|
| Main Gallery (No filters) | Illustration + "No media uploaded yet." | Retry button inline |
| Main Gallery (Filtered) | "No media found matching your filters." + [Clear Filters] CTA | Retry button inline |
| Album Detail View | "This album is currently empty." | Retry button |

---

## 10. Loading States

- **Initial Load:** A staggered masonry layout of shimmer blocks (skeletons) to mimic the expected varied heights of images.
- **Pagination (Infinite Scroll):** A standard circular loading spinner appears at the bottom of the scroll view when fetching the next batch of media.
- **Full-Screen Viewer:** A subtle, centered loading indicator if a high-resolution asset takes time to load over the network.
