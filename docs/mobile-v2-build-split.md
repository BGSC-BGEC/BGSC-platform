# Mobile v2 — screen build list & work split (BE-1 / BE-2)

> The mobile app build moves to BE-1 and BE-2 (same roles as in `MVP_Timeline_Plan_Updated.md`). This doc
> supersedes the FE-Mobile-1 / FE-Mobile-2 mobile assignments in that plan; existing screens in `mobile/` are
> the starting point and get rebuilt to the v2 designs.

Source of truth for every screen: the **v2** frames in Figma
(`BGSC Application - Frontend Screens - Navigation`, page **01 — Mobile**, columns at x ≥ 3700).
Link format: `https://www.figma.com/design/oLGMtiAnxLElj27lRQciuq/?node-id=<node-id with - instead of :>`
— e.g. Home = `node-id=34-563`. Play the prototype from the flow **"v2 · Full app (splash)"** to see how screens connect.

Feature spec: `docs/SystemDesignDocs/` (never `Legacy/`). API: gateway on `:3000`, no `/api` prefix.

---

## 1. How the work is split

Split is by **vertical slice** (whole user journeys), so neither person waits on the other for a screen in the
middle of their flow. Cross-slice links are **navigation only** — you `navigate('<Route>', params)` into the
other person's screen using the route contract in §3; until it lands, the route renders a placeholder.

| | **BE-2** | **BE-1** |
|---|---|---|
| Shared foundation (§2) | App shell (nav, header, tab bar, drawer, sheets) + display components | Form controls + list/row components |
| Slices | **A** Home, announcements & social · **B** Events & registration · **C** Live auction · **G** Auth & onboarding | **D** Leaderboards & brackets · **E** Points, challenges & Strava · **F** Profile, settings & notifications · **H** Hall of Fame, media & feedback |
| Figma frames | 28 | 29 |
| Why this way | Events → registration → auction is one tightly coupled flow (shared registration/team state, purse, captain logic) — one owner. Auth owns the session/token store everything else consumes. | Each slice is self-contained behind its own service (leaderboard, points/challenge, user/notification, media/feedback). Phone OTP sits in F because it is reached from Edit profile, not from sign-up. |

Rules:
- **Own your files.** Don't edit the other person's screens/components; ask (or open a PR against their branch).
- Shared files with one owner: `mobile/screens/drawer/layout.tsx`, `bottom-tabs-layout.tsx` → **BE-2**.
- **Colours:** use theme tokens only (`useTheme().colors.*`), never hex. The final colour scheme is still open —
  it gets swapped in one place (`mobile/src/theme/colors.ts`) once decided. Small visual tweaks are fine while building.
- Every list screen ships with **loading (skeleton), empty and error** states (see `v2-events-states` /
  `v2-auction-states` for the pattern) and pull-to-refresh.

---

## 2. Phase 0 — shared foundation (do first, in parallel, ~1–2 days)

Both start here at the same time. Nothing below depends on the other person's half.

