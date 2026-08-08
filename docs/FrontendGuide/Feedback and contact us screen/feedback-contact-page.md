# Feedback & Contact Us — UI/UX Specification

**Platform:** Mobile (React Native / Expo)  
**Route:** `/(drawer)/feedback` (`src/app/(drawer)/feedback.tsx`)  
**Visibility:** Public (Accessible to both Guest and Authenticated users)  
**Developer Assignee:** `[satyam]`  
**Source:** Complete Feature Specification & Architecture §5.12; Screen Inventory "Feedback & Contact Us"  
**Design Tokens Reference:** `design-system.md`  

---

## 1. Page Structure & Master Viewport Architecture

The **Feedback & Contact Us** mobile screen implements a **Segmented View-Swapping Architecture (Approach B)** with **60fps Directional Screen Sliding Animations**. A top fixed Dynamic Status Bar and sticky segmented navigation bar allow users to seamlessly toggle between three unified in-line screen views:

```text
┌────────────────────────────────────────────────────────┐
│ [☰]                 [ BGSC LOGO ]            [Profile] │ ← Fixed Dynamic Status Bar
├────────────────────────────────────────────────────────┤
│     SEGMENTED TABS: [ Submit Ticket | FAQ | Directory ] │ ← Sticky Segmented Bar
├────────────────────────────────────────────────────────┤
│ ▼ ACTIVE TAB VIEW (Wrapped in KeyboardAvoidingView)    │
│                                                        │
│  [Tab 0: Submit Feedback Ticket Screen]                │
│   • In-line Feedback & Bug Reporting Form              │
│   • Category Dropdown, Segmented Severity Buttons      │
│   • Description Textarea (45/2000), '+' Media Upload   │
│   • Anonymous Switch, Contact Email & Submit CTA       │
│                                                        │
│  [Tab 1: FAQ Knowledge Base]                           │
│   • Search Bar ('Search frequently asked questions...')│
│   • 7 Collapsible Category Accordions                  │
│   • Nested Question Cards with Markdown Answers        │
│   • Empty Search Fallback with Ticket CTA              │
│                                                        │
│  [Tab 2: Contact Directory]                            │
│   • Active Coordinators List                           │
│   • WhatsApp SVG + Blurred Phone Row                   │
│   • 3 Quick Actions: [Email], [Copy], [Report Issue]   │
│   • Hall of Admin (Read-Only Legacy Leaders Accordion) │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 2. Dynamic Status Bar & Segmented Tab Navigation

### 2.1 Fixed Dynamic Status Bar
- **Component**: Rendered by `mobile/src/components/dynamic-status-bar.tsx`.
- **Positioning**: Fixed at the top of the screen viewport (`headerShown: true` / `position: 'fixed'`, `zIndex: 100`).
- **Slots**:
  - **Left Slot**: Standard Drawer Hamburger trigger **`☰`** (three horizontal bars) rendered in `#051F20` / `#235347` (`fontSize: 24`, `width: 32`) → Opens navigation drawer.
  - **Center Slot**: BGSC / Community Emblem (Height: 28pt).
  - **Right Slot**: Guest mode renders `"Login"` pill; Authenticated mode renders 36pt circular user profile avatar.

### 2.2 Sticky Segmented Navigation Bar & Sliding Transitions
- **Positioning**: Sticky directly below the status bar (`zIndex: 90`).
- **Container Styling**: `backgroundColor: rgba(142, 182, 155, 0.2)` with 1 dp `#8EB69B` solid border, `borderRadius: 24`, `padding: 4`, `marginHorizontal: 16`, `marginVertical: 12`.
- **Tabs (Clean Text-Only)**:
  - `Index 0`: **Submit Ticket**
  - `Index 1`: **FAQ**
  - `Index 2`: **Directory**
- **Interaction & Feedback**:
  - Tapping fires `Haptics.selectionAsync()`.
  - Active sliding pill indicator (`backgroundColor: '#235347'`, `borderRadius: 20`, `height: 36`) glides smoothly behind the active tab via `react-native-reanimated` spring physics (`damping: 18, stiffness: 150`).
  - Active tab text renders in `Mograph-Medium` (`#DAF1DE`), while inactive tabs render in `Mograph-Medium` (`#163B32`).
