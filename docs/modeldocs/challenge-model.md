# Challenge Model

**Owner service:** Challenge Service
**Collections:** `challenges`, `challenge_participations`
**Spec refs:** §4.1 Challenge, §5.7 Challenge System, §5.15 "Challenge Creation" (required fields), §5.9 "Challenge Legends" → Hall of Fame, §8.2 (Points consumes `ChallengeCompleted`), §15.1 media limits
**MVP plan refs:** Week 3 BE-2 "Challenge System" (create/manage, types individual/team, participation, completion tracking, rewards → points). `ARCHITECTURE_REVIEW_MEETING.md` §6: proof upload depends on Media (Week 4) — proof is a URL/text until then.

---

## 1. Purpose

`challenges` = the catalog (admin-authored). `challenge_participations` = one doc per (challenge, user-or-team) carrying the **entire** lifecycle: accepted → in progress → submitted → approved/rejected. Acceptance and submission are not separate collections; a submission without an acceptance cannot exist, and the UI (Spec §5.7 "Progress tracking and submission portal") always shows them together.

## 2. `challenges`

Fields map 1:1 to Spec §5.15 "Challenge Creation — Required fields": Points, Title, Description, Time, Location, Status, Domain, Teammable.

```ts
{
  _id: string,
  slug: string,

  title: string,                          // 1..120
  description: string,                    // markdown; for 'digital' kind, the full brief may be hidden until accept (Spec §5.7)
  brief_hidden_until_accept: boolean,     // Spec §5.7 "details revealed upon acceptance"
  cover_media_url: string | null,

  domain: 'sports' | 'esports' | 'dev' | 'general',          // Spec §5.7 domain filter
  kind: 'physical' | 'digital',                                    // Spec §5.7 challenge types
  difficulty: 'easy' | 'medium' | 'hard' | 'legend',               // Spec §4.1
  tags: string[],

  award_points: number,                   // Spec "Points". > 0
  grants_hall_of_fame: boolean,           // default true when difficulty == 'legend' (Spec §5.7)

  // ---- "Time" ----
  window: {
    opens_at: Date | null,                // null = open now
    closes_at: Date | null,               // last moment to accept; null = evergreen
    submissions_close_at: Date | null,    // hard stop for submissions regardless of personal deadline; null = none
    time_limit_minutes: number | null     // per-participant deadline from accepted_at (Spec §4.1 time_limit)
  },

  // ---- "Location" (physical challenges) ----
  location: { name: string, details: string | null } | null,

  // ---- "Teammable" ----
  teaming: {
    enabled: boolean,                     // Spec §5.15 "Teammable or not?"
    team_size_min: number | null,
    team_size_max: number | null,         // == Spec §4.1 team_limit
    max_teams: number | null
  },

  max_participants: number | null,        // solo cap; null = unlimited

  resources: { label: string, url: string }[],      // Spec §4.1 resource_links

  submission: {
    requires_proof: boolean,              // false = admin marks complete manually
    proof_types: ('url' | 'text' | 'image' | 'video')[],   // image/video enabled when Media lands (Week 4)
    max_files: number,                    // default 5
    auto_approve: boolean                 // true = approved on submit (trust-based digital challenges)
  },

  status: 'draft' | 'active' | 'completed' | 'archived',   // Spec §4.1

  counts: { accepted: number, submitted: number, approved: number },   // $inc by owner

  created_by: string,
  reviewers: string[],                    // user_ids allowed to approve/reject; Core+ always allowed
  created_at: Date,
  updated_at: Date,
  deleted_at: Date | null
}
```

### 2.1 Status lifecycle

```
draft ──activate──> active ──(closes_at passed or admin)──> completed ──> archived
  └──────────────────────────────────────archive────────────────────────────┘
```

`active` is the only state where acceptances are allowed. `completed` still accepts **submissions** from already-accepted participants until their `deadline_at`. `archived` hides from browser.

### 2.2 Invariants