### BE-2 — app shell + display components
| Item | Figma | Notes |
|---|---|---|
| Navigation restructure | `v2-sidebar` (73:2319), overlays row I | Implement the route contract in §3: Root stack → Auth stack / App (Drawer → MainTabs). **Bottom tabs = Home · Announcements · Social.** Events, Leaderboard, Challenges, Hall of Fame, Media, Feedback move to drawer-level screens. Land this **first** (day 1) — register every route from §3 with a placeholder screen so BE-1 can drop real screens in. |
| `AppHeader` v2 | component `v2/AppHeader` | Leading = Menu (drawer root screens) or Back (pushed screens); title; bell with unread dot (`GET /notifications/unread-count`); avatar → `Profile`. |
| `TabBar` v2 | `v2/TabBar` | 3 tabs, active state. |
| `Drawer` v2 | `v2/Drawer` (Active = section) | Profile card → `Profile`; items with badges ("2 open", "5 active"); active item follows current route; Log out via `useConfirmLogout`. |
| `BottomSheet` | sheet frames (e.g. 103:3012) | Build on existing `PopupProvider`/`PopupShell`: scrim tap closes, grabber, safe-area. All sheets in both slices use this. |
| `StickyCTABar`, `FAB` | event detail / announcements | Pinned bottom bar (text left, button right); floating action button. |
| `Chip` (single-select group), `Pill` (tones), `SectionHeader` ("See all") | `v2/Chip`, `v2/Pill`, `v2/SectionHeader` | Extend existing `FilterChips`, `Badge`, `SectionHeader`. |
| `EventCard`, `AnnouncementCard` | `v2/EventCard`, `v2/AnnouncementCard` | Used by Home, Events, Announcements (all BE-2). |
| State views | `v2-events-states` | Skeleton card, `EmptyState`, `ErrorState` banner — restyle existing `src/feedback/*`. |

### BE-1 — form controls + rows
| Item | Figma | Notes |
|---|---|---|
| `Field` | `v2/Field` (Default/Focused/Error) | Label, helper/counter, error text. Restyle `forms/TextInput`, `TextArea`, `Select`. |
| `Switch`, `Checkbox` | `v2/Switch`, `v2/Checkbox` | Restyle existing `forms/Switch`, `forms/Checkbox`. |
| `SegmentedControl` | `v2/Segment` | Restyle `components/SegmentedTabs`. Used by ~15 screens in both slices. |
| `OptionTile`, `SeverityPill`, `InterestTile` | `v2/OptionTile`, `v2/SeverityPill`, `v2/InterestTile` | Single-select tiles (feedback), multi-select tiles (get-started). |
| `ListRow` / settings row | Settings, Account actions | Icon + title + subtitle + trailing (chevron / switch / value / pill). Grouped card container. |
| `StatTile`, `Avatar` v2 | Profile, leaderboard, points | Small stat block (value + caption); avatar with initials fallback + ring. |

> Until a component lands, use the existing `mobile/src` version — swap later. Don't block.

---

## 3. Route contract (agree once, both code against it)

| Route | Navigator | Params | Owner | Figma |
|---|---|---|---|---|
| `Splash` | root | — | BE-2 | 55:1979 |
| `Landing`, `Login`, `Register`, `VerifyEmail`, `GetStarted`, `RestoreAccount` | Auth stack | `VerifyEmail {email}` · `RestoreAccount {email}` | BE-2 | row G |
| `HomeTab`, `AnnouncementsTab`, `SocialTab` | MainTabs | — | BE-2 | row A |
| `Events`, `Leaderboard`, `Challenges`, `HallOfFame`, `Media`, `Feedback` | Drawer (Menu header) | `Events {status?, category?}` | BE-2 / BE-1 | — |
| `AnnouncementDetail` | App stack | `{id}` | BE-2 | 35:775 |
| `EventDetails` | App stack | `{ref}` (shows "registered" state itself) | BE-2 | 38:904 / 38:1072 |
| `EventRegistration` | App stack | `{ref, role?: 'captain'\|'member', step?}` | BE-2 | 39:994 → 40:1263 |
| `TeamJoin` | App stack | `{ref, code?}` | BE-2 | 40:1058 |
| `Auction`, `AuctionLots`, `MyBids` | App stack | `{ref}` | BE-2 | row C |
| `EventStandings` | App stack | `{ref, view?: 'table'\|'bracket'\|'matches'}` | BE-1 | 44:1459 / 45:1541 |
| `Match` | App stack | `{id}` | BE-1 | 45:1668 |
| `Points` | App stack | — | BE-1 | 46:1425 |
| `ChallengeDetail` | App stack | `{key}` (renders accepted/progress/result by participation state) | BE-1 | 47:1506 → 49:1564 |
| `StravaConnect` | App stack | — (shows connected state itself) | BE-1 | 49:1638 / 49:1701 |
| `Profile`, `EditProfile`, `Settings`, `DeleteAccount`, `Notifications`, `PhoneOtp` | App stack | `Profile {ref?}` | BE-1 | row F |
| `HallOfFameDetail` | App stack | `{slugOrId}` | BE-1 | 59:2151 |
| `MediaViewer` | App stack (fullScreenModal) | `{id, ids?}` | BE-1 | 60:2187 |
| `FeedbackSuccess`, `MyTickets`, `ContactFaq` | App stack | `FeedbackSuccess {ticket_no}` | BE-1 | row H |

