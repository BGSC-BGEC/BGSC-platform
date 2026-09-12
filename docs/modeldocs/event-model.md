# Event Model

**Owner service:** Event Service
**Collections:** `events`, `auction_lots`
**Spec refs:** §4.1 (Event, Auction), §5.5 Events Page, §5.15.1 Event/League Builder, §5.15.3 Dynamic Rule Scoring Engine, §5.15.4 Live Auction Hub, §11.4 Auction Security, §8.1 Event + Auction domain events
**MVP plan refs:** Week 2 BE-1 "Events Service Core/Advanced", Week 3 BE-1 "Auction Service"

---

## 1. Purpose

One document per event. The event doc is the **aggregate root** for everything the Events page needs to render a card, a detail view, and its filters in a single read: identity, category/type, schedule, capacity, registration gates, admin assignment, scoring rules, leaderboard config, and auction config.

Things that grow unbounded (registrations, teams, bids, scores) live in their own collections and point back with `event_id`.

## 2. Document shape — `events`

```ts
{
  _id: string,                          // uuid
  slug: string,                         // url-safe, unique, derived from title + year

  // ---- identity ----
  title: string,                        // 1..200
  description: string,                  // rich text (markdown), 0..10_000
  cover_media_url: string | null,
  logo_url: string | null,              // Spec §3.1: event-specific logo in status bar

  // ---- classification (drives Events page tabs + filters) ----
  category: 'leagues' | 'bgec' | 'fitsoc' | 'general',   // Spec §5.5 tabs
  type: 'LE' | 'DE' | 'ALL' | 'DLL',                     // Spec §19 glossary
  domain: 'sports' | 'esports' | 'fitness' | 'general',
  tags: string[],                       // free-form, lowercase, max 20

  // ---- lifecycle ----
  status: 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled',
  visibility: 'public' | 'unlisted',    // unlisted = reachable by link only

  // ---- schedule ----
  start_at: Date,
  end_at: Date,
  venue: string | null,
  timezone: string,                     // IANA, default 'Asia/Kolkata'

  // ---- registration gates (Spec §5.15.1 "Registration Deadline Gates") ----
  registration: {
    opens_at: Date | null,              // null = open as soon as published
    closes_at: Date,                    // == "registration_deadline" in Spec §4.1
    roster_finalizes_at: Date | null,   // teamed events only
    form_id: string | null,             // -> form_definitions._id (registration-model.md); null = no registration (spectator-only event)
    max_participants: number | null,    // solo cap; null = unlimited
    waitlist_enabled: boolean,
    requires_approval: boolean          // admin confirms each registration
  },

  // ---- team settings (Spec §4.1 is_teamed/team_size/max_teams) ----
  teaming: {
    is_teamed: boolean,
    team_size_min: number | null,
    team_size_max: number | null,
    max_teams: number | null,
    captain_application_required: boolean   // Spec §5.5 League "Captain Request Flow"
  },

  // ---- rules & awards ----
  rules_pdf_url: string | null,
  rules_summary: string | null,         // parsed from PDF outline (Spec §5.15.1), optional
  awards: { place: number, title: string, description: string | null }[],

  // ---- contact points shown on detail view (Spec §5.5 "coordinator contact points") ----
  contacts: { user_id: string, display_name: string, role_label: string, contact: string | null }[],

  // ---- admin assignment (Spec §5.15.1 "Administrative Assignment Matrix") ----
  created_by: string,                   // user_id
  core_admins: string[],                // user_ids with edit rights on this event

  // ---- points rules (Spec §5.15.3 "Point Award Toggles", §4.1 points_pool) ----
  points_pool: {
    participation: number,              // base points on confirmed registration; default 10
    podium_multipliers: number[],       // Spec "winner multiplier variables": [place1, place2, place3] × participation; default [3, 2, 1.5]
    sponsor_bonus: number,              // reserved; 0 until sponsors in MVP
    investment_enabled: boolean,        // Spec §5.6 "Points Investment"
    investment_cap: number | null       // max points one user may invest
  },

  // ---- scoring & leaderboard (Spec §5.6, §5.15.3). Detailed in leaderboard-model.md ----
  scoring: {
    parameters: {                       // "Custom Parameter Score Matrix"
      key: string,                      // 'goals', 'kills', 'mvp'
      label: string,
      kind: 'int' | 'float' | 'bool',
      weight: number                    // contribution to raw score
    }[],
    normalization: { lower: number, upper: number }   // 0 <= lower < upper <= 1000
  },
  leaderboard: {                        // present ⇔ type != 'DE' (Spec: DE = Direct Event, no leaderboard)
    format: 'round_robin' | 'single_elim' | 'double_elim' | 'elim_after_n' | 'points_table',
    elim_after_n: number | null,        // only when format == 'elim_after_n'
    min_participants: number            // Spec §5.6 "Min participant threshold"
  } | null,

  // ---- auction (Spec §5.15.4). Lots live in auction_lots. present ⇔ type == 'ALL' ----
  auction: {
    k_multiplier: number,               // Purse Pool = K * sum(base prices)
    min_bid_increment: number,
    bid_timer_seconds: number,          // default 5
    oc_override_quota: number,          // default 3/7 = 0.4286
    status: 'not_started' | 'live' | 'paused' | 'finished',
    captain_user_ids: string[],         // approved captains
    purse_per_team: number | null       // computed when auction starts
  } | null,

  bracket: null,                        // reserved for Week 4 (matches / bracket engine)

  // ---- denormalized counters (updated with $inc by owner service) ----
  counts: {
    registrations_confirmed: number,
    registrations_waitlisted: number,
    teams: number
  },

  created_at: Date,
  updated_at: Date,
  deleted_at: Date | null
}
```

