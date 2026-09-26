# Announcement Model

**Owner service:** Announcement Service (plan Week 2 BE-2)
**Collection:** `announcements`; per-user read state on the User doc
**Spec refs:** §4.1 Announcement, §5.2 Tab 2 Announcements (4-month retention, attribution, categories), §5.2 Tab 1 "What Our Heads Have to Say" (latest announcement per coordinator), §6.4 Make Announcement Popup (multi-select tags, WhatsApp per tag, Send Now / Schedule), §7.1 (Teams tag role-gated), §9.4 WhatsApp Business API (tag → group, fallback, 1/tag/hour), §15.3 retention (4 months active, 1 year archive)
**MVP plan refs:** Week 2 BE-2 "Announcements Service" (CRUD, categories, priority levels, target audience, scheduling, read/unread). Week 4 BE-2 "Broadcast & WhatsApp" consumes this model.

---

## 1. Purpose

Official, editorial, short-lived posts. One document per announcement. Delivery (WhatsApp, push) is tracked **on** the document per category so the composer can show "sent / failed / rate-limited" without a second collection.

## 2. `announcements`

```ts
{
  _id: string,

  title: string,                          // 1..120
  body: string,                           // rich text (markdown), 1..5000
  media_url: string | null,               // optional 16:9 visual

  // ---- classification (Spec §6.4 multi-select) ----
  categories: ('bgec' | 'fitsoc' | 'airball' | 'offside' | 'powerplay' | 'around_the_net' |
               'deuce' | 'highlight' | 'teams')[],      // ≥ 1
  tags: string[],                         // free-form extra tags (Spec §4.1 tags[])
  priority: 'normal' | 'important' | 'urgent',          // plan: "priority levels"

  // ---- audience (plan: "target audience filtering") ----
  audience: {
    min_role: 'guest' | 'user' | 'member' | 'core' | 'coordinator' | 'founder',   // 'teams' forces >= 'core' (Spec §6.4); never above the author's own rank
    event_id: string | null                                            // scope to registrants of one event; null = everyone
  },

  // ---- attribution (Spec §5.2 "Shows which coordinator/admin made each announcement") ----
  author: {
    user_id: string,
    display_name: string,                 // snapshot
    role_label: string,                   // "Coordinator", "BGEC Core" — historical, never refreshed
    avatar_url: string | null,
    deleted: boolean                      // raised by UserDeleted, lowered by UserRestored
  },

  // ---- lifecycle & scheduling (Spec §6.4 "Send Now / Schedule for Later") ----
  status: 'draft' | 'scheduled' | 'published' | 'archived',
  scheduled_for: Date | null,
  published_at: Date | null,
  expires_at: Date | null,                // = published_at + 4 months (Spec §5.2, §15.3); null until published
  pinned_until: Date | null,              // homepage banner (plan Week 4 "Live announcements banner")

  // ---- delivery (Spec §9.4) ----
  delivery: {
    whatsapp: {
      requested: boolean,
      per_category: {
        category: string,
        group_id: string,                 // MASKED label of the destination (`••••1234`), never the raw value — PII served to core+
        status: 'pending' | 'sent' | 'failed' | 'rate_limited' | 'skipped',
        message_id: string | null,
        attempted_at: Date | null,
        error: string | null,
        revision: number                  // sender's dispatch-row revision; an older receipt never overwrites a newer one
      }[]
    },
    push: { requested: boolean, status: 'pending' | 'sent' | 'failed' | 'skipped', sent_count: number | null, revision: number }
  },

  created_at: Date,
  updated_at: Date,
  deleted_at: Date | null
}
```

### 2.1 Field notes

| Field | Notes |
|---|---|
| `categories[]` | Spec §4.1 has singular `type`; Spec §6.4 says multi-select. Multi-select wins (array). Enum values are the nine Spec §6.4 tags in snake_case. |
| `audience.min_role` | Derived at publish: `'teams' ∈ categories` ⇒ `min_role = 'core'` (Spec §6.4 "Teams (Visible to Core, Coordinator, Founder only)"). Everything else `guest` (Spec §5.2 announcements are public). Admin may raise, never lower below the derived value, and never above their own rank (`422 min_role_above_own_rank`) — a composer cannot write what they could not read. |
| `expires_at` | Set at publish. Mongo TTL index **does not delete** here (Spec §15.3 wants 1-year archive) — a scheduler flips `status → archived` at `expires_at`; a second TTL-style job hard-deletes `archived` docs at `expires_at + 8 months` (= 1 year total). |
| `delivery.whatsapp.per_category` | One row per category present at publish. Rate limit (Spec §9.4: 1/tag/hour) is checked per row: Redis key `wa:rl:{category}` with 1h TTL; blocked ⇒ `rate_limited`, in-app still publishes (Spec fallback). |
| `pinned_until` | Cheap way to power the homepage banner without a "featured" collection. |
| `author` snapshot | Announcement stays attributed even if the coordinator's role changes later (Spec §5.2 attribution is historical). |

