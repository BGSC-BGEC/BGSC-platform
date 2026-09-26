# Relationships & References

**Task:** MVP plan Week 1 BE-2 "Document relationships and references".
**Scope:** the six BE-2 models (events, auction_lots, teams, form_definitions/form_submissions, point_transactions, leaderboard_entries, challenges/challenge_participations, announcements) plus their touch points with BE-1's `users`.
**Spec refs:** §2.1 event-driven flow examples, §8.1 domain events, §8.2 consumers table.

---

## 1. Ownership map

One writer per collection. Everyone else reads by ID or reacts to events.

| Collection | Owner (writer) | Readers |
|---|---|---|
| `users` | User/Auth Service (BE-1) | all (snapshots only) |
| `events`, `auction_lots` | Event Service | Registration, Leaderboard, Points, Announcement |
| `teams`, `team_memberships` | Registration Service | Event, Challenge, Leaderboard (`teams` only; `team_memberships` has no other reader) |
| `form_definitions`, `form_definition_versions`, `form_submissions`, `form_uploads` | Registration Service | Event, Leaderboard, Points, Challenge (`form_uploads`: none) |
| `point_transactions`, `point_rules`, `point_expiry_cursor` | Points Service | Leaderboard (global board) |
| `users.points_balance` | **Points Service only** (cross-service write, agreed exception) | all |
| `users.announcements.{last_seen_at, read_ids}` | **Announcement Service only** (same exception) | Announcement |
| `users.profile.social_links.strava_id` | **Challenge Service only** (third exception, written down Sep 27) | all (display) |
| `leaderboard_entries`, `leaderboard_snapshots`, `halloffameentries` (Hall of Fame) | Leaderboard Service | Event, Profile, Points (entry ids for the cancel refund sweep) |
| `challenges`, `challenge_participations` | Challenge Service | Points, Hall of Fame (W4) |
| `announcements` | Announcement Service | Notification Service (broadcast) |
| `notifications`, `notification_dispatches`, `notification_preferences`, `notification_rate_slots` | Notification Service | — (no other reader today) |
| `media`, `media_albums`, `media_likes`, and **serving `/uploads`** | Media Service | — |
| `strava_credentials`, `strava_activities` | Challenge Service | — |
| `audit_logs` | **append-only, every service appends** through shared `recordAudit`; nobody updates or deletes (model hooks refuse it). Indexes built by User Service | User Service (admin explorer) |
| `feedback_tickets`, `feedback_throttle` | Feedback Service | — |
| `brackets`, `matches` | Bracket Service | Leaderboard (W3, unbuilt), Hall of Fame (W4, BE-1) |
| `events.bracket` | **nobody** — the slot stays null by decision | — |
| `users.settings.notifications` | **User/Auth Service** (global channel switch; read-only to Notification Service) | Notification Service |

The `users.*` exceptions exist because BE-1 owns the User doc but the values are entirely derived from BE-2 domains.

**Enforced, not just written down (Sep 26 audit).** A whole-repo grep of every `create/save/update*/delete*/insertMany/bulkWrite` now finds only owner writes plus the three `users.*` exceptions. What was removed: Event Service writing `teams` (purses, members, auction start, budget override) and `form_submissions` (attendance, waitlist promotion); Leaderboard Service writing `users.points_balance` and `point_transactions` (fallbacks) and `challenge_participations` (the Hall of Fame link). Each became an `/internal` route on the owner or an event the owner consumes (§5, §6).

**Index ownership.** Every service lists its models in `createServiceApp({ models: [...] })` and builds indexes for those only, so one bad collection no longer fails every service's boot. Every model is listed by exactly one owner (`User` by both Auth and User Service — same indexes, harmless).

**Uploads.** One upload root (`config.uploadDir`, one compose volume mounted by user, event, registration and media); each writer keeps a prefix (`avatars/`, `events/`, `registrations/`, `media/`) and **only Media Service serves `/uploads`** — the gateway routes the prefix there, and the other three static mounts are gone.

