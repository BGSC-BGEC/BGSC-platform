# Bracket Model

**Owner service:** Bracket Service, :3012 (plan Week 4 Sunday, BE-2)
**Collections:** `brackets`, `matches`
**Spec refs:** §4.1 `Match`, §5.5 Spectator Bracket View (round robin grids, single/double elimination, bypass rounds), §5.15.2 Visual Bracket Generator, §5.6 leaderboard formats
**MVP plan refs:** Week 4 Sunday BE-2 — tournament bracket data structure, bracket generation for events, match/game results update.
**Service plan:** `docs/be2-feedback-bracket-plan.md`

---

## 1. Purpose

A **bracket** is a plan: who is in it, seeded how, over how many rounds. A **match** is a fixture:
two participants, a score, a winner, and where that winner goes next. Keeping them apart is what
makes "redo the draw" one delete and "report a score" one update.

The format is not this service's to choose. `events.leaderboard.format` already carries it
(`Event.ts`), set when an organiser configured the event, and the generator reads it — a draw that
could disagree with its own event would be a second source of truth for the same fact.

**`events.bracket` stays null.** That reserved `Mixed` slot lives on a document the Event Service
owns (`relationships.md §1`); `brackets.event_id` is the same link from the side that owns it, so
nothing here writes into another service's collection (plan D3).

---

## 2. `brackets`

```jsonc
{
  _id: uuid,
  event_id: string,                    // unique — one bracket per event
  format: 'round_robin' | 'single_elim',
  participant_type: 'user' | 'team',   // from events.teaming.is_teamed
  seeding: 'registration' | 'random' | 'manual',
  participants: [{ seed, id, display_name, avatar_url }],   // frozen at generation
  rounds: number,
  status: 'draft' | 'active' | 'completed',
  generated_by: string,
  created_at, updated_at
}
```

| Field | Why |
|---|---|
| `participants` | A snapshot, like every other in this repo: a draw is the record of who was in it, not a live view of who still is. A team that disbands after the draw still played its fixtures |
| `seeding` | `registration` is the default and the only deterministic one — arrival order, explicable to a participant. `manual` must list the field exactly once; anything else is refused |
| `event_id` unique | One bracket per event, enforced by the index rather than by a read-then-write, so a double-clicked Generate is a 409 and not two draws |
| `format` | Only the two that are generated today. `double_elim` and `elim_after_n` are on the event model and not here (plan D4) |

**Invariants:** at least two participants; ids unique; seeds exactly `1..n` with no gaps.

---

## 3. `matches`

```jsonc
{
  _id: uuid,
  event_id, bracket_id,
  round: number,                       // 1-based
  slot: number,                        // position within the round
  bracket_side: 'main' | 'upper' | 'lower',
  a: { seed, id, display_name } | null,
  b: { seed, id, display_name } | null,
  score_a: number | null,
  score_b: number | null,
  winner: 'a' | 'b' | 'draw' | null,
  status: 'scheduled' | 'ongoing' | 'completed' | 'bye' | 'cancelled',
  scheduled_at: Date | null,
  venue: string | null,
  advances_to: { match_id, slot: 'a' | 'b' } | null,
  reported_by: string | null,
  created_at, updated_at
}
```

### 3.1 Why a bye is a row

A bracket of six pads to eight, and the two spare pairings are **`bye` rows with one participant**,
completed the moment they are created — not silent promotions. Spec §5.5 names "bypass rounds" as
something the spectator view renders, so they have to exist to be drawn; and the participant who
gets one is advanced by exactly the same code path as a played result.

It follows that **"has this draw been played?" is `reported_by`, not `status`** — byes are completed
at generation, so a regeneration guard keyed on status would make any bracket with a bye
unregenerable from the moment it was drawn.

### 3.2 Invariants

- `score_a` and `score_b` are both null or both set.
- `winner` is set **exactly when** the status is `completed` or `bye`, and names a side that exists.
- a `bye` has exactly one participant and no score; a `completed` match has two.
- nobody plays themselves.
- `advances_to` only ever points from round *r* into round *r+1*, so the tree cannot cycle.

### 3.3 Indexes

