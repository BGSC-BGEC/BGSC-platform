# FE-Mobile-1 — MVP Checklist

**Last updated:** 18 Oct 2026  
**Scope:** every FE-Mobile-1 task in `docs/MVP_Timeline_Plan_Updated.md`, up to the 18 Oct deadline.  
**Legend:** ✅ done · 🟡 done but not yet tested against a running backend · ⛔ blocked · ⬜ not started

> **Testing status:** all features below are wired to the real backend routes. The app typechecks and the Android bundle builds (`npx expo export --platform android`). The backend has **not** yet been run alongside the app, so nothing has been tested end to end. Every 🟡 item needs a pass once the backend is up.

---

## 1. Summary

| Timeline task (date) | Status |
|---|---|
| Project architecture setup (5 Sep) | ✅ |
| Authentication UI & integration (6 Sep) | 🟡 (Google sign-in ⛔) |
| Events list & filters (12 Sep) | 🟡 |
| Event details & registration (13 Sep) | 🟡 |
| Auction interface (19 Sep) | 🟡 |
| Leaderboard page (20 Sep) | 🟡 |
| Media page (26 Sep) | 🟡 |
| Hall of Fame page (27 Sep) | 🟡 |
| All popups (17 Oct) | ✅ |
| Bug fixes, polish, production APK/IPA (18 Oct) | ⬜ (needs backend running + `app.json` config) |

---

## 2. Done, task by task

### Project architecture setup
- ✅ **API client** — `src/api/client.ts`
  - One axios instance pointed at the gateway.
  - Unwraps the `{ success, data }` envelope.
  - Turns backend error codes into readable messages.
  - Renews the access token on a 401 (one refresh shared by all requests, then retries) and logs out if the refresh fails.
- ✅ **Token storage** — `src/api/tokenStorage.ts`. Access and refresh tokens live in SecureStore (localStorage on web).
- ✅ **Backend types** — `src/api/types.ts`, matching the backend models.
- ✅ **Base URL** — `src/api/config.ts`
  - Read from `EXPO_PUBLIC_API_URL` in `mobile/.env`.
  - Falls back to the local gateway, using `10.0.2.2` on the Android emulator.
  - Turns relative `/uploads/...` paths into full URLs.
  - `.env.example` added.
- ✅ **Repositories** in `src/repositories/`: Auth, Events, Registration, Auction, Leaderboard, Media, HallOfFame, Notifications.
- ✅ **Shared hooks**
  - `useAsyncResource` handles loading, refreshing, error and stale responses.
  - `useConfirmLogout` asks before signing out.
- ✅ **Shared components**
  - `FilterChips`, `SegmentedTabs`, `Avatar`, `LeaderboardParts` (podium and ranked rows).
  - `DynamicFormField` for admin-built registration forms.
- ✅ **Navigation fix**
  - `LoggedInStack` was defined inside a component, so every auth-state change remounted the app. It is now defined once.
  - A loading screen shows while the saved session is restored.

### Authentication
- 🟡 **Login** → `POST /auth/login`. Handles wrong password, suspended accounts and accounts scheduled for deletion.
- 🟡 **Register** → `POST /auth/register`
  - Added **Full name** and **Username** fields, which the backend requires.
  - Minimum password length is now 8, matching the backend.
  - The user is signed in straight after registering.
  - An optional contact number is saved to the profile.
- 🟡 **Forgot password** → `POST /auth/forgot-password`.
- 🟡 **Session restore** on app start through `GET /users/me`.
- 🟡 **Logout** → `POST /auth/logout`, with a confirmation dialog.
- ✅ **Removed fake logins:**
  - The app no longer starts logged in as a hard-coded "Jeet".
  - Failed requests no longer log in a fake user.
- ⛔ **Google sign-in** — no backend support for mobile (see §4). The button now shows "not available yet".
- ℹ️ **OTP screen** — no longer used. The backend verifies email with a link, not a code.

### Events list & filters
- 🟡 Real list from `GET /events`, with infinite scroll.
- 🟡 Category chips (Leagues / BGEC / FitSoc / General) and time filter (Upcoming & live / Happening now / Past).
- 🟡 Debounced search and pull-to-refresh.
- 🟡 Skeleton loading, empty and error-with-retry states.
- 🟡 Status badge worked out from the registration window (Open / Soon / Closed / Full / Live / Completed / Cancelled), plus an "Auction live" tag.