**The third one was found by audit, not by design.** `challenge-service/src/strava/strava.service.ts` has been writing `profile.social_links.strava_id` since Week 3 without this table saying so — and, worse, `PATCH /users/me` accepted the same field from any client, so a user could paste an athlete id and wear a Strava badge nobody verified. The field records a *verified OAuth connection*, so it now has one writer: the field was removed from `UpdateProfileSchema` (Sep 27) and the Strava flow owns it. The other three social links stay client-editable, because nothing verifies them either way. Alternative is an internal endpoint on User Service; **decide with BE-1 today**, both models work.

## 2. Reference graph

```
                         ┌──────────────┐
                         │    users     │  (BE-1)
                         └──────┬───────┘
      user_id / snapshots everywhere ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  events ──registration.form_id──▶ form_definitions ◀──form_id── form_submissions
│    ▲  ▲                                                          │   │  │
│    │  └──────────────── owner.id ─────────────────────────────────┘   │  │
│    │                                                                  │  │
│    ├── event_id ── auction_lots ── registration_id ───────────────────┘  │
│    │                    │ sold_to_team_id                                 │
│    │                    ▼                                                 │
│    ├── owner.id ───── teams ◀── context.event.team_id ────────────────────┘
│    │                    ▲ members[].registration_id → form_submissions
│    │                    │
│    ├── event_id ── leaderboard_entries ── participant.id → users | teams
│    │                    │ registration_id → form_submissions
│    │                    │
│    └── reference.id ── point_transactions ── user_id → users
│                              ▲ reference → events | challenges | leaderboard_entries | registrations
│                              │
│  challenges ── challenge_id ── challenge_participations ── participant.id → users | teams
│      ▲                                                     member_user_ids[] → users
│      └── owner.id ── teams (owner.type = 'challenge')
│
│  announcements ── audience.event_id → events ;  author.user_id → users
└──────────────────────────────────────────────────────────────────────────┘
```

Arrows = "stores the ID of". Never resolved by join; resolved by a second read or by a stored snapshot.

## 3. Reference table