### 2.2 Status lifecycle

```
draft ──publish now──> published ──(expires_at)──> archived ──(+8 months)──> deleted
  └──schedule──> scheduled ──(scheduled_for reached)──> published
                     └──unschedule──> draft
```

| Transition | Who | Guard | Emits |
|---|---|---|---|
| create draft | Core+ (Spec §6.4 "Core with permission" — no per-user permission field exists on `users`, so it collapses to the role gate) | — | — |
| draft → published | same | `categories.length ≥ 1`; if `'teams'` then author role ≥ core; sets `published_at = now`, `expires_at = +4mo`, derives `audience.min_role`, sets `delivery.*.requested = true` (Spec §6.4: WhatsApp auto-sends on publish) | `AnnouncementPublished` |
| draft / scheduled → scheduled | same | `scheduled_for > now`; from `scheduled` it is a reschedule | `AnnouncementScheduled` |
| scheduled → published | scheduler | — ; `pinned_until` is capped at the new `expires_at` (the pin was checked against `scheduled_for`, and a later publish at a clamped month end can expire earlier) | `AnnouncementPublished` |
| published → archived | scheduler | `now ≥ expires_at` | none — one `updateMany`, nothing consumes it before Week 4 |
| edit published / scheduled | Core+ | title/body/media/priority/tags/pinned_until; `categories` and `audience` frozen once out of `draft` (WhatsApp fan-out keys off them) | `AnnouncementUpdated` |
| delete | Coordinator+ | soft (`deleted_at`). A deleted draft/scheduled item never gets `expires_at`, so the scheduler hard-purges it 1 year after `deleted_at` | `AnnouncementDeleted` |

### 2.3 Invariants

- `categories` non-empty, unique values
- `status == 'scheduled'` ⇔ `scheduled_for != null && published_at == null`
- `status ∈ {published, archived}` ⇒ `published_at != null && expires_at == published_at + 4 months`
  — calendar months in UTC, the day clamped to the target month's last day (Oct 31 → Feb 28/29), so
  the value is the same on every host and never earlier for a later publish in a different month
- `status ∈ {draft, scheduled}` ⇒ `published_at == null && expires_at == null`
- `pinned_until != null` ⇒ `pinned_until <= expires_at`
- `'teams' ∈ categories` ⇒ `audience.min_role ∈ {core, coordinator}`
- `delivery.whatsapp.per_category[].category ⊆ categories`

### 2.4 Indexes

| Index | Serves |
|---|---|
| `{ status: 1, published_at: -1 }` | announcements feed (newest first, `status: 'published'`). `audience.min_role` is filtered **in the query** as a `$in` over the viewer's allowed prefix of `ROLE_RANK` — not in memory, which would break `limit` and keyset pagination. It is not an index key: ≤ a few hundred live docs (4-month window), the `{ status, published_at }` scan does the work |
| `{ status: 1, categories: 1, published_at: -1 }` | category filter chips |
| `{ status: 1, 'audience.event_id': 1, published_at: -1 }` | event-scoped announcements on event detail |
| `{ 'author.user_id': 1, status: 1, published_at: -1 }` | "What Our Heads Have to Say": latest per coordinator (Spec §5.2 Tab 1) |
| `{ status: 1, scheduled_for: 1 }` partial (`status == scheduled`) | scheduler |
| `{ status: 1, expires_at: 1 }` | archive + purge jobs |
| `{ status: 1, pinned_until: 1 }` | homepage banner |
| `{ title: 'text', body: 'text' }` | `q` search (MVP stand-in for Elasticsearch, Spec §13) |
| `{ deleted_at: -1 }` partial (`deleted_at` is a date) | Notification Service's sweep for deletes whose `AnnouncementDeleted` it never heard (pub/sub has no replay) |

`tags` declares `lowercase`/`trim` on the array element; on the array path Mongoose ignored them (Sep 26).

## 3. Read / unread (plan Week 2: "read/unread status")