Sheets are **not routes** — open them with the shared `BottomSheet` from the screen that owns them.
Existing route names (`EventDetails`, `EventRegistration`, `Auction`, `MediaViewer`, `HallOfFameDetail`,
`EditProfile`) are kept. `EventLeaderboard` → `EventStandings`; `History` is replaced by `Points`.

---

## 4. BE-2 screens

### A · Home, announcements & social
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| A1 | Home | 34:563 | `screens/drawer/home.tsx` (currently **mock**) | `GET /points/me`, `GET /leaderboards/global` (my rank), `GET /events?status=open`, `GET /announcements?pinned`, `GET /announcements/heads`, `GET /points/me/transactions?limit=3`, `GET /challenges/me/participations` (count) | Pinned banner, season-points card, quick actions, "From the heads" carousel, upcoming events, recent activity, WhatsApp card (URL TBD). Links into D/E/H by route only. |
| A2 | Announcements | 35:646 | `screens/drawer/announcement.tsx` (**mock**) | `GET /announcements` (+chips filter), `POST /announcements/read-all`, `GET /announcements/unread-count` | Pinned card, Today/Earlier groups, club chips. FAB "Announce" only for Core+ (create flow is admin — FAB can link out/hide). |
| A3 | Announcement detail | 35:775 | new | `GET /announcements/:id`, `POST /announcements/:id/read` | Linked-event card → `EventDetails`. |
| A4 | Social (coming soon) | 73:2502 | new | — | Static placeholder; "Notify me" can no-op/toast. |
| A5 | Sidebar / drawer | 73:2319 | shell (§2) | `GET /users/me`, `GET /points/me` | Part of Phase 0. |

### B · Events & registration
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| B1 | Events list | 37:768 | `screens/drawer/events.tsx` (real) | `GET /events` (status / category / search) | Live-auction banner when an auction is running → `Auction`. Segments Upcoming/Ongoing/Past + category chips. |
| B2 | Events · loading / empty / error | 37:957 | states of B1 | — | Reference frame for all list states. |
| B3 | Event detail | 38:904 | `screens/events/event-details.tsx` (real) | `GET /events/:ref`, `/eligibility`, `/participants/stats`, `/captains` | Sticky CTA "Register now"; auction card; awards; organiser chat (WhatsApp URL). |
| B4 | Event detail · registered | 38:1072 | same screen, registered state | `GET /events/:ref/my-registration` | Timeline card, Edit details, Cancel → B10. Sticky bar shows auction countdown. |
| B5 | Register · captain | 39:994 | `screens/events/registration.tsx` (real, dynamic form) | `GET /forms/:id`, `POST /registrations/upload-file` | Role picker (captain/member), franchise + join policy. Generic events keep `DynamicFormField` inside this layout. |
| B6 | Register · auction member | 39:1114 | same | `GET /forms/:id` | Base-price stepper + distribution chart. |
| B7 | Join a team | 40:1058 | split out of registration.tsx | `GET /teams?event=&status=forming`, `POST /teams/:id/join`, `POST /teams/join-by-code` | Browse / join-by-code segment, invite-code cells, "let captains invite me" switch. |
| B8 | Review & submit | 40:1182 | same flow | — (local) | Edit links back to steps. |
| B9 | Registration submitted | 40:1263 | same flow | `POST /registrations` | Must handle `confirmed` / `waitlisted` / `pending approval` / `rejected` (audit: 201 + rejected is shown as submitted). |
| B10 | Cancel registration sheet | 40:1337 (overlay 103:3012) | sheet | `DELETE /registrations/:id` | |

