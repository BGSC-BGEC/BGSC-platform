# Leaderboard Model

**Owner service:** Leaderboard Service (plan Week 3 BE-1 builds the service; this doc defines its data). Config lives on `events` (Event Service); entries live here.
**Collections:** `leaderboard_entries`, `leaderboard_snapshots`; Redis sorted sets as the global board's read cache.
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
    avatar_url: string | null,          // snapshot
    deleted: boolean                    // raised by UserDeleted, lowered by UserRestored (relationships.md §4)
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
- entries exist only for confirmed registrations / locked teams, and only while the event is `upcoming`/`ongoing`; on `RegistrationCancelled` / `TeamDisbanded` an entry is **deleted only if the event is still `upcoming`/`draft` AND `invested_points == 0`**, otherwise marked `stats.eliminated`. An entry with investment is never deleted: the cancel-refund sweep finds spends only through entry ids (Sep 26).

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
4. Snapshot (§7).
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
          amount ≥ 10 (body schema); entry.invested_points + amount ≤ investment_cap
   then the request goes on the entry as pending (once per request_id; a retry of one in flight is 409),
   and only then the rate limit 5/user/event/hour (Redis) — a retry spends no quota
2. POST points:/internal/points/spend { user_id, amount, reference { type: 'leaderboard_entry', id }, request_id }
   idempotency_key 'leaderboard.investment:<request_id>'   → callInternal; refusal ⇒ abort, nothing written;
   unknown outcome ⇒ one retry with the same request_id; a refusal of that retry is still unknown (the first
   may have landed), so the request stays pending and the settle sweep refunds it on Points' final answer; 503
   (Points answers a retry from its idempotency key before re-checking the event or the rule)
3. in the event's recompute queue: board still open? then
   entries.findOneAndUpdate({ _id, not eliminated, pending as 'apply', invested_points <= cap - amount }, { $inc: { invested_points: amount } })
   → closed ⇒ refund, 400 leaderboard_frozen; 0 matched ⇒ POST /internal/points/refund { user_id, reference, request_id }
     (exactly that spend, once), then 409/400. The final recompute therefore either counts an investment or refuses it.
4. recompute final_score + ranks for the event; snapshot
5. emit LeaderboardInvestmentMade { event_id, user_id, amount, new_rank }
```

**No fallback writes (Sep 26).** This service never writes `users` or `point_transactions`; the old fallback did on any network error, and debited twice whenever the points call had in fact landed. A 401/403 from Points (our token) is a 503, not a 401 the client reads as "logged out".

A refund Points answers `user_not_found` for is dropped only once the account is past its restore window (`deletion.restorable_until`, else `deleted_at` + `ACCOUNT_DELETION_GRACE_DAYS`); until then it stays pending and is paid if the account comes back.

Investments are non-refundable (Spec) **except** on event cancel: `EventCancelled` ⇒ Points Service refunds every `leaderboard.investment` spend whose `reference.id` is one of this event's entries (see points-model.md §4).

Projection endpoint (`GET .../project?amount=`) is read-only math on the cached list; advisory.

## 7. Threshold & freezing

- `rank == null` for all entries while `count(entries not eliminated) < events.leaderboard.min_participants` — an eliminated entry is kept for refunds, not counted as a participant. UI shows lock state (Spec §5.6). Ties in rank order break on `participant.display_name`, then `_id`.
- If participants drop below threshold mid-event (cancellations), ranks keep the **last computed** values and `leaderboard_snapshots` gets a `frozen: true` marker; investment disabled until count recovers.
- On `EventCompleted`: final recompute, snapshot with `reason: 'final', frozen: true`, no further writes accepted, and `LeaderboardFrozen { reason: 'final', podium }` for Points (§9).
- On `EventCancelled`: a `reason: 'freeze', frozen: true` snapshot — **entries are kept** (Sep 26). Deleting them raced the Points Service's refund sweep on the same message, and a lost race lost every investment refund.

`leaderboard_snapshots` (small, for history/Δ/audit):

```ts
{ _id, event_id, taken_at, reason: 'score_update' | 'investment' | 'final' | 'freeze',
  frozen: boolean, ranks: { participant_id: string, rank: number, final_score: number }[] }