| From | Field | To | Cardinality | On target delete |
|---|---|---|---|---|
| `events` | `registration.form_id` | `form_definitions` | 1 → 1 | forbid (form archived, not deleted) |
| `events` | `created_by`, `core_admins[]`, `contacts[].user_id`, `auction.captain_user_ids[]` | `users` | N → 1 | keep the ID, erase the display copy (§4.1) |
| `events` | `seat_holders[]` | `form_submissions` | 1 → 0..N | released (`$pull`) on every exit from `confirmed`; idempotent |
| `auction_lots` | `event_id` | `events` | N → 1 | cascade (event cancel drops lots) |
| `auction_lots` | `registration_id` | `form_submissions` | 1 → 1 | forbid while `on_block`/`sold` |
| `auction_lots` | `sold_to_team_id`, `bids[].team_id` | `teams` | N → 1 | keep |
| `teams` | `owner.{type,id}` | `events` / `challenges` | N → 1 | cascade → `disbanded` |
| `teams` | `members[].registration_id` (event owners only; null for challenge teams) | `form_submissions` | 1 → 1 | remove member |
| `form_definitions` | `owner.{type,id}` | `events` / `challenges` / null | N → 1 | archive form |
| `form_submissions` | `form_id` (+ `form_version`) | `form_definitions` (+ `_versions`) | N → 1 | forbid |
| `form_submissions` | `context.event.team_id` | `teams` | N → 1 | null out |
| `form_submissions` | `files[].url` | `form_uploads` | N → 1 | forbid (a submission can name only its own user's upload for that form + field) |
| `form_uploads` | `user_id`, `form_id` | `users`, `form_definitions` | N → 1 | keep |
| `team_memberships` | `_id = owner_id:user_id`, `team_id` | owner / `users` / `teams` | 1 → 1 | released on leave/remove; `deleteMany({ team_id })` on disband |
| `point_transactions` | `reference.{type,id}` | `events` / `challenges` / `leaderboard_entries` / `form_submissions` / `transaction` (expiry) | N → 1 | **never** — ledger immutable |
| `point_transactions` | `user_id` | `users` | N → 1 | keep (GDPR: anonymize user, keep rows) |
| `leaderboard_entries` | `event_id` | `events` | N → 1 | **keep** on cancel (frozen snapshot only) — the points refund sweep finds investments through entry ids |
| `leaderboard_entries` | `participant.id` | `users` / `teams` | N → 1 | keep snapshot |
| `leaderboard_entries` | `registration_id` | `form_submissions` | 1 → 1 | delete only if pre-start and nothing invested, else `stats.eliminated` |
| Hall of Fame entries | `honoree.id`, `members[].user_id`, `source.id` | `users` / `teams`, `challenges` / `events` | N → 1 | keep snapshot; unique `{ category, honoree.id, source.id }` live |
| `challenge_participations` | `challenge_id` | `challenges` | N → 1 | forbid while any `approved` (points paid) |
| `challenge_participations` | `participant.id`, `member_user_ids[]` | `users` / `teams` | N → 1 | keep snapshot |
| `challenge_participations` | `reward.hall_of_fame_entry_id` | Hall of Fame entries | 1 → 1 | set by Challenge Service from `HallOfFameEntryCreated` |
| `media_likes` | `media_id`, `user_id` | `media`, `users` | N → 1 | unique pair; `likes_count` moves with inserts/deletes |
| `point_expiry_cursor` | `tx_id` | `point_transactions` | 1 → 1 | sweep position only |
| `announcements` | `audience.event_id` | `events` | N → 1 | null out |
| `announcements` | `author.user_id` | `users` | N → 1 | keep snapshot |

"Cascade" and "null out" are implemented as **event consumers**, not DB constraints (no FKs in a document DB, and different services own the two sides).

## 4. Snapshot policy

Stored copies of another service's data, accepted stale:

| Snapshot | Where | Refreshed by |
|---|---|---|
| `{ user_id, display_name, avatar_url, deleted }` | `form_submissions.user`, `teams.members[]`, `leaderboard_entries.participant`, `challenge_participations.participant`, `announcements.author`, `auction_lots.player`, `events.contacts[]` (name only), `feedback_tickets.reporter`, `brackets.participants[]`, `matches.a/b` (name only), `media.uploader`, Hall of Fame `honoree` / `members[]` | **renamed** by `UserProfileUpdated { user_id, changed_fields }` → `updateMany`, only when `changed_fields ∋ full_name | avatar_url`; **erased** by `UserDeleted` → `anonymizedSnapshot()`; **restored** by `UserRestored { user_id }` → re-snapshot from `users` with `deleted: false`, never gated. All best-effort. Every one of the 12 is covered by all three consumers (Sep 26). |
| `challenge_snapshot { title, difficulty, award_points }` | `challenge_participations` | never (historical: what it was worth when accepted) |
| `owner` on `form_submissions` | copied from `form_definitions.owner` | never (immutable) |
| `events.counts`, `challenges.counts` | own collections | `$inc` in same write as the cause; nightly recount. `events.counts.registrations_confirmed` moves only with `seat_holders`; `registrations_waitlisted` was **dropped** (non-idempotent writers; count `form_submissions`) |

Rule: a snapshot is for **display**. Authorization and money never read a snapshot; they re-fetch by ID.

### 4.1 A deleted account (settled Sep 27, 2026)

`§3` used to say "keep ID; UI shows 'deleted user'". **The UI cannot do that**, and the audit that
looked found out why: a snapshot carried no deletion signal, and `GET /users/:ref` filters deleted
accounts and answers 404 — so a client holding a roster had the person's real name, no way to learn
the account was gone, and nothing to render instead. Meanwhile the name kept leaving the API.

Both halves are now in place, and they are complementary:

1. **The copy is erased, server-side.** Every service that embeds a snapshot consumes `UserDeleted`
   and applies `anonymizedSnapshot(prefix)` from `@bgsc/shared` — one definition of what anonymized
   means, so ten collections cannot disagree: `display_name` becomes `Deleted user`, `avatar_url`
   becomes null, `deleted` becomes true. Challenge Service had been doing this alone since Week 3;
   registration, announcement, feedback, bracket and event joined it.
2. **The signal is carried**, so the client renders a deliberate "deleted user" rather than a name
   it should not print or a blank it cannot explain.

3. **The copy comes back on restore** (Sep 26). A restore inside the window (`POST /account/reactivate`,
   Auth Service) emits `UserRestored`; until then only the leaderboard consumed it, so a reactivated
   user stayed "Deleted user" on every roster, ticket and announcement. Every snapshot owner now
   re-copies from `users` with `deleted: false`. `UserDeleted` also drops personal data that is not a
   snapshot: `events.contacts[].contact`, `feedback_tickets.contact_email` (refilled on restore), and the
   Strava link.

`user_id` is **kept** in every case: it is a reference, not a display, and the rosters, ledger rows
and fixtures that point at it still have to resolve. Results, seeds, purses and audit rows are
untouched — what is erased is the name, not the history.

## 5. Cross-service write flows (the ones that must not double-count)

### 5.0 The rules every flow below obeys (Sep 26)

| Rule | Why |
|---|---|
| Every service-to-service call is `callInternal()` from `@bgsc/shared` | It unwraps `{ success, data }`. The first hand-written client read `result.reserved` off the envelope — `undefined` every time, so every event registration settled `rejected` while a seat was counted |
| `4xx` = a refusal: pass it on, **never fall back** | The old clients wrote the other service's collection on any failure, which overrode deliberate refusals (`team_full`, `team_locked`) |
| `0` / `5xx` = outcome unknown: retry with the **same idempotency key**, else 503 | A timeout after the write landed, followed by a direct write, is a double debit |
| Every mutating internal route is idempotent on a caller-derived key | So the retry above is safe: seats per `registration_id`, purses per `request_id`, points per `request_id`/spend id |
| Consumers are idempotent by construction and never throw into the bus | Redis pub/sub delivers every message to **every instance** of every subscriber, with no replay |

### 5.1 Register for event (Spec §2.1 "Event Registration Flow", adapted)

```
Mobile ─POST /registrations─▶ Registration Service
  1. load form + event window; validate answers against form_definitions@version; files[] resolved from form_uploads
  2. insert form_submissions { status: 'submitted' }      ── unique (form_id, user) rejects duplicates; nothing else written yet
  3. POST event:/internal/events/:id/reserve-seat { registration_id }     (idempotent per registration: events.seat_holders)
        { reserved: true }                       → CAS → confirmed,  emit RegistrationCreated
        { reserved: false, 'capacity_full' }     → CAS → waitlisted, emit RegistrationWaitlisted
        { reserved: false, other reason }        → CAS → rejected    (waitlist_disabled | event_closed | not_open | event_not_found)
        no answer                                → stays submitted; a resubmit retries the same reserve
  RegistrationCreated
        ├─▶ Leaderboard:  create leaderboard_entries row (solo events with type != 'DE')
        └─▶ Notification: "you're in"
  (Points is NOT paid here — participation is paid on attendance, §5.1b.)
```

Duplicate is the common failure and costs nothing to roll back because it happens before any cross-service write.

**Leaving `confirmed`** (user cancel, or admin demotion to waitlisted/rejected): CAS the row, `POST /internal/events/:id/release-seat` (idempotent; one retry), then `RegistrationCancelled { previous_status, status, freed_seat, reason }` — `freed_seat` only when the Event Service confirmed the release. Consumers: Registration (freed seat → promote next), Leaderboard (withdraw entry), Points (reverse a participation credit), Event (idempotent release, safety net).

### 5.1a Waitlist promotion — one path, owned by Registration

```
auto:      RegistrationCancelled { freed_seat: true } ─▶ Registration: head of waitlist
organiser: POST /events/:ref/waitlist/:id/promote ─▶ Event Service ─POST /internal/registrations/:id/promote { by }─▶ Registration
  both → promoteRegistration(): reserve-seat (idempotent) → CAS waitlisted → confirmed → emit RegistrationCreated
         CAS lost → release the seat it will not use;  refusal → row stays waitlisted (organiser gets 409 <reason>)
```

**Decision:** `RegistrationConfirmed` is **retired**. The Event Service used to flip `form_submissions` itself and emit it; the leaderboard only heard `RegistrationCreated`, so an organiser-promoted user never got an entry. One event for "now confirmed", whatever the path.

### 5.1b Attendance → participation points

```
Web Console ─POST /events/:ref/attendance─▶ Event Service (auth, event not draft/cancelled)
  ─POST /internal/registrations/attendance { event_id, marked_by, attendances[] }─▶ Registration
     only confirmed rows of that event; CAS per row on its previous value → { updated_count, skipped[] }
     → true:        ParticipantAttended          ─▶ Points: event.participation, key event.participation:<registration_id>
     true → false:  ParticipantAttendanceRevoked ─▶ Points: reverse, key event.participation.reversal:<credit_tx>
```

`ParticipantAttended` moved from Event to Registration Service with the same payload. ponytail: revoke-then-re-mark pays nothing the second time (both keys exist); a per-marking key if admins ever toggle rosters.

### 5.2 Complete event

```
Web Console ─PATCH /events/:id { status: 'past' }─▶ Event Service   (or the scheduler)
  emit EventCompleted { event_id, title }
        ├─▶ Leaderboard: final recompute, snapshot { reason: 'final', frozen: true },
        │                emit LeaderboardFrozen { event_id, reason: 'final', podium: [{ place, participant, user_ids[] }] }
        │                     └─▶ Points: event.podium.<place> per user, key event.podium:<event_id>:<user_id>
        │                                 (same key as the admin POST /points/award → never both)
        └─▶ Media: create the event album named from `title` (unique event_id → once)
```

Winners are **not** on `EventCompleted`: the leaderboard is the only thing that knows the final order, so the podium rides on its freeze. `DE` events (brackets) have no leaderboard; their podium stays the admin award until `BracketCompleted` has a consumer.

### 5.3 Invest points in leaderboard

Leaderboard Service is the orchestrator; Points Service is the only one that touches balance. Detailed in `leaderboard-model.md` §6. Order: **debit first, then rank** — a debit without a rank update is repairable; a rank update without a debit is free points.

```
Leaderboard ─POST /internal/points/spend { user_id, amount, reference: leaderboard_entry, request_id }─▶ Points   (event must be ongoing)
  $inc invested_points (guarded) ── fails ─▶ POST /internal/points/refund { user_id, reference, request_id }
  spend outcome unknown ─▶ one retry (same request_id) ─▶ refund-by-request_id (404 = nothing taken) ─▶ 503
EventCancelled ─▶ Points sweep refunds every spend on the event's entries
```

**One spend, at most one refund:** both refund paths key on the spend row (`leaderboard.investment.refund:<spend_tx_id>`). The Leaderboard never writes `users` or `point_transactions`, and on `EventCancelled` it **keeps** its entries (freeze + cache drop only) — deleting them raced the sweep that finds spends through them.

### 5.4 Auction sale

```
Web Console ─POST /auction/lots/:id/advance─▶ Event Service
  1. lot: CAS on version, on_block → sold (sold_to_team_id, sold_amount)
  2. Registration: POST /internal/teams/:id/debit-purse { amount, request_id: '<lot>:debit' }   ── 409 insufficient_purse → lot unsold
  3. Registration: POST /internal/teams/:id/add-member { user_id, registration_id }             ── seats the player, links
       form_submissions.context.event.team_id, claims team_memberships; repeat for an auction member = 200
       refused (team_full, team_locked, …) → POST refund-purse { request_id: '<lot>:refund' } → lot unsold (PlayerUnsold.reason)
  4. emit BidClosed + PlayerSold
  outcome unknown at 2/3 → lot back to on_block (timer expired, no bids) → admin retry replays the same keyed calls
```

Auction start: `POST /internal/events/:id/auction-purses { purse_total }` (only teams with no purse). Captain budget override: `PATCH /internal/teams/:id/auction-budget`. The Event Service writes no `teams` field anywhere.

### 5.5 Challenge approval → points

`challenge-model.md` §3.2. Fan-out to `member_user_ids` with per-user idempotency keys. `ChallengeLegendAchieved` → Leaderboard creates the Hall of Fame entry → `HallOfFameEntryCreated { entry_id, participation_id }` → Challenge Service sets `reward.hall_of_fame_entry_id`.

## 6. Domain-event contract summary (as built, Sep 26 — Spec §8.1 + BE-2 additions)

Payloads are what the producer sends; a consumer's TypeScript type is only a claim. "—" = no consumer today (published for Search/Audit/Analytics, which are not built).

| Event | Producer | Payload | Consumers |
|---|---|---|---|
| `UserProfileUpdated` | User | `{ user_id, changed_fields[] }` | the 8 snapshot owners: Registration, Event, Challenge, Leaderboard, Announcement, Feedback, Bracket, Media (gated on `full_name`/`avatar_url`) |
| `UserDeleted` | User | `{ user_id, research_consent, restorable_until }` | same 8 → `anonymizedSnapshot()`; Challenge also unlinks Strava |
| `UserRestored` | Auth (`/account/reactivate`) | `{ user_id }` | same 8 → re-snapshot, `deleted: false` (was Leaderboard only) |
| `UserRegistered/LoggedIn/EmailVerified/PhoneVerified` | Auth | — | — |
| `UserRoleChanged`, `UserDisabled`, `UserEnabled` | User | `{ user_id, …, reason, *_by }` | — (status/role are read live per request by `requireActiveUser`, so nothing caches them) |
| `EventCreated/Updated/Started/Deleted` | Event | `{ event_id, … }` (`Started` adds `title`) | — |
| `EventCompleted` | Event | `{ event_id, title }` | Leaderboard (final freeze + podium), Media (event album) |
| `EventCancelled` | Event | `{ event_id, title }` | Points (refund investments, then reverse credits), Leaderboard (freeze, **keep** entries), Notification |
| `CaptainApproved` | Registration (seat held), Event (admin add) | `{ event_id, user_id, approved_by, registration_id? }` | Event (`auction.captain_user_ids`, `ALL` events only) |
| `AuctionStarted/Closed`, `BidPlaced`, `BidClosed`, `PlayerSold`, `PlayerUnsold` | Event | per event-model.md §9 | — |
| `RegistrationCreated` | Registration | `{ registration_id, owner, user_id, role }` — **every** entry into `confirmed` | Leaderboard (solo entry), Notification |
| `RegistrationWaitlisted` | Registration | `{ registration_id, owner, user_id, position }` | Notification |
| `RegistrationCancelled` | Registration | `{ registration_id, owner, user_id, previous_status, status, freed_seat, reason }` — every cancel and every exit from `confirmed` | Registration (`freed_seat` → promote next), Leaderboard (withdraw), Points (reverse credit), Event (idempotent release) |
| `ParticipantAttended` | **Registration** (moved from Event) | `{ event_id, registration_id, user_id, marked_by }` | Points (participation credit) |
| `ParticipantAttendanceRevoked` | Registration (new) | same | Points (reverse credit) |
| `FormPublished` | Registration | `{ form_id, owner, version }` | — |
| `TeamLocked` | Registration | `{ team_id, owner, locked_by }` (`owner` new) | Leaderboard (team entry) |
| `TeamDisbanded` | Registration | `{ team_id, owner, reason }` | Leaderboard (withdraw) |
| `TeamCreated`, `TeamMemberAdded`, `TeamMemberRemoved`, `TeamInviteCreated` (new) | Registration | all carry `team_id, owner` | — |
| `PointsEarned` / `PointsAdjusted` | Points (`ledger.ts`, computed name `EVENT_FOR[tx.type]`) | `{ transaction_id, user_id, amount, balance_after, … }` | Notification (`Earned` only); Leaderboard (both: global-board eviction) |
| `PointsSpent/Refunded/Expired` | Points | same shape | — |
| `LeaderboardFrozen` | Leaderboard | `{ event_id, reason: 'below_threshold' \| 'final', podium? }`, `podium: [{ place, participant: { type, id }, user_ids[] }]` on `final` | Points (`event.podium.<place>` per user) |
| `LeaderboardUpdated`, `LeaderboardInvestmentMade` | Leaderboard | per leaderboard-model.md §9 | — |
| `HallOfFameEntryCreated` | Leaderboard (new) | `{ entry_id, slug, category, honoree, source, participation_id }` | Challenge (`reward.hall_of_fame_entry_id`) |
| `ChallengeCompleted` | Challenge | `{ participation_id, challenge_id, participant, member_user_ids[], award_points }` | Points, Notification |
| `ChallengeRejected` | Challenge | `{ participation_id, challenge_id, reason }` | Notification |
| `ChallengeLegendAchieved` | Challenge | `{ participation_id, challenge_id, member_user_ids[] }` | Leaderboard (Hall of Fame entry) |
| `ChallengeCreated/Updated/Accepted/Submitted/Expired`, `Strava*` | Challenge | — | — |
| `AnnouncementPublished/Updated/Deleted` | Announcement | per announcement-model.md §5 | Notification |
| `AnnouncementScheduled/Delivered` | Announcement | — | — |
| `FeedbackSubmitted` | Feedback | `{ ticket_id, ticket_no, kind, category, severity, subject }` | Notification (staff notice) |
| `FeedbackStatusChanged` | Feedback | — | — |
| `BracketGenerated`, `MatchScheduled`, `MatchCompleted`, `BracketCompleted` | Bracket | per bracket-model.md | — (Leaderboard `stats` and Hall of Fame are the planned consumers) |
| `MediaUploaded/Approved/Rejected/Deleted` | Media | per media-model.md §4 | — |

**Retired / never emitted.** `RegistrationConfirmed` (Event) — retired Sep 26, promotion goes through Registration and emits `RegistrationCreated`; nobody publishes or subscribes to it. `EventRegistrationOpened/Closed`, `TeamUpdated`, `AnnouncementArchived` — designed, not emitted. `EventCompleted.winners[]` — never carried; the podium rides on `LeaderboardFrozen`.

Envelope (all events): `{ message_id: uuid, type, occurred_at, producer, schema_version: 1, payload }`. `message_id`, not `event_id`, so it never collides with the Event entity's id inside payloads. Transport is Redis pub/sub: every instance of every subscriber receives every message, and nothing is replayed after an outage. So consumers do **not** rely on `message_id`: each is idempotent by construction — a key derived from the document that caused it (ledger `idempotency_key`, notification `dedupe_key`, unique indexes such as `{ event_id, participant.id }`, `event_id_unique`, the Hall of Fame identity), or a CAS on the row's current state.

## 7. Denormalization decisions (and their ceilings)

| Decision | Ceiling / upgrade path |
|---|---|
| Bids embedded in `auction_lots` | hundreds of bids per lot → `auction_bids` collection |
| `read_ids[]` on user (cap 200) | per-announcement analytics → `announcement_reads` |
| `counts` on events/challenges via `$inc` | drift → nightly recount job (already planned) |
| `rank` materialized on `leaderboard_entries` | n > ~5k participants per event → compute from ZSET only |
| `balance_after` on ledger rows | none; makes drift detection O(1) |
| Global leaderboard = Redis ZSET read over the ledger, evicted (5s debounce) on `PointsEarned`/`PointsAdjusted` | board up to 5s stale → incremental `ZINCRBY` per event |
| Sync HTTP for seat reservation / purse debit / points debit | services on separate DBs + latency → sagas with compensation events |
| `events.seat_holders[]` embedded (one uuid per seat) | ~400k seats per event before 16 MB → `event_seats` with unique `{ event_id, registration_id }` |
| `teams.auction.applied_ops[]` embedded | two ids per lot sold; tens of lots per auction → an ops collection if auctions grow to thousands of lots |
| Redis pub/sub, no replay | a missed message is lost → tick sweeps cover the ones that matter (announcement retraction, writebacks); Kafka is Phase 2 |
| Cross-service writes to `users.points_balance` / `users.announcements` | BE-1 objects → internal endpoint on User Service, same semantics |

## 8. Open items for BE-1 sync (today)

1. DB vendor (Mongo assumed here). Transactions available? Decides §5.1 compensation vs txn.
2. Who writes `users.points_balance` and `users.announcements.*` — direct write or internal endpoint. **Settled Sep 13, 2026 for `users.announcements.*`: direct write by Announcement Service**. `users.points_balance` still open.
   **No third exception was added on Sep 26, 2026:** notification preferences live in the Notification Service's own `notification_preferences` collection rather than extending `users.settings.notifications`, which `PATCH /users/me/settings` already writes. The global channel switch stays User Service's; per-category granularity is the Notification Service's.
3. Shared `UserSnapshot` shape `{ user_id, display_name, avatar_url }` — confirm field names against BE-1's User model.
4. Role enum spelling (`guest|user|member|core|coordinator|founder`) used in `announcements.audience.min_role` and RBAC guards.
5. `UserProfileUpdated` payload includes `changed_fields` so snapshot refresh is cheap.
