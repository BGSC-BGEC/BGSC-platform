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
    min_role: 'guest' | 'user' | 'member' | 'core' | 'coordinator',   // 'teams' category forces >= 'core' (Spec §6.4)
    event_id: string | null                                            // scope to registrants of one event; null = everyone
  },

  // ---- attribution (Spec §5.2 "Shows which coordinator/admin made each announcement") ----
  author: {
    user_id: string,
    display_name: string,                 // snapshot
    role_label: string,                   // "Coordinator", "BGEC Core"
    avatar_url: string | null
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
        group_id: string,                 // WhatsApp community group mapped to this category
        status: 'pending' | 'sent' | 'failed' | 'rate_limited' | 'skipped',
        message_id: string | null,
        attempted_at: Date | null,
        error: string | null
      }[]
    },
    push: { requested: boolean, status: 'pending' | 'sent' | 'failed' | 'skipped', sent_count: number | null }
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
| `audience.min_role` | Derived at publish: `'teams' ∈ categories` ⇒ `min_role = 'core'` (Spec §6.4 "Teams (Visible to Core, Coordinator, Founder only)"). Everything else `guest` (Spec §5.2 announcements are public). Admin may raise, never lower below the derived value. |
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
| create draft | Coordinator+, or Core with `announcements:create` permission (Spec §6.4) | — | — |
| draft → published | same | `categories.length ≥ 1`; if `'teams'` then author role ≥ core; sets `published_at = now`, `expires_at = +4mo`, derives `audience.min_role` | `AnnouncementPublished` |
| draft → scheduled | same | `scheduled_for > now` | `AnnouncementScheduled` |
| scheduled → published | scheduler | — | `AnnouncementPublished` |
| published → archived | scheduler | `now ≥ expires_at` | `AnnouncementArchived` |
| edit published | Coordinator+ | title/body/media only; categories frozen (WhatsApp already sent) | `AnnouncementUpdated` |
| delete | Coordinator+ | soft (`deleted_at`) | `AnnouncementDeleted` |

### 2.3 Invariants

- `categories` non-empty, unique values
- `status == 'scheduled'` ⇔ `scheduled_for != null && published_at == null`
- `status ∈ {published, archived}` ⇒ `published_at != null && expires_at == published_at + 4 months`
- `status ∈ {draft, scheduled}` ⇒ `published_at == null && expires_at == null`
- `pinned_until != null` ⇒ `pinned_until <= expires_at`
- `'teams' ∈ categories` ⇒ `audience.min_role ∈ {core, coordinator}`
- `delivery.whatsapp.per_category[].category ⊆ categories`

### 2.4 Indexes

| Index | Serves |
|---|---|
| `{ status: 1, published_at: -1 }` | announcements feed (newest first, `status: 'published'`). `audience.min_role` is filtered in-memory; ≤ a few hundred live docs (4-month window), not worth its own index |
| `{ status: 1, categories: 1, published_at: -1 }` | category filter chips |
| `{ status: 1, 'audience.event_id': 1, published_at: -1 }` | event-scoped announcements on event detail |
| `{ 'author.user_id': 1, status: 1, published_at: -1 }` | "What Our Heads Have to Say": latest per coordinator (Spec §5.2 Tab 1) |
| `{ status: 1, scheduled_for: 1 }` partial (`status == scheduled`) | scheduler |
| `{ status: 1, expires_at: 1 }` | archive + purge jobs |
| `{ status: 1, pinned_until: 1 }` partial | homepage banner |

## 3. Read / unread (plan Week 2: "read/unread status")

No per-(user, announcement) collection. On the User doc (BE-1's schema; agree today):

```ts
users.announcements = {
  last_seen_at: Date,                     // set when user opens Announcements tab
  read_ids: string[]                      // capped at 200 most recent; for per-card "unread" dots
}
```

- Unread count = `count({ status: 'published', published_at > last_seen_at, audience matches })` — one indexed count.
- Per-card dot = `_id ∉ read_ids`.

ponytail: `read_ids` array capped at 200 on the user doc; 4-month retention means the active set is small. If per-announcement read analytics are ever needed, add `announcement_reads { announcement_id, user_id, read_at }`.

## 4. Audience resolution (query-time)

```
visible(a, viewer) :=
  a.status == 'published'
  && rank(viewer.role) >= rank(a.audience.min_role)
  && (a.audience.event_id == null || viewer registered (confirmed) for that event)
```

Guests: `role = guest`. The event-scoped check is **server-side**: Announcement Service fetches the viewer's confirmed event IDs from Registration Service (internal endpoint, cached 60s per user) and adds `{ $or: [{ 'audience.event_id': null }, { 'audience.event_id': { $in: my_event_ids } }] }` to the query. Never trust a client-supplied list.

## 5. Domain events

```
AnnouncementPublished   { announcement_id, categories[], priority, author_user_id, audience }   // Notification + Broadcast consume
AnnouncementScheduled   { announcement_id, scheduled_for }
AnnouncementUpdated     { announcement_id, changed_fields[] }
AnnouncementArchived    { announcement_id }
AnnouncementDeleted     { announcement_id, deleted_by }
AnnouncementDelivered   { announcement_id, channel: 'whatsapp' | 'push', category | null, status }
```

Week 4 Broadcast/WhatsApp service subscribes to `AnnouncementPublished`, writes back into `delivery.*` via Announcement Service.

## 6. Read patterns

| Screen | Query |
|---|---|
| Announcements tab (All) | `find({ status: 'published', 'audience.min_role': { $in: allowedForViewer } }).sort({ published_at: -1 }).limit(20)` |
| Category chip | add `categories: 'bgec'` |
| Homepage "Heads" section | for each coordinator id: `findOne({ 'author.user_id', status: 'published' }).sort({ published_at: -1 })` — or one `$group` by author with `$first`; cache 5 min |
| Homepage banner | `findOne({ status: 'published', pinned_until: { $gt: now } }).sort({ priority: -1, published_at: -1 })` |
| Event detail → announcements | `find({ status: 'published', 'audience.event_id': eventId })` |
| Composer → delivery status | the doc's `delivery` block |

## 7. Deferred

- WhatsApp group-id mapping table (`category → group_id`) — config in Broadcast Service (Week 4), not here.
- Comments/reactions on announcements — Spec treats announcements as one-way; none.
- Full-text search — Spec §13 Elasticsearch; text index on `{ title: 'text', body: 'text' }` for MVP.
