# Points Model

**Owner service:** Points Service
**Collections:** `point_transactions` (ledger), `point_rules` (config), `point_expiry_cursor` (expiry sweep position). Denormalized `points_balance` on the User doc is written **only** by Points Service.
**Spec refs:** §4.1 PointTransaction, §5.7 Points System, §5.6 Points Investment, §5.15.3 Point Award Toggles, §8.1 Points events, §8.2 consumers table, §7.3 audit for "point modifications"
**MVP plan refs:** Week 3 BE-2 "Points System Service" (rules engine, transaction history, earning opportunities, manual adjustment, breakdown by source, balance calc, validity/expiry)

---

## 1. Purpose

Append-only ledger. Every change to a user's points is one immutable transaction document. Balance is `sum(amount)` of the ledger; we cache it on the user doc for reads but the ledger is truth.

Design rule: **no doc in `point_transactions` is ever updated or deleted.** Corrections are new rows (`type: 'adjust'` or `'refund'`). This is what makes the Spec §7.3 audit requirement free. Enforced in the model (Sep 26): besides the query hooks, `pre('save')` refuses any non-new document and `pre('bulkWrite')` refuses outright — a loaded row re-saved, or a bulkWrite, used to rewrite the ledger unchecked.

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
| `balance_after` | Lets transaction history show a running balance without re-summing. Not used for drift detection: `created_at` is millisecond-resolution and `_id` is a uuid, so "the newest row" is ambiguous among same-millisecond writes — drift is `Σ amount` vs the cache, which the summary aggregate already computes. |
| `reason` | Drives the "Points breakdown by source" UI grouping and maps to a `point_rules` entry. |
| `reference` | Deep link from history row to the thing (event page, challenge page). |
| `expires_at` | Only on positive rows. Expiry job inserts a negative `type: 'expire'` row with `reference: { type: 'transaction', id: <credit _id> }`; the credit row itself is **not** touched (ledger stays immutable). "Already expired" = an `expire` row referencing it exists. MVP: rules default to `null` = no expiry; the field exists so enabling it later is a config change, not a migration. |

### 2.2 Write path (single atomic unit)

**Revised Sep 19, 2026 when the service was built** — cache first, row second, compensate on
failure. Implemented in `apps/points-service/src/points/ledger.ts`.

```
1. read point_transactions by idempotency_key → exists? return it, write nothing
2. users.findOneAndUpdate({ _id, deleted_at: null, points_balance: { $gte: -amount } if debit },
                          { $inc: { points_balance: amount } }, { returnDocument: 'after' })
   → no match: 409 insufficient_points if the user exists, else 404 user_not_found
3. insert point_transactions row with balance_after = the balance the $inc produced
   → throws? $inc the balance back. Duplicate key ⇒ a racing caller won; return their row
4. emit PointsEarned | PointsSpent | PointsRefunded | PointsAdjusted | PointsExpired
```

The original order (insert, then compare-and-swap the balance, retry on a lost swap) cannot be
repaired: this collection refuses updates and deletes by hook, so a row written before a lost swap
keeps a wrong `balance_after` forever, and a retry re-enters on the same `idempotency_key`. The
order above has one failure window, step 3, and the *cache* is not immutable — so `$inc: -amount`
undoes it. It is also one round trip with no retry loop, and the solvency check moves inside the
filter, where concurrency cannot step around it (proved by a ten-way concurrent-spend selfcheck).

### 2.3 Indexes

| Index | Serves |
|---|---|
| `{ idempotency_key: 1 }` unique | dedupe |
| `{ user_id: 1, created_at: -1, _id: -1 }` | transaction history (paginated). `_id` is in the index because it is in the sort — the keyset tiebreak — and without it Mongo adds a SORT stage that reads every row the user has to return one page (measured 500 vs 20 examined). The two-key prefix still serves `user_id`-only reads |
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
| `ParticipantAttended` | `event.participation` | `event.participation:${registration_id}` | earn |
| `RegistrationCancelled`, `ParticipantAttendanceRevoked` | reverse the participation credit if one exists (same key for both, so they and an event cancel reverse once) | `event.participation.reversal:${credit_tx_id}` | adjust (negative) |
| `LeaderboardFrozen { reason: 'final', podium: [{ place, participant, user_ids[] }] }` (Sep 26) | `event.podium.N` per user in `user_ids` (team → its members); same function as `POST /points/award` | `event.podium:${event_id}:${user_id}` — shared with the admin route, so the two cannot both pay | earn |
| `EventCancelled` | (a) refund every `leaderboard.investment` spend whose entry belongs to the event; (b) reverse every `event.participation` earn for it — **refunds first**, or an investor who spent everything cannot afford the reversal | (a) `leaderboard.investment.refund:${spend_tx_id}` (b) `event.participation.reversal:${original_tx_id}` | (a) refund (b) adjust |
| `ChallengeCompleted` (approved) | `challenge.completed`, one row per `member_user_ids[]`, amount from payload | `challenge.completed:${participation_id}:${user_id}` | earn |
| Leaderboard Service internal call `POST /internal/points/spend` (only while the event is `ongoing`) | `leaderboard.investment` | `leaderboard.investment:${request_id}` (Leaderboard generates `request_id`) | spend |
| Leaderboard Service internal call `POST /internal/points/refund { user_id, reference, request_id }` (compensation) | gives back exactly the spend `leaderboard.investment:${request_id}` (same user, same entry; `amount` optional and only cross-checked); none → `404 spend_not_found` | `leaderboard.investment.refund:${spend_tx_id}` | refund |
| Admin `POST /points/adjust` | `admin.manual` | `admin:${request_uuid}` | adjust |

**One spend, at most one refund (Sep 26).** The compensation and the cancel sweep used two keys (`…refund:${request_id}` and `event.cancel.refund:${tx_id}`), so a spend both paths wanted back was paid back twice. Both now key on the **spend row's `_id`** (`idempotencyKey.investmentRefund`), and the unique index refuses the second. The Leaderboard Service has no fallback that writes `users` or `point_transactions`: a refusal is passed through, an unknown outcome is retried once with the same `request_id`, then 503 (and a debit whose outcome is unknown is compensated by a refund, which 404s harmlessly if nothing was taken).

Type semantics: `earn` and `refund` are always positive, `spend` and `expire` always negative, `adjust` either. Reversal of a credit is a negative `adjust`, not a `refund` (refund = a spend given back). Spec §4.1 lists only `earn|spend|refund`; `adjust` and `expire` are additions.

## 5. Balance cache & reconciliation

- `users.points_balance` (User Service schema, BE-1) is written only by Points Service, **by direct `$inc`** — settled Sep 19, 2026.
- **No nightly job**: `Σ amount` vs `points_balance` is one aggregate, reported as `ledger_synced` on the admin read at no extra cost, and repaired on demand by `POST /points/users/:id/recalculate` (compare-and-swapped, audited). Ledger wins. Build the sweep when something has actually drifted.
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
- Expiry job — **built** (60s sweep, `apps/points-service/src/scheduler/expiry.ts`), but inert: every seeded rule has `expires_after_days: null`, so enabling expiry is a rule edit, not a deployment. It walks due credits in `(expires_at, _id)` order from a cursor in `point_expiry_cursor` (one doc, `_id: 'expiry'`, `{ expires_at, tx_id }`), so each credit is decided exactly once, at its expiry — before the cursor, the sweep re-read the same first batch forever and never reached anything behind it.
