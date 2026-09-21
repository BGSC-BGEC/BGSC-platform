# Strava Model

**Owner service:** Challenge Service (`:3008`, also serves `/strava`)
**Collections:** `strava_credentials`, `strava_activities`
**Spec refs:** §9.1 Strava (Physical Sports), §12.4 Integration Settings "Connect / Disconnect Strava", §14 scope table (line 2597) — which lists the integration as **excluded from MVP**
**MVP plan refs:** Week 3 BE-2 Sunday (`MVP_Timeline_Plan_Updated.md:381-382`) — "Strava OAuth integration (basic)", "Strava activity sync endpoint"
**Design source:** `docs/SystemDesignDocs/strava-integration.md` — correct on the *idea*, written for a stack this repo does not have (see §6)

---

## 1. Purpose

Strava is **account linking, never a login method**. A user already holds a BGSC account and an
active session before any of this runs; nothing here participates in authentication. Spec §9.1 and
the design doc agree, and it is the first thing to get wrong, so it is stated first.

What the two collections are for: `strava_credentials` holds one row per connected user — the
OAuth tokens, encrypted — and `strava_activities` holds what has been pulled, keyed by Strava's own
activity id.

**Two readers.** The challenge screen (a physical challenge's proof is usually an activity) and the
user profile (Spec §9.1 "Activity feed on user profile"). The models live in
`packages/shared/src/models/Strava.ts` like every other model, so the profile's reader queries the
collection directly and needs no API between the services (`adding-a-service.md §6.5`).

## 2. `strava_credentials`

```ts
{
  _id: string,
  user_id: string,            // unique
  athlete_id: string,         // Strava's athlete id, as a string

  access_token_enc: string,   // AES-256-GCM, 'iv:tag:ciphertext' hex
  refresh_token_enc: string,
  expires_at: Date,           // when Strava's access token dies
  scope: string,              // 'activity:read_all,profile:read_all'

  last_synced_at: Date | null, // watermark for the next sync's `after=`; null before the first
  created_at: Date,
  updated_at: Date
}
```

### 2.1 Encryption

Both tokens are sealed with AES-256-GCM (`crypto.createCipheriv`, stdlib — no dependency) before
they touch the database. They are bearer credentials for somebody else's account: a database dump
or a mis-scoped read must not be a set of live Strava sessions.

The key is `STRAVA_TOKEN_ENCRYPTION_KEY` (64 hex). Blank is tolerated in development, where the key
is derived from `JWT_ACCESS_SECRET` via `scrypt` so a dev database survives a restart, and is a
**hard boot error in production** — the same shape as `assertInternalTokenConfigured`.

### 2.2 Invariants

- `user_id` unique — one Strava account per BGSC user. Reconnecting upserts; it never duplicates.
- `athlete_id` unique — **one BGSC user per Strava athlete**, the other direction. Without it two
  accounts could link the same athlete, and since `strava_activities` is keyed by Strava's own
  activity id, whichever synced last would silently take ownership of the other's rows: the
  activity would move between profiles on every sync. Enforced by the index rather than a
  check-then-insert, which two simultaneous callbacks would both pass. The callback maps the
  duplicate-key error to `409 strava_athlete_already_linked`.
- `access_token_enc` and `refresh_token_enc` match `/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/`. A raw Strava
  token contains no colon, so this is the one way the schema can still catch an unencrypted write.
- `last_synced_at` only ever moves **forward**, and only after a successful sync: a failed sync must
  re-fetch its window rather than skip it.

### 2.3 Indexes

> `athlete_id` was added non-unique first and made unique during the audit. On a database that
> already holds the non-unique version that is a **boot failure**, not a silent upgrade:
> `createIndexes()` cannot alter an existing index. Drop `athlete_id_1` and let the next boot
> rebuild it. `adding-a-service.md §9` has the general rule.


| Index | Serves |
|---|---|
| `{ user_id: 1 }` unique | every read, and one-account-per-user |
| `{ athlete_id: 1 }` **unique** | athlete → user ("whose account is athlete 123?"), a future webhook, and the one-account-per-athlete rule above |

## 3. `strava_activities`

```ts
{
  _id: string,                  // Strava's activity id, as a string — the upsert key IS the dedupe
  user_id: string,
  athlete_id: string,

  type: string,                 // 'Run', 'Ride', 'Swim', ...  (sport_type, falling back to type)
  name: string,
  distance_meters: number,
  moving_time_seconds: number,
  elapsed_time_seconds: number,
  total_elevation_gain: number | null,
  is_private: boolean,          // Strava's own flag, carried so ours can honour it

  start_date: Date,             // when it happened
  synced_at: Date               // when we heard
}
```

`is_private` is the answer to `strava-integration.md §17`'s "Activity privacy" open question. We
request `activity:read_all`, which deliberately returns activities the athlete hid on Strava;
republishing one on a public BGSC profile would make this integration a privacy leak rather than a
feature. So:

- `GET /strava/activities` — **your own** feed, unfiltered;
- `GET /strava/users/:id/activities` — **someone else's**, `is_private: false` only.

The field is `private ?? (visibility !== 'everyone')`, and **defaults to `true`** when Strava tells
us neither: an activity whose privacy we could not read is not one to publish.

No `created_at` / `updated_at`: a row that is re-upserted has no meaningful "created", and the two
dates above already answer both questions.

**No `raw` blob.** `strava-integration.md §7.1` keeps the whole API response in a `jsonb` column
"for future use". That is storing somebody's personal data with no reader and no retention story;
the fields above are what the sync endpoint and the two screens use.

### 3.1 Indexes

| Index | Serves |
|---|---|
| `{ _id }` (Strava's id) | the upsert — a re-sync of an overlapping window rewrites, never duplicates |
| `{ user_id: 1, start_date: -1 }` | the activity feed, keyset paginated on `(start_date, _id)`. `is_private` is deliberately not in the key — another user's feed filters on it, but the selectivity that matters is the user |

## 4. Flows

### 4.1 Connect

```
GET /strava/connect   (auth)
  state = jwt { nonce, sub: user_id }, 10 min, HS256 on JWT_ACCESS_SECRET
  302 -> strava.com/oauth/authorize?...&scope=activity:read_all,profile:read_all&state=...

GET /strava/callback  (public — a browser redirect cannot carry a Bearer token)
  verify state -> user_id        (expired or forged -> 400 invalid_oauth_state)
  POST /oauth/token { code, grant_type: 'authorization_code' }
  upsert strava_credentials, seal both tokens   (E11000 on athlete_id -> 409 strava_athlete_already_linked)
  users.profile.social_links.strava_id = athlete_id
  publish StravaConnected { user_id, athlete_id }
  302 -> ${FRONTEND_URL}/settings/integrations?strava=connected
```

The signed `state` is OAuth CSRF protection (RFC 6749 §10.12) and is not optional: without it an
attacker hands a victim a callback URL carrying the attacker's authorization code, and the victim's
BGSC account is bound to the attacker's Strava athlete. Same implementation as the Google flow in
`auth-service` — a short-lived HMAC token, no session store, no new dependency.

`error=access_denied` (the user pressed Cancel) redirects to `?strava=denied`. Changing your mind
is not a failure.

### 4.2 Token refresh

Before every API call: if `expires_at` is less than 5 minutes away, exchange the refresh token and
re-seal both. A token that dies mid-request is a 401 the user cannot act on.

### 4.3 Sync

```
POST /strava/sync   (auth)
  GET /api/v3/athlete/activities?after=<last_synced_at>&per_page=100&page=1..3
  upsert each by String(activity.id) ; publish StravaActivitySynced per activity
  advance last_synced_at to the newest start_date
  -> { synced, skipped, has_more }
```

Capped at **3 pages per call**. Strava allows 200 requests per 15 minutes for the *whole
application*, so one user's button press must not spend everyone's budget; `has_more` tells the
client to call again. A 429 from Strava surfaces as `503 strava_rate_limited` with `Retry-After`
passed through — an expected state, not a 500.

## 5. Domain events

```
StravaConnected        { user_id, athlete_id }
StravaDisconnected     { user_id }
StravaActivitySynced   { user_id, activity_id, type, distance_meters, moving_time_seconds }
```

**No tokens on the bus.** `strava-integration.md §13` puts `accessToken` and `refreshToken` in the
`StravaConnected` payload. Redis pub/sub is plaintext on one channel every service subscribes to;
publishing a decrypted OAuth token there would undo §2.1 entirely. Nothing consumes them — the
service that stores them is the service that uses them.

Nothing consumes these events today. `StravaActivitySynced` exists so Points can award activity
points when that is in scope (Spec §9.1; the design doc marks it Phase 3).

## 6. Where the design doc and this model disagree

`docs/SystemDesignDocs/strava-integration.md` is marked DRAFT and predates every architecture
decision the repo actually made.

| It says | Here |
|---|---|
| TypeORM `@Entity`, `jsonb`, `timestamptz`, `bigint`, two SQL migrations (§6.1, §7.1, §14) | Mongoose on MongoDB, no migrations |
| NestJS `PassportStrategy`, `AuthGuard('strava')`, `auth.config.ts` (§5.1, §12) | Express 5, manual OAuth, `config/env.ts` |
| BullMQ backfill and nightly repeatable job (§8.3, §9.2) | No job queue; sync is pull-based, on request |
| OAuth in auth-service, storage + webhook in user-service (§3) | All of it in Challenge Service (be2-challenge-service-plan.md D1) |
| Webhook endpoint registered with Strava (§8) | Out of scope: nothing in this stack is publicly reachable, as §17 of that doc concedes |
| Tokens published on the event bus (§13) | §5 above — never |

And **Spec §14's own scope table (line 2597) excludes Strava from the MVP** while the MVP plan
(line 381-382) asks for basic OAuth and a sync endpoint. The plan is the task source and wins; that
disagreement is why the scope here stops exactly where the plan's two lines stop.

## 7. Deferred

- **Webhooks** (`strava-integration.md §8`) — needs a publicly reachable callback URL.
- **Nightly batch sync** (§9.2) — the Challenge Service's `setInterval` sweeper could host it once
  there is a reason; there is no queue to put it in.
- **Points for activities** (Spec §9.1, design doc §2 "Phase 3") — the event is published; nothing
  consumes it.
- **An activity as automatic challenge proof** — a user pastes the activity URL as a `url` proof
  today. Verifying "ran 5km" against an activity is a rules engine nobody has specified.
- **Route maps / GPS** (§2) — Phase 3 in the design doc, and the fields are not stored.
- **Re-syncing privacy changes** — an activity made private on Strava *after* we pulled it keeps the
  flag it had. The next sync only asks for activities after `last_synced_at`, so it is not re-read.
  Cheap fix when it matters: a periodic re-fetch of the last N days, which the webhook would give
  for free if it existed.
- **Steam** (Spec §9.2) — `social_links.steam_id` exists on the User model and nothing else does.
