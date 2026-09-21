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
| `teams` | Registration Service | Event, Challenge, Leaderboard |
| `form_definitions`, `form_definition_versions`, `form_submissions` | Registration Service | Event, Leaderboard, Points, Challenge |
| `point_transactions`, `point_rules` | Points Service | Leaderboard (global rebuild) |
| `users.points_balance` | **Points Service only** (cross-service write, agreed exception) | all |
| `users.announcements.{last_seen_at, read_ids}` | **Announcement Service only** (same exception) | Announcement |
| `users.profile.social_links.strava_id` | **Challenge Service only** (third exception, written down Sep 27) | all (display) |
| `leaderboard_entries`, `leaderboard_snapshots` | Leaderboard Service | Event, Profile |
| `challenges`, `challenge_participations` | Challenge Service | Points, Hall of Fame (W4) |
| `announcements` | Announcement Service | Notification Service (broadcast) |
| `notifications`, `notification_dispatches`, `notification_preferences` | Notification Service | — (no other reader today) |
| `feedback_tickets`, `feedback_throttle` | Feedback Service | — |
| `brackets`, `matches` | Bracket Service | Leaderboard (W3, unbuilt), Hall of Fame (W4, BE-1) |
| `events.bracket` | **nobody** — the slot stays null by decision (be2-feedback-bracket-plan.md D3) | — |
| `users.settings.notifications` | **User/Auth Service** (global channel switch; read-only to Notification Service) | Notification Service |

The `users.*` exceptions exist because BE-1 owns the User doc but the values are entirely derived from BE-2 domains.

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
| `auction_lots` | `event_id` | `events` | N → 1 | cascade (event cancel drops lots) |
| `auction_lots` | `registration_id` | `form_submissions` | 1 → 1 | forbid while `on_block`/`sold` |
| `auction_lots` | `sold_to_team_id`, `bids[].team_id` | `teams` | N → 1 | keep |
| `teams` | `owner.{type,id}` | `events` / `challenges` | N → 1 | cascade → `disbanded` |
| `teams` | `members[].registration_id` (event owners only; null for challenge teams) | `form_submissions` | 1 → 1 | remove member |
| `form_definitions` | `owner.{type,id}` | `events` / `challenges` / null | N → 1 | archive form |
| `form_submissions` | `form_id` (+ `form_version`) | `form_definitions` (+ `_versions`) | N → 1 | forbid |
| `form_submissions` | `context.event.team_id` | `teams` | N → 1 | null out |
| `point_transactions` | `reference.{type,id}` | `events` / `challenges` / `leaderboard_entries` / `form_submissions` | N → 1 | **never** — ledger immutable |
| `point_transactions` | `user_id` | `users` | N → 1 | keep (GDPR: anonymize user, keep rows) |
| `leaderboard_entries` | `event_id` | `events` | N → 1 | cascade |
| `leaderboard_entries` | `participant.id` | `users` / `teams` | N → 1 | keep snapshot |
| `leaderboard_entries` | `registration_id` | `form_submissions` | 1 → 1 | remove entry if pre-start, else keep |
| `challenge_participations` | `challenge_id` | `challenges` | N → 1 | forbid while any `approved` (points paid) |
| `challenge_participations` | `participant.id`, `member_user_ids[]` | `users` / `teams` | N → 1 | keep snapshot |
| `announcements` | `audience.event_id` | `events` | N → 1 | null out |
| `announcements` | `author.user_id` | `users` | N → 1 | keep snapshot |

"Cascade" and "null out" are implemented as **event consumers**, not DB constraints (no FKs in a document DB, and different services own the two sides).

## 4. Snapshot policy

Stored copies of another service's data, accepted stale:

| Snapshot | Where | Refreshed by |
|---|---|---|
| `{ user_id, display_name, avatar_url, deleted }` | `form_submissions.user`, `teams.members[]`, `leaderboard_entries.participant`, `challenge_participations.participant`, `announcements.author`, `auction_lots.player`, `events.contacts[]`, `feedback_tickets.reporter`, `brackets.participants[]`, `matches.a/b` | **renamed** by `UserProfileUpdated { user_id, changed_fields }` → `updateMany` where `display_name`/`avatar_url` changed; **erased** by `UserDeleted` → `anonymizedSnapshot()`. Both best-effort. |
| `challenge_snapshot { title, difficulty, award_points }` | `challenge_participations` | never (historical: what it was worth when accepted) |
| `owner` on `form_submissions` | copied from `form_definitions.owner` | never (immutable) |
| `events.counts`, `challenges.counts` | own collections | `$inc` in same write as the cause; nightly recount |

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

`user_id` is **kept** in every case: it is a reference, not a display, and the rosters, ledger rows
and fixtures that point at it still have to resolve. Results, seeds, purses and audit rows are
untouched — what is erased is the name, not the history.

## 5. Cross-service write flows (the ones that must not double-count)

### 5.1 Register for event (Spec §2.1 "Event Registration Flow", adapted)

```
Mobile ─POST /events/:id/register─▶ Registration Service
  1. load events(id): status ∈ {upcoming, ongoing}, now ∈ [opens_at, closes_at], form_id != null
  2. validate answers against form_definitions@version
  3. insert form_submissions { status: 'submitted' }      ── unique (form_id, user) rejects duplicates; nothing else written yet
  4. Event Service: reserve seat  findOneAndUpdate(counts.registrations_confirmed < max) $inc
        ok   → 5a. status → confirmed, emit RegistrationCreated
        fail → 5b. status → waitlisted | rejected, emit RegistrationWaitlisted
  RegistrationCreated
        ├─▶ Points:       +participation  (idempotent on registration_id)
        ├─▶ Leaderboard:  create leaderboard_entries row (solo events with type != 'DE')
        ├─▶ Notification: confirm
        └─▶ User:         history cache
```

Duplicate is the common failure and costs nothing to roll back because it happens before any cross-service write.

### 5.2 Complete event

> **As built (Sep 27 audit):** `EventCompleted` carries `{ event_id }` only, and **nothing consumes
> it**. Podium points are awarded by an admin through `POST /points/award { user_id, event_id, place }`
> (points plan §2), not by this fan-out; Leaderboard and Hall of Fame are unbuilt. The flow below is
> the design, kept because it is where those consumers will attach.

```
Web Console ─PATCH /events/:id/complete { winners }─▶ Event Service
  status → past, emit EventCompleted { event_id, winners[] }
        ├─▶ Points:       podium credits per user (team win → each member via teams.members)
        ├─▶ Leaderboard:  final recompute, freeze, snapshot 'final'
        ├─▶ Hall of Fame (W4): entries for place 1
        └─▶ Notification
```

### 5.3 Invest points in leaderboard

Leaderboard Service is the orchestrator; Points Service is the only one that touches balance. Detailed in `leaderboard-model.md` §6. Order: **debit first, then rank** — a debit without a rank update is repairable (retry step 3); a rank update without a debit is free points.

### 5.4 Auction sale

```
Web Console ─POST /auction/lots/:id/close─▶ Event Service
  1. lot: status on_block → sold, sold_to_team_id, sold_amount  (version-checked)
  2. Registration Service: teams.$inc purse_spent (version-checked, purse_remaining ≥ amount)  ── fails → revert lot to on_block, reject
  3. teams.members.push({ user_id, registration_id, acquired_via: 'auction' })
  4. form_submissions(registration).context.event.team_id = team_id, role = 'member'
  5. emit PlayerSold
```

### 5.5 Challenge approval → points

`challenge-model.md` §3.2. Fan-out to `member_user_ids` with per-user idempotency keys.

## 6. Domain-event contract summary (Spec §8.1 + BE-2 additions)