### Event details & registration
- 🟡 **Event details** — loads the event, eligibility and your registration together.
  - Cover image and a gallery of event photos.
  - About, tags, format, capacity, team size and deadlines.
  - Rules popup and rulebook PDF link.
  - Awards and contacts (tap to email or call).
- 🟡 **Registration status card** — confirmed / waitlisted / pending approval / rejected, with **Cancel registration** behind a confirm popup.
- 🟡 Links to the **live auction** and **event standings** when the event has them.
- 🟡 **Dynamic registration form** built from `GET /forms/:form_id`:
  - All 12 field types.
  - Conditional fields (`visible_if`).
  - Validation matching the backend.
  - Image uploads for file fields.
- 🟡 **Team events:**
  - Pick captain or member.
  - Captains name a new team (`POST /teams`).
  - Members can join an open team (`POST /teams/:id/join`).
- 🟡 **Submit flow:**
  - Rules must be accepted first.
  - A confirmation popup shows a summary.
  - A success popup reflects the real status: confirmed, waitlisted or pending.
  - Server field errors appear on the matching fields.

### Auction
- 🟡 **Live state** — polls `GET /auction/events/:ref/live` every second while the screen is open. The countdown ticks locally between polls.
- 🟡 **Current player** — base price, current bid, leading team.
- 🟡 **Captain bidding** — only shown to captains:
  - +/– stepper and quick-raise buttons.
  - Checks against the minimum bid and remaining budget.
  - Bid confirmation popup.
  - If someone bid first (stale version), shows a clear "Outbid!" message.
- 🟡 **Bid log** and **team budgets** with progress bars.
- 🟡 **Result of each player** — "SOLD! / Unsold" card when a player is settled, plus a popup when your team wins one.
- 🟡 **Players tab** — the whole pool; tap a player for full bid history.
- 🟡 **My bids tab** — your bids marked Won / Leading / Outbid. Worked out in the app because the backend has no "my bids" endpoint.
- ✅ Removed the mock admin auction console. Admin controls belong in the web panel.

### Leaderboard
- 🟡 **Tabs** — Global / Events / Challenges.
- 🟡 **Filters** — period (All time / Semester / Month / Week) and domain.
- 🟡 **Display:**
  - Top-3 podium with entry animation.
  - Ranked list with up/down movement.
  - Your row highlighted.
  - Infinite scroll.
- 🟡 **"Your position" card**, with a "Top X%" badge and **Scroll to my position**.
- 🟡 **Event standings screen** (`EventLeaderboard`):
  - Podium and search.
  - Your or your team's entry.
  - Notice when there are too few participants for final ranks.

### Media
- 🟡 3-column gallery from `GET /media`, with infinite scroll.
- 🟡 Filters for type (Photos / Videos) and category.
- 🟡 **Full-screen viewer** — swipe between items, video playback (`expo-video`), like toggle, share sheet.
- 🟡 **Member upload** with `expo-image-picker`. Uploads go to moderators as *pending*.
- ✅ Added to the drawer menu.

### Hall of Fame
- 🟡 Featured carousel.
- 🟡 Category filters, search, and a **List / Timeline** toggle (timeline grouped by year).
- 🟡 Share from any card.
- 🟡 **Detail page** — cover, honoree, quote, story, achievement badges, roster, link to the source event.

### Popups (`src/popups/`)
- ✅ `PopupProvider` and `usePopup()` — success, error, info, warning and confirm (including destructive), awaited as promises.
- ✅ `TermsPopup` — scrollable rules with a required tick box.
- ✅ `EventRegistrationPopup` — summary shown before submitting.
- ✅ `BidConfirmPopup` — amount, budget after the bid, time left.
- ✅ **Used for:** logout from the drawer and Profile, cancel registration, media upload, and success/error messages everywhere.

### Housekeeping
- ✅ Deleted dead mock files: `src/mock/*`, `src/types/event.ts`, `screens/events/auction-console.tsx`.
- ✅ **Bug fix — Event details** didn't refresh after coming back from the registration form.
- ✅ **Bug fix — `.env`** had a URL wrapped in brackets, which broke the base URL.
- ✅ Home's mock "Register / View details" buttons now open the Events tab instead of crashing.
- ✅ Notification bell (`AppHeader`) now reads the real `/notifications` endpoints. Its fake notifications were removed.
- ✅ Added dependencies `expo-video` and `expo-image-picker` (installed with `npx expo install`).
- ✅ Kept the existing look: only existing theme colors, the same Card / Badge / Button / AppHeader components, and no restyling of existing screens.