No per-(user, announcement) collection. On the User doc (BE-1's schema; agree today):

```ts
users.announcements = {
  last_seen_at: Date,                     // set when user opens Announcements tab
  read_ids: string[]                      // capped at 200 most recent; for per-card "unread" dots
}
```

- `last_seen_at` is a watermark (opening the tab / "read all" sets it); `read_ids` holds cards opened one at a time.
- Unread count = `count({ status: 'published', published_at > last_seen_at, audience matches })` — one indexed count.
- Per-card dot = `published_at > last_seen_at && _id ∉ read_ids`. Both halves, or "read all" clears the badge but leaves every dot lit.
- `POST /announcements/:id/read` and `/read-all` take `requireAuth` only: they write the caller's own user document and nothing else, so there is no authority to re-check against the live user.
- `GET /announcements/unread-count` answers `{ count }` — the same shape as `GET /notifications/unread-count`.

ponytail: `read_ids` array capped at 200 on the user doc; 4-month retention means the active set is small. If per-announcement read analytics are ever needed, add `announcement_reads { announcement_id, user_id, read_at }`.

## 4. Audience resolution (query-time)

```
visible(a, viewer) :=
  a.status == 'published'
  && rank(viewer.role) >= rank(a.audience.min_role)
  && (a.audience.event_id == null || viewer registered (confirmed) for that event)
```

Guests: `role = guest`. The event-scoped check is **server-side**: Announcement Service reads the viewer's confirmed event IDs straight from `form_submissions` (`distinct('owner.id', { 'user.user_id', 'owner.type': 'event', status: 'confirmed' })` — a read, so no internal endpoint and no cache) and adds `{ $or: [{ 'audience.event_id': null }, { 'audience.event_id': { $in: my_event_ids } }] }` to the query. Never trust a client-supplied list. Every read path also carries `deleted_at: null`.

Core+ bypasses the **status and event** gates on `GET /:id` and on the list: a composer has to be able to open its own drafts and find a published announcement it scoped to an event it is not registered for. The **rank** gate is never bypassed — a core member does not see a coordinator- or founder-only announcement, on reads or on writes.

## 5. Domain events

```
AnnouncementPublished   { announcement_id, categories[], priority, author_user_id, audience }   // Notification + Broadcast consume
AnnouncementScheduled   { announcement_id, scheduled_for }
AnnouncementUpdated     { announcement_id, changed_fields[] }
AnnouncementArchived    { announcement_id }                                                    // NOT emitted: archiving is one updateMany
AnnouncementDeleted     { announcement_id, deleted_by }
AnnouncementDelivered   { announcement_id, channel: 'whatsapp' | 'push', category | null, status }
```

**Shipped Sep 26, 2026 (Week 4 Saturday).** The Notification Service (:3010) subscribes to
`AnnouncementPublished`, fans out in-app notifications to the resolved audience, sends one WhatsApp
message per category, and writes the outcome back through
`PATCH /internal/announcements/:id/delivery` — an internal route, built once it had a caller. `AnnouncementDelivered`
is emitted **by this service** on that writeback, one event per channel, because the owner of a
collection emits the events about it.

**Writeback ordering (Sep 26).** The inline writeback and the sweep's can land out of order, so every
row carries the dispatch `revision` and the receiver applies a row only if it is newer than the one it
holds. The client treats only `404` (deleted) and `409` (not published) as permanent; `401`/`422` are
deploy faults and are retried (and logged), not stamped done.

Consumed: `UserProfileUpdated` (gated on `full_name`/`avatar_url`; a currently-deleted author is left
alone), `UserDeleted` (`anonymizedSnapshot('author.')`), `UserRestored` (re-snapshot, `deleted: false`).
`role_label` is never refreshed.

One rule that belongs here rather than only in the broadcaster: **an announcement whose
`audience.min_role` is above `guest`, or which is scoped to an event, is never sent to a WhatsApp
group.** The `teams` tag raises `min_role` to `core` (§2.3), and a community group is a public
destination — see `notification-model.md §4.1`.

## 6. Read patterns

| Screen | Query |
|---|---|
| Announcements tab (All) | `find({ status: 'published', deleted_at: null, 'audience.min_role': { $in: allowedForViewer }, $or: [event_id null \| in mine] }).sort({ published_at: -1, _id: -1 }).limit(20)` — keyset cursor on `(published_at, _id)` |
| Category chip | add `categories: 'bgec'` |
| Homepage "Heads" section | `users` where role ∈ {coordinator, founder}, `status: 'active'`, then one `$match` + `$sort` + `$group`/`$first` by `author.user_id`; a coordinator with no announcement gets `announcement: null` (Spec §5.2 meme slot) |
| Homepage banner | `find({ ...feed filter, pinned_until: { $gt: now } })`, then ordered in memory by `ANNOUNCEMENT_PRIORITY.indexOf` desc, `published_at` desc — `priority` is a string enum, so a Mongo sort on it is alphabetical and wrong |
| Event detail → announcements | `find({ status: 'published', 'audience.event_id': eventId })` |
| Composer → my drafts | `?status=draft&author_id=<me>`, newest created first |
| Composer → schedule queue | `?status=scheduled`, `scheduled_for` ascending (soonest first), keyset on `(scheduled_for, _id)` |
| Composer → delivery status | the doc's `delivery` block — core+ only; readers' responses omit it |

## 7. Deferred

- WhatsApp group-id mapping table (`category → group_id`) — config in Broadcast Service (Week 4), not here.
- Comments/reactions on announcements — Spec treats announcements as one-way; none.
- Full-text search — Spec §13 Elasticsearch; text index on `{ title: 'text', body: 'text' }` for MVP.
