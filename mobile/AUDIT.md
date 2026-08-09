# Frontend Audit — BGSC Mobile

**Date:** 2026-08-10  
**Auditor:** Parallel multi-agent review (19 agents, ~1M tokens)  
**Scope:** All 150 source files — `src/app`, `src/components`, `src/core`, `src/hooks`, `src/lib`, `src/viewmodels`

Legend: ✅ Fixed · ⬜ Pending · 🔍 Not reproduced · ⏳ Deferred (needs backend/coordination)

---

## CRITICAL (must fix before any release)

| # | Status | File | Issue |
|---|--------|------|-------|
| C-01 | ✅ | `src/app/(drawer)/users.tsx:73` | RBAC gate admits unauthenticated users — `myRole &&` short-circuits to `false` when no session |
| C-02 | ✅ | `src/core/stores/authStore.ts:107` | Concurrent-refresh race: multiple 401s all call `refresh()`, rotation backends log the user out |
| C-03 | ✅ | `src/core/repositories/SponsorRepository.ts:130` | `updateAffiliation` catch swallows errors — success toast fires on API failure |
| C-04 | ✅ | `src/core/repositories/SponsorRepository.ts:162` | `updateNewsletterSubscriptions` catch swallows errors — optimistic rollback is dead code |
| C-05 | ✅ | `src/components/feedback/SubmitTicketTab.tsx:7` | `Clipboard` removed from RN core in 0.73 — crashes ticket-copy on Expo SDK 56 (RN 0.77+) |
| C-06 | ✅ | `src/app/event/[id].tsx:32` | `isLoading \|\| !event` guard makes `isError` branch unreachable — infinite skeleton on failure |
| C-07 | ✅ | `src/components/events/BracketView.tsx:12` | `WEB_CONSOLE_URL = 'http://localhost:5173'` compiled into every production build |
| C-08 | ✅ | `src/app/auth/callback.tsx:105` | OAuth token accepted from URL query string — leaks to server logs and browser history |
| C-09 | ⏳ | `src/app/auth/callback.tsx` | No OAuth state/nonce CSRF check — requires backend to issue & verify nonce |
| C-10 | 🔍 | `src/core/repositories/AnnouncementRepository.ts:43` | Reported syntax error `constqs` — **not reproduced** in actual file; code is correct |
| C-11 | 🔍 | `src/hooks/use-leaderboard.ts:76` | Reported syntax error `constownScore` — **not reproduced** in actual file; code is correct |
| C-12 | ⏳ | `src/app/auth/complete-profile.tsx` | No user-identity re-confirmation before applying password — requires backend session check |

---

## HIGH

