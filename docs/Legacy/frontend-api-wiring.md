# BGSC Platform — Frontend API Wiring

Shows which repository method each screen/page calls, what endpoint that maps to, and the current status (live = hits real backend, mock = local data only).

---

## Web Admin (`/web`)

Single API client: `web/src/core/api/ApiClient.ts`  
Base URL: `VITE_API_URL` (default `http://localhost:3000`)

### Repositories

| Repository | File | Methods | Endpoint(s) | Status |
|-----------|------|---------|-------------|--------|
| AuthRepository | `core/repositories/AuthRepository.ts` | `register` | POST `/auth/register` | Live |
| | | `login` | POST `/auth/login` | Live |
| | | `refresh` | POST `/auth/refresh` | Live |
| | | `logout` | POST `/auth/logout` | Live |
| | | `googleAuthUrl` | GET `/auth/google` (redirect) | Live |
| EventRepository | `core/repositories/EventRepository.ts` | `list` | GET `/events` | Live |
| | | `getById` | GET `/events/:id` | Live |
| UserRepository | `core/repositories/UserRepository.ts` | `getMe` | GET `/users/me` | Live |
| | | `updateMe` | PATCH `/users/me` | Live |

### Pages and what they call

| Page | File | Repository calls |
|------|------|-----------------|
| Login | `pages/Login.tsx` | `AuthRepository.login`, `AuthRepository.googleAuthUrl` |
| BracketManagerPage | `pages/BracketManagerPage.tsx` | `EventRepository.list`, `EventRepository.getById` |
| ModerationPage | `pages/ModerationPage.tsx` | User management (via `UserRepository`) |
| BroadcastsPage | `pages/BroadcastsPage.tsx` | (check page for specific calls) |
| InvestmentsPage | `pages/InvestmentsPage.tsx` | Sponsor/points (check page) |
| AuctionsPage | `pages/AuctionsPage.tsx` | (check page for specific calls) |

---

## Mobile App (`/mobile`)

Single API client: `mobile/src/core/api/ApiClient.ts`  
Base URL: `EXPO_PUBLIC_API_URL` (default `http://localhost:3000`)

### Repositories

| Repository | File | Methods | Endpoint(s) | Status |
|-----------|------|---------|-------------|--------|
| AuthRepository | `core/repositories/AuthRepository.ts` | `register` | POST `/auth/register` | Live |
| | | `login` | POST `/auth/login` | Live |
| | | `refresh` | POST `/auth/refresh` | Live |
| | | `logout` | POST `/auth/logout` | Live |
| | | `verifyEmail` | POST `/auth/verify-email` | Live |
| | | `resendOtp` | POST `/auth/resend-otp` | Live |
| | | `completeGoogleProfile` | POST `/auth/complete-profile` | Live |
| | | `googleAuthUrl` | GET `/auth/google` (redirect) | Live |
| EventRepository | `core/repositories/EventRepository.ts` | `list` | GET `/events` | Live |
| | | `getById` | GET `/events/:id` | Live |
| | | `register` | POST `/events/:id/register` | Live |
| | | `withdrawRegistration` | DELETE `/events/:id/registrations/:regId` | Live |
| | | `applyForCaptain` | POST `/events/:id/captain-application` | Live |
| | | `getLeaderboard` | GET `/events/:id/leaderboard` | Live |
| | | `getMyRegistration` | GET `/events/:id/my-registration` | Live |
| UserRepository | `core/repositories/UserRepository.ts` | `getMe` | GET `/users/me` | Live |
| | | `updateMe` | PATCH `/users/me` | Live |
| | | `getProfile` | GET `/users/me/profile` | Live |
| | | `updateProfile` | PATCH `/users/me/profile` | Live |
| | | `getInterests` | GET `/users/interests` | Live |
| | | `updateInterests` | PATCH `/users/me/interests` | Live |
| | | `getPlayerCard` | GET `/users/me/player-card` | Live |
| | | `getSponsorStats` | GET `/users/me/sponsor-stats` | Live |
| | | `getEventSuggestions` | GET `/users/me/event-suggestions` | Live |
| | | `getFriendSuggestions` | GET `/users/me/friend-suggestions` | Live |
| | | `getEventHistory` | GET `/events/me/registrations` | Live |
| | | `listUsers` | GET `/users` | Live |
| | | `updateUserRole` | PATCH `/users/:id` | Live |
| | | `disableAccount` | PATCH `/account/disable` | Live |
| HallOfFameRepository | `core/repositories/HallOfFameRepository.ts` | `getEventWinners` | GET `/hall-of-fame/event-winners` | Live |
| | | `getSponsorChampions` | GET `/hall-of-fame/sponsor-champions` | Live |
| PointsRepository | `core/repositories/PointsRepository.ts` | `getBalance` | GET `/points/me/balance` | Live |
| | | `getTransactions` | GET `/points/me/transactions` | Live |
| AnnouncementRepository | `core/repositories/AnnouncementRepository.ts` | `list` | GET `/announcements` | Live |
| | | `create` | POST `/announcements` | Live |
| SponsorRepository | `core/repositories/SponsorRepository.ts` | `getActiveSponsors` | GET `/hall-of-fame/sponsor-champions` (via HallOfFame) | Live |
| | | `getMyAffiliation` | GET `/users/me/sponsor-stats` | Live |
| | | `updateAffiliation` | PATCH `/users/me/sponsor` | Live |
| | | `getPrizes` | — | Mock (Phase 2) |
| | | `getPastSponsors` | — | Mock (Phase 2) |
| | | `getNewsletterSubscriptions` | GET `/users/me/newsletter-subscriptions` | Mock (endpoint not yet implemented) |
| | | `updateNewsletterSubscriptions` | PATCH `/users/me/newsletter-subscriptions` | Mock (endpoint not yet implemented) |
| FriendRepository | `core/repositories/FriendRepository.ts` | all methods | — | Mock (Phase 2) — all local data |
| ChallengeRepository | `core/repositories/ChallengeRepository.ts` | all methods | — | Mock (Phase 2) — all local data |
| FeedbackRepository | `core/repositories/FeedbackRepository.ts` | all methods | — | Mock (Phase 2) — all local data |
| MediaRepository | `core/repositories/MediaRepository.ts` | all methods | — | Mock (Phase 2) — all local data |
| LeaderboardRepository | `core/repositories/LeaderboardRepository.ts` | `investPoints` | — | Mock (Phase 2) — local simulation |
| StoreRepository | `core/repositories/StoreRepository.ts` | all methods | — | Mock (Phase 2) — all local data |

