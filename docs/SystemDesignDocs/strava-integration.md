# Strava Integration — Backend Design

> Status: DRAFT — For review before implementation.

## 1. Overview

Strava is an account-linking integration (not login). A user must already have a BGSC account and be authenticated before they can connect Strava. Once connected, the platform:

- Stores the user's Strava access + refresh tokens
- Receives real-time activity pushes via a Strava webhook
- Runs a daily batch sync for historical activities
- Exposes activity data on the user's profile

---

## 2. Scope

| In scope | Out of scope |
|---|---|
| OAuth2 connect / disconnect flow | Using Strava as a login method |
| Token storage and auto-refresh | Posting activities back to Strava |
| Real-time webhook handler | Route maps / GPS data rendering (Phase 3) |
| Activity data sync and storage | Points awarded for activities (Phase 3 — Points Service) |
| Profile display API | |

---

## 3. Architecture: Which Service Owns What

The platform already splits OAuth (auth-service) from user data (user-service). Strava follows the same split:

```
User (authenticated) ──► GET /auth/strava/connect  ──► auth-service
                                │
                     Redirects to Strava OAuth
                                │
Strava ──────────────► GET /auth/strava/callback   ──► auth-service
                                │
              Publishes StravaConnected event on event bus
                                │
                         user-service (consumer)
                         └─ stores strava_credentials row
                         └─ backfills last 30 days of activities
                                │
Strava ──────────────► POST /strava/webhook         ──► user-service
                         └─ stores new activity
                         └─ emits StravaActivitySynced event
```

**Why this split:**
- `auth-service` already owns all OAuth flows (Google lives here). Consistent.
- `user-service` already owns `strava_id` on the User entity. Token storage and activity data are user-profile data — they belong here.
- Webhook endpoint needs no auth context; user-service can handle it independently.

---

## 4. Strava OAuth Scopes

Request these scopes during authorization:

```
activity:read_all
profile:read_all
```

`activity:read_all` gives access to private activities.  
`profile:read_all` gives access to the Strava athlete profile (used to confirm identity and get athlete ID).

---

## 5. OAuth Connect / Disconnect Flow (auth-service)

### 5.1 New files

```
auth-service/src/
├── strategies/
│   └── strava.strategy.ts          ← PassportStrategy(Strategy, 'strava')
├── guards/
│   └── strava-auth.guard.ts        ← AuthGuard('strava')
└── controllers/
    └── strava.controller.ts        ← GET /auth/strava/connect & /callback
                                       DELETE /auth/strava/disconnect
```

### 5.2 Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/strava/connect` | JWT required | Redirect to Strava consent screen |
| `GET` | `/auth/strava/callback` | Public (Strava redirect) | Handle OAuth callback |
| `DELETE` | `/auth/strava/disconnect` | JWT required | Revoke tokens and unlink |

### 5.3 Connect flow (step by step)

1. Frontend calls `GET /auth/strava/connect` with the user's JWT.
2. auth-service encodes `userId` in OAuth state (signed, short-lived — use the existing Redis pattern from Google OAuth state).
3. Redirect to Strava.
4. User approves. Strava redirects to `/auth/strava/callback?code=...&state=...`.
5. auth-service exchanges code for tokens (Strava access_token + refresh_token + expires_at + athlete_id).
6. Validates state to recover `userId`.
7. Publishes `StravaConnected` event on the event bus with the tokens and athlete profile.
8. Redirects frontend to `/settings/integrations?strava=connected`.

### 5.4 Disconnect flow

1. Authenticated user calls `DELETE /auth/strava/disconnect`.
2. auth-service publishes `StravaDisconnected` event with `userId`.
3. user-service consumer deletes the `strava_credentials` row and clears `strava_id` on the User.
4.  call Strava's `/oauth/deauthorize` endpoint to revoke the token on Strava's side.

### 5.5 Strava Strategy (passport-strava-oauth2 or manual)

`passport-strava-oauth2` is a community package. Given its low maintenance, **implement the strategy manually** using `passport-oauth2` (already installed via `@types/passport-oauth2`) and Strava's endpoints:

```
Authorization URL: https://www.strava.com/oauth/authorize
Token URL:         https://www.strava.com/oauth/token
```