| # | Status | File | Issue |
|---|--------|------|-------|
| H-01 | ⬜ | `src/core/api/ApiClient.ts` | No request timeout — stalled connection hangs UI forever |
| H-02 | ⬜ | `src/core/storage.ts` | Keychain write/delete failures silently swallowed — can lose session token |
| H-03 | ⬜ | `src/core/stores/authStore.ts:87` | `loadSession` deletes token on any transient error (timeout, airplane mode) |
| H-04 | ⬜ | `src/core/stores/authStore.ts:54` | `adoptToken` writes state/keychain before `getMe()` confirms token validity |
| H-05 | ⬜ | `src/core/repositories/AuthRepository.ts:29` | `logout()` missing `skipAuth: true` — fails with 401 on expired token |
| H-06 | ⬜ | `src/core/repositories/EventRepository.ts` | `getMyRegistration` throws on 404 instead of returning `null` (common path) |
| H-07 | ⬜ | `src/hooks/use-leaderboard.ts` + `use-sponsors.ts` | Query key collision `['sponsors','mine']` — two hooks share one cache slot |
| H-08 | ⬜ | `src/hooks/use-leaderboard.ts:43` | `useSponsorStandings` ignores `time` filter in queryFn — all time tabs show same data |
| H-09 | ⬜ | `src/hooks/use-events.ts` | `useMyRegistration` catch returns `null` for all errors, not just 404 |
| H-10 | ⬜ | `src/hooks/use-media.ts` | `useMediaCommunity` auth state absent from query key — wrong data shown after logout |
| H-11 | ⬜ | `src/hooks/use-feed.ts` | 450 ms artificial delay ships to production (not gated by `__DEV__`) |
| H-12 | ⬜ | `src/components/events/EventTabs.tsx` | `useNativeDriver: true` with `translateX: '25%'` strings — runtime error on native |
| H-13 | ⬜ | `src/components/challenges/ProofUploadGrid.tsx:40` | Link proof tap is a silent no-op (missing `Linking.openURL`) |
| H-14 | ⬜ | `src/components/challenges/ProofUploadGrid.tsx:106` | Video proof rendered in `Image` component — broken preview |
| H-15 | ⬜ | `src/app/challenge/[id]/submission.tsx` | Camera/gallery launched with no permission request — crashes on iOS first launch |
| H-16 | ⬜ | `src/components/events/AuctionView.tsx:68` | "View Full Results →" button calls `router.back()` — label is misleading |
| H-17 | ⬜ | `src/app/login.tsx:56` | Open redirect via unvalidated `returnTo` — any `/` prefix accepted including `//evil.com` |
| H-18 | ⬜ | `src/components/home/HomeHero.tsx` | `Animated.timing` ignores OS Reduce Motion setting — WCAG / App Store flag |
| H-19 | ⬜ | `src/components/home/HomeTabRail.tsx` | `Animated.spring` ignores OS Reduce Motion setting |
| H-20 | ⬜ | `src/components/media/HeroReel.tsx` | Ken Burns loop runs continuously in background — battery drain |
| H-21 | ⬜ | `src/components/media/CommunityMasonry.tsx` | Division by zero when `item.width === 0` — layout crash |
| H-22 | ⬜ | `src/components/media/GlassFilterBar.tsx` | 16×16 dp touch target on clear button (below 44 dp minimum) |
| H-23 | ⬜ | `src/components/leaderboard/InvestPointsSheet.tsx` | `amountText` not reset on sheet close — stale input on reopen |
| H-24 | ⬜ | `src/app/(drawer)/leaderboards.tsx:154` | `useLeaderboardPreviews` with variable array may violate Rules of Hooks |
| H-25 | ⬜ | `src/app/(drawer)/leaderboards.tsx:329` | `confirmInvest` toast reads pre-investment rank from stale cache |
| H-26 | ⬜ | `src/app/(drawer)/points.tsx:107` | Client-side filter on paginated data — false empty states |
| H-27 | ⬜ | `src/components/profile/HistorySection.tsx:330` | Array index as React key in `HistoryList` |
| H-28 | ⬜ | `src/app/(drawer)/leaderboards.tsx:354` | `yourRankState` flashes `spectator` while registration query loads |
| H-29 | ⬜ | `src/components/feedback/SubmitTicketTab.tsx:93` | `pickAttachments` async errors unhandled — no user feedback on failure |
| H-30 | ⬜ | `src/app/auth/otp.tsx` | `busyRef` never reset on success path — effect can re-trigger verify |
| H-31 | ⬜ | `src/app/(drawer)/feedback.tsx:78` | `pagerRef` in `useCallback` deps — stale closure, real deps missing |
| H-32 | ⬜ | `src/app/(drawer)/sponsors.tsx` | Newsletter switch no `onError` rollback |
| H-33 | ⬜ | `src/app/challenge/[id]/submission.tsx` | Duplicate submissions possible while mutation pending (double-tap) |
| H-34 | ⬜ | `src/components/leaderboard/SponsorBarChart.tsx` | Bar animation stale when `rows` data changes |
| H-35 | ⬜ | `src/app/login.tsx:60` | Error message read from potentially stale Zustand store state |
| H-36 | ⬜ | `src/app/(drawer)/users.tsx:402` | "View Full Profile" navigates to own profile, not selected user's |
| H-37 | ⬜ | `src/app/(drawer)/leaderboards.tsx` | Haptics fired on scroll momentum, not user tap |
| H-38 | ⬜ | `src/app/(drawer)/points.tsx` | `onTransactionPress` defined at module scope outside any component |

---

## MEDIUM