- `award_points > 0`
- `difficulty == 'legend'` ⇒ `grants_hall_of_fame` defaults true (admin may override). **Applied in the
  service, not as a schema default** (`Challenge.ts:97` is `default: false`): a Mongoose default
  cannot tell "the admin said false" from "the admin said nothing", and the override has to win
- `teaming.enabled == false` ⇒ `team_size_*`, `max_teams` null
- `kind == 'physical'` ⇒ `location != null`
- `window.opens_at < window.closes_at <= window.submissions_close_at` for whichever are set
- `teaming.enabled == true` ⇒ `1 <= team_size_min <= team_size_max`
- `submission.requires_proof == false` ⇒ `proof_types == []` — the service **normalizes** this rather
  than refusing it. `proof_types` defaults to `[...MVP_PROOF_TYPES]` (`Challenge.ts:129`) while
  `requires_proof` defaults `true`, so `{ requires_proof: false }` alone would trip the hook and
  answer 500 for a request that was never wrong
- `submission.auto_approve == true` ⇒ `requires_proof == true` (something must be submitted)

### 2.3 Indexes

| Index | Serves |
|---|---|
| `{ slug: 1 }` unique | deep link |
| `{ status: 1, domain: 1, difficulty: 1 }` | Challenge browser filters (Spec §5.7) |
| `{ status: 1, 'window.closes_at': 1 }` | scheduler: complete expired |
| `{ tags: 1, status: 1 }` | tag filter / search |
| `{ created_by: 1 }`, `{ reviewers: 1 }` | admin lists |

## 3. `challenge_participations`

```ts
{
  _id: string,
  challenge_id: string,
  challenge_snapshot: { title: string, difficulty: string, award_points: number },   // for history rows

  participant: {
    type: 'user' | 'team',
    id: string,                           // user_id or teams._id (owner.type == 'challenge')
    display_name: string,
    avatar_url: string | null
  },
  member_user_ids: string[],              // team: all members at acceptance; user: [user_id]. Points fan out to these.

  status: 'accepted' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'withdrawn',

  accepted_at: Date,
  deadline_at: Date | null,               // min(accepted_at + time_limit_minutes, window.submissions_close_at); null if neither set

  progress: {                             // Spec §5.7 "Progress tracking"
    percent: number,                      // 0..100, user-reported or step-derived
    steps: { key: string, label: string, done: boolean, done_at: Date | null }[],
    notes: string | null
  },

  submission: {
    proofs: {
      type: 'url' | 'text' | 'image' | 'video',
      value: string,                      // url or text
      name: string | null,
      size_bytes: number | null,
      mime: string | null
    }[],
    notes: string | null,                 // ≤ 500 chars
    submitted_at: Date,
    version: number                       // increments on re-submit while under_review
  } | null,

  review: {
    reviewer_user_id: string,
    decision: 'approved' | 'rejected',
    reason: string | null,
    reviewed_at: Date
  } | null,

  reward: {
    points_awarded: number,
    point_transaction_ids: string[],      // one per member_user_id
    hall_of_fame_entry_id: string | null
  } | null,

  status_history: { from: string, to: string, by: string, at: Date }[],
  created_at: Date,
  updated_at: Date
}
```

### 3.1 Status lifecycle

```
accepted ──submit──> submitted ─(auto_approve)─> approved
    │                    │                          ▲
    │                    └──> under_review ─approve─┘
    │                              │
    │                              └─reject─> rejected ──resubmit──> under_review
    ├──(requires_proof == false, reviewer marks done)──> approved
    ├──(deadline_at passed, nothing submitted)──> expired
    └──(Core+ removes)──> withdrawn
```

> **`submitted` is drawn above but never assigned.** The service writes `under_review` (or
> `approved` when `auto_approve`) directly, because the hop out of `submitted` is unconditional —
> a row could only ever be caught there between two lines of one write. It stays in the enum and in
> the reviewable set so an older row still reviews; treat the diagram's `submitted` node as a label
> on the arrow, not a state to query for.