## 3. Field notes

| Field | Why it exists / rules |
|---|---|
| `category` vs `type` | `category` is **where it shows** (Events page tab, Spec §5.5). `type` is **how it behaves** (LE/DE/ALL/DLL, Spec §19). A FitSoc run can be `category: fitsoc, type: LE`. Leagues tab shows `category: leagues` regardless of domain. |
| `status` | Spec §4.1 lists `upcoming|ongoing|past`. Plan adds `draft` (admin) and we add `cancelled`. `upcoming/ongoing/past` are **stored, not derived**, flipped by a scheduler job at `start_at` / `end_at` so filters are plain equality queries and the status change emits a domain event. |
| `registration.form_id` | Event Service never stores form fields. Registration Service owns them (`registration-model.md`). Event creation wizard creates the form first, then the event references it. |
| `teaming.captain_application_required` | Spec §5.5 League-Specific Registration: users apply, Core reviews. Application state lives on the user's `form_submissions` doc (`context.event.captain_application`). |
| `leaderboard` / `auction` nullability | No `enabled` flags. Spec glossary already encodes it in `type`: `DE` has no leaderboard, only `ALL` has an auction. So `leaderboard != null ⇔ type != 'DE'` and `auction != null ⇔ type == 'ALL'`. Queries filter on `type`, which is indexed. |
| `points_pool` | Copied from Spec §4.1 `points_pool{}`, expanded with the three toggles from §5.15.3 (participation, winner multipliers, sponsor bonus) plus investment. Points Service reads this when it consumes `RegistrationCreated` / `EventCompleted`. |
| `scoring.parameters` | Admin-defined per event. The **schema** lives here; the **values** per participant live in `leaderboard_entries.raw`. |
| `auction.captain_user_ids` | Approved captains only. Approval happens through the registration flow; Event Service copies the ID here when Core approves. |
| `counts` | Avoids `count()` on `form_submissions` for every card render. Owner service does `$inc` in the same operation that writes the registration. Drift is repairable by a recount job. |
| `slug` | Deep links and the "Manage on Web" anchor (Spec §5.5 Spectator Bracket View). |

## 4. Enums

```
category       leagues | bgec | fitsoc | general
type           LE | DE | ALL | DLL
domain         sports | esports | fitness | general
status         draft | upcoming | ongoing | past | cancelled
visibility     public | unlisted
leaderboard.format  round_robin | single_elim | double_elim | elim_after_n | points_table
auction.status not_started | live | paused | finished
```

`points_table` = plain ranked list with no bracket (the default for `LE`).