- **Directional Screen Slide Animation**:
  - Tapping a tab or swiping triggers a 60fps horizontal slide of the main viewport:
    - **Moving Forward (e.g. Tab 0 → Tab 1)**: Incoming tab enters from `+SCREEN_WIDTH` to `0`, while previous tab exits to `-SCREEN_WIDTH`.
    - **Moving Backward (e.g. Tab 2 → Tab 1)**: Incoming tab enters from `-SCREEN_WIDTH` to `0`, while previous tab exits to `+SCREEN_WIDTH`.
    - Driven by `Animated.timing` (`duration: 220ms`, `useNativeDriver: true`) or `react-native-reanimated`.

---

## 3. Tab 0: Submit Feedback Ticket (In-Line Screen View)

### 3.1 In-Line Screen Wireframe
Selecting the **`[ Submit Ticket ]`** tab displays the feedback submission form directly in the viewport:

```text
┌────────────────────────────────────────────────────────┐
│  FEEDBACK & BUG REPORTING                              │
│  "Report bugs, suggest features, or reach out."        │
│                                                        │
│  Category:   [ Bug Report                           ▼ ]│ ← Dropdown selector
│                                                        │
│  SEVERITY LEVEL *                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [ Low ]      [ Med ]      [ High ]      [ Crit ] │  │ ← Clean segmented pills
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  DESCRIPTION *                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Describe what happened in detail...              │  │
│  │                                                  │  │
│  │                                        (45/2000) │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ATTACHMENTS (Max 5MB each, up to 3 files):            │
│  ┌──────────┐  ┌──────────┐                            │
│  │          │  │thumb1.png│                            │
│  │    +     │  │  1.2 MB  │                            │ ← Perfectly centered vector '+' cross
│  │          │  │   [x]    │                            │
│  └──────────┘  └──────────┘                            │
│                                                        │
│  ANONYMOUS SUBMISSION                                  │
│  [X] Submit Anonymously                                │
│                                                        │
│  CONTACT EMAIL (Required for Guests):                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ student@goa.bits-pilani.ac.in                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                 [ Submit Ticket ]                │  │ ← Full-width Primary CTA
│  └──────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

### 3.2 Form Fields Specification Table

| Field Name | Component Type | Options / Rules | Default / Notes |
|---|---|---|---|
| **Category** | Inline Label + Dropdown Selector | `Bug Report`, `Feature Request`, `Event Complaint`, `General` | Label `"Category: "` in `Mograph-Medium` (`#051F20`). Dropdown trigger pill on right (`borderRadius: 20`, `height: 36`, `borderWidth: 1`, `borderColor: '#8EB69B'`). Tapping opens picker sheet. Default: `Bug Report`. |
| **Severity Level** | Segmented pill button group | `Low`, `Medium`, `High`, `Critical` (Rendered cleanly without parentheses: `[ Low ]  [ Med ]  [ High ]  [ Crit ]`) | Default: `Low`. Custom tinted badge fills: Low (`#DAF1DE` / `#235347`), Medium (`#FEF3C7` / `#92400E`), High (`#FFEDD5` / `#C2410C`), Critical (`#FEE2E2` / `#991B1B`). Inactive buttons have 1 dp `#8EB69B` border. |
| **Description** | Multi-line rich text editor / textarea | Min 10 characters, Max 2,000 characters. Live character counter positioned bottom-right. | Default: Empty. Background: `#FFFFFF`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `borderRadius: 8`, Focus: 2 dp `#235347`. Live counter in `#163B32` (turns `#991B1B` at max). |
| **Attachments** | Upload tile with centered vector `+` icon + thumbnail grid | Up to 3 files (PNG, JPG, WEBP, PDF). Max 5MB per file. | Displays 72×72pt square rounded tile (`borderRadius: 8`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `backgroundColor: rgba(142, 182, 155, 0.2)`, `alignItems: 'center'`, `justifyContent: 'center'`). Uses symmetric vector SVG plus cross (`size: 28`, `strokeWidth: 2.5`, `color: '#235347'`) for 100% optical and geometric centering (no font baseline drift). Thumbnails show file size badge and top-right `[x]` delete trigger. |
| **Anonymous Submission** | Switch toggle | Boolean (`true` / `false`) | Default: `Off` for logged-in users. When `On`, strips `userId` from request payload. Auto-enforced to `true` for Guest users. Track: `#8EB69B`, Thumb: `#235347`. |
| **Contact Email** | Single-line text input | Standard email regex validation (`^.+@.+\..+$`). | Visible & required for Guest users; hidden for logged-in users unless submitting anonymously. Background: `#FFFFFF`, `borderColor: '#8EB69B'`. |
| **Submit Button** | Full-width Primary Action Button | Tap action: Validates & dispatches payload. | Full-width button (`borderRadius: 8`, `height: 48`, `backgroundColor: '#235347'`, `color: '#DAF1DE'`, `elevation: 0`, `marginTop: 16`). Disabled when empty or description < 10 characters. |