```
Keep last 20 per event (capped by a cleanup job). `previous_rank` on entries = rank in the previous snapshot.

## 8. Redis read cache (Spec §2.3)

| Key | Type | Content |
|---|---|---|
| `lb:global:{period}:{domain}:{source}` | ZSET | member = user_id, score = Σ `earn` amounts in period; `period ∈ all|semester|month|week`, `domain ∈ all|sports|esports|fitness|dev|general` (the union of `events.domain` and `challenges.domain`) |

Event boards are read from Mongo (`rank` is materialized); there is no event ZSET. Global ZSETs rebuilt from `point_transactions` — points earned net of reversals (`earn` rows plus negative `adjust` rows whose reason is not `admin.manual` — reversals; a cancelled event's reversed credit no longer stays on the board) → `$group user_id` — and evicted (5s debounce) on `PointsEarned`/`PointsAdjusted`. A rebuild whose aggregate started before an eviction is not written back (a per-process eviction counter), so a stale board cannot sit out the 10-minute TTL. Mongo is truth; Redis loss ⇒ rebuild.

Global filters ("by event, category, time period"): event ⇒ the event board; domain/period ⇒ the matching global ZSET. Domain of a point transaction = `domain` of its referenced event/challenge, resolved at rebuild time from a `{ id → domain }` map fetched once per run. ponytail: contingency "global only, no filters" = build only `lb:global:all:all`.

## 9. Domain events

```
LeaderboardUpdated            { event_id, reason, changed_participant_ids[] }
LeaderboardInvestmentMade     { event_id, user_id, amount, previous_rank, new_rank }
LeaderboardFrozen             { event_id, reason: 'below_threshold' | 'final', podium? }
                              // podium (final only): [{ place, participant: { type, id }, user_ids[] }]
                              // team → its members' ids; empty below threshold. Points pays event.podium.<place> off it.
HallOfFameEntryCreated        { entry_id, slug, category, honoree: { type, id }, source: { type, id }, participation_id }
                              // Challenge Service records reward.hall_of_fame_entry_id from it
```

Consumed: `RegistrationCreated` (create user entry, solo events — the one "now confirmed" event, including promotions), `RegistrationCancelled` (withdraw: delete pre-start with nothing invested, else eliminate), `TeamLocked` (create team entry from the `teams` doc, teamed events), `TeamDisbanded` (withdraw), `EventCompleted` (final freeze + podium), `EventCancelled` (freeze, keep entries; Points refunds), `UserProfileUpdated` (gated on `full_name`/`avatar_url`) / `UserDeleted` (`anonymizedSnapshot`) / `UserRestored` (re-snapshot, `deleted: false`) on entries and Hall of Fame honorees/members, `ChallengeLegendAchieved` (create the Hall of Fame entry; unique `{ category, honoree.id, source.id }` makes it once across instances), `PointsEarned` / `PointsAdjusted` (debounced 5s eviction of the global ZSETs).

**Replay sweeps** (the bus has no outbox; every 5 min): finals of events completed in the last 7 days are finalized if `EventCompleted` was missed, and `LeaderboardFrozen{final}` is re-announced only while Points holds no `event.podium:<event>:<user>` row for some payable podium user; confirmed solo registrations and locked teams of live boards with no entry (or only an entry eliminated under an older registration) go through the `RegistrationCreated` / `TeamLocked` consumers; cancelled events of the last 7 days whose board is still open are frozen.

**Never written here:** `challenge_participations` (the HoF link goes out as `HallOfFameEntryCreated`), `users`, `point_transactions`.

## 10. Read patterns

| Screen | Source |
|---|---|
| Leaderboards page card list (top-3 preview + my rank) | `events.find({ type: { $ne: 'DE' }, status: { $in: ['ongoing','past'] } })` + `find({ event_id, rank: { $in: [1,2,3] } })` + my entry's `rank` |
| Standings tab | `find({ event_id }).sort({ rank: 1, 'participant.display_name': 1, _id: 1 })` paginated |
| Score breakdown accordion | entry `raw` + `events.scoring.parameters` |
| Global tab | `ZREVRANGE lb:global:{period}:{domain} 0 99 WITHSCORES` + user snapshots from User Service |
| Profile "my results" | `find({ 'participant.id': me })` |

## 11. Deferred

- Bracket-derived standings (`round_reached`, match results feeding `stats`) — Week 4 bracket engine writes `stats`; fields reserved.
- Sponsor leaderboard — out of MVP.
- Team-vs-user mixed leaderboards — an event is either all-user or all-team entries.