| Producer | Events | Consumers |
|---|---|---|
| Event | `EventCreated/Updated/RegistrationOpened/RegistrationClosed/Started/Completed/Cancelled/Deleted`, `AuctionStarted`, `BidPlaced`, `BidClosed`, `PlayerSold`, `PlayerUnsold` | Points, Leaderboard, Registration, Announcement, Notification, Search, Audit |
| Registration | `RegistrationCreated/Waitlisted/Cancelled`, `CaptainApproved`, `FormPublished`, `TeamCreated/Updated/MemberAdded/MemberRemoved/Locked/Disbanded` | Event, Points, Leaderboard, Challenge, Notification, User |
| Points | `PointsEarned/Spent/Refunded/Adjusted/Expired` | Notification, Audit, Leaderboard (global rebuild trigger), User (balance display invalidation) |
| Leaderboard | `LeaderboardUpdated`, `LeaderboardInvestmentMade`, `LeaderboardFrozen` | Notification, Event (detail cache) |
| Challenge | `ChallengeCreated/Updated/Accepted/Submitted/Completed/Rejected/Expired`, `ChallengeLegendAchieved` | Points, Hall of Fame, Notification |
| Announcement | `AnnouncementPublished/Scheduled/Updated/Archived/Deleted/Delivered` | Notification, Search |
| Feedback | `FeedbackSubmitted`, `FeedbackStatusChanged` | Notification (staff notice) |
| Bracket | `BracketGenerated`, `MatchScheduled`, `MatchCompleted`, `BracketCompleted` | Leaderboard (`stats`), Hall of Fame, Notification |
| Notification | *(none)* — it is a terminal consumer. Consumes `AnnouncementPublished/Updated/Deleted`, `RegistrationConfirmed/Waitlisted`, `ChallengeCompleted/Rejected`, `EventCancelled` | — |

Envelope (all events): `{ message_id: uuid, type, occurred_at, producer, schema_version: 1, payload }`. `message_id`, not `event_id`, so it never collides with the Event entity's id inside payloads. Consumers dedupe on `message_id`; Points additionally dedupes on its own `idempotency_key`.

## 7. Denormalization decisions (and their ceilings)

| Decision | Ceiling / upgrade path |
|---|---|
| Bids embedded in `auction_lots` | hundreds of bids per lot → `auction_bids` collection |
| `read_ids[]` on user (cap 200) | per-announcement analytics → `announcement_reads` |
| `counts` on events/challenges via `$inc` | drift → nightly recount job (already planned) |
| `rank` materialized on `leaderboard_entries` | n > ~5k participants per event → compute from ZSET only |
| `balance_after` on ledger rows | none; makes drift detection O(1) |
| Global leaderboard = Redis ZSET rebuilt from ledger every 5 min | needs realtime → incremental `ZINCRBY` on `PointsEarned` |
| Sync HTTP for seat reservation / purse debit / points debit | services on separate DBs + latency → sagas with compensation events |
| Cross-service writes to `users.points_balance` / `users.announcements` | BE-1 objects → internal endpoint on User Service, same semantics |

## 8. Open items for BE-1 sync (today)

1. DB vendor (Mongo assumed here). Transactions available? Decides §5.1 compensation vs txn.
2. Who writes `users.points_balance` and `users.announcements.*` — direct write or internal endpoint. **Settled Sep 13, 2026 for `users.announcements.*`: direct write by Announcement Service** (be2-announcement-service-plan.md D2). `users.points_balance` still open.
   **No third exception was added on Sep 26, 2026:** notification preferences live in the Notification Service's own `notification_preferences` collection rather than extending `users.settings.notifications`, which `PATCH /users/me/settings` already writes. The global channel switch stays User Service's; per-category granularity is the Notification Service's (be2-broadcast-service-plan.md D8).
3. Shared `UserSnapshot` shape `{ user_id, display_name, avatar_url }` — confirm field names against BE-1's User model.
4. Role enum spelling (`guest|user|member|core|coordinator|founder`) used in `announcements.audience.min_role` and RBAC guards.
5. `UserProfileUpdated` payload includes `changed_fields` so snapshot refresh is cheap.