---

## 3. Remaining for FE-Mobile-1

| # | Task | Notes |
|---|---|---|
| 1 | ⬜ **Run the backend and test every 🟡 item end to end** | Biggest open item. See §5 for setup. |
| 2 | ⬜ Fix bugs found in that pass | |
| 3 | ⬜ **Fill in `app.json` for production builds** | Currently only lists plugins. Needs `name`, `slug`, `version`, `icon`, `splash`, `android.package`, `ios.bundleIdentifier`. Coordinate with FE-Mobile-2. |
| 4 | ⬜ Build production APK/IPA | `eas build` (needs an Expo account) after #3. |
| 5 | ⬜ Point `EXPO_PUBLIC_API_URL` at the production/staging backend | No deployed backend URL exists in the repo yet. |
| 6 | ⬜ Accessibility pass | Screen reader labels are on most buttons; contrast and font scaling not checked. |
| 7 | ⬜ Show an "unverified email" banner and resend button | Backend has `POST /auth/resend-verification`; `pendingEmail` is already in the auth store. |
| 8 | ⬜ (Optional) Email verification and password reset links opening the app | Links currently point at the web app (`FRONTEND_URL`). |

---

## 4. Blocked on the backend (raise with BE-1 / BE-2)

- ⛔ **Google sign-in on mobile.** There is no endpoint that accepts a Google token from a phone; the only flow redirects through the web app. Google is also unconfigured by default (returns `503`).
- ⚠️ **No real email.** Verification and reset emails are only printed to the auth-service log.
- ⚠️ **No "my bids" endpoint.** The app collects them from every lot.
- ⚠️ **No "my global rank" endpoint.** The app pages through the board, up to 500 rows.
- ⚠️ **No push notifications or device-token registration.** In-app notifications only.
- ⚠️ **No thumbnails.** `thumbnail_url` is always null, so video tiles show an icon.
- ⚠️ **Stale staging deploy workflow.** `deploy-staging.yml` watches `backend/**` (lowercase) but the folder is `Backend/`, so it never runs.

---

## 5. Running the backend locally

```bash
cd Backend
cp .env.example .env
docker compose up -d --build     # first build is slow and uses a lot of RAM
curl localhost:3000/health       # should print "status":"ok"
```

**Machines with 8 GB RAM:** build one service at a time, or the Docker builder can crash (we hit `failed to solve: ... EOF`):
```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose build
docker compose up -d
```

**First admin account:** register in the app, then run:
```bash
docker compose run --rm -e FOUNDER_EMAIL=you@example.com user-service node apps/user-service/dist/scripts/seed-founder.js
```

**Wipe all data:** `docker compose down -v`

**Value for `mobile/.env`:**

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Android emulator | `http://10.0.2.2:3000` |
| Physical phone | `http://<PC's Wi-Fi IP>:3000` |

---

## 6. Not FE-Mobile-1, but still using fake data (FE-Mobile-2 screens)

These were left alone to avoid clashing with FE-Mobile-2's work:

| Screen | What is hard-coded | Backend route to use |
|---|---|---|
| Home | 1,250 points, rank #8, two events, quick actions | `GET /points/me`, `GET /events`, `GET /announcements` |
| Profile | Stats and recent events | `GET /users/me` (`points_balance`), `GET /registrations` |
| History | Hard-coded list | `GET /registrations`, then each event |
| Edit Profile | Pre-filled "Jeet", save does nothing | `PATCH /users/me`, `POST /users/me/avatar` |
| Announcements | Two hard-coded cards | `GET /announcements` |
| Feedback | Send button does nothing | `POST /feedback`, `POST /contact` |

The shared API client and repositories in `src/` can be reused for all of these.

---

## 7. Known issues carried over (not introduced by FE-1)

- 27 TypeScript errors in shared design-system files.
  - Badge `secondary` / `slate`, Checkbox, RadioGroup, Switch and IconButton reference theme colors that don't exist in `colors.ts`, so those variants render with missing colors.
  - FE-1 screens avoid those variants.
  - The fix is to add the missing tokens in `src/theme/colors.ts`. Agree on the colors first.
- Drawer and Profile logout styling use hard-coded hex colors instead of theme tokens.
