# Leaderboard Model

**Owner service:** Leaderboard Service (plan Week 3 BE-1 builds the service; this doc defines its data). Config lives on `events` (Event Service); entries live here.
**Collections:** `leaderboard_entries`, `leaderboard_snapshots`; Redis sorted sets as read cache.
**Spec refs:** §5.6 Leaderboards Page (formats, threshold, normalization, investment), §5.15.3 Dynamic Rule Scoring Engine, §5.5 Event Leaderboard, §2.3 "Redis — real-time leaderboards", §8.1
**MVP plan refs:** Week 3 BE-1 "Leaderboard Service" (calc, filters by event/category/period, global + event-specific, rank updates, top performers, caching); contingency "Simplify leaderboard (global only, no filters)"

---

## 1. Two kinds of leaderboard

| Kind | Source of truth | Ranking key |
|---|---|---|
| **Event leaderboard** (LE / DLL / ALL) | `leaderboard_entries` for that event | `final_score` = normalized score + invested points |
| **Global leaderboard** (per period / domain) | `point_transactions` ledger (points-model.md) | `Σ amount` where `type == 'earn'` in period (refunds and manual adjusts do not count) |

Global is a **query + cache**, not a collection. Only the event leaderboard needs its own documents, because it stores per-participant raw scoring parameters that exist nowhere else.

## 2. Config — lives on `events` (see event-model.md §2)

```ts
events.type        // != 'DE' ⇔ event has a leaderboard (events.leaderboard != null)
events.leaderboard = { format, elim_after_n, min_participants }
events.scoring     = { parameters: [{ key, label, kind, weight }], normalization: { lower, upper } }
events.points_pool = { ..., investment_enabled, investment_cap }
events.teaming.is_teamed   // decides participant.type for the whole event
```

Leaderboard Service reads these; never writes them.

**Who gets an entry:** solo events (`is_teamed == false`) ⇒ one entry per confirmed registration, created on `RegistrationCreated`. Teamed events ⇒ one entry per team, created on `TeamLocked`; no user entries. An event never mixes the two.

## 3. `leaderboard_entries` — one per participant (user or team) per event

```ts
{
  _id: string,
  event_id: string,
  participant: {
    type: 'user' | 'team',
    id: string,
    display_name: string,               // snapshot
    avatar_url: string | null           // snapshot
  },
  registration_id: string | null,       // user entries: -> form_submissions._id

  // ---- raw scoring parameters, keys == events.scoring.parameters[].key ----
  raw: Record<string, number | boolean>,      // { goals: 4, assists: 2, mvp: true }
  raw_score: number,                          // Σ weight_i × value_i  (bool → 0/1)
  normalized_score: number,                   // mapped into [lower, upper], see §5
  invested_points: number,                    // Spec §5.6 Points Investment, Σ of accepted investments
  final_score: number,                        // normalized_score + invested_points

  // ---- format-specific ----
  stats: {
    played: number, won: number, lost: number, drawn: number,   // round_robin / points_table
    round_reached: number | null,                                // single/double elim
    fails: number | null,                                        // elim_after_n
    eliminated: boolean
  },

  rank: number | null,                        // materialized after each recompute; null until threshold met
  previous_rank: number | null,               // for Δ column
  last_scored_at: Date | null,
  scored_by: string | null,                   // admin user_id of last score edit

  version: number,                            // optimistic lock
  created_at: Date,
  updated_at: Date
}
```

### 3.1 Why materialize `rank`

Spec §5.6 and the plan want "user position highlight", "scroll to my position", "Δ rank". A `findOne({ event_id, 'participant.id': me })` returning `rank` is one read; otherwise every profile view sorts the whole event. Recompute is O(n log n) per event per score change — trivial at n ≤ a few hundred.

### 3.2 Invariants

- `Object.keys(raw) ⊆ events.scoring.parameters[].key`
- `invested_points >= 0`; `invested_points <= events.points_pool.investment_cap` when cap set
- one entry per `(event_id, participant.id)` — unique index
- `participant.type == 'team' ⇔ events.teaming.is_teamed`; `registration_id != null ⇔ participant.type == 'user'`
- entries exist only for confirmed registrations / locked teams; removed on `RegistrationCancelled` / `TeamDisbanded` before `start_at`; frozen after

### 3.3 Indexes

| Index | Serves |
|---|---|
| `{ event_id: 1, 'participant.id': 1 }` unique | upsert scores, "my rank" |
| `{ event_id: 1, final_score: -1, 'participant.display_name': 1 }` | ranked list, deterministic tiebreak |
| `{ event_id: 1, rank: 1 }` | podium (rank ≤ 3), pagination |
| `{ 'participant.id': 1, event_id: 1 }` | profile "my leaderboard results" |

## 4. Score entry (admin, Web Console only — Spec §5.5 "Operational Boundaries")

`PUT /events/:id/leaderboard/scores` body `[{ participant_id, raw }]`.

1. Validate `raw` against `events.scoring.parameters` (unknown key, wrong kind ⇒ 400).
2. For each: `raw_score = Σ weight × value`.
3. Recompute normalization for the **whole event** (§5), then `final_score`, then ranks. Write all entries with `bulkWrite`.
4. Snapshot (§7) and refresh Redis (§8).
5. Emit `LeaderboardUpdated`.

Idempotent: same payload ⇒ same state.

