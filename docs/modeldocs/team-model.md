# Team Model

**Owner service:** Registration Service (teams are a registration construct; Event and Challenge services only read them)
**Collection:** `teams`
**Spec refs:** §4.1 Team, §5.5 "Event registration section" + "Event Team Formation Section", §5.7 "team formation list ... following the structure of teamed events", §5.15.4 (captain wallets/rosters), §8.1 Team* events

---

## 1. Purpose

Spec §5.7 says challenge teams follow "the structure of teamed events". So one `teams` collection, polymorphic on `owner`, used by both events and challenges. Avoids two near-identical team models.

## 2. Document shape — `teams`

```ts
{
  _id: string,
  owner: { type: 'event' | 'challenge', id: string },    // which event/challenge this team competes in

  name: string,                      // 1..60, unique per owner (case-insensitive)
  name_lower: string,                // lowercased name, for the unique index
  logo_url: string | null,

  captain_user_id: string,
  members: {                         // includes captain
    user_id: string,
    display_name: string,            // snapshot
    avatar_url: string | null,       // snapshot
    registration_id: string | null,  // -> form_submissions._id; required for event owners, null for challenge owners (no form)
    joined_at: Date,
    acquired_via: 'created' | 'invite' | 'join_request' | 'auction'
  }[],

  join_policy: 'open' | 'invite_only' | 'closed',   // Spec §5.5 "Team status toggle"
  invite_code: string,                              // 8 chars, unique globally, rotatable
  size_min: number,                                 // copied from owner (events.teaming / challenges.teaming) at creation
  size_max: number,

  pending: {                                        // in-flight invites / requests
    user_id: string,
    direction: 'invite' | 'request',                // invite = team → user, request = user → team
    created_by: string,
    created_at: Date,
    expires_at: Date
  }[],

  status: 'forming' | 'complete' | 'locked' | 'disbanded',

  // auction leagues only (Spec §5.15.4 "captain wallets and rosters"); set on AuctionStarted from events.auction.purse_per_team
  auction: {
    purse_total: number,
    purse_spent: number,             // purse_remaining = total - spent, computed on read
    version: number                  // optimistic lock for concurrent bids
  } | null,

  created_at: Date,
  updated_at: Date
}
```

## 3. Field notes

| Field | Notes |
|---|---|
| `owner` | Polymorphic ref. All team queries are scoped by `owner.id` so there is never a cross-owner scan. |
| `members[].registration_id` | For event owners every member must have their own confirmed `form_submissions` doc; team ≠ registration, team groups registrations. Challenge owners have no form, so null there. |
| `join_policy` | Spec §5.5 three-way toggle. `open` = anyone can request; `invite_only` = captain invites; `closed` = nothing in/out. |
| `invite_code` | Spec §5.5 "invite codes". Captain can rotate; old code invalid immediately. |
| `pending` | Both invite and request directions live in one array; accepting either moves the user to `members`. Expire after 72h by default. |
| `status` | See §4.1. `forming` while roster can change; `complete` once `size_min` met and captain confirms; `locked` after `roster_finalizes_at` (event) or on challenge acceptance; `disbanded` = soft removal. |
| `auction.version` | Purse debit on `PlayerSold` is `findOneAndUpdate({ _id, version, 'auction.purse_spent': { $lte: total - amount } }, { $inc: { 'auction.purse_spent': amount, 'auction.version': 1 } })`. |

## 4. Invariants

- `captain_user_id ∈ members[].user_id`
- `members.length <= size_max`; `status ∈ {complete, locked}` ⇒ `members.length >= size_min`
- event owner: captain's registration has `context.event.role == 'captain'` and, when `events.teaming.captain_application_required`, `captain_application.status == 'approved'`
- event owner with `type == 'ALL'`: `captain_user_id ∈ events.auction.captain_user_ids`
- `members[].user_id` unique within a team; a user is in **at most one** non-disbanded team per `owner` (enforced by unique index on a side collection or by a check-then-write inside the Registration Service; see §6)
- `pending[].user_id ∉ members[].user_id`
- `status == 'locked'` ⇒ no member mutations except by Core+ of the owner
- `auction != null ⇔ owner.type == 'event' && events.type == 'ALL'`

### 4.1 Status lifecycle

```
forming ──(size_min met, captain confirms)──> complete ──(roster_finalizes_at / challenge accepted)──> locked
   │             ▲                                │
   │             └──(member leaves, below size_min)┘
   └──────────── disband (captain, or owner cancelled) ─────────────────────────────────────> disbanded
```

| Transition | Who | Emits |
|---|---|---|
| create | captain (needs confirmed captain registration for event owners) | `TeamCreated` |
| member add / remove | captain, member (leave), Core+ | `TeamMemberAdded` / `TeamMemberRemoved` |
| forming ↔ complete | captain, or automatic on size change | `TeamUpdated` |
| → locked | scheduler at `roster_finalizes_at`; Challenge Service on acceptance; Event Service when a lot is sold into the team (auction rosters lock per event rules) | `TeamLocked` |
| → disbanded | captain while `forming`; Core+ any time; automatic on `EventCancelled` | `TeamDisbanded` |

Captain leaving: blocked unless they transfer captaincy first (`TeamUpdated { captain_user_id }`) or the team has no other members (then disband).

## 5. User-side "open to be invited" toggle

Spec §5.5: "User toggle: Open / Closed / Invite Only (controls if others can invite them to teams)". This is **per user per event**, not per team. It lives on the user's registration doc: `form_submissions.context.event.team_visibility` (see `registration-model.md`). Team search for "users open to join" queries `form_submissions`, not `teams`.

## 6. Indexes

| Index | Serves |
|---|---|
| `{ 'owner.type': 1, 'owner.id': 1, status: 1 }` | list teams for an event/challenge, filter by status |
| `{ 'owner.id': 1, name_lower: 1 }` unique | unique team names per event (store `name_lower` alongside `name`) |
| `{ invite_code: 1 }` unique | join by code |
| `{ 'members.user_id': 1, 'owner.id': 1 }` | "my team for this event"; also the duplicate-membership check |
| `{ 'owner.id': 1, join_policy: 1, status: 1 }` | Team search: open teams still forming |

**One-team-per-user-per-owner:** Mongo cannot make a multikey index unique across documents the way we need. Registration Service enforces it: `findOne({ 'owner.id', 'members.user_id': uid, status: { $ne: 'disbanded' } })` then insert, inside a transaction (Mongo 4.0+ replica set). ponytail: check-then-write in a txn; if the DB chosen has no transactions, add a `team_memberships` side collection with unique `{ owner_id, user_id }`.

## 7. Domain events (Spec §8.1)

```
TeamCreated        { team_id, owner, captain_id, name }
TeamUpdated        { team_id, changed_fields[], updated_by }
TeamMemberAdded    { team_id, user_id, added_by, via }
TeamMemberRemoved  { team_id, user_id, removed_by }
```
Plus `TeamLocked { team_id }` and `TeamDisbanded { team_id }` (not in spec list; needed by Event Service to freeze rosters and by Points Service to refund).

## 8. Read patterns

| Screen | Query |
|---|---|
| Event detail → "My Team Card" | `findOne({ 'owner.id': eventId, 'members.user_id': me, status: { $ne: 'disbanded' } })` |
| Event detail → Team search | `find({ 'owner.id': eventId, join_policy: 'open', status: 'forming' })` |
| Auction spectator → Captain wallets | `find({ 'owner.id': eventId }, { name, auction, 'members.display_name' })` |
| Challenge detail → public teams | same as event team search with `owner.type: 'challenge'` |