---

## 6. Token Storage (user-service)

### 6.1 New entity: `strava_credentials`

```ts
@Entity({ name: 'strava_credentials' })
export class StravaCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'athlete_id', type: 'bigint' })
  athleteId: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;                   // encrypted at rest

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;                  // encrypted at rest

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'scope', type: 'varchar' })
  scope: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

Tokens are sensitive. Encrypt `access_token` and `refresh_token` at rest using AES-256-GCM (same pattern as TOTP secrets in auth-service).

### 6.2 Token refresh

Before every API call to Strava, check `expiresAt`. If within 5 minutes of expiry, exchange the refresh token:

```
POST https://www.strava.com/oauth/token
  { client_id, client_secret, grant_type: 'refresh_token', refresh_token }
```

Update the row with the new access_token + expires_at.

---

## 7. Activity Data Model (user-service)

### 7.1 New entity: `strava_activities`

```ts
@Entity({ name: 'strava_activities' })
export class StravaActivity {
  @PrimaryColumn({ name: 'strava_id', type: 'bigint' })
  stravaId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;                    // Run, Ride, Swim, Walk, etc.

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'distance_meters', type: 'float' })
  distanceMeters: number;

  @Column({ name: 'moving_time_seconds', type: 'integer' })
  movingTimeSeconds: number;

  @Column({ name: 'elapsed_time_seconds', type: 'integer' })
  elapsedTimeSeconds: number;

  @Column({ name: 'total_elevation_gain', type: 'float', nullable: true })
  totalElevationGain: number | null;

  @Column({ name: 'average_speed', type: 'float', nullable: true })
  averageSpeed: number | null;

  @Column({ name: 'average_heartrate', type: 'float', nullable: true })
  averageHeartrate: number | null;

  @Column({ name: 'calories', type: 'float', nullable: true })
  calories: number | null;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  @Column({ name: 'raw', type: 'jsonb', default: () => "'{}'::jsonb" })
  raw: Record<string, unknown>;    // full Strava API response, for future use

  @CreateDateColumn({ name: 'synced_at', type: 'timestamptz' })
  syncedAt: Date;
}
```

---

## 8. Webhook Handler (user-service)

Strava sends a `POST` to a registered URL for every new activity, update, or delete.

### 8.1 Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/strava/webhook` | Public | Webhook verification (Strava hub challenge) |
| `POST` | `/strava/webhook` | Public (HMAC verified) | Receive activity events |

### 8.2 Verification handshake

When registering the webhook with Strava, Strava sends:
```
GET /strava/webhook?hub.mode=subscribe&hub.challenge=<token>&hub.verify_token=<your_secret>
```
Respond with `{ "hub.challenge": "<token>" }` if `hub.verify_token` matches your env var.

### 8.3 Event handling (POST)

Strava webhook payload:
```json
{
  "object_type": "activity",
  "object_id": 12345678,
  "aspect_type": "create",
  "owner_id": 987654,
  "event_time": 1609459200
}
```

Flow:
1. Verify the request is from Strava (check `hub.verify_token` header or use a webhook secret).
2. Look up user by `athlete_id` (`owner_id`) in `strava_credentials`.
3. If `aspect_type === 'create'`: fetch full activity from Strava API → upsert into `strava_activities`.
4. If `aspect_type === 'update'`: refetch and update.
5. If `aspect_type === 'delete'`: delete row by `stravaId`.
6. Emit `StravaActivitySynced` event on event bus (for Points Service to consume later).
7. Return `200 OK` immediately — do the fetch asynchronously via a BullMQ job to avoid webhook timeouts.

### 8.4 Webhook registration

Register the webhook once at app bootstrap (or via a one-time admin script):

```
POST https://www.strava.com/api/v3/push_subscriptions
  { client_id, client_secret, callback_url, verify_token }
```

Store the subscription ID in an env var or config table.

---

## 9. Batch Sync (user-service)

### 9.1 Initial backfill

Triggered when `StravaConnected` event is consumed. Fetches activities from the last 30 days using:

```
GET https://www.strava.com/api/v3/athlete/activities?before=<epoch>&after=<epoch>&per_page=100&page=<n>
```