## 5. Normalization (Spec §5.6 "lower ≥ 0, upper ≤ 1000")

Min-max across current entries of the event:

```
if max_raw == min_raw:  normalized = lower
else:                   normalized = lower + (raw - min_raw) / (max_raw - min_raw) × (upper - lower)
```

Rounded to 2 dp. Recomputed for every entry whenever any raw changes (one participant's score can move everyone's normalized value). ponytail: min-max; swap to z-score or admin-fixed bounds if a sport needs absolute scales — `normalization` object has room for a `mode` field.

## 6. Points investment (Spec §5.6, §5.7)

Flow, all inside Leaderboard Service:

```
1. guard: user is confirmed participant; events.points_pool.investment_enabled; event.status == 'ongoing';
          amount ≥ 10; entry.invested_points + amount ≤ investment_cap; rate limit 5/user/event/hour (Redis)
2. request Points Service debit: reason 'leaderboard.investment', reference { type: 'leaderboard_entry', id },
   idempotency_key 'leaderboard.investment:<request_id>'   → sync call; 4xx ⇒ abort, nothing written
3. entries.findOneAndUpdate({ _id, version }, { $inc: { invested_points: amount, version: 1 } })
   → 0 matched ⇒ retry step 3 (points already debited, must land)
4. recompute final_score + ranks for the event; snapshot; refresh cache
5. emit LeaderboardInvestmentMade { event_id, user_id, amount, new_rank }
```

Investments are non-refundable (Spec) **except** on event cancel: `EventCancelled` ⇒ Points Service refunds every `leaderboard.investment` spend whose `reference.id` is one of this event's entries (see points-model.md §4).

Projection endpoint (`GET .../project?amount=`) is read-only math on the cached list; advisory.

## 7. Threshold & freezing

- `rank == null` for all entries while `count(entries) < events.leaderboard.min_participants`. UI shows lock state (Spec §5.6).
- If participants drop below threshold mid-event (cancellations), ranks keep the **last computed** values and `leaderboard_snapshots` gets a `frozen: true` marker; investment disabled until count recovers.
- On `EventCompleted`: final recompute, snapshot with `reason: 'final', frozen: true`, no further writes accepted.

`leaderboard_snapshots` (small, for history/Δ/audit):

```ts
{ _id, event_id, taken_at, reason: 'score_update' | 'investment' | 'final' | 'freeze',
  frozen: boolean, ranks: { participant_id: string, rank: number, final_score: number }[] }
```
Keep last 20 per event (capped by a cleanup job). `previous_rank` on entries = rank in the previous snapshot.

## 8. Redis read cache (Spec §2.3)

| Key | Type | Content |
|---|---|---|
| `lb:event:{event_id}` | ZSET | member = participant_id, score = `final_score` |
| `lb:event:{event_id}:meta` | HASH | `updated_at`, `frozen`, `count` |
| `lb:global:{period}:{domain}` | ZSET | member = user_id, score = Σ `earn` amounts in period; `period ∈ all|semester|month|week`, `domain ∈ all|sports|esports|fitness|general` (matches `events.domain` / `challenges.domain`) |

Event ZSET rebuilt on every recompute (write-through). Global ZSETs rebuilt by a job every 5 min from `point_transactions` (`$match created_at ≥ period_start, type: 'earn'` → `$group user_id`). Mongo is truth; Redis loss ⇒ rebuild.

Global filters (plan Week 3 BE-1: "by event, category, time period"): event ⇒ event ZSET; domain/period ⇒ the matching global ZSET. Domain of a point transaction = `domain` of its referenced event/challenge, resolved at rebuild time from a `{ id → domain }` map fetched once per run. ponytail: contingency "global only, no filters" = build only `lb:global:all:all`.

## 9. Domain events

```
LeaderboardUpdated            { event_id, reason, changed_participant_ids[] }
LeaderboardInvestmentMade     { event_id, user_id, amount, previous_rank, new_rank }
LeaderboardFrozen             { event_id, reason: 'below_threshold' | 'final' }
```

Consumed: `RegistrationCreated` (create user entry, solo events), `RegistrationCancelled` (remove entry pre-start), `TeamLocked` (create team entry, teamed events), `TeamDisbanded` (remove entry pre-start), `EventCompleted` (final freeze), `EventCancelled` (drop entries; Points handles refunds itself).

## 10. Read patterns

| Screen | Source |
|---|---|
| Leaderboards page card list (top-3 preview + my rank) | `events.find({ type: { $ne: 'DE' }, status: { $in: ['ongoing','past'] } })` + `ZREVRANGE lb:event:{id} 0 2` + `ZREVRANK` for me |
| Standings tab | `find({ event_id }).sort({ rank: 1 })` paginated; or ZSET page + `find({ _id: { $in } })` |
| Score breakdown accordion | entry `raw` + `events.scoring.parameters` |
| Global tab | `ZREVRANGE lb:global:{period}:{domain} 0 99 WITHSCORES` + user snapshots from User Service |
| Profile "my results" | `find({ 'participant.id': me })` |

## 11. Deferred

- Bracket-derived standings (`round_reached`, match results feeding `stats`) — Week 4 bracket engine writes `stats`; fields reserved.
- Sponsor leaderboard — out of MVP.
- Team-vs-user mixed leaderboards — an event is either all-user or all-team entries.