| # | Status | File | Issue |
|---|--------|------|-------|
| M-01 | ⬜ | `src/core/api/ApiClient.ts` | `parse` casts to `T` without validation — silent DTO shape drift |
| M-02 | ⬜ | `src/core/api/ApiClient.ts` | Missing `put` HTTP method |
| M-03 | ⬜ | `src/core/env.ts` | No startup assertion when `EXPO_PUBLIC_API_URL` is unset in production |
| M-04 | ⬜ | `src/core/repositories/EventRepository.ts` | `toEvent(dto: any)` discards all type safety at the DTO boundary |
| M-05 | ⬜ | `src/core/repositories/UserRepository.ts:57` | Falsy check `if (params.page)` drops `page: 0` silently |
| M-06 | ⬜ | `src/core/repositories/FriendRepository.ts` | `acceptRequest` removes from requests but never adds to friends |
| M-07 | ⬜ | `src/core/repositories/UserRepository.ts` | `sendFriendRequest` duplicates `FriendRepository.sendRequest` |
| M-08 | ⬜ | `src/core/repositories/AnnouncementRepository.ts:12` | Author `id` uses `createdBy` (author ID) not announcement ID — wrong avatar seed |
| M-09 | ⬜ | `src/core/repositories/UserRepository.ts` | `updateMe` accepts `Partial<User>` including privileged fields (`role`, `id`) |
| M-10 | ⬜ | `src/core/repositories/SponsorRepository.ts:121` | `getMyAffiliation` returns `null` for all errors — 500 looks like "no affiliation" |
| M-11 | ⬜ | `src/lib/dates.ts` | No `Invalid Date` guard — malformed input renders "Invalid Date" in UI |
| M-12 | ⬜ | `src/core/types.ts` | `ProofItem.id` required on client-created items — client must fabricate server IDs |
| M-13 | ⬜ | `src/hooks/use-friends.ts` | `useSendFriendRequest` no `onSuccess` cache invalidation — button stays stale |
| M-14 | ⬜ | `src/hooks/use-friends.ts` | Friend queries fire for unauthenticated users — no `enabled` guard |
| M-15 | ⬜ | `src/hooks/use-feedback.ts` | `useCoordinators` / `useLegacyAdmins` have no `staleTime` — refetch every mount |
| M-16 | ⬜ | `src/hooks/use-challenges.ts` | `useActiveChallenges` puts `userId` in key but repo ignores it |
| M-17 | ⬜ | `src/hooks/use-points.ts` | `userId` decorates keys but never passed to queryFn |
| M-18 | ⬜ | `src/hooks/use-events.ts` | `useWithdrawRegistration` silently drops `registrationId` param |
| M-19 | ⬜ | `src/hooks/use-users.ts` | `sortMap` rebuilt on every render — hoist to module scope |
| M-20 | ⬜ | `src/components/home/HomeTabRail.tsx:49` | `BlurView tint="dark"` hardcoded — wrong in light mode |
| M-21 | ⬜ | `src/components/home/HomeTabRail.tsx:47` | Tab rail container missing `accessibilityRole="tablist"` |
| M-22 | ⬜ | `src/components/home/HomeHero.tsx:61` | Decorative cue icon not hidden from accessibility tree |
| M-23 | ⬜ | `src/components/home/IntroTab.tsx:65` | `scrollEventThrottle={64}` too coarse for 32 px threshold |
| M-24 | ⬜ | `src/components/leaderboard/InvestPointsSheet.tsx:22` | `eventId` prop declared but never used in component |
| M-25 | ⬜ | `src/components/leaderboard/SponsorBarChart.tsx:133` | `transformOrigin: 'left'` not a valid RN style — bar grows from center |
| M-26 | ⬜ | `src/components/leaderboard/EventBrowserCard.tsx` | Duplicate `onPress` on card + inner Pressable → double-navigation |
| M-27 | ⬜ | `src/components/media/CommunityMasonry.tsx:103` | `splitMasonry` uses hardcoded `200` width for height estimates |
| M-28 | ⬜ | `src/components/leaderboard/SponsorStandingCard.tsx:102` | `initials('')` returns `'undefined'` on empty string |
| M-29 | ⬜ | `src/app/(drawer)/leaderboards.tsx:283` | "Most Participants" sort uses `maxParticipants` (capacity) not enrollment |
| M-30 | ⬜ | `src/app/(drawer)/hall-of-fame.tsx` | `pageEmpty` true when a query errors (data `undefined` → length 0 is falsy) |

---

## LOW