| Index | Serves |
|---|---|
| `{ bracket_id, round, slot }` unique | the draw's shape; a re-run of the generator collides rather than drawing twice |
| `{ event_id, round, slot }` | the spectator view, in bracket order |
| `{ event_id, status }` | "what is still to play", and the bracket-completion check |

---

## 4. Generation

Participants come from the event, never from the request:

- **teamed** → `teams` with `owner: { type: 'event', id }` and `status: 'locked'`. Spec §5.5's
  roster lockdown is the moment a team stops changing; seeding one that can still gain a player
  produces a bracket that lies about who is playing.
- **solo** → `form_submissions` with `status: 'confirmed'`, in `submitted_at` order.

**Round robin** is the circle method: fix one participant, rotate the rest, and an odd field gets a
ghost so that everyone sits out exactly one round rather than one player sitting out all of them.
Exactly `n(n-1)/2` fixtures, every pair once.

**Single elimination** pads to the next power of two and seeds by doubling — `[1,2]` → `[1,4,2,3]` →
`[1,8,4,5,2,7,3,6]` — so the top two can only meet in the final. Every round is laid out at
generation, including the rounds nobody can play yet: an empty fixture is how the tree is drawn and
how `advances_to` has somewhere to point.

The arithmetic is a **pure function** (`generate.ts`): participants in, fixtures out, no database.
A round-robin schedule is right or wrong for reasons Mongo has no opinion on.

### 4.1 Two writes, no transaction

Mongo is standalone (`relationships.md §5`). The bracket is inserted **first** — its unique
`event_id` is the claim — then the fixtures; if the fixtures fail, the bracket is deleted, because
one holding an event's key with nothing under it would refuse every retry.

---

## 5. Results

A score completes the fixture, decides the winner, and advances them — each step a compare-and-swap,
so a double-clicked Save produces one result and one advance.

| Rule | Why |
|---|---|
| core admin **of that event**, or coordinator+ | `event.service.ts:280` already gates attendance this way; scoring somebody else's tournament is not a smaller act (plan D14) |
| a draw is refused in single elimination | a knockout has to knock somebody out; round robin keeps draws, which is what its table is for |
| core reports, coordinator corrects | Spec §5.15.2's admin override, and every correction is audited with the previous score |
| a correction is refused once the **next** round has been played | this service cannot un-play a match, so it will not invalidate one |
| the last result completes the bracket | a compare-and-swap from `active`, so `BracketCompleted` is emitted exactly once |

Standings are **derived** on read, never stored (plan D12): points 3-1-0 with goal difference for a
round robin, furthest round reached for elimination. A bye is not a game played. When that stops
being cheap, `leaderboard_entries.stats` already has the fields — and a service that owns them
(plan D8).

---

## 6. Domain events

Emitted:

```
BracketGenerated  { event_id, bracket_id, format, participant_type, participants, rounds }
MatchScheduled    { event_id, match_id, scheduled_at, venue }
MatchCompleted    { event_id, bracket_id, match_id, round, winner_id, loser_id, draw }
BracketCompleted  { event_id, bracket_id, format, participant_type, winner_id, winner_name }
```

Consumed: `UserDeleted { user_id }` — and nothing else. A bracket is drawn when an organiser says
so, not in reaction to an event. The exception is an account being deleted out from under a seed:
the name comes off the draw and off every fixture, while the seed, the id and the results stay
exactly as they were (relationships.md §4.1).

`MatchCompleted` and `BracketCompleted` are the seams for the two services that are not built yet:
Leaderboard (BE-1, Week 3) for `stats`, and Hall of Fame (BE-1, Week 4) for a tournament win.

---

## 7. Deferred, with the ceiling named

| Deferred | Why / upgrade path |
|---|---|
| Double elimination | The cost is entirely loser-bracket routing. `bracket_side: 'main' \| 'upper' \| 'lower'` is on the model already, so it is code and not a migration (plan D9) |
| `elim_after_n` | Not a tree — a standings rule over ad-hoc fixtures. `leaderboard_entries.stats.fails` is where it lands |
| Real-time score feeds (Spec §5.5) | WebSockets. MVP is polling, as the plan's own risk register says |
| Scheduling conflicts (one venue, two fixtures, one hour) | Spec does not ask, and no venue model exists |
| Third-place playoffs, group stages into knockouts | One bracket per event today; a group stage is two brackets and a link between them |