### C · Live auction
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| C1 | Live auction · captain | 41:1158 | `screens/events/auction.tsx` (real) | poll `GET /auction/events/:ref/live` every 1.5–2 s, `GET /auction/lots/:id` | No websockets — polling only. Purse, increments chips, bid log, team purses. |
| C2 | Confirm bid sheet | 41:1309 (overlay 103:3178) | `src/popups/BidConfirmPopup.tsx` | `POST /auction/lots/:id/bid` | Freeze lot + amount when the sheet opens (audit bug). |
| C3 | Auction · states & errors | 42:1210 | states of C1 | — | Before start / paused / spectator / bid-error banners — map API error codes. |
| C4 | Lot result · sold / unsold | 42:1311 | overlay/transition in C1 | from live payload | Auto-advance after ~3 s. |
| C5 | Auction · players | 43:1243 | new | `GET /auction/events/:ref/lots` | Queued / Sold / Unsold segments, role chips. |
| C6 | Auction · my bids | 43:1383 | new | `GET /auction/events/:ref/live` (my team), `GET /teams/:id` | Roster + bid history. |

### G · Auth & onboarding
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| G1 | Splash | 55:1979 | `BootSplash` in layout.tsx | session restore | Don't wipe the session when offline (audit). |
| G2 | Landing · tour | 55:1999 | new | — | Get started / I have an account / guest. |
| G3 | Login | 55:2048 | `screens/login/login.tsx` | `POST /auth/login`, `GET /auth/google` → `POST /auth/google/exchange` | Show 401/429 banners; deleted account → `RestoreAccount`. |
| G4 | Create account | 56:1996 | `screens/login/register.tsx` | `POST /auth/register` | Username availability, password strength. |
| G5 | Verify email | 56:2070 | `screens/login/otp.tsx` → rename | `POST /auth/resend-verification`, `POST /auth/verify-email` | ⚠ Email sending is a stub in prod — flow can't complete until a mail provider is wired (backend). |
| G6 | Get started · interests | 58:2024 | `screens/login/complete-profile.tsx` → replace | `PATCH /users/me` (`interests[]`) | Min 3, Skip allowed. |
| G7 | Restore account | 58:2107 | new | `POST /account/reactivate` | Countdown of restore window. |

`ForgotPassword` stays as-is (no v2 frame yet) — restyle with v2 `Field`.

---

## 5. BE-1 screens

### D · Leaderboards & brackets
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| D1 | Leaderboard · global | 44:1290 | `screens/drawer/leaderboard.tsx` (real) | `GET /leaderboards/global` (period/domain, `?source=challenge`) | Global/Events/Challenges segments, podium, my-rank card. Audit: domain filter leaks into Challenges tab; deleted users show "@undefined". |
| D2 | Event standings | 44:1459 | `screens/events/event-leaderboard.tsx` → `EventStandings` | `GET /leaderboards/events/:ref`, `/me`, `GET /brackets/:event_id/standings` | Table view; "Back a team" card. Fix dead event search (audit). |
| D3 | Invest points sheet | 45:1359 (overlay 103:3337) | sheet | `GET /leaderboards/events/:ref/project?amount=`, `POST /leaderboards/events/:ref/invest`, `GET /points/me` | Slider 10–cap, projected rank. |
| D4 | Tournament bracket | 45:1541 | `EventStandings view=bracket` | `GET /brackets/:event_id` | Horizontal scroll, live match highlight. |
| D5 | Match details | 45:1668 | new | `GET /matches/:id` | Timeline; "Winner meets…" → bracket. |