### Screens and what they call

| Screen | File | Live repositories used |
|--------|------|----------------------|
| Home | `app/(drawer)/index.tsx` | Events, Announcements, User |
| Events | `app/(drawer)/events.tsx` | EventRepository |
| Event detail | `app/event/[id].tsx` | EventRepository |
| Leaderboards | `app/(drawer)/leaderboards.tsx` | EventRepository (leaderboard), PointsRepository, HallOfFameRepository |
| Hall of Fame | `app/(drawer)/hall-of-fame.tsx` | HallOfFameRepository |
| Profile | `app/(drawer)/profile.tsx` | UserRepository, PointsRepository |
| Points / Store | `app/(drawer)/points.tsx`, `store.tsx` | PointsRepository (live), StoreRepository (mock) |
| Sponsors | `app/(drawer)/sponsors.tsx` | SponsorRepository (partially live) |
| Friends | `app/(drawer)/friends.tsx` | FriendRepository (mock) |
| Media | `app/(drawer)/media.tsx` | MediaRepository (mock) |
| Feedback | `app/(drawer)/feedback.tsx` | FeedbackRepository (mock) |
| Login | `app/auth/login.tsx` | AuthRepository |
| Register | `app/auth/register.tsx` | AuthRepository |
| OAuth callback | `app/auth/callback.tsx` | AuthRepository |
| OTP | `app/auth/otp.tsx` | AuthRepository |
| Complete profile | `app/auth/complete-profile.tsx` | AuthRepository, UserRepository |
| Challenge detail | `app/challenge/[id].tsx` | ChallengeRepository (mock) |

---

## Phase 2 endpoints not yet implemented

These are called by the frontend but the backend endpoint does not exist yet:

| Frontend call | Expected endpoint | Service |
|---------------|------------------|---------|
| `AnnouncementRepository.list()` with filtering | GET `/announcements?type=&tag=` | announcement-service |
| `UserRepository.sendFriendRequest` | POST `/friendships` | social-service (wrong path — should be `/social/friends/requests`) |
| `SponsorRepository.getNewsletterSubscriptions` | GET `/users/me/newsletter-subscriptions` | user-service |
| `SponsorRepository.updateNewsletterSubscriptions` | PATCH `/users/me/newsletter-subscriptions` | user-service |
| `LeaderboardRepository.investPoints` | POST `/points/invest` | points-service |
| `FriendRepository.*` | `/social/friends/*` | social-service |
| `ChallengeRepository.*` | `/challenges/*` | challenge-service |
| `StoreRepository.*` | `/store/*` | (no store service yet) |
| `FeedbackRepository.*` | `/feedback/*` | (no feedback service yet) |
| `MediaRepository.*` | `/media/*` | (no media service yet) |

---

## Notes on the refresh cookie

- **Web**: relies on the `bgsc_refresh_token` httpOnly cookie automatically sent with `credentials: 'include'`. Cookie is set with `secure: true` — this only works over HTTPS. For local dev over HTTP, the browser will ignore the cookie and refresh will return 401. Workaround: test auth flows with `curl -c cookies.txt` or temporarily set `secure: false` in `auth-service/src/controllers/auth.controller.ts`.

- **Mobile**: does not use cookies. The access token is stored in zustand and the refresh is triggered manually on 401. Refresh token is sent in the request body via POST `/auth/refresh` — but the backend reads it from the cookie. This means the mobile refresh flow needs the refresh token stored in SecureStore and sent explicitly. Check `mobile/src/core/stores/authStore.ts` for the current implementation.