## 5. Status lifecycle

```
draft ──publish──> upcoming ──(start_at reached)──> ongoing ──(end_at reached or admin completes)──> past
  │                   │                                │
  └──────cancel───────┴────────────cancel──────────────┘──> cancelled
```

| Transition | Who | Guard | Emits |
|---|---|---|---|
| create | Core+ | — | `EventCreated` |
| draft → upcoming | Core+ | all §6 invariants hold; `registration.form_id != null` when `type != 'DE'` | `EventUpdated`, plus `EventRegistrationOpened` if `opens_at == null` or `opens_at <= now` |
| `registration.opens_at` reached | scheduler | `status == 'upcoming'` | `EventRegistrationOpened` |
| `registration.closes_at` reached | scheduler | — | `EventRegistrationClosed` |
| upcoming → ongoing | scheduler | `now >= start_at` | `EventStarted` |
| ongoing → past | scheduler or Core+ | — | `EventCompleted { event_id, winners[] }` |
| draft/upcoming/ongoing → cancelled | Coordinator+ | — | `EventCancelled` (consumers: Points reverses participation credits + refunds investments; Leaderboard drops entries; Registration disbands teams; auction lots dropped) |
| delete draft | Core+ | `status == 'draft'` only; soft (`deleted_at`) | `EventDeleted` |

`past` and `cancelled` are terminal. Published events are never deleted, only cancelled — registrations and ledger rows reference them.

## 6. Validation invariants

- `start_at < end_at`
- `registration.opens_at (if set) < registration.closes_at <= start_at`
- `roster_finalizes_at`, if set, in `[closes_at, start_at]`
- `teaming.is_teamed == false` ⇒ `team_size_*`, `max_teams`, `roster_finalizes_at` are null
- `teaming.is_teamed == true` ⇒ `1 <= team_size_min <= team_size_max`
- `leaderboard != null ⇔ type != 'DE'`
- `auction != null ⇔ type == 'ALL'`; `type == 'ALL'` ⇒ `teaming.is_teamed == true`
- `registration.form_id == null` ⇒ `teaming.is_teamed == false`, `max_participants == null`, `type == 'DE'`
- `leaderboard.format == 'elim_after_n'` ⇔ `elim_after_n >= 1`
- `0 <= scoring.normalization.lower < upper <= 1000` (Spec §5.6)
- `scoring.parameters[].key` unique, `^[a-z][a-z0-9_]{0,31}$`
- `core_admins` ⊇ `{created_by}`
- `points_pool.podium_multipliers` non-increasing, length ≤ `awards.length` or 3
- `auction.oc_override_quota <= 3/7` (Spec §5.15.4 hard ceiling)

## 7. Indexes

| Index | Serves |
|---|---|
| `{ slug: 1 }` unique | deep links |
| `{ status: 1, category: 1, start_at: 1 }` | Events page: tab + Past/Upcoming/Ongoing multi-select, sorted by date |
| `{ type: 1, status: 1, start_at: -1 }` | Leaderboards page card list (`type != 'DE'`), auction list (`type == 'ALL'`) |
| `{ tags: 1, status: 1 }` | filter by tag (Leaderboards page, search) |
| `{ core_admins: 1 }` | "events I administer" in admin panel |
| `{ status: 1, start_at: 1 }` | scheduler: find `upcoming` whose `start_at <= now` |
| `{ status: 1, end_at: 1 }` | scheduler: find `ongoing` whose `end_at <= now` |
| `{ status: 1, 'registration.opens_at': 1 }` | scheduler: open registration |
| `{ status: 1, 'registration.closes_at': 1 }` | scheduler: close registration |
| `{ deleted_at: 1 }` partial | exclude soft-deleted |

Text search on `title`/`description` deferred to Elasticsearch (Spec §13); for MVP a text index on `{ title: 'text', tags: 'text' }` is acceptable.

## 8. `auction_lots` — one doc per player on the block

Spec §4.1 `Auction` entity is per-player; we call it a **lot** to avoid confusion with the event-level `auction` config.