### E · Points, challenges & Strava
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| E1 | Points · wallet & history | 46:1425 | `screens/profile/history.tsx` → `Points` (**mock**) | `GET /points/me`, `/me/breakdown`, `/me/transactions`, `GET /points/opportunities` | Donut breakdown, ways to earn, filtered history. |
| E2 | Challenges | 46:1573 | new | `GET /challenges`, `GET /challenges/me/participations` | Active/Available/Completed segments, category chips. |
| E3 | Challenge detail | 47:1506 | new | `GET /challenges/:key`, `POST /challenges/:id/accept` | Brief unlocks on accept; resources (external URLs). |
| E4 | Challenge · progress & proof | 47:1615 | same route, accepted state | `PATCH /challenges/participations/:id/progress`, `POST /challenges/participations/:id/submit` (check the submit payload for image/link/text proof) | Proof types Strava / Image / Link / Text. |
| E5 | Challenge · reviewed | 49:1564 | same route, reviewed state | `GET /challenges/participations/:id` | Approved / under review / rejected / expired / legend outcomes. |
| E6 | Strava · connect | 49:1638 | new | `GET /strava/connect` → OAuth → `POST /strava/link` | |
| E7 | Strava · connected | 49:1701 | same route | `GET /strava/status`, `GET /strava/activities`, `POST /strava/sync`, `DELETE /strava/disconnect` | |

### F · Profile, settings & notifications
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| F1 | Profile · player card | 51:1626 | `screens/drawer/profile.tsx` (partly mock) | `GET /users/me`, `GET /users/:ref/player-card`, `GET /points/me`, `GET /registrations/me` | Interests, picked-for-you, achievements, history → `Points`. No longer a tab — pushed from avatar/drawer. |
| F2 | Account actions sheet | 52:1697 (overlay 103:3504) | sheet | — | Logout via `useConfirmLogout`. "Request my data" → ⚠ no export endpoint yet. |
| F3 | Settings | 52:1999 | new | `PATCH /users/me/settings` (theme, public profile), `GET/PATCH /notifications/preferences`, `GET /strava/status` | ⚠ Change password: no endpoint yet. Privacy/terms = external URL. |
| F4 | Edit profile | 53:1822 | `screens/profile/edit-profile.tsx` (**mock**) | `PATCH /users/me`, `POST /users/me/avatar` | Verified/Verify pills → `PhoneOtp`. |
| F5 | Delete account | 53:1905 | new | `GET /users/me/deletion-preview`, `DELETE /users/me` | Type-DELETE confirm; then sign out to `Landing`. |
| F6 | Notifications | 54:1872 | new (bell currently only in AppHeader) | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `DELETE /notifications/:id` | Deep links into other slices by route (event, points, team invite, settings). |
| F7 | Profile picture sheet | 54:1985 (overlay 103:3740) | sheet | `POST /users/me/avatar` (expo-image-picker) | Crop/zoom, remove. |
| F8 | Verify phone · OTP | 56:2104 | new (reuse `src/auth/OtpCells`) | `POST /auth/phone/send-otp`, `POST /auth/phone/verify-otp` | ⚠ SMS is a stub in prod. Lockout state. |

