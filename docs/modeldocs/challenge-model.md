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
- `difficulty == 'legend'` ⇒ `grants_hall_of_fame` defaults true (admin may override)
- `teaming.enabled == false` ⇒ `team_size_*`, `max_teams` null
- `kind == 'physical'` ⇒ `location != null`
- `window.opens_at < window.closes_at <= window.submissions_close_at` for whichever are set
- `teaming.enabled == true` ⇒ `1 <= team_size_min <= team_size_max`
- `submission.requires_proof == false` ⇒ `proof_types == []`
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

`accepted` is also the "in progress" state; `progress` is edited while `accepted`. No separate start step (ponytail: add `started_at` + explicit start only if a challenge needs the timer to begin later than acceptance).

| Transition | Guard | Emits |
|---|---|---|
| create (`accepted`) | challenge `active`; now in `[window.opens_at, window.closes_at]`; unique index passes; solo: `counts.accepted < max_participants`; team: caller is captain of a `teams` doc with `owner = { challenge, id }`, `status == 'complete'`, `size_min <= members <= size_max`, and team count `< teaming.max_teams` — the team is then `locked` and `member_user_ids` copied from it | `ChallengeAccepted` |
| accepted → submitted | `requires_proof`; ≥ 1 proof; `now <= deadline_at` | `ChallengeSubmitted` |
| submitted → approved | `auto_approve` | `ChallengeCompleted` |
| submitted → under_review | `!auto_approve` | — |
| under_review → approved | reviewer ∈ `challenge.reviewers` or Core+ | `ChallengeCompleted` |
| under_review → rejected | same | `ChallengeRejected` |
| rejected → under_review | user resubmits; `now <= deadline_at`; `submission.version += 1` | `ChallengeSubmitted` |
| accepted → approved | `requires_proof == false`; reviewer/Core+ marks complete (physical challenges verified in person) | `ChallengeCompleted` |
| accepted → expired | scheduler at `deadline_at` | `ChallengeExpired` |
| accepted → withdrawn | Core+ only | — |

Spec §5.7 (via UI): submission is replaceable while `under_review` (same transition, `version += 1`); **not** retractable by the user. User self-withdrawal is not offered; if Core wants it later it is a flag on the challenge, not a schema change.

### 3.2 Reward on approve (single place)

```
1. status → approved, review filled
2. for each uid in member_user_ids:
     Points Service credit  reason 'challenge.completed', amount challenge.award_points,
                            reference { type:'challenge', id }, idempotency 'challenge.completed:<participation_id>:<uid>'
3. reward.point_transaction_ids = results
4. if challenge.grants_hall_of_fame → emit ChallengeLegendAchieved (Hall of Fame Service creates entry, Week 4)
5. challenges.counts.approved $inc
```

Step 2 is idempotent by key, so a retried approve cannot double-pay.

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
ChallengeCompleted        { participation_id, challenge_id, member_user_ids[], award_points }   // Spec §8.2 → Points
ChallengeRejected         { participation_id, challenge_id, reason }
ChallengeExpired          { participation_id, challenge_id }
ChallengeLegendAchieved   { participation_id, challenge_id, member_user_ids[] }                 // → Hall of Fame
```

Consumed: `UserDeleted` (anonymize snapshots). Team size validation for challenge teams is done by Registration Service at write time using `challenges.teaming`, so no team events need consuming here.

## 5. Read patterns

| Screen | Query |
|---|---|
| Challenge browser + filters | `challenges.find({ status: 'active', domain?, difficulty? }).sort({ created_at: -1 })` |
| Challenge detail (+ my state) | `challenges.findOne({ slug })` + `participations.findOne({ challenge_id, member_user_ids: me })` |
| My challenges: active / completed tabs | `participations.find({ member_user_ids: me, status: { $in: [...] } })` |
| Reviewer queue (admin) | `participations.find({ challenge_id, status: 'under_review' }).sort({ 'submission.submitted_at': 1 })` |
| Public teams for a teammable challenge | `teams.find({ 'owner.type': 'challenge', 'owner.id', join_policy: 'open', status: 'forming' })` (team-model.md) |

## 6. Deferred

- Image/video proofs — `proof_types` accepts them; enabled per challenge once Media Service (Week 4) exists. Until then `['url','text']`.
- Friend-to-friend challenge invitations (Spec §5.4 Tab 4) — Friends out of MVP.
- Hall of Fame entry creation — Week 4 BE-1; we only emit the event.