```ts
{
  _id: string,
  event_id: string,
  player: { user_id: string, display_name: string, avatar_url: string | null },  // snapshot
  registration_id: string,            // -> form_submissions._id (has base_price)
  base_price: number,                 // player-submitted (Spec §5.5)
  oc_adjusted_price: number | null,   // after 3/7ths override (Spec §5.15.4)
  order: number,                      // position in auction sequence

  status: 'queued' | 'on_block' | 'sold' | 'unsold',
  current_bid: number | null,
  current_bidder: { user_id: string, team_id: string } | null,
  timer_ends_at: Date | null,         // server-authoritative (Spec §11.4)

  bids: {                             // embedded, append-only
    bid_id: string,
    bidder_user_id: string,
    team_id: string,
    amount: number,
    placed_at: Date
  }[],

  sold_to_team_id: string | null,
  sold_amount: number | null,
  closed_at: Date | null,

  version: number,                    // optimistic lock (Spec §11.4 "Concurrent Bid Handling")
  created_at: Date,
  updated_at: Date
}
```

**Bid write rule.** Pre-checks (reject with 4xx): bidder ∈ `events.auction.captain_user_ids`; bidder's team `purse_remaining >= amount` (from `teams`, see `team-model.md`); `amount >= (current_bid ?? (oc_adjusted_price ?? base_price)) + min_bid_increment` for a non-first bid, `>= floor price` for the first. Then one atomic write:

```
findOneAndUpdate(
  { _id, version, status: 'on_block', timer_ends_at: { $gt: now } },
  { $push: { bids }, $set: { current_bid, current_bidder, timer_ends_at: now + bid_timer_seconds }, $inc: { version: 1 } })
```

No match ⇒ reject (stale version, timer expired, or lot closed). Purse is re-validated on close (`PlayerSold`) because a captain can hold the high bid on only one lot at a time but may have lost purse elsewhere in the meantime.

Indexes: `{ event_id: 1, order: 1 }`, `{ event_id: 1, status: 1 }`, `{ 'player.user_id': 1, event_id: 1 }` unique.

Lot lifecycle: `queued → on_block → sold | unsold`. Emits `AuctionStarted`, `BidPlaced`, `BidClosed`, `PlayerSold`, `PlayerUnsold` (Spec §8.1).

ponytail: bids embedded in the lot. Ceiling ≈ a few hundred bids per player; if bid history needs pagination or analytics, move to `auction_bids` collection.

## 9. Domain events emitted (Spec §8.1)

```
EventCreated              { event_id, title, type, created_by }
EventUpdated              { event_id, changed_fields[], updated_by }
EventRegistrationOpened   { event_id }
EventRegistrationClosed   { event_id }
EventStarted              { event_id }
EventCompleted            { event_id, winners: [{ place, participant: { type: 'user' | 'team', id } }] }
EventCancelled            { event_id, cancelled_by, reason }
EventDeleted              { event_id, deleted_by }          // drafts only
AuctionStarted            { event_id, lot_id, player_user_id }
BidPlaced                 { bid_id, lot_id, event_id, bidder_user_id, team_id, amount }
BidClosed                 { lot_id, winner_team_id | null, final_amount | null }
PlayerSold                { lot_id, player_user_id, team_id, amount }
PlayerUnsold              { lot_id, player_user_id }
```

## 10. Read patterns this design must serve

| Screen | Query |
|---|---|
| Events page tab + filters | `find({ status: { $in: [...] }, category, deleted_at: null }).sort({ start_at })` — one index hit |
| Event detail | `findOne({ slug })` — one read; registration count from `counts` |
| Leaderboards page card list | `find({ type: { $ne: 'DE' }, status: { $in: ['ongoing','past'] } }).sort({ start_at: -1 })` |
| Admin "my events" | `find({ core_admins: userId })` |
| Auction spectator screen | `findOne(events)` + `find(auction_lots, { event_id, status: 'on_block' })` + `find(teams, { owner.id: event_id })` |

## 11. Deferred / not in this doc

- `bracket` / `matches` — Week 4 BE-2 task; slot reserved.
- Sponsor leaderboard preview on event detail (Spec §5.5) — sponsors out of MVP.
- Elasticsearch indexing — Spec §13; text index is the MVP stand-in.