### H · Hall of Fame, media & feedback
| # | Screen | Figma | Code | API | Notes |
|---|---|---|---|---|---|
| H1 | Hall of Fame | 59:2043 | `screens/drawer/hall-of-fame.tsx` (real) | `GET /hall-of-fame/featured`, `GET /hall-of-fame` | Featured carousel, List/Timeline, chips. |
| H2 | Hall of Fame · honour | 59:2151 | `screens/hall-of-fame/hall-of-fame-detail.tsx` (real) | `GET /hall-of-fame/:slugOrId` | Fix crash on solo entries (`members` undefined). Source event → `EventStandings`. |
| H3 | Media | 60:2090 | `screens/drawer/media.tsx` (real) | `GET /media?status=approved`, `GET /media/albums` | Albums carousel, masonry grid, pending tile for own uploads. |
| H4 | Media viewer | 60:2187 | `screens/media/media-viewer.tsx` (real) | `GET /media/:id`, `POST /media/:id/like` | Like state needs `liked_by_me` (backend ask). |
| H5 | Upload sheet | 60:2231 (overlay 103:3913) | sheet | `POST /media/upload` | iOS `.mov`/HEIC currently 415 (backend ask). |
| H6 | Feedback & contact | 61:2157 | `screens/drawer/feedback.tsx` (**mock**) | `POST /feedback`, `POST /contact` | Category tiles, severity, attachments, anonymous switch. |
| H7 | Feedback sent | 61:2255 | new | `GET /feedback/:ticket_no` | Copy ticket no. |
| H8 | My tickets | 62:2200 | new | `GET /feedback/me` | Open/Closed segments. |
| H9 | Contact & FAQ | 62:2269 | new | — (static content) | FAQ accordion + coordinator directory (static until an endpoint exists). |

---

## 6. Cross-slice touchpoints (navigation only)

| From (owner) | To (owner) | Route call |
|---|---|---|
| Home (BE-2) | Points, Leaderboard, Challenges, Media, Match (BE-1) | `navigate('Points')`, `'Leaderboard'`, `'Challenges'`, `'Media'`, `'Match', {id}` |
| Event detail (BE-2) | Event standings (BE-1) | `navigate('EventStandings', {ref})` |
| Notifications (BE-1) | Event detail, Team join (BE-2) | `navigate('EventDetails', {ref})`, `'TeamJoin', {ref}` |
| Profile picked-for-you (BE-1) | Event detail / Team join (BE-2) | as above |
| Hall of Fame honour (BE-1) | Event standings (BE-1) | — |
| Delete account (BE-1) | Landing (BE-2) | sign out via auth store → auth stack shows `Landing` |
| Login (BE-2) | Restore account (BE-2) | — |
| Drawer (BE-2) | every drawer screen | route names in §3 |

Shared state: auth/session (`mobile/store/auth.tsx`) — **BE-2** owns; BE-1 only reads `useAuth()`.
Points balance shown in drawer/home (BE-2) and points/invest (BE-1) — both call `GET /points/me`; refetch on focus.

---

## 7. Suggested order

1. **Phase 0** (§2) — both, in parallel. BE-2 lands the nav shell + route placeholders on day 1.
2. **Core journeys** — BE-2: G (auth) → A1 Home → B (events/registration). BE-1: F1/F4 (profile) → D (leaderboards) → H (media/HoF).
3. **Second half** — BE-2: C (auction) → A2–A4. BE-1: E (points/challenges/Strava) → F rest → H6–H9.
4. **Pass together**: play the Figma prototype side by side with the app; fix gaps; colour-scheme swap.

## 8. Backend gaps hit by these screens

| Gap | Screens | Owner to decide |
|---|---|---|
| No real email provider (verify / reset mails only logged) | G5, ForgotPassword, H7 receipts | backend |
| No SMS provider (phone OTP only logged) | F8 | backend |
| No change-password endpoint | F3 | backend |
| No data-export endpoint | F2 | backend |
| No push notifications (in-app only) | F3 notification toggles, F6 | post-MVP |
| `liked_by_me` missing on media | H4 | backend |
| QuickTime/HEIC uploads rejected | H5 | backend |
| Auction polling hits the 100/min IP limit on campus Wi-Fi | C1 | backend |

## 9. Done means

- Matches the v2 frame (layout, copy, states); tokens only, no hex.
- Real API, no mock data; loading / empty / error handled; pull-to-refresh on lists.
- Every tap that's wired in the Figma prototype works in the app (or is listed in §8).
- Works on Android + iOS, small (360 px) and large phones; no text clipping.
- `tsc --noEmit` clean for files you touched.
