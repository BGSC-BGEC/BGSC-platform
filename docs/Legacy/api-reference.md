# BGSC Platform — API Reference

All requests go through the single gateway at `http://localhost:3000`.  
Frontends never call individual services directly.

**Auth:** Protected routes require `Authorization: Bearer <accessToken>`.  
The gateway verifies the JWT and injects `x-user-id` / `x-user-role` headers before forwarding.  
Refresh uses the `bgsc_refresh_token` httpOnly cookie (web) or an explicit POST /auth/refresh call (mobile).

---

## Auth Service (`/auth`, `/account`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | Public | Redirect to Google OAuth2 consent |
| GET | `/auth/google/callback` | Public | Google OAuth2 callback → redirects to frontend with `#access_token=` |
| POST | `/auth/register` | Public | Register new user. Body: `{username, email, password, acceptedTos, contact?}` |
| POST | `/auth/login` | Public | Login. Body: `{usernameOrEmail, password, keepMeLoggedIn?}`. Returns `{accessToken, user}` or `{requiresTOTP, tempToken}` |
| POST | `/auth/refresh` | Public (cookie) | Refresh access token using `bgsc_refresh_token` cookie |
| POST | `/auth/logout` | Protected | Logout current session, clears cookie |
| POST | `/auth/logout-all` | Protected | Logout all sessions across all devices |
| POST | `/auth/forgot-password` | Public | Request password reset email. Body: `{email}` |
| POST | `/auth/reset-password` | Public | Reset password. Body: `{token, password}` |
| POST | `/auth/change-password` | Protected | Change password. Body: `{currentPassword, newPassword}` |
| GET | `/auth/sessions` | Protected | List active sessions |
| DELETE | `/auth/sessions/:familyId` | Protected | Revoke a specific session |
| POST | `/auth/totp/setup` | Protected | Initialize TOTP 2FA — returns secret + QR code |
| POST | `/auth/totp/verify-setup` | Protected | Enable 2FA after scanning QR. Body: `{token}` |
| POST | `/auth/totp/authenticate` | Public | Complete login with TOTP code. Body: `{tempToken, token, keepMeLoggedIn?}` |
| POST | `/auth/totp/disable` | Protected | Disable 2FA. Body: `{token}` |
| GET | `/auth/strava/connect` | Protected (header) | Initiate Strava account linking |
| GET | `/auth/strava/callback` | Public | Strava OAuth callback |
| DELETE | `/auth/strava/disconnect` | Protected (header) | Unlink Strava account |
| POST | `/account/disable` | Protected | Disable account. Body: `{userId}` |
| POST | `/account/:userId/enable` | Coordinator+ | Enable a disabled account |
| POST | `/account/delete` | Protected | Schedule own account for deletion (30-day grace) |
| POST | `/account/cancel-deletion` | Protected | Cancel pending account deletion |
| POST | `/account/export` | Protected | Request data export (1/24h) |

**Rate limits (stricter):** register 3/hr · login 5/15min · TOTP verify 5/15min · forgot-password 3/hr

---

## User Service (`/users`, `/strava`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Protected | Get own user record |
| PATCH | `/users/me` | Protected | Update own user fields |
| GET | `/users/me/profile` | Protected | Extended profile (bio, interests, social links, stats) |
| PATCH | `/users/me/profile` | Protected | Update profile fields |
| PATCH | `/users/me/interests` | Protected | Update interest IDs only |
| GET | `/users/me/sponsor-stats` | Protected | Current sponsor affiliation stats (null if none) |
| GET | `/users/me/player-card` | Protected | Shareable player card JSON |
| GET | `/users/me/event-suggestions` | Protected | Upcoming events matched to interests |
| GET | `/users/me/friend-suggestions` | Protected | Friend suggestions (Phase 2 stub — returns []) |
| GET | `/users/me/history/events` | Protected | Paginated event registration history |
| GET | `/users/me/history/matches` | Protected | Match history (Phase 3 stub — returns []) |
| GET | `/users/me/history/challenges` | Protected | Challenge history (Phase 2 stub — returns []) |
| GET | `/users/me/history/sponsor` | Protected | Sponsor contribution timeline (Phase 2 stub — returns []) |
| POST | `/users/me/sponsor` | Protected | Select sponsor affiliation. Body: `{sponsorId}` |
| GET | `/users/interests` | Protected | Interests catalog (all roles) |
| GET | `/users` | Coordinator+ | List all users. Query: `role, status, page, limit` |
| POST | `/users` | Coordinator+ | Create user manually |
| PATCH | `/users/:id` | Coordinator+ | Update any user |
| DELETE | `/users/:id` | Coordinator+ | Remove user |
| GET | `/users/:id` | Protected | Get public profile of any user |
| GET | `/strava/me/activities` | Protected | Own Strava activity feed |
| GET | `/strava/me/stats` | Protected | Own weekly Strava stats |
| GET | `/strava/me/status` | Protected | Check if Strava is connected |
| GET | `/strava/:userId/activities` | Protected | Another user's Strava activities |
| GET | `/strava/webhook` | Public | Strava webhook verification challenge |
| POST | `/strava/webhook` | Public | Receive Strava activity push events |

---

## Sponsor Service (`/sponsors`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sponsors` | Public | List all sponsors. Query: `status, page, limit` |
| GET | `/sponsors/active` | Public | Active sponsors only |
| GET | `/sponsors/leaderboard` | Public | Sponsor fan leaderboard |
| GET | `/sponsors/:id` | Public | Get sponsor by ID |
| POST | `/sponsors` | Coordinator+ | Create sponsor |
| PATCH | `/sponsors/:id` | Coordinator+ | Update sponsor |
| DELETE | `/sponsors/:id` | Coordinator+ | Delete sponsor |
| PATCH | `/sponsors/:id/tenure-end` | Coordinator+ | End sponsor tenure |
| POST | `/sponsors/:id/fans` | Coordinator+ | Award fans to a sponsor |