Paginate until no results. Upsert all into `strava_activities`.

### 9.2 Daily sync (BullMQ repeatable job)

Runs nightly at 02:00. For each user with active `strava_credentials`, fetches activities since the last sync timestamp. Handles rate limits (Strava allows 200 req/15 min, 2000 req/day per app).

---

## 10. New API Endpoints (user-service)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me/strava/activities` | JWT | Paginated activity list for current user |
| `GET` | `/users/me/strava/stats` | JWT | Weekly summary (distance, time, count by type) |
| `GET` | `/users/:id/strava/activities` | JWT | Public activity feed for another user's profile |

---

## 11. New Environment Variables

### auth-service

```env
STRAVA_CLIENT_ID=<from Strava app settings>
STRAVA_CLIENT_SECRET=<from Strava app settings>
STRAVA_CALLBACK_URL=https://api.bgsc-platform.in/auth/strava/callback
```

### user-service

```env
STRAVA_CLIENT_ID=<same>
STRAVA_CLIENT_SECRET=<same>
STRAVA_WEBHOOK_VERIFY_TOKEN=<random secret — used to verify Strava webhook registration>
STRAVA_TOKEN_ENCRYPTION_KEY=<64-char hex — for AES-256-GCM encryption of stored tokens>
```

---

## 12. New Config Keys (auth.config.ts additions)

```ts
strava: {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  callbackUrl: process.env.STRAVA_CALLBACK_URL,
},
```

---

## 13. Event Bus Events

| Event | Publisher | Consumers | Payload |
|---|---|---|---|
| `StravaConnected` | auth-service | user-service | `{ userId, athleteId, accessToken, refreshToken, expiresAt, scope }` |
| `StravaDisconnected` | auth-service | user-service | `{ userId }` |
| `StravaActivitySynced` | user-service | points-service (future) | `{ userId, activityId, type, distanceMeters, movingTimeSeconds }` |

---

## 14. DB Migrations

Two new migrations needed in **user-service**:

1. `AddStravaCredentialsTable` — creates `strava_credentials`
2. `AddStravaActivitiesTable` — creates `strava_activities`

The existing migration `1750000000000-AddUserProfileColumns` already added `strava_id` to the `users` table — no change needed there.

---

## 15. New Packages

| Package | Service | Purpose |
|---|---|---|
| `passport-oauth2` | auth-service | Already installed (via `@types/passport-oauth2`) — use for Strava strategy |
| `strava-v3` (optional) | user-service | Typed Strava API client — evaluate vs plain `axios` |

Recommendation: use plain `axios` for Strava API calls in user-service to avoid adding an unmaintained dependency. Strava's API is stable and well-documented.

---

## 16. Implementation Order

1. Add env vars + config keys to auth-service and user-service
2. Create `strava_credentials` migration + entity in user-service
3. Create `strava_activities` migration + entity in user-service
4. Implement Strava strategy + guard + controller in auth-service (connect/disconnect)
5. Implement event bus consumer in user-service for `StravaConnected` / `StravaDisconnected`
6. Implement token storage + refresh service in user-service
7. Implement webhook handler in user-service
8. Implement initial backfill job (BullMQ) in user-service
9. Implement daily sync job (BullMQ repeatable) in user-service
10. Implement activity feed + stats endpoints in user-service
11. Register Strava webhook (one-time, post-deploy)

---

## 17. Open Questions for Review

- **Webhook URL**: The webhook must be publicly reachable. In dev, use ngrok. Confirm production URL format.
- **Token encryption key**: Should this share the same encryption key as TOTP, or be a separate key? Recommendation: separate key per concern.
- **Activity privacy**: Strava activities can be private. The `raw` jsonb column stores the full response so privacy flags are preserved. Decide whether to display private activities on the BGSC profile or filter them out.
- **Rate limiting**: With 2000 req/day across all users, the daily batch sync needs to be staggered. At >200 connected users, individual activity fetches on webhook events could exhaust the limit. We may need to throttle or prioritize webhook-triggered fetches.
- **Points integration**: `StravaActivitySynced` is defined above but Points Service is not yet built. Confirm this event shape is sufficient when that work starts.