---

### 3.3 Submission Confirmation & Status Pipeline
1. **Submission States**:
   - Disabled while description < 10 characters or during active file uploads.
   - Shows inline animated `ActivityIndicator` with label *"Submitting Ticket..."* on tap.
2. **In-Line Confirmation View**:
   - Upon successful submission, the form transitions in-place to an inline confirmation card displaying the checkmark emblem, auto-generated Ticket ID (e.g. `#TICK-84920`) with one-tap clipboard copy, and a `[ Submit Another Ticket ]` button to reset the form.
3. **Status Tracking Pipeline**:
   ```text
   Submitted -> Under Review -> Resolved -> Closed
   ```

---

### 3.4 Ticket System States Matrix

| State / Scenario | Trigger Condition | Visual & Functional Behavior |
|---|---|---|
| **Guest State** | User not logged in | • Anonymous Mode is auto-enforced (`isAnonymous = true`).<br>• Renders required **Contact Email** input field in the in-line form.<br>• Generates and emails `#TICK-84920` ID to provided email. |
| **Authenticated State** | User logged in | • Auto-attaches user profile.<br>• Anonymous toggle is selectable (`Default: Off`).<br>• Contact email field is hidden.<br>• Generates confirmation with `#TICK-84920` ID. |
| **Upload Error** | Attachment > 5MB | • Rejected before network upload.<br>• Inline error banner: *"File exceeds 5MB limit."* |
| **Network Error** | API failure / offline | • Form preserves all typed text and attachments.<br>• Toast / Banner: *"Unable to submit ticket. Please check connection."*<br>• Submit button displays *"Retry Submission"*. |
| **Rate Limit Exceeded** | >3 tickets submitted in 1h | • HTTP 429 received.<br>• Banner: *"Submission limit reached (3 tickets/hr). Please wait [MM:SS] before trying again."* |

---

## 4. Tab 1: FAQ Accordion Section

### 4.1 Component Layout & ASCII Wireframe