---

## Event Service (`/events`, `/hall-of-fame`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/events` | Public | List events. Query: `status, type, page, limit` |
| GET | `/events/me/registrations` | Protected | Own event registration history |
| GET | `/events/me/stats` | Protected | Own total registrations + wins |
| GET | `/events/:id` | Public | Get event by ID |
| POST | `/events` | Coordinator+ | Create event |
| POST | `/events/:id/register` | Protected | Register for an event |
| GET | `/events/:id/my-registration` | Protected | Own registration for a specific event |
| DELETE | `/events/:id/registrations/:registrationId` | Protected | Withdraw registration |
| POST | `/events/:id/captain-application` | Protected | Apply to be team captain |
| POST | `/events/:id/scores` | Coordinator+ | Submit scores |
| GET | `/events/:id/leaderboard` | Public | Event leaderboard |
| PATCH | `/events/:id/complete` | Coordinator+ | Mark event as complete |
| GET | `/hall-of-fame/event-winners` | Public | All-time event winners |
| GET | `/hall-of-fame/sponsor-champions` | Public | Sponsor fan champions |

---

## Points Service (`/points`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/points/me/balance` | Protected | Own points balance |
| GET | `/points/me/transactions` | Protected | Own transaction history. Query: `source, type, page, limit` |
| GET | `/points/balance/:userId` | Protected | Any user's balance (self or admin) |
| GET | `/points/transactions/:userId` | Core+ | Any user's transaction history |
| POST | `/points/award` | Coordinator+ | Award points to a user |
| POST | `/points/participation` | Coordinator+ | Award 10-point participation credit |

---

## Notification Service (`/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications/me` | Protected | Own notifications (paginated) |
| PATCH | `/notifications/:id/read` | Protected | Mark one notification as read |
| PATCH | `/notifications/read-all` | Protected | Mark all as read |
| POST | `/notifications` | Internal only | Create notification (blocked at gateway for external callers) |

---

## Announcement Service (`/announcements`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/announcements` | Public | List non-expired announcements. Query: `type, tag, page, limit` |
| GET | `/announcements/:id` | Public | Get announcement by ID |
| POST | `/announcements` | Core+ | Create announcement |
| PATCH | `/announcements/:id` | Core+ | Update announcement |
| DELETE | `/announcements/:id` | Coordinator+ | Delete announcement |

---

## Social Service (`/social/posts`, `/social/feed`, `/social/friends`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/social/posts` | Protected | Create a post |
| GET | `/social/posts/:id` | Public | Get post by ID |
| DELETE | `/social/posts/:id` | Protected | Delete a post (own) |
| POST | `/social/posts/:id/like` | Protected | Like a post |
| DELETE | `/social/posts/:id/like` | Protected | Unlike a post |
| POST | `/social/posts/:id/comments` | Protected | Add comment |
| GET | `/social/posts/:id/comments` | Protected | Get comments (paginated) |
| DELETE | `/social/posts/:postId/comments/:commentId` | Protected | Delete comment |
| GET | `/social/feed` | Protected | Personalized feed (friends + public) |
| GET | `/social/feed/public` | Public | Public feed |
| GET | `/social/friends` | Protected | List accepted friends |
| POST | `/social/friends/requests` | Protected | Send friend request |
| GET | `/social/friends/requests/incoming` | Protected | Incoming friend requests |
| GET | `/social/friends/requests/outgoing` | Protected | Outgoing friend requests |
| PATCH | `/social/friends/requests/:id/accept` | Protected | Accept friend request |
| PATCH | `/social/friends/requests/:id/reject` | Protected | Reject friend request |
| POST | `/social/friends/:userId/block` | Protected | Block a user |
| DELETE | `/social/friends/:userId` | Protected | Remove friend |
| GET | `/social/friends/suggestions` | Protected | Friend suggestions (mutual connections) |
| POST | `/social/friends/presence` | Protected | Heartbeat (5-min online TTL) |
| GET | `/social/friends/online` | Protected | Online status of friends |

---

## Challenge Service (`/challenges`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/challenges` | Public | Browse challenges. Query: `domain, difficulty, status` |
| GET | `/challenges/me/accepted` | Protected | Own accepted challenges |
| GET | `/challenges/me/submissions` | Protected | Own submissions |
| GET | `/challenges/:id` | Public | Get challenge by ID |
| POST | `/challenges` | Core+ | Create challenge |
| PATCH | `/challenges/:id` | Core+ | Update challenge |
| DELETE | `/challenges/:id` | Coordinator+ | Delete challenge |
| POST | `/challenges/:id/accept` | Protected | Accept a challenge |
| POST | `/challenges/:id/submit` | Protected | Submit proof |
| GET | `/challenges/:id/submissions` | Core+ | All submissions for a challenge |
| PATCH | `/challenges/:challengeId/submissions/:submissionId/review` | Core+ | Approve/reject submission |

---

## Gateway-blocked internal endpoints

These are rejected with 403 at the gateway edge — they are service-to-service only:

- `POST /notifications` — notification creation (internal event bus)
- `POST /strava/internal/link` — called by auth-service to link Strava tokens
- `DELETE /strava/internal/unlink/:userId` — called by auth-service to unlink

---

## Role hierarchy

`guest < user < member < core < coordinator < founder`

- **Public** — no token required
- **Protected** — any authenticated user (user+)
- **Core+** — role ≥ core
- **Coordinator+** — role ≥ coordinator
