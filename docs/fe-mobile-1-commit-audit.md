# FE-Mobile-1 commit audit — `adf207c` · Oct 19, 2026

Scope: every file in commit `adf207c` ("FE-Mobile-1: connect mobile app to backend", merged as PR #62), checked against the real backend code in `Backend/` (gateway + `apps/*` + `packages/shared`). `Legacy/` and `docs/Legacy/` were ignored.

Legend: 🔴 broken today · 🟠 edge case / latent · 🟡 cleanup / smell · **[BE]** needs a backend change.

## Build checks (run locally)

- `tsc --noEmit`: 27 errors, all in design-system files that predate this commit (Showcase 12, Badge 6, IconButton 3, Checkbox 2, RadioGroup, Switch, ThemeProvider, Typography). None are in FE-1 code. The checklist says "the app typechecks", which is wrong, but §7 does list these errors.
- `npx expo export --platform android`: builds (4.2 MB bundle).
- API wire contracts are mostly correct. Paths, field names, enums, the `{success,data}` envelope, error envelopes, token shapes and pagination params all match.
- The bugs are in session handling, client-side rules that don't match the backend, and screen state.

---

## 🔴 Broken today

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | `src/api/client.ts:123-136, 164-168` | `refreshAccessToken` turns **any** failure (timeout, offline, 502, 429) into `null`. The caller then clears the tokens and logs the user out. | Clear the session only when `/auth/refresh` returns 401 or 403. Otherwise throw a network error and keep the tokens. |
| 2 | `store/auth.tsx:61-64` | Opening the app offline, or before the backend is up, runs `tokenStorage.clear()`, so the saved session is lost for good. | Clear only on `ApiError` with status 401 or 403. Otherwise show a retry screen. |
| 3 | `screens/events/registration.tsx:147-156` | `POST /registrations` can return 201 with `status:'rejected'` (`registration-service/src/clients/event-client.ts:20`). The UI shows "submitted, waiting for approval". | Add a `rejected` branch: error popup, stay on the form. |
| 4 | `src/forms/DynamicFormField.tsx:18-33` | `visible_if` does not match the server. The server coerces values (number to `20`, date to an ISO string, trimmed text) and treats a hidden controller field as unset (`validation.ts:84-113, 255-286`). The client compares raw strings. Result: a field the user can't see fails as required with 422, and the user is stuck. | Coerce values the way the server does. Treat a hidden controller as `undefined`. |
| 5 | `registration.tsx:75, 136-143` | Joining a team as a member fails in almost every case. The backend requires a **confirmed** registration (`team.service.ts:554`), status `forming` only (`:537`), and not an auction league (`:538`). The client lists full (`complete`) teams, shows the picker on `ALL` events, and joins right after submitting. | Filter to `forming`. Hide the picker for `type==='ALL'`. Join only when the registration is `confirmed`. |
| 6 | `registration.tsx:129-135, 246, 264` | Creating a team as captain needs an approved and confirmed captain registration (`team.service.ts:143`). Every error is swallowed. The copy promises "team is created when confirmed" and "join later with a code", but neither exists. `joinTeamByCode` and `mine()` are dead code. | Call `createTeam` only when the status allows it and show real errors. Build a later create/join entry point or remove the copy. |
| 7 | `src/popups/TermsPopup.tsx:10-17` + `registration.tsx:317` | Users must accept **invented** rules (college ID, arrive 15 min early, "no cash value") when the event has no `rules_summary`. These are not backend data. | Drop `DEFAULT_EVENT_TERMS`. Skip the terms step when there are no rules. |
| 8 | `screens/events/auction.tsx:409-418` | The live bid log is oldest-first (`$push`, then `slice(-10)`), but row 0 is labelled **"Leading"**, so the oldest bid is shown as leading. The history popup reverses the list correctly. | `[...lot.recent_bids].reverse()`. |
| 9 | `auction.tsx:170-178, 521-531` | A bid can go to the wrong player or the wrong amount. `bidAmount` stays high when the next lot starts. The confirm popup stays open across a lot change. `placeBid` reads `lot`/`version` when tapped, not when the popup opened. Result: one tap bids 500 on player B. | When `lot_id` changes, close the confirm and reset the amount. Freeze `{lot_id, version, amount}` when the confirm opens. |
| 10 | `auction.tsx:134` + **[BE]** `optionalAuth` | 15 minutes in, the access token expires. `/live` uses `optionalAuth`, so it never returns 401 and the client never refreshes. The gateway limiter then keys by **IP**: 100/min shared by everyone on campus Wi-Fi. Two phones polling once a second hit 429, and captains' bids are refused. | Refresh proactively before `exp`, and back off on 429. Also tighten `optionalAuth`. Its `ponytail:` note says to do this "once clients refresh on 401", and mobile does now. |
| 11 | `screens/hall-of-fame/hall-of-fame-detail.tsx:44` | `entry.members.filter` crashes on solo or challenge-legend entries. The model default is `undefined` (`HallOfFame.ts:97`). | `(entry.members ?? [])`, and make the type optional. |
| 12 | `screens/drawer/media.tsx` + `MediaRepository.ts:42` + **[BE]** | iOS video uploads always get 415. The picker writes `.mov` (`video/quicktime`), which is not in `ACCEPTED_CONTENT_TYPES`, and the sniffer lacks the `qt  ` brand. HEIC photos probably fail too (not tested on a device). | Backend: accept QuickTime. Mobile: `preferredAssetRepresentationMode: Compatible`. |
| 13 | `MediaRepository.ts:14-16` | No `status` filter is sent. Core and admin users get pending and rejected items (`media.service.ts:300-303`), which show as broken tiles because their files sit in unserved `.pending/`. | Always send `status: 'approved'`. |
| 14 | `media-viewer.tsx:39, 52` + **[BE]** | The like state always starts unliked. There's no `liked_by_me`, and `POST /like` is a **toggle**, so tapping a heart you already liked *unlikes* it while the UI shows a like animation. | Backend: add `liked_by_me` to list and get. This gap is missing from checklist §4. |
| 15 | `screens/events/event-leaderboard.tsx:101` | Search does nothing. `value={search}` is passed without `onChangeText`, so `SearchInput` is pinned to `''`. | Remove `value`. |
| 16 | `screens/drawer/leaderboard.tsx:85, 104-105` | The rank search shares `requestId` with load-more. Scrolling during the 1–5 s search drops its result, and the "Your position" spinner spins forever. | Give the rank search its own counter. |
| 17 | `leaderboard.tsx:90` | The domain filter (shown on the Global tab only) still applies when you switch to Challenges, with no visible chip. | Send `domain` only on the Global tab. |
| 18 | `event-leaderboard.tsx:54-59` | Every row shows "P0 · W0 · L0" because nothing in the backend ever writes `stats.played/won/lost`. | Show W/L only when `played > 0`. |
| 19 | `leaderboard.tsx:51` | Deleted users show "@undefined" (`username` is missing in the backend response). | `username?:` and a guard. |

## 🟠 Latent / edge cases

**Session / API**
- `client.ts:131` + `AuthRepository.ts:170-178`: a refresh that is in flight while the user logs out writes tokens back, so the next launch restores a session the user logged out of. Fix: add a generation counter to `tokenStorage`.
- `.env.example:3`: `localhost:3000` overrides the Android `10.0.2.2` fallback, which contradicts checklist §5. Comment it out.
- `register.tsx` / `AuthRepository.ts:57-61,105-114`: the phone number is not validated, the `toE164` regex differs from the backend's (`User.ts:291-294`), and a failed PATCH is swallowed (`catch {}`), so the number is silently lost.
- `AuthRepository.ts:81-85`: for deleted accounts the app says "contact the team", but the backend has self-service `POST /account/reactivate`.
- **[BE]** Only one refresh session exists per user. Logging in on web or a second device kicks mobile out. Not documented, and testers will report it as a bug.

**Auction**
- Polls run on `setInterval` with no in-flight guard. A late response overwrites newer state (stale `version`, needless 409), and the "joins your team" popup can repeat.
- After every sale, every client runs an uncached `GET /auction/lots/:id` at the same moment, which bypasses the 750 ms live cache. Build the result card from the last `active_lot` instead.
- The countdown rounds up on both server and client and counts from when the response arrived, so it runs up to ~1 s + RTT behind the server. The default timer is 5 s. Use floor and subtract RTT/2.
- "Outbid!" is shown for every `conflict_concurrent_bid`, including an expired timer or a pause.
- A captain approved after the auction started has `purse_remaining: 0` in the live state, so the client disables the button that would assign the purse **[BE]**.
- Roster-full (`members_count >= size_max`) is not checked before bidding, so the bid fails with 422 `team_roster_full`.
- The whole screen (pool rendered with `.map`, no FlatList) re-renders 4×/s from the countdown tick.
- 404/422 errors are polled every second forever.

**Events / registration**
- `event-details.tsx:100-102`: any `rejected` row blocks re-registering, but the backend allows it after a system or `captain_declined` rejection. **[BE]** `GET /events/:ref/my-registration` has no sort and can return the stale rejected row.
- `event-details.tsx:239-241`: Cancel is shown after `closes_at`, which returns 409 `cancel_window_closed`. A captain with members gets `captain_has_team`.
- `format.ts:83-101`: the pill shows "Open" for events with no `form_id`.
- `DynamicFormField.tsx:62-96`: the phone regex, text caps, `multi_select` min/max and user_ref UUID rules differ from the server's (`validation.ts:32-36, 359-367`). The checklist's claim "validation matching the backend" is false.
- File fields accept images only and ignore `accept`/`max_size_bytes`, so PDF-only fields can't be answered. A denied permission fails silently.
- `registration.tsx:171-185`: a draft form returns 404, which shows a generic error instead of the "not published" message.
- `format.ts:103-110`: the capacity label says "teams" but counts individual registrations.

**Leaderboard**
- Rank > 500 (cap of 5 × 100 pages) shows "Not ranked yet", which is false.
- A failed load-more or refresh wipes the whole list (the same pattern also appears in `events.tsx:140` and `media.tsx:150`).
- Offset pagination over live rankings gives duplicate keys and duplicate rows. The same applies to media. Dedupe on append.
- Event standings are cut at 100 with no paging, while the badge shows the full total. The Hall of Fame list does the same.
- Podium medals come from list position, not `row.rank`, so they can go to eliminated or null-rank entries.
- The scroll-to-me fallback ignores the header height.

**Media**
- Like has no in-flight guard, so a double tap toggles twice.
- The viewer FlatList uses the default `windowSize` (21), so up to ~10 `useVideoPlayer` instances load at once. Use `windowSize={3}`.
- The like/caption bar covers the native video scrub bar.
- No client-side size check against the server's 10/50 MB limits.
- The upload category follows the active filter chip, so members can post into `event`, `hall_of_fame` or `sponsors`. Always use `community`.

**Popups**
- `registration.tsx:146` and `auction.tsx:182`: one RN `Modal` closes and the next (`popup.*`) opens immediately. iOS can drop the second modal, so `await popup.success()` never resolves and `goBack()` never runs. Not tested on a device.
- `useAsyncResource`: the comment says loading is "first load only", but it reloads with the previous filter's data shown. With `enabled:false` there is a one-frame empty-state flash.

## 🟡 Cleanup

- **Dead code to delete:**
  - `src/store/auth.tsx` (unused re-export)
  - `services/apiclient.ts` (no importers)
  - `src/viewmodels/useAuthViewModel.ts` (unused, still has 4-digit OTP logic)
  - `OTP` / `CompleteProfile` routes and `verifyOtp` / `completeProfile` / `forgotPassword` in `store/auth.tsx`
  - `RegistrationRepository.joinTeamByCode` / `mine`
  - `AuctionRepository.lots(status)` param
  - the media duration label
- **Non-functional UI:** "Remember me" does nothing.
- **Auth state:**
  - `dropSession` doesn't reset `pendingEmail` / `error`.
  - The auth error banner carries over between the Login and Register tabs.
  - The auth context value isn't memoized.
  - Logout waits up to 15 s on a bad network.
- **Missing error messages:** many backend codes are missing from `FRIENDLY_MESSAGES`, so they show "Something went wrong":
  - teams: `not_registered_as_member`, `team_not_accepting_members`, `auction_league`, `captain_not_approved`, `team_name_taken`
  - media: `unsupported_media_type`, `pending_quota_exceeded`, `upload_rate_exceeded`
  - Hall of Fame: `entry_not_found`
  - gateway: 503 `service_unavailable`
- **Notifications repo:**
  - Errors are swallowed with `console.log` while `AppHeader` updates optimistically.
  - `data?: any`.
  - Each tab's `AppHeader` runs its own 30 s poll.
- **Inline `onSearch` lambdas** restart the `SearchInput` debounce on every render. Search inputs have no `maxLength`, so text over 100 (events) or 64 (Hall of Fame) characters gets a 422.
- **Bullet stripping:** the regex in `event-details.tsx:107` also strips leading numbers ("3 players" becomes "players"). `TermsPopup` uses `key={line}`, which duplicates on repeated lines.
- **Labels:**
  - Period labels say "This month/week", but they are rolling 30/7 days. "Semester" is rolling 120 days.
  - The bid badge is capped at "10 bids".
  - The "Unsold — returns to the pool" copy is wrong; nothing re-queues an unsold lot.
- **Smaller fixes:**
  - `Linking.openURL` has no catch.
  - `format.ts:4` hardcodes `Asia/Kolkata`.
  - The registration form has no `KeyboardAvoidingView`.
  - `media.tsx:105-109` asks for media library permission it doesn't need.
- **Type gaps:**
  - `HallOfFameEntry.members` should be optional.
  - `LeaderboardStanding.username` should be optional.
  - `awards[].description` and `contacts[].contact` should be nullable.
- **Pre-existing:**
  - `package.json` doesn't list `react` / `react-native` directly.
  - `react-native-appwrite` and `react-native-url-polyfill` are unused.
  - The `backend/**` path bug is in `.github/workflows/backend-ci.yml:7` too, not just in staging.

## Checklist (`mobile/FE1_CHECKLIST.md`) claims

| Claim | Verdict |
|---|---|
| App typechecks | ❌ 27 pre-existing errors (disclosed in §7) |
| Android bundle builds | ✅ |
| Logs out if refresh fails | ⚠️ Logs out on *any* failure, including offline (🔴1) |
| Stack remount fix, protected routes, drawer highlight | ✅ |
| Validation matches backend | ❌ (🔴4, 🟠 validator gaps) |
| Members can join an open team / captains create a team | ❌ Mostly fails (🔴5, 🔴6) |
| Success popup reflects real status | ❌ Misses `rejected` (🔴3) |
| "Clear Outbid! message" | ⚠️ Also shown for an expired timer or a pause |
| Ranked list with up/down movement | ❌ Global has no `previous_rank`; only event standings show movement |
| My bids / my-rank / Google / email / thumbnail backend gaps | ✅ All true. Missing from the list: `liked_by_me`, QuickTime uploads, the `optionalAuth` + IP-limiter interaction |
| Deleted mocks not imported anywhere | ✅ |

## Backend items to raise (BE-1 / BE-2)

1. **`optionalAuth` lenient on expired tokens + gateway limiter keyed by IP.** Together these break auction polling on shared Wi-Fi. Mobile now refreshes on 401, so `optionalAuth` can become strict, as its own `ponytail:` note says.
2. **Media:** accept `video/quicktime` + the `qt  ` brand. Probably HEIC too.
3. **Media:** add `liked_by_me` to list and get.
4. **Auction:** report an un-assigned purse as `purse_per_team` in the live state.
5. **`/events/:ref/my-registration`:** exclude `rejected` rows (or sort newest first).
6. **Single refresh session per user:** document it, or support more than one.