| # | Status | File | Issue |
|---|--------|------|-------|
| L-01 | ⬜ | `src/hooks/use-feed.ts` | Imports mock data from component layer (`@/components/home/mock-feed`) |
| L-02 | ⬜ | `src/hooks/use-challenges.ts` | Infinite query over-fetches on exact page-size boundaries |
| L-03 | ⬜ | `src/hooks/use-media.ts` | `useMediaMemories` uses `'me'` string fallback when `user` is null |
| L-04 | ⬜ | `src/core/viewmodel/BaseViewModel.ts` | `runAsync` discards error status code — callers can't distinguish 403 vs 500 |
| L-05 | ⬜ | `src/lib/query-client.ts` | No global query error handler for crash reporting / toast fallback |
| L-06 | ⬜ | `src/core/repositories/UserRepository.ts` | `disableAccount` sends `userId` in body, not URL — inconsistent REST |
| L-07 | ⬜ | `src/core/repositories/UserRepository.ts` | `getEventHistory` hardcodes `limit=20`, no override |
| L-08 | ⬜ | `src/core/repositories/SponsorRepository.ts:152` | `getNewsletterSubscriptions` returns fabricated defaults on error |
| L-09 | ⬜ | `src/core/repositories/FriendRepository.ts` | Module-level mutable mock state leaks across tests |
| L-10 | ⬜ | `src/app/(drawer)/_layout.tsx` | "Users" drawer item visible to non-admin roles → immediate redirect |
| L-11 | ⬜ | `src/app/register.tsx` + `login.tsx` | `OrDivider` duplicated in both files |
| L-12 | ⬜ | `src/app/(drawer)/sponsors.tsx` | `${statusColor}22` hex concatenation breaks for `rgba()` colors |
| L-13 | ⬜ | `src/app/(drawer)/users.tsx:53` | `ROLE_COLORS` hardcoded hex values bypass theme system |
| L-14 | ⬜ | `src/app/auth/otp.tsx` | `+` in email mangled by expo-router param serialization |
| L-15 | ⬜ | `src/app/challenge/[id].tsx` | Hardcoded production URL in `share()` — staging builds produce wrong links |
| L-16 | ⬜ | `src/viewmodels/ProfileViewModel.ts` | Dead code — no screen uses this ViewModel |
| L-17 | ⬜ | `src/components/media/SectionStates.tsx:95` | Emoji in `LargeEmpty` violates §16.2 style rule (vector icons only) |
| L-18 | ⬜ | `src/components/media/GlassFilterBar.tsx` | `BlurView tint="dark"` hardcoded — wrong in light mode |
| L-19 | ⬜ | `src/components/media/FadeOverlay.tsx:26` | Array index as React key on static array |
| L-20 | ⬜ | `src/components/leaderboard/states.tsx:45` | `SectionError` accessibility label is a generic hardcoded string |

---

## Statistics

| Severity | Total | Fixed | Pending | Not Reproduced | Deferred |
|----------|-------|-------|---------|----------------|----------|
| CRITICAL | 12 | 8 | 0 | 2 | 2 |
| HIGH | 38 | 0 | 38 | 0 | 0 |
| MEDIUM | 30 | 0 | 30 | 0 | 0 |
| LOW | 20 | 0 | 20 | 0 | 0 |
| **Total** | **100** | **8** | **88** | **2** | **2** |

---

## Fix log

| Date | Item | Change |
|------|------|--------|
| 2026-08-10 | C-01 | `users.tsx`: inverted RBAC guard; added `authStatus` loading check |
| 2026-08-10 | C-02 | `authStore.ts`: added `refreshInFlight` deduplication singleton |
| 2026-08-10 | C-03 | `SponsorRepository.ts`: removed error-swallowing catch in `updateAffiliation` |
| 2026-08-10 | C-04 | `SponsorRepository.ts`: removed error-swallowing catch in `updateNewsletterSubscriptions` |
| 2026-08-10 | C-05 | `SubmitTicketTab.tsx`: replaced deprecated `Clipboard` with `expo-clipboard` |
| 2026-08-10 | C-06 | `event/[id].tsx`: split `isLoading \|\| !event` guard — error state now reachable |
| 2026-08-10 | C-07 | `env.ts` + `BracketView.tsx`: localhost URL moved to `EXPO_PUBLIC_WEB_CONSOLE_URL` env var |
| 2026-08-10 | C-08 | `callback.tsx`: removed query-string token fallback; token only from fragment or RN params |