```text
┌────────────────────────────────────────────────────────┐
│  FREQUENTLY ASKED QUESTIONS                            │
│  "Search and explore answers across platform topics."  │
│                                                        │
│  SEARCH BAR:                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Search frequently asked questions...         [x] │  │ ← Real-time search + clear
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  MOTION FAQ ACCORDION CONTAINER (rounded-[34px], p-3): │
│  ╭──────────────────────────────────────────────────╮  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Points & Rewards (4 FAQs)       [−] │ │  │ ← Expanded Category (Scale: 1.0, Rotated 180°)
│  │ │ ──────────────────────────────────────────── │ │  │
│  │ │  ╭─────────────────────────────────────────╮ │ │  │
│  │ │  │ [button] Q: How are points awarded? [−] │ │ │  │ ← Expanded Question Card
│  │ │  │ ─────────────────────────────────────── │ │ │  │
│  │ │  │ [panel] (overflow: hidden, y: 0)        │ │ │  │
│  │ │  │ Points are credited directly to your    │ │ │  │
│  │ │  │ wallet within 2 hours of admin score    │ │ │  │
│  │ │  │ verification.                           │ │ │  │
│  │ │  ╰─────────────────────────────────────────╯ │ │  │
│  │ │  ╭─────────────────────────────────────────╮ │ │  │
│  │ │  │ [button] Q: What is the LE bonus?   [+] │ │ │  │ ← Collapsed Question (Scale: 0.985)
│  │ │  ╰─────────────────────────────────────────╯ │ │  │
│  │ ╰──────────────────────────────────────────────╯ │  │
│  │                                                  │  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Events & Tournaments (6 FAQs)   [+] │ │  │ ← Collapsed Category (Scale: 0.985)
│  │ ╰──────────────────────────────────────────────╯ │  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Account & Security (3 FAQs)     [+] │ │  │ ← Collapsed Category
│  │ ╰──────────────────────────────────────────────╯ │  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Student Union (5 FAQs)          [+] │ │  │ ← Collapsed Category
│  │ ╰──────────────────────────────────────────────╯ │  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Technical & Performance (4 FAQs)[+] │ │  │ ← Collapsed Category
│  │ ╰──────────────────────────────────────────────╯ │  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Privacy & Anonymity (2 FAQs)    [+] │ │  │ ← Collapsed Category
│  │ ╰──────────────────────────────────────────────╯ │  │
│  │ ╭──────────────────────────────────────────────╮ │  │
│  │ │ [button] Sponsors & Perks (3 FAQs)       [+] │ │  │ ← Collapsed Category
│  │ ╰──────────────────────────────────────────────╯ │  │
│  ╰──────────────────────────────────────────────────╯  │
└────────────────────────────────────────────────────────┘
```

### 4.2 Search Bar & Real-Time Filtering
- **Placeholder**: `'Search frequently asked questions...'`
- **Styling**: `height: 48`, `borderRadius: 24`, `backgroundColor: '#FFFFFF'`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `paddingHorizontal: 16`, `color: '#0B2B25'`.
- **Real-Time Keyword Search**: Typing automatically filters questions and answers across all 7 categories in real time; matching category accordions and question cards automatically expand (`isExpanded = true`) with matching terms highlighted in `#235347` bold.
- **Clear Action (`[x]`)**: Pinned on right side when query > 0; tapping immediately clears search, restores all categories, and collapses cards back to default.

### 4.3 7 Accordion Categories & Motion Accordion Mechanics

1. **7 Official Categories**:
   - `Account`: Login, 2FA, password resets, profile settings.
   - `Events`: Tournament registration, bracket formats, schedules.
   - `Points`: Points calculation, reward redemption, leaderboard rankings.
   - `Union`: Student union initiatives, elections, council voting.
   - `Technical`: App performance, crashes, offline cache, notifications.
   - `Privacy`: Anonymous feedback handling, data collection, profile privacy.
   - `Sponsors`: Sponsor challenges, partner discounts, coupon redemption.

2. **Multi-Layered Spring Animation Physics (Derived from `motion-faqs-accordion.tsx`)**:

   | Layer / Element | Animation Property | Closed / Collapsed | Open / Expanded | Physics / Timing Spec |
   |---|---|---|---|---|
   | **1. Item Card Scale** | `scale` (Breathing) | `0.985` | `1.0` | **Spring**: `stiffness: 280`, `damping: 28`, `mass: 0.9` (`originX: 0.5, originY: 0`) |
   | **2. Toggle Icon Morph** | `rotate` & `scale` | `rotate: 0deg`, `scale: 1.0` (Plus `+` SVG) | `rotate: 180deg`, `scale: 1.05` (Minus `−` SVG) | **Spring**: `stiffness: 480`, `damping: 28` |
   | **3. Content Panel Height** | `height` | `0` | `contentHeight` (Measured via `ResizeObserver` / `onLayout`) | **Spring**: `stiffness: 340`, `damping: 34`, `mass: 0.9` with `style={{ overflow: "hidden" }}` |
   | **4. Content Opacity** | `opacity` | `0.0` | `1.0` | **Timing**: `duration: 0.2s`, `easing: "easeOut"` |
   | **5. Inner Text Slide** | `translateY` (`y`) | `-8px` | `0px` | **Spring**: `stiffness: 360`, `damping: 30`, `mass: 0.8` |

