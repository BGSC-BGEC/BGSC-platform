# Points Model

**Owner service:** Points Service
**Collections:** `point_transactions` (ledger), `point_rules` (config). Denormalized `points_balance` on the User doc is written **only** by Points Service.
**Spec refs:** §4.1 PointTransaction, §5.7 Points System, §5.6 Points Investment, §5.15.3 Point Award Toggles, §8.1 Points events, §8.2 consumers table, §7.3 audit for "point modifications"
**MVP plan refs:** Week 3 BE-2 "Points System Service" (rules engine, transaction history, earning opportunities, manual adjustment, breakdown by source, balance calc, validity/expiry)

---

## 1. Purpose

Append-only ledger. Every change to a user's points is one immutable transaction document. Balance is `sum(amount)` of the ledger; we cache it on the user doc for reads but the ledger is truth.

Design rule: **no doc in `point_transactions` is ever updated or deleted.** Corrections are new rows (`type: 'adjust'` or `'refund'`). This is what makes the Spec §7.3 audit requirement free.

## 2. `point_transactions`

```ts
{
  _id: string,
  user_id: string,

  amount: number,                       // signed integer. + credit, − debit. Never 0.
  type: 'earn' | 'spend' | 'refund' | 'adjust' | 'expire',
  source: 'event' | 'challenge' | 'leaderboard' | 'store' | 'engagement' | 'sponsor' | 'admin',
  reason: string,                       // machine key, e.g. 'event.participation', 'event.podium.1',
                                        // 'challenge.completed', 'leaderboard.investment', 'admin.manual'

  reference: {                          // what caused it
    type: 'event' | 'challenge' | 'registration' | 'leaderboard_entry' | 'store_order' | 'transaction' | null,
    id: string | null
  },

  idempotency_key: string,              // unique. e.g. `event.participation:${registration_id}`
  balance_after: number,                // running balance, written at insert time

  actor: { type: 'system' | 'admin' | 'user', user_id: string | null },
  note: string | null,                  // admin free text on manual adjustments

  expires_at: Date | null,              // plan: "points validity/expiry"; only on positive rows; null = never

  created_at: Date
}
```

### 2.1 Field notes

| Field | Notes |
|---|---|
| `amount` signed | One arithmetic rule: `balance = Σ amount`. No `CASE WHEN type`. `spend`/`expire` rows are negative; `earn`/`refund` positive; `adjust` either. |
| `idempotency_key` | Unique index. Points Service will consume the same domain event twice (retries, replay). Second insert fails on the index ⇒ ignore. This is the whole dedupe story. |
| `balance_after` | Lets transaction history show a running balance without re-summing, and makes ledger-vs-cache drift detectable (`last tx.balance_after == user.points_balance`). |
| `reason` | Drives the "Points breakdown by source" UI grouping and maps to a `point_rules` entry. |
| `reference` | Deep link from history row to the thing (event page, challenge page). |
| `expires_at` | Only on positive rows. Expiry job inserts a negative `type: 'expire'` row with `reference: { type: 'transaction', id: <credit _id> }`; the credit row itself is **not** touched (ledger stays immutable). "Already expired" = an `expire` row referencing it exists. MVP: rules default to `null` = no expiry; the field exists so enabling it later is a config change, not a migration. |

### 2.2 Write path (single atomic unit)

```
0. read users(user_id).points_balance  → old
1. new = old + amount
2. if amount < 0 and new balance < 0  → reject (insufficient)
3. insert point_transactions row      → fails if idempotency_key exists → return existing
4. users.updateOne({ _id, points_balance: old }, { $set: { points_balance: new } })
   → if 0 matched: concurrent write; retry from 1 (optimistic, max 3)
5. emit PointsEarned | PointsSpent | PointsRefunded
```

Steps 3–4 inside a Mongo transaction where available. ponytail: optimistic retry on the user doc instead of a per-user lock; fine at campus scale. If the DB has no multi-doc transactions, step 4 failing after step 3 is repaired by the reconcile job (§5).

### 2.3 Indexes

| Index | Serves |
|---|---|
| `{ idempotency_key: 1 }` unique | dedupe |
| `{ user_id: 1, created_at: -1 }` | transaction history (paginated) |
| `{ user_id: 1, source: 1 }` | breakdown by source |
| `{ 'reference.type': 1, 'reference.id': 1 }` | "all points for event X" (admin, refunds on cancel) |
| `{ expires_at: 1 }` partial (`expires_at != null`) | expiry job (candidate credits; job skips those with an `expire` row via the `reference` index) |

## 3. `point_rules` — the rules engine config

