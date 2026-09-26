# Notification Model

**Owner service:** Notification Service, :3010 (plan Week 4 Saturday, BE-2)
**Collections:** `notifications`, `notification_dispatches`, `notification_preferences`, `notification_rate_slots`
**Spec refs:** §4.1 Notification, §9.4 WhatsApp Business API (tag → group, fallback, 1/tag/hour), §10 Notification System (§10.1 channels, §10.2 categories, §10.3 preferences), §6.4 Make Announcement Popup (WhatsApp auto-send on publish), §14 MVP scope ("Notifications — In-app only")
**MVP plan refs:** Week 4 Saturday BE-2 "Broadcast & WhatsApp Integration" — broadcast service, WhatsApp Business API, message templating, notification preferences, scheduled broadcast, delivery status tracking, user notification history.

---

## 1. Purpose

Three collections, one domain, split by grain:

| Collection | Grain | Answers |
|---|---|---|
| `notifications` | one row per **recipient** per cause | "what is in my inbox, and what have I not read" |
| `notification_dispatches` | one row per **outbound channel job** | "did this announcement reach its WhatsApp groups, and should we try again" |
| `notification_preferences` | one row per **user** (absent = defaults) | "which categories does this person want in-app" |

The inbox and the outbound ledger are deliberately not one collection. A broadcast to 400 people is
400 inbox rows and *two* dispatch rows (one per tagged category); merging them would make "was this
sent" a scan over recipients.

`DeliveryStatus` (`pending | sent | failed | rate_limited | skipped`) is **imported from the
Announcement model**, not redeclared: the same values are written back into
`announcements.delivery.*`, and two enums that must agree are one enum with extra steps.

---

## 2. `notifications`

```jsonc
{
  _id: uuid,
  user_id: string,                        // the recipient
  category: 'announcement'|'event'|'challenge'|'system',
  type: string,                           // template key: 'announcement.published'
  title: string,                          // <= 140
  body: string,                           // <= 500
  data: { announcement_id?, event_id?, challenge_id?, ... },   // deep-link ids, display only
  channel: 'in_app',                      // Spec §4.1's enum; only in_app is written
  dedupe_key: string,                     // 'announcement:<id>', 'registration.confirmed:<id>', ...
  read_at: Date | null,
  expires_at: Date,                       // TTL, 90 days
  created_at, updated_at
}
```

### 2.1 Field notes

| Field | Why |
|---|---|
| `title` / `body` | A snapshot of the announcement, refreshed on `AnnouncementUpdated` and gated on `changed_fields` — a published announcement keeps its title and body editable, and a card that still reads "5pm" after the time moved is worse than no card. Refreshing never *creates* rows, so a muted user does not acquire one from a typo fix. |
| `dedupe_key` | Derived from the **document that caused** the notification, never from the event envelope. A replayed `AnnouncementPublished` carries a fresh `message_id`, so envelope dedupe cannot survive one; the cause is stable. Same construction as `point_transactions.idempotency_key`. |
| `read_at` | A nullable timestamp, not Spec §4.1's `is_read` boolean. Repo convention (`deleted_at`, `published_at`), and "when" is strictly more than "whether" — the client derives the boolean. |
| `data` | `Mixed`. Ids for routing, never authorization input: the service re-checks by id when the client opens the target. |
| `category` | Spec §10.2's groups minus the out-of-MVP domains (social, sponsor, union). It is also the preference key. |
| `expires_at` | An inbox is not an audit trail. The AuditLog is where permanence lives. |

### 2.2 Invariants

- `(dedupe_key, user_id)` is unique — one notification per user per cause, enforced by the index
  rather than by reading first.
- A notification is never written for a user outside the announcement's audience (§4).
- Nothing in `title`/`body` carries a destination, a token or another user's contact details.

### 2.3 Indexes

