# Store Page — UI/UX Specification

**Platform:** Mobile (React Native / Expo)
**Route:** `/(drawer)/store` (`src/app/(drawer)/store.tsx`)
**Visibility:** Mixed (Public sections & Authenticated-only sections)

---

## 1. Page Structure Overview

The page is a vertically scrolling dashboard. Sections stack below each other like visible cards. Authenticated-only sections hide gracefully for Guest users.

```text
┌─────────────────────────────────────┐
│         Dynamic Status Bar          │  ← fixed top, full width
├─────────────────────────────────────┤
│                                     │
│ ▼ MAIN SCROLL VIEW (Vertical)       │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Merchandise Store (Auth)   │  │
│  │  • Item Cards & Stock Status  │  │
│  │  • Cart & Checkout            │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Indie Game Showcase (Pub)  │  │
│  │  • Game Trailers              │  │
│  │  • Downloads & Points Cost    │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Friendly Games Jam (Auth)  │  │
│  │  • Pitch Board                │  │
│  │  • Upvotes & Comments         │  │
│  ╰───────────────────────────────╯  │
│                                     │
│  ╭───────────────────────────────╮  │
│  │    Friendly Gaming (Auth)     │  │
│  │  • Discord/Steam Integration  │  │
│  │  • Voice Overlay (Future)     │  │
│  ╰───────────────────────────────╯  │
│                                     │
└─────────────────────────────────────┘
```

---

## 2. Merchandise Store

**Visibility:** Authenticated Users Only.

### 2.1 Layout

```text
┌──────────────────────────────────────┐
│  Merchandise Store          [🛒 2]   │
│  [ Track My Orders 📦 ]              │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ [Item Image] │  │ [Item Image] │  │
│  │ T-Shirt      │  │ Coffee Mug   │  │
│  │ 🪙 500 Pts   │  │ 🪙 250 Pts   │  │
│  │ 🟢 In Stock  │  │ 🔴 Sold Out  │  │
│  │ [Add to Cart]│  │ [Out of Stock│  │
│  └──────────────┘  └──────────────┘  │
│                                      │
│  [ Scrollable List -> & downwards]   │
└──────────────────────────────────────┘
```

### 2.2 Components & Behaviour
- **Store Header:** Contains a Cart icon indicating the number of items currently selected, and a secondary text button to "Track My Orders".
- **Item Cards (Grid):** A 2-column grid displaying available merchandise.
  - **Details:** Item image, title, cost in Points, and a visual stock status indicator (e.g., Green for In Stock, Yellow for Low Stock, Red for Sold Out).
  - **Action:** "Add to Cart" button. If out of stock, the button is disabled.
- **Cart & Checkout (Modal/Sheet):** Tapping the Cart icon opens a bottom sheet detailing selected items, total points cost, and a "Confirm Checkout" CTA.
- **Order Tracking:** Navigates to a sub-screen showing order history and fulfillment status.

---

## 3. Indie Game Showcase

**Visibility:** Public.

### 3.1 Layout

```text
┌──────────────────────────────────────┐
│  Indie Game Showcase                 │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ▶️ [ Game Trailer Video ]       │  │
│  │                                │  │
│  │ Cosmic Drift by @dev_team      │  │
│  │ 🪙 Cost: 1,000 Pts             │  │
│  │                                │  │
│  │ [ Download Now ↓ ]             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 3.2 Components & Behaviour
- **Game Cards (Vertical List or Carousel):** Large, high-impact cards focusing on media.
- **Game Trailers:** Inline video player or a thumbnail that opens a full-screen video player upon tap.
- **Details:** Game title, developer credit, and the points cost required to unlock or download.
- **Download Link:** A primary CTA button. If the user is a Guest, tapping prompts a login redirect. If authenticated but lacks points, shows an "Insufficient Points" snackbar.

---

## 4. Friendly Games Jam

**Visibility:** Authenticated Users Only.

### 4.1 Layout

```text
┌──────────────────────────────────────┐
│  Friendly Games Jam                  │
│  [ + Pitch an Idea ]                 │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ "VR Campus Tour"               │  │
│  │ by @student_dev                │  │
│  │                                │  │
│  │ A multiplayer VR experience... │  │
│  │                                │  │
│  │ [⬆️ 124 Upvotes]  [💬 12]     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 4.2 Components & Behaviour
- **Pitch Board:** A vertical feed of user-submitted game ideas or project pitches.
- **Pitch Card:** Displays the pitch title, author, and a text preview of the idea.
- **Interaction Row:** 
  - **Upvote Button:** Toggles the user's vote. Highlights when active.
  - **Comment Button:** Tapping opens a Comment Sheet (similar to the standard Social Feed comment sheet) to discuss the pitch.