Plan: "Points allocation rules engine". Keep it a table of `(reason → amount)` with optional per-event overrides coming from `events.points_pool`. No DSL.

```ts
{
  _id: string,                          // == reason key, e.g. 'event.participation'
  label: string,                        // "Event participation"
  source: PointsSource,
  default_amount: number,               // used when the trigger has no override
  overridable_by: 'event' | 'challenge' | null,   // events.points_pool / challenges.award_points wins
  enabled: boolean,
  expires_after_days: number | null,
  updated_by: string,
  updated_at: Date
}
```

Seed rows for MVP:

| `_id` | default | overridable_by |
|---|---|---|
| `event.participation` | 10 | event (`points_pool.participation`) |
| `event.podium.1` / `.2` / `.3` | 30 / 20 / 15 | event (`points_pool.participation × points_pool.podium_multipliers[place-1]`) |
| `challenge.completed` | — | challenge (`award_points`, always set) |
| `leaderboard.investment` | negative, user-chosen | — (bounded by `points_pool.investment_cap`) |
| `engagement.profile_completed` | 5 | — |
| `admin.manual` | — | — (amount from admin input) |

Resolution order: trigger override → rule `default_amount`. If rule `enabled == false`, no transaction.

## 4. Triggers (what Points Service consumes — Spec §8.2)

| Consumed event | Rule | Idempotency key | Type |
|---|---|---|---|
| `RegistrationCreated` (confirmed) | `event.participation` | `event.participation:${registration_id}` | earn |
| `RegistrationCancelled` | reverse the participation credit if one exists | `event.participation.reversal:${registration_id}` | adjust (negative) |
| `EventCompleted { winners[] }` | `event.podium.N` per winner; team winner ⇒ one row per `teams.members[].user_id` | `event.podium:${event_id}:${user_id}` | earn |
| `EventCancelled` | (a) reverse every `event.participation` earn for the event; (b) refund every `leaderboard.investment` spend whose entry belongs to the event | (a) `event.cancel.reversal:${original_tx_id}` (b) `event.cancel.refund:${original_tx_id}` | (a) adjust (b) refund |
| `ChallengeCompleted` (approved) | `challenge.completed`, one row per `member_user_ids[]`, amount from payload | `challenge.completed:${participation_id}:${user_id}` | earn |
| Leaderboard Service internal call `POST /internal/points/spend` | `leaderboard.investment` | `leaderboard.investment:${request_id}` (Leaderboard generates `request_id`) | spend |
| Admin `POST /points/adjust` | `admin.manual` | `admin:${request_uuid}` | adjust |

Type semantics: `earn` and `refund` are always positive, `spend` and `expire` always negative, `adjust` either. Reversal of a credit is a negative `adjust`, not a `refund` (refund = a spend given back). Spec §4.1 lists only `earn|spend|refund`; `adjust` and `expire` are additions.

## 5. Balance cache & reconciliation

- `users.points_balance` (User Service schema, BE-1) is written only by Points Service via an internal endpoint or direct write to the shared DB (decide with BE-1 today).
- Nightly job: for users with activity in last 24h, `Σ amount` vs `points_balance`; mismatch ⇒ log + fix cache + alert. Ledger wins.
- Read of balance never touches the ledger.

## 6. Domain events emitted (Spec §8.1)

```
PointsEarned    { transaction_id, user_id, amount, source, reason, reference, balance_after }
PointsSpent     { transaction_id, user_id, amount, source, reason, reference, balance_after }
PointsRefunded  { transaction_id, user_id, amount, source, reason, reference, reason_text, balance_after }
PointsAdjusted  { transaction_id, user_id, amount, reason, actor_user_id, note, balance_after }   // audit consumer
PointsExpired   { transaction_id, user_id, amount, credit_transaction_id, balance_after }
```

## 7. Read patterns

| Screen | Query |
|---|---|
| Profile / Points page balance | `users.points_balance` — no ledger read |
| Transaction history | `find({ user_id }).sort({ created_at: -1 }).limit(20)` cursor on `created_at` |
| Breakdown by source | `aggregate([{ $match: { user_id } }, { $group: { _id: '$source', total: { $sum: '$amount' } } }])` — cache 60s |
| Admin: points for an event | `find({ 'reference.type': 'event', 'reference.id': eventId })` |
| Earning opportunities | derived: `point_rules.find({ enabled: true, source: { $in: ['event','challenge','engagement'] } })` joined client-side with open events/challenges |

## 8. Deferred

- Store spend/refund flow — store out of MVP; `source: 'store'` reserved.
- Sponsor bonus — reserved `source: 'sponsor'`, rule not seeded.
- Expiry job — schema ready; not scheduled in MVP.