| Index | Serves |
|---|---|
| `{ user_id: 1, created_at: -1, _id: -1 }` | the keyset feed — `_id` is in the index because it is in the sort |
| `{ user_id: 1, read_at: 1, created_at: -1 }` | badge count (`GET /notifications/unread-count` → `{ count }`, the announcement badge's shape) and `?unread=true` |
| `{ dedupe_key: 1, user_id: 1 }` **unique** | idempotency **and** retraction (`deleteMany({ dedupe_key })` needs the key as prefix) |
| `{ 'data.player_user_id': 1 }` partial on `type: 'auction.sold.captain'` | `UserDeleted` erasing a player from captain cards (User Service replays recent deletions on a timer) |
| `{ expires_at: 1 }` TTL `expireAfterSeconds: 0` | 90-day retention, no sweep job |

---

## 3. `notification_dispatches`

```jsonc
{
  _id: uuid,
  channel: 'whatsapp' | 'push',
  source: { type: 'announcement', id: string },
  category: AnnouncementCategory | null,  // which group this send is for; null for push
  destination: string | null,             // opaque provider destination — PII, no HTTP surface
  status: DeliveryStatus,
  attempts: number,                       // incremented by the claim, not by the failure
  provider_message_id: string | null,
  error: string | null,                   // clipped to 300; never a credential
  attempted_at: Date | null,
  next_attempt_at: Date | null,           // set iff status is retryable
  writeback_at: Date | null,              // when this outcome reached the announcement document
  writeback_tried_at: Date | null,        // last writeback-sweep attempt; the sweep takes least recently tried first, so rows that keep failing rotate instead of holding its page
  revision: number,                       // bumped on every settle; sent with the writeback so an older receipt never overwrites a newer one
  created_at, updated_at
}
```

### 3.1 Invariants

- `next_attempt_at` is **null exactly when the status is terminal** (`sent`, `skipped`) and a real
  date whenever it is retryable (`pending`, `failed`, `rate_limited`). A retryable row with a null
  date is invisible to the sweep's `$lte` filter forever; a terminal row with one is re-sent. Both
  fail silently, so the model's `pre('validate')` hook refuses them. The hook is document
  middleware and the update path is `findOneAndUpdate`, so it catches construction bugs only — the
  service keeps the pair correct on update.
- `skipped` is terminal **on purpose**: configuring WhatsApp credentials next week must not make
  three weeks of `no_group_mapped` rows suddenly broadcast.
- `attempts` stops the row at `DISPATCH_MAX_ATTEMPTS` (5). A `rate_limited` outcome restores the
  previous count, because no provider call was made and five quiet hours must not burn the budget.

### 3.2 Indexes

| Index | Serves |
|---|---|
| `{ source.type, source.id, channel, category }` **unique** | the claim: a colliding insert means someone already owns this send |
| `{ status: 1, next_attempt_at: 1 }` | the retry sweep |
| `{ writeback_at: 1, status: 1 }` | terminal rows whose outcome never reached the announcement |
| `{ source.id: 1 }` | reconciliation counts an announcement's rows against its channels — *not* an `exists` test, because a dispatch that died half way through its categories has rows and is still unfinished. Only publishes older than 2 minutes are candidates, so a fan-out still running is not re-run underneath itself |

### 3.3 `notification_rate_slots` — Spec §9.4 "1 per tag per hour" (Sep 26)

```jsonc
{ _id: '<channel>:<category>',   // e.g. 'whatsapp:fitsoc'
  sends: Date[] }                 // most recent sends, newest last, capped at the configured rate
```

**Decision:** the limit used to be a count of `sent` dispatch rows in the last hour, checked before the
send — check-then-send, so two announcements in one tag both counted zero and both went out. Now a slot
is **taken** before the provider call by one single-document `findOneAndUpdate({ _id, $expr: size(sends
in window) < rate }, { $push: { sends: { $each: [now], $slice: -rate } } })`; the second taker sees the
first. A provider refusal gives the slot back (best-effort; a crash keeps it, erring toward the limit).
Durable rather than a Redis TTL key: Redis is optional here and forgets. The old
`{ channel, category, status, attempted_at }` index on dispatches is gone with the count. Notification
Service is the only writer.

The announcement writeback sends `group_id` as a **masked** label (`••••1234`, or `(unmapped)`), never
`destination`: the announcement document is served to every core+ reader.

---

## 4. Audience resolution (who gets a row)

The mirror of the announcement feed's filter (`audience.ts`) — the feed asks which announcements a
user may see, the fan-out asks which users may see an announcement:

```
role   : role ∈ ROLE_RANK.slice(roleRank(announcement.audience.min_role))
status : active, deleted_at: null
event  : if audience.event_id → intersect with confirmed registrants of that event
prefs  : minus users who muted in_app for the category
```

The author is included: the inbox is a record of what was published to them, not a feed of other
people's actions.

### 4.1 The WhatsApp audience gate

**A community group is a public destination.** An announcement with `audience.min_role` above
`guest`, or scoped to one event's registrants, is never sent to one — the dispatch row resolves
`skipped` with `audience_restricted` / `audience_scoped`.

This is load-bearing: the model raises `audience.min_role` to `core` whenever the `teams` category
is tagged (Spec §7.1, `Announcement.ts`), so a dispatch loop that read only `categories` would post
the platform's Core-internal announcements to a group chat. In-app delivery is unaffected — it is
per-user and rank-checked.

---

## 5. `notification_preferences`

```jsonc
{ _id: <user_id>, channels: { in_app: { announcement: true, event: true, challenge: true, system: true } } }
```

`_id` **is** the user id: one document per user, no second index, no lookup key to get wrong. An
absent document means every default, so nothing is created at signup and there is no backfill.

**Boundary with `users.settings.notifications`** (owned by User/Auth Service,
`relationships.md §1`): the **global channel switch stays theirs** (`email`, `whatsapp` booleans,
written by `PATCH /users/me/settings`); **per-category granularity is ours**. One question, one
owner, each — and no third cross-service write exception.

`settings.notifications.whatsapp` is deliberately **not** consulted for announcement broadcasts:
those go to a community group, not to a person, so a per-user opt-out cannot be honoured on that
channel. Saying otherwise in a settings screen would be a promise the system does not keep.

---

## 6. Domain events

Consumed:

```
AnnouncementPublished  { announcement_id, categories[], priority, author_user_id, audience }  → broadcast
AnnouncementUpdated    { announcement_id, changed_fields[] }                                  → refresh card text
AnnouncementDeleted    { announcement_id, deleted_by }                                        → retract inbox rows
PointsEarned           { transaction_id, user_id, amount, balance_after, reason, source }      → "you earned X points" (not for source 'challenge')
RegistrationCreated    { registration_id, owner, user_id, role }                             → "you're in" (every path, promotions included)
RegistrationWaitlisted { registration_id, owner, user_id, position }
ChallengeCompleted     { participation_id, challenge_id, member_user_ids[], award_points }   → "approved, X points on their way"
ChallengeRejected      { participation_id, challenge_id, reason, rejection_no }              → keyed per rejection_no
EventCancelled         { event_id }
FeedbackSubmitted      { ticket_id, ticket_no, kind, category, subject }                     → staff notice (core+)
FeedbackResponded      { ticket_id, ticket_no, reporter_user_id, responded_at }              → keyed per responded_at (falls back to the ticket's response.at)
TeamInviteCreated      { team_id, owner, user_id, invited_by }
PlayerSold             { event_id, lot_id, player_user_id, team_id, captain_user_id, amount } → player card + captain card
UserDeleted            { user_id }                                                           → erase the player's name from captain auction cards
```

A challenge approval is one card, not two: `ChallengeCompleted` already says what it pays, so the
`PointsEarned` it causes (source `challenge`) is not carded. The captain's auction card is the only
card that names someone other than its recipient; the name sits in its title alone, and
`UserDeleted` (guarded on the user still being deleted) re-renders that title anonymously and sets a
generic body (older cards named the player in the body too).

**Retired (Sep 26):** `RegistrationConfirmed` — the Event Service's organiser promotion now goes through
Registration Service and emits `RegistrationCreated` like every other entry into `confirmed`; one dedupe
key per registration keeps it one card. A deleted announcement whose `AnnouncementDeleted` was missed
(pub/sub has no replay) is still retracted by the tick's `retractDeleted` sweep over recent `deleted_at`.

Emitted: **none.** `AnnouncementDelivered { announcement_id, channel, category, status }` is emitted
by the **Announcement Service** when the writeback lands, because the owner of a collection emits
the events about it (`relationships.md §6`). A retried writeback re-emits it; nothing consumes it
today, and delivery is not a money path.

The Points Service publishes five events under computed names (`EVENT_FOR[tx.type]` in `ledger.ts`),
as `relationships.md §6` says; only `PointsEarned` is consumed. The other four are deliberately not
consumed: a spend is something the user just did, a refund and an adjustment explain themselves
where they happen, and an expiry is not news to push at somebody. The dedupe key is the ledger row,
which is already idempotent.

---

## 7. Deferred, with the ceiling named

| Deferred | Ceiling / upgrade path |
|---|---|
| Push (FCM), email, SMS | No provider configured; Spec §14 scopes MVP to in-app. `channels` map and the `push` dispatch row are the seams |
| WhatsApp approved message templates | Required for business-initiated conversations outside the 24h service window; needs a business account to register against |
| Delivery webhooks (`sent → delivered → read`) | Meta posts status callbacks to a public URL; nothing in this stack has one. Our status is what the send call returned — same limitation as Strava webhooks |
| Quiet hours / DND (Spec §10.3) | A scheduling concern for channels that interrupt someone. In-app does not; lands with push |
| Synchronous fan-out | `insertMany` in batches of 500 inside the consumer. Sub-second at campus scale; at a few tens of thousands of recipients the answer is a job queue, not a bigger batch |
| Per-announcement delivery analytics (opens, clicks) | `read_at` is the whole story today; an events table is the upgrade |
| Digests / grouping | One cause, one row |