3. **SVG Toggle Icon Vector Paths**:
   - **Collapsed / Plus (`+`)**: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>`
   - **Expanded / Minus (`−`)**: `<svg width="14" height="14" viewBox="0 0 14 2" fill="none"><path d="M1 1h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>`

4. **Accessible Deterministic ID Structure & ARIA Semantics**:
   - **Base ID**: Generated uniquely per accordion container: `const baseId = 'accordion-' + rawId.replace(/:/g, "")`.
   - **Trigger Button**: `id={`${baseId}-trigger-${i}`}`, `aria-controls={`${baseId}-panel-${i}`}`, `aria-expanded={isOpen}` (React Native: `accessibilityRole="button"`, `accessibilityState={{ expanded: isOpen }}`).
   - **Expandable Region**: `id={`${baseId}-panel-${i}`}`, `role="region"`, `aria-labelledby={`${baseId}-trigger-${i}`}`, `style={{ overflow: "hidden" }}`.

5. **Mutually Exclusive Single-Expand State Management**:
   ```typescript
   // Categories single-expand toggle
   const toggleCategory = (i: number) => setOpenCategoryIndex((prev) => (prev === i ? null : i));

   // Questions within category single-expand toggle
   const toggleQuestion = (qIndex: number) => setOpenQuestionIndex((prev) => (prev === qIndex ? null : qIndex));
   ```

6. **Layout & Scroll Rule**:
   - The outer accordion container uses `borderRadius: 34`, `padding: 12`, `gap: 10`.
   - Each accordion card uses `borderRadius: 30`, `backgroundColor: '#FFFFFF'`, `overflow: 'hidden'`, `borderWidth: 1`, `borderColor: '#8EB69B'`.
   - Accordions expand dynamically **in-line** within the tab's `ScrollView`. Nested `ScrollView` or `FlatList` containers are strictly prohibited.

### 4.4 FAQ States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | Skeleton shimmer search bar + 3 skeleton category accordion cards. | Animated linear shimmer while fetching FAQ data from cache or API. |
| **Empty Search State**| Message: *"No matching FAQs found — try submitting a ticket."* | Displays button: `[ Submit Ticket ]`. Tapping switches directly to Tab 0 with the search query pre-filled as the description. |
| **Error State** | Text: *"Unable to load FAQs."* | Displays inline `[ Retry ]` button. Automatically falls back to cached local storage. |

---

## 5. Tab 2: Contact Directory

### 5.1 Single Coordinator Contact Card Wireframe

```text
┌────────────────────────────────────────────────────────┐
│ ╭────────────────────────────────────────────────────╮ │
│ │ ┌──────────┐  Rahul Mehta                          │ │
│ │ │  Avatar  │  BGSC Coordinator · 2025–2026         │ │
│ │ │  (48 dp) │  rahul.mehta@bgsc.in                  │ │
│ │ └──────────┘                                       │ │
│ │                                                    │ │
│ │  WHATSAPP & PHONE NUMBER ROW:                      │ │
│ │  ┌────────┐ ┌────────────────────────────────────┐ │ │
│ │  │  [✆]   │ │ [ ░░░░░░░░░░░░░░ ] (Tap to Unblur) │ │ │ ← WhatsApp SVG on left, Blurred Phone on right
│ │  └────────┘ └────────────────────────────────────┘ │ │
│ │                                                    │ │
│ │  CONTACT ACTION ROW:                               │ │
│ │  ┌─────────────┐ ┌───────────────────┐ ┌─────────┐ │ │
│ │  │   [ Email ] │ │     [ Copy ]      │ │ [Issue] │ │ │ ← 3 Quick Action Buttons
│ │  └─────────────┘ └───────────────────┘ └─────────┘ │ │
│ ╰────────────────────────────────────────────────────╯ │
└────────────────────────────────────────────────────────┘
```