`accepted` is also the "in progress" state; `progress` is edited while `accepted`. No separate start step (ponytail: add `started_at` + explicit start only if a challenge needs the timer to begin later than acceptance).

| Transition | Guard | Emits |
|---|---|---|
| create (`accepted`) | challenge `active`; now in `[window.opens_at, window.closes_at]`; unique index passes; solo: `counts.accepted < max_participants`; team: caller is captain of a `teams` doc with `owner = { challenge, id }`, `status != 'disbanded'`, `teaming.team_size_min <= members <= teaming.team_size_max`, and team count `< teaming.max_teams` — the team is then `locked` and `member_user_ids` copied from it. Plus a query the unique index cannot express: **no member of the team may already be on another roster for this challenge** — `{ challenge_id, 'participant.id' }` is unique on the *team*, so without it Points pays an overlapping member twice. The lock is `POST /internal/teams/:id/lock` on Registration Service (their collection, so it crosses by HTTP) and is best-effort: `member_user_ids` is already snapshotted, so a failed lock costs a movable roster, not a wrong payout | `ChallengeAccepted` |
| accepted → under_review | `requires_proof`; ≥ 1 proof; `now <= deadline_at`; challenge not `archived`; caller ∈ `member_user_ids` | `ChallengeSubmitted` |
| accepted → approved | `auto_approve` (the submit writes the verdict and the reward in the same update) | `ChallengeSubmitted` + `ChallengeCompleted` |
| under_review → approved | reviewer ∈ `challenge.reviewers` or Core+, **and not a member of the participation** (D16) | `ChallengeCompleted` |
| under_review → rejected | same | `ChallengeRejected` |
| rejected → under_review | user resubmits; `now <= deadline_at`; `submission.version += 1` | `ChallengeSubmitted` |
| accepted → approved | `requires_proof == false`; reviewer/Core+ marks complete (physical challenges verified in person) | `ChallengeCompleted` |
| accepted → expired | scheduler at `deadline_at` | `ChallengeExpired` |
| accepted → withdrawn | Core+ only | — |

> **`status == 'complete'` was the original guard here and it could never be satisfied.** Nothing
> in the Registration Service ever assigns that state — a team goes `forming` → `locked` (core+
> only) → `disbanded` — so requiring it made the ordinary path (captain creates a team, members
> join, captain accepts) a permanent `409`. The real guard is the size check against
> `challenges.teaming`, which acceptance already performs, and acceptance locks the roster itself.
> `complete` remains in `TEAM_STATUS` unused; drop it from the enum when Registration next changes.

Spec §5.7 (via UI): submission is replaceable while `under_review` (same transition, `version += 1`); **not** retractable by the user. User self-withdrawal is not offered; if Core wants it later it is a flag on the challenge, not a schema change.

### 3.2 Reward on approve (single place)

```
1. CAS status → approved (the loser of a double-click matches nothing), review filled,
   reward = { points_awarded: challenge_snapshot.award_points, point_transaction_ids: [], ... }
2. challenges.counts.approved $inc
3. publish ChallengeCompleted { participation_id, challenge_id, participant, member_user_ids, award_points }
4. if challenge.grants_hall_of_fame → publish ChallengeLegendAchieved (Hall of Fame creates the entry, Week 4)
5. later, on read: reward.point_transaction_ids filled from the ledger (below)
```

**Step 3 is an event, not a call.** The Points Service has consumed `ChallengeCompleted` since
Sep 19 (`points-service/src/events/consumers.ts:231`) and writes one `earn` row per member keyed
`challenge.completed:<participation_id>:<uid>` (`Points.ts:212`). A synchronous call would buy
nothing but a failure mode; the Challenge Service makes no outbound call to Points at all.

`award_points` comes from `challenge_snapshot`, never from today's `challenges` row — the value at
acceptance (§4 snapshot policy). It must be non-zero: the seeded `challenge.completed` rule has
`default_amount: 0` (`Points.ts:195`) and the payload is the only override, so a zero or a missing
field pays nobody and logs nothing.

