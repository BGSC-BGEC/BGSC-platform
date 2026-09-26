# Team Model

**Owner service:** Registration Service (teams are a registration construct; Event and Challenge services only read them)
**Collections:** `teams`, `team_memberships`
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

  // auction leagues only (Spec §5.15.4 "captain wallets and rosters"); auto-allocated via K-multiplier on start or overridden by OC
  auction: {
    purse_total: number,
    purse_spent: number,             // purse_remaining = total - spent, computed on read
    version: number,                 // optimistic lock for concurrent bids
    is_overridden: boolean,          // true if OC manually adjusted captain purse within oc_captain_override_quota
    override_reason: string | null,  // reason for OC budget override
    overridden_by: string | null,    // user_id of OC member who applied the override
    applied_ops: string[]            // request_ids of purse debits/refunds already applied (idempotency)
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
| `auction.*` writes | **Registration Service only (Sep 26).** The Event Service used to `$inc` purses and `$push` members directly, and fell back to those writes on any HTTP failure — double debits after a timeout, and deliberate refusals (`team_full`, `team_locked`) overridden. Now every write is an `/internal` route here: `debit-purse` / `refund-purse { amount, request_id }`, `add-member`, `POST /internal/events/:id/auction-purses { purse_total }` (auction start; only teams with no purse), `PATCH /internal/teams/:id/auction-budget` (OC override). |
| `auction.applied_ops` | What makes a purse op idempotent: debit = `findOneAndUpdate({ applied_ops: { $ne: rid }, $expr: spent + amount <= total }, { $inc, $push: { applied_ops: rid } })`; a replay of an applied `rid` answers 200 with the team. `rid` = `<lot_id>:debit` / `<lot_id>:refund`. Refund larger than `purse_spent` is refused (`refund_exceeds_spent`), never clamped — the old clamp was a second `save()` that could overwrite a concurrent debit. ponytail: two ids per lot sold; tens of lots per auction. |

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
| → locked | Core+ (`PATCH /teams/:id/lock`); Challenge Service on acceptance (`POST /internal/teams/:id/lock`, idempotent). **As built:** no scheduler and no auction auto-lock — and a teamed event's leaderboard entry is created on `TeamLocked`, so event teams must be locked by hand. | `TeamLocked` |
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

**One-team-per-user-per-owner — `team_memberships` (Sep 26).** A multikey index cannot be unique across documents, and the database runs standalone (no transactions), so two concurrent joins both passed the read-then-write check. Decision: a side collection whose **primary key is the lock**.

```ts
team_memberships { _id: `${owner_id}:${user_id}`, owner_id, user_id, team_id, created_at }
```

Claimed (insert) before the roster `$push`; a second claim is E11000 → `409 already_in_team`. Released on leave/remove, and `deleteMany({ team_id })` on disband. Index `{ team_id: 1 }`. Registration Service is its only writer and reader.

## 7. Domain events (Spec §8.1)

As built (Sep 26):

```
TeamCreated        { team_id, owner, captain_user_id, name }
TeamMemberAdded    { team_id, owner, registration_id, user_id, acquired_via }
TeamInviteCreated  { team_id, owner, user_id, invited_by }
TeamMemberRemoved  { team_id, owner, registration_id, user_id, removed_by, reason }
TeamLocked         { team_id, owner, locked_by }          // Leaderboard creates the team's entry
TeamDisbanded      { team_id, owner, reason }             // Leaderboard withdraws the entry
```

`owner` is on every Team event so a consumer can filter without a read (`TeamLocked` carried none, and the leaderboard's handler was a silent no-op). `TeamUpdated` is not emitted.

## 8. Read patterns

| Screen | Query |
|---|---|
| Event detail → "My Team Card" | `findOne({ 'owner.id': eventId, 'members.user_id': me, status: { $ne: 'disbanded' } })` |
| Event detail → Team search | `find({ 'owner.id': eventId, join_policy: 'open', status: 'forming' })` |
| Auction spectator → Captain wallets | `find({ 'owner.id': eventId }, { name, auction, 'members.display_name' })` |
| Challenge detail → public teams | same as event team search with `owner.type: 'challenge'` |