### 5.2 Current Coordinators Section & Mechanics
- **Container**: Card in `#FFFFFF`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `borderRadius: 8`, `padding: 16`, `marginBottom: 12`.
- **48dp Circular Avatar**: Profile image with fallback initials avatar (`backgroundColor: rgba(142, 182, 155, 0.2)`).
- **Name & Role**: Name in `Mograph-Medium` (`#051F20`, 16sp), Role in System Regular (`#163B32`, 13sp), Email in `#163B32` (13sp).
- **Dedicated WhatsApp & Blurred Phone Row**:
  - **Left (WhatsApp SVG Button `[✆]`)**: `width: 36`, `height: 36`, `borderRadius: 6`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `backgroundColor: 'transparent'`. Renders the custom SVG logo asset from [`screens/assets/svg logos/whatsapp-logo-variant.svg`](file:///C:/Users/SAT/Desktop/BGSC/New/BGSC-platform/screens/assets/svg%20logos/whatsapp-logo-variant.svg) (icon size: 20×20, no text label). Tapping triggers light haptics, unblurs the phone number, and opens WhatsApp chat directly via `https://wa.me/<number>`.
  - **Right (Blurred Phone Container)**: `height: 36`, `borderRadius: 6`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `flex: 1`, `paddingHorizontal: 12`, `justifyContent: 'center'`. Protected by default with a native frosted glass blur overlay using `BlurView` (`intensity: 20`, `borderRadius: 6`, `tint="light"`) or `filter: 'blur(6px)'`. Tapping triggers light haptics (`Haptics.impactAsync(Light)`), smoothly animates blur opacity to `0`, and reveals the unmasked number (`+91 98765 43210`).
- **Bottom 3-Action Button Row**:
  1. **Email (`[ Email ]`)**: `borderRadius: 6`, `height: 36`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `flex: 1`. Opens system mail client pre-addressed to that coordinator (`mailto:`).
  2. **Copy Contact (`[ Copy ]`)**: `borderRadius: 6`, `height: 36`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `flex: 1`. Copies contact details to clipboard with snackbar confirmation (*"Contact details copied"*).
  3. **Report Issue (`[ Report Issue ]`)**: `borderRadius: 6`, `height: 36`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `flex: 1`. Switches directly to Tab 0 and pre-assigns this coordinator in the description.

### 5.3 Past Coordinators — "Hall of Admin"
- **Component**: Expandable accordion positioned at the bottom of the directory (`backgroundColor: rgba(218, 241, 222, 0.5)`, `borderWidth: 1`, `borderColor: '#8EB69B'`, `borderRadius: 8`). Default: Collapsed.
- **Card Content**: 40dp circular portrait, Name in `Mograph-Medium`, Former Role, Tenure Period (`2024–2025`), and a memorable legacy quote.
- **Read-Only**: Non-interactive archive without contact buttons.

### 5.4 Directory States Matrix

| State / Scenario | Visual Presentation | Functional Behavior |
|---|---|---|
| **Loading State** | 3 Skeleton shimmer cards with pulsating 48dp circle and 3 button outlines. | Uses linear shimmer animation while loading roster. |
| **Empty State** | Centered text: *"No active coordinators listed for this term."* | Displays CTA to switch to Tab 0 to submit a general support ticket. |
| **Guest Mode** | Identical visual directory list to authenticated users. | All contact links work identically. |
| **Offline Cache** | Loads cached coordinator roster from `AsyncStorage`. | Displays subtle offline indicator: *"Showing cached directory"*. |

---

## 6. Scrolling, Gestures & Viewport Behavior Rules

1. **Header Pinning**: Dynamic Status Bar and Segmented Tab Bar remain fixed and sticky at the top (`position: 'fixed'` / `headerShown: true`, `zIndex: 100`).
2. **Main Scroll Container**: Each of the 3 active tab views is wrapped in a `KeyboardAvoidingView` (`behavior: Platform.OS === 'ios' ? 'padding' : 'height'`) containing a single vertical `ScrollView` (`showsVerticalScrollIndicator={false}`, `keyboardShouldPersistTaps="handled"`).
3. **Directional Screen Slide Animation**:
   - Tab transitions animate horizontally using `translateX` (`duration: 220ms`, `useNativeDriver: true`).
   - Forward tabs slide in from `+SCREEN_WIDTH` to `0`; backward tabs slide in from `-SCREEN_WIDTH` to `0`.
4. **Horizontal Swipe Gesture Support**:
   - Swipe gestures between tabs enforce horizontal priority (`Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2`) to ensure fluid vertical scrolling inside forms, accordions, and cards without gesture collisions.
5. **Horizontal Scroll Sub-Components**: Category chips and attachment thumbnail previews use horizontal scrolling (`horizontal={true}`, `showsHorizontalScrollIndicator={false}`).
6. **Nested Scroll Prohibition**: Accordions and coordinator cards render inline via `.map()`; nested `FlatList` or `ScrollView` instances are strictly prohibited.
7. **Cross-Tab Deep Linking**: Tapping `[ Report Issue ]` in Directory or `[ Submit Ticket ]` in FAQ directly switches to Tab 0 with form context pre-filled.

---

## 7. Typography & Custom Font Configuration

### 7.1 Font Families & Loading Architecture
1. **Primary Custom Display Font**: `Mograph` (Loaded via `expo-font` from `assets/fonts/Mograph-[Bold|Medium|Regular].otf` / `.ttf`).
2. **Fallback Font Stack**: `Platform.select({ ios: 'System', android: 'sans-serif' })`.

### 7.2 Font Family Application Rules Table

| UI Context | Font Variant | Font Size (sp) | Line Height | Weight / Token | Example UI Elements |
|---|---|---|---|---|---|
| **Screen & Section Titles** | `Mograph-Bold` | `22sp – 24sp` | `28sp` | Bold (`700`) | Screen Title, Section Headers ("Feedback & Bug Reporting", "FAQ") |
| **Card Titles & Headers** | `Mograph-Medium` | `18sp – 20sp` | `24sp` | Medium (`600`) | Section Headers, Coordinator Names |
| **Buttons & Action Pills** | `Mograph-Medium` | `14sp – 16sp` | `20sp` | Medium (`600`) | `[ Submit Ticket ]`, `[ Email ]`, `[ Copy ]` |
| **Category Chips & Badges**| `Mograph-Medium` | `12sp – 13sp` | `16sp` | Medium (`600`) | Category Pills (`[Points]`), Tenure Badges (`2025–2026`), Status Pills |
| **Body & Paragraph Text** | System Sans / `Mograph-Regular` | `14sp` | `20sp` | Regular (`400`) | FAQ markdown answers, coordinator quotes, helper subtitles |
| **Form Inputs & Textarea** | System Sans | `14sp – 15sp` | `20sp` | Regular (`400`) | Description textarea, contact email input |
| **Monospace / IDs & Phone**| `Platform Mono` | `13sp` | `16sp` | Medium (`500`) | Ticket IDs (`#TICK-84920`), Unblurred Phone Numbers (`+91 98765 43210`) |

---

## 8. Palette & Color System — Light Sage Theme

```typescript
export const sageThemeTokens = {
  // Backgrounds & Fills
  background: '#DAF1DE', // Soft sage canvas
  surface: '#FFFFFF', // Pure white card surface
  surfaceTranslucent: 'rgba(218, 241, 222, 0.5)', // 50% opacity sage surface
  surfaceMuted: 'rgba(142, 182, 155, 0.2)', // 20% opacity #8EB69B fill
  
  // Borders & Dividers
  border: '#8EB69B', // 1dp solid sage border
  borderMuted: 'rgba(142, 182, 155, 0.3)',
  focusRing: '#235347', // 2dp active focus ring

  // Typography & Contrast (WCAG AAA Compliant)
  textPrimary: '#051F20', // Headers & Titles (12:1 contrast ratio on #DAF1DE)
  textBody: '#0B2B25', // 14sp body text & text inputs
  textMuted: '#163B32', // 12sp helper labels & character counters

  // Primary Interactive & Accent
  primary: '#235347', // Submit button, active tab pill, active chip background
  primaryText: '#DAF1DE', // Text inside primary filled elements
  accent: '#235347', // Interactive highlights & borders
  whatsappBrand: '#25D366', // WhatsApp Official Accent

  // Severity Badges (Custom Tinted Fills over Sage)
  severityLowBg: '#DAF1DE',
  severityLowText: '#235347',
  severityMediumBg: '#FEF3C7',
  severityMediumText: '#92400E',
  severityHighBg: '#FFEDD5',
  severityHighText: '#C2410C',
  severityCriticalBg: '#FEE2E2',
  severityCriticalText: '#991B1B',
};
```

---

## 9. Minimalist Button Geometry & Shape System

The screen enforces a strict 3-tier geometry hierarchy:

| Button / Trigger | Tier | Shape & Radius | Height (dp) | Background Fill | Border | Text / Icon Style |
|---|---|---|---|---|---|---|
| **`[ Submit Ticket ]`** | Primary | Slightly Rounded (`8 dp`) | `48 dp` (Full Width) | `#235347` (Flat) | None | `15 sp` `Mograph-Medium` (`#DAF1DE`) |
| **Drawer Toggle (`☰`)** | Primary | Borderless Icon | `32 dp` | Transparent | None | `24 sp` `#051F20` (High Contrast) |
| **Active Tab Pill** | Secondary | Capsule (`20 dp`) | `36 dp` | `#235347` | None | `13 sp` `Mograph-Medium` (`#DAF1DE`) |
| **Inactive Tab Item** | Secondary | Capsule (`20 dp`) | `36 dp` | Transparent | None | `13 sp` `Mograph-Medium` (`#163B32`) |
| **Active Severity Pill** | Secondary | Capsule (`16 dp`) | `32 dp` | Tinted Fill (`#235347` / Badge) | None | `12 sp` `Mograph-Medium` |
| **Inactive Severity Pill**| Secondary | Capsule (`16 dp`) | `32 dp` | Transparent | 1 dp `#8EB69B` | `12 sp` System Regular (`#0B2B25`) |
| **Media Upload Tile (`+`)**| Secondary | Soft Square (`8 dp`) | `72 dp` (72×72) | `rgba(142, 182, 155, 0.2)` | 1 dp `#8EB69B` | Perfectly Centered Vector SVG Cross (`size: 28`, `#235347`) |
| **Active Filter Chip** | Secondary | Capsule (`20 dp`) | `36 dp` | `#235347` | None | `12 sp` `Mograph-Medium` (`#DAF1DE`) |
| **Inactive Filter Chip** | Secondary | Capsule (`20 dp`) | `36 dp` | Transparent | 1 dp `#8EB69B` | `12 sp` System Regular (`#0B2B25`) |
| **WhatsApp SVG Button `[✆]`**| Tertiary | Soft Square (`6 dp`) | `36 dp` (36×36) | Transparent | 1 dp `#8EB69B` | Custom SVG (`screens/assets/svg logos/whatsapp-logo-variant.svg`) |
| **Blurred Phone Container**| Tertiary | Soft Rectangle (`6 dp`) | `36 dp` (`flex: 1`) | `rgba(142, 182, 155, 0.2)` | 1 dp `#8EB69B` | Frosted Glass Blur (`intensity: 20`) |
| **`[ Email ]` / `[ Copy ]`**| Tertiary | Soft Rectangle (`6 dp`) | `36 dp` | Transparent | 1 dp `#8EB69B` | `12 sp` System Regular (`#0B2B25`) |
| **`[ Clear x ]` (Search)**| Tertiary | Borderless Icon / Text | `24 dp` | Transparent | None | `#163B32` |