Idempotent on both sides: the compare-and-swap in step 1 means a second approve publishes nothing,
and the idempotency key means a replayed event writes nothing.

**`reward.point_transaction_ids[]` is filled by READING `point_transactions`**, not by consuming
`PointsEarned`. `record()` returns early on a replay and publishes nothing
(`points-service/src/points/ledger.ts:114-115`), and `PointsEarned.reference.id` is the *challenge*,
not the participation (`ledger.ts:96`) — so a dropped or replayed message would leave the array
permanently short, with nothing to notice it. The read is
`PointTransaction.find({ idempotency_key: { $in: member_user_ids.map(u => idempotencyKey.challengeCompleted(pid, u)) } })`:
one indexed lookup on a unique index, run when a participation is served and the array is shorter
than the roster, persisted with `$addToSet`. It converges whatever the bus did.

### 3.3 Indexes

| Index | Serves |
|---|---|
| `{ challenge_id: 1, 'participant.id': 1 }` unique | one participation per user/team per challenge |
| `{ member_user_ids: 1, status: 1, accepted_at: -1 }` | "my challenges" tabs (active / completed), profile History |
| `{ challenge_id: 1, status: 1, 'submission.submitted_at': 1 }` | reviewer queue |
| `{ status: 1, deadline_at: 1 }` partial (`status == 'accepted'`) | expiry scheduler |
| `{ 'review.reviewer_user_id': 1, 'review.reviewed_at': -1 }` | reviewer audit |

## 4. Domain events

```
ChallengeCreated          { challenge_id, title, domain, difficulty, created_by }
ChallengeUpdated          { challenge_id, changed_fields[], updated_by }
ChallengeAccepted         { participation_id, challenge_id, participant, member_user_ids[] }
ChallengeSubmitted        { participation_id, challenge_id, version }
ChallengeCompleted        { participation_id, challenge_id, participant, member_user_ids[], award_points }
                          // Spec §8.2 → Points. The consumer destructures only the last three
                          // (points consumers.ts:189-195); `participant` is carried because
                          // be2-points-service-plan.md §5.5 specifies it. A superset satisfies both.
ChallengeRejected         { participation_id, challenge_id, reason }
ChallengeExpired          { participation_id, challenge_id }
ChallengeLegendAchieved   { participation_id, challenge_id, member_user_ids[] }                 // → Hall of Fame
```

Consumed: `UserProfileUpdated { user_id, changed_fields }` (refresh the solo participant snapshot when
`full_name` or `avatar_url` moved) and `UserDeleted` (anonymize it; the rows stay, because an approved
participation is what a paid ledger row references). **Not** `PointsEarned` — see §3.2. Team size validation for challenge teams is done by Registration Service at write time using `challenges.teaming`, so no team events need consuming here.

## 5. Read patterns

| Screen | Query |
|---|---|
| Challenge browser + filters | `challenges.find({ status: 'active', domain?, difficulty? }).sort({ created_at: -1 })` |
| Challenge detail (+ my state) | `challenges.findOne({ slug })` + `participations.findOne({ challenge_id, member_user_ids: me })` |
| My challenges: active / completed tabs | `participations.find({ member_user_ids: me, status: { $in: [...] } })` |
| Reviewer queue (admin) | `participations.find({ challenge_id, status: 'under_review' }).sort({ 'submission.submitted_at': 1, _id: 1 })` — ascending, oldest submission first, keyset-paginated on the same key |
| Public teams for a teammable challenge | `teams.find({ 'owner.type': 'challenge', 'owner.id', join_policy: 'open', status: 'forming' })` (team-model.md) |

## 6. Deferred

- Image/video proofs — `proof_types` accepts them; enabled per challenge once Media Service (Week 4) exists. Until then `['url','text']`.
- Friend-to-friend challenge invitations (Spec §5.4 Tab 4) — Friends out of MVP.
- Hall of Fame entry creation — Week 4 BE-1; we only emit the event.