- **"Pitch an Idea" CTA:** Opens a modal to submit a new pitch (Title and Description text inputs).

---

## 5. Friendly Gaming

**Visibility:** Authenticated Users Only.

### 5.1 Layout

```text
┌──────────────────────────────────────┐
│  Friendly Gaming                     │
│                                      │
│  Link your accounts to coordinate:   │
│                                      │
│  [🔗 Link Discord Account]           │
│  Status: Not Linked                  │
│                                      │
│  [🔗 Link Steam Account]             │
│  Status: ✅ Linked as @gamer123      │
│                                      │
│  *Voice Coordination Overlay*        │
│  [ 🔒 Coming Soon ]                  │
└──────────────────────────────────────┘
```

### 5.2 Components & Behaviour
- **Integration Buttons:** Wide, branded buttons to trigger OAuth flows for linking external gaming platforms (Discord, Steam).
- **Status Indicators:** Clear text below each integration showing the current link status and the connected username.
- **Voice Coordination Overlay (Future):** A placeholder card or disabled section indicating upcoming features. Can be styled with a "Coming Soon" badge.

---

## 6. Modals & Bottom Sheets

### 6.1 Cart & Checkout (Bottom Sheet)
**Trigger:** Tapping the Cart icon in the Merchandise Store header.
**Appearance:** Bottom sheet.
- **Details:** Displays the selected items and calculates the total points cost.
- **Action:** Contains a primary "Confirm Checkout" CTA button.

### 6.2 Pitch an Idea (Modal)
**Trigger:** Tapping the "+ Pitch an Idea" CTA in the Friendly Games Jam section.
**Appearance:** Modal overlay.
- **Inputs:** Contains text input fields for the pitch Title and Description.

### 6.3 Comment Sheet
**Trigger:** Tapping the Comment button on a Pitch Card.
**Appearance:** Bottom sheet showing the comments thread.
- **Behaviour:** Functions similarly to the standard Social Feed comment sheet, allowing users to discuss the pitch.

---

## 7. Interaction Summary Table

| Element | Gesture / Event | Outcome |
|---|---|---|
| Hamburger icon (status bar) | Tap | Opens Side Drawer. |
| Profile picture (status bar) | Tap (Auth) | Opens Account Actions Popup. |
| "Login" button (status bar) | Tap (Guest) | Navigates to `Login screen`. |
| "Add to Cart" Button | Tap (Auth) | Adds item to local cart state, updates Cart icon counter. |
| Cart Icon | Tap (Auth) | Opens Checkout bottom sheet. |
| Game Trailer Thumbnail | Tap | Plays video inline or opens full-screen player. |
| "Download Now" Button | Tap (Auth) | Initiates point deduction and provides download link. |
| "Download Now" Button | Tap (Guest) | Redirects to `Login screen`. |
| "Pitch an Idea" CTA | Tap (Auth) | Opens Pitch creation modal. |
| Upvote Button | Tap (Auth) | Toggles vote state on the pitch. |
| Comment Button | Tap (Auth) | Opens a Comment Sheet to discuss the pitch. |
| Link Discord/Steam | Tap (Auth) | Opens webview/browser for OAuth linking process. |

---

## 8. Empty, Error, & Auth States

| Location | Guest State | Empty State (Authenticated) | Error State |
|---|---|---|---|
| **Merchandise Store** | Hidden. | "Store is currently empty. Check back later!" | Retry button inline. |
| **Indie Game Showcase**| Visible. | "No games available right now." | Retry button inline. |
| **Friendly Games Jam** | Hidden. | "No pitches yet. Be the first to pitch an idea!" | Retry button inline. |
| **Friendly Gaming** | Hidden. | N/A (Integrations are static elements). | Retry button inline. |

---

## 9. Loading States

All data-driven sections use **skeleton screens** (shimmer placeholders matching the shape of live content) rather than spinners, to preserve layout stability. Skeletons appear for:

- **Merchandise Store:** 2-column grid of skeleton item cards mimicking the product images and text blocks.
- **Indie Game Showcase:** Large skeleton blocks mimicking game trailers and game details.
- **Friendly Games Jam:** Skeleton pitch cards in a vertical feed layout.