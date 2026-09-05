# Architecture Mismatches — For The Record

**Date:** 2026-09-05
**Purpose:** Conflicts between the current planning documents. Recorded so decisions are deliberate rather than discovered mid-build.

**Current documents**
- `docs/SystemDesignDocs/BGSC Platform — Complete Feature Specification & Architecture.md` — the vision
- `docs/MVP_Timeline_Plan_Updated.md` — the delivery plan
- `docs/local-dev-guide.md`

Everything under `docs/Legacy/` and `Legacy/` is archived and not referenced here.

---

## 1. Locked decisions absent from the plan

Three things were declared non-negotiable. The delivery plan does not contain them.

### Kafka

Not mentioned anywhere in `MVP_Timeline_Plan_Updated.md`. The tech stack section (`:806-836`) lists no event bus. No hours allocated in any phase.

The spec assumes it throughout — §8 (`…Architecture.md:1577-1694`) defines 40+ event types across 7 domains with a consumer matrix.

**Needs:** hours in the plan, or an explicit "Phase 2" marker on spec §8.

### WebSockets

The plan actively rules them out for MVP:

> `:703-705` — "Auction Real-time: Use polling-based approach for MVP (simpler). Future: Upgrade to WebSockets post-MVP."
> `:834` — "Real-time (if needed): Polling for auction (MVP), WebSockets (future)."

Direct conflict with the locked decision. The spec asks for sub-100ms bid updates (`…Architecture.md:1257`); polling gives ~1s.

**Needs:** either the plan changes, or WebSockets move to Phase 2 and the spec's latency target relaxes for MVP.

### Media

In the plan as one 8-hour backend task in Week 4 (`:458-466`), the last working week before the break. The Week 4 contingency (`:722`) says:

> "If behind by Week 4: Simplify Media page (gallery only, no uploads)"

Cutting uploads removes the feature. This is the item identified as the platform's main draw, scheduled last and first on the chopping block.

**Needs:** move earlier, or protect it in the contingency order.

---

## 2. Database — decision due today

| Source | Says |
|---|---|
| `MVP_Timeline_Plan_Updated.md:88-91` | Relational → NoSQL, "Must complete early (Week 1)" |
| `MVP_Timeline_Plan_Updated.md:117` | "Finalize database choice (MongoDB/Firestore/DynamoDB)" — Week 1 Saturday |
| `MVP_Timeline_Plan_Updated.md:808-810` | "MongoDB or Firestore (NoSQL). Decision by: End of Week 1 Saturday" |
| `docs/local-dev-guide.md:9-11` | PostgreSQL 15 + Redis |
| `…Architecture.md:231` | "PostgreSQL — Relational data integrity, ACID compliance for transactions" |

Week 1 Saturday is today.

Worth weighing before switching: points transactions, event registrations, and auction bids are the three flows where a lost or double-counted write is visible to users. Those are the ACID cases the spec cites. Schema flexibility is a real benefit elsewhere, but it is cheapest to get this one right now rather than after the ledger exists.

---

## 3. Backend framework undecided

| Source | Says |
|---|---|
| `MVP_Timeline_Plan_Updated.md:826-828` | "Node.js/Express, Python/FastAPI, or Go — Assumption: Team's preferred stack" |
| `…Architecture.md:229` | "Node.js (NestJS)" |
| `docs/local-dev-guide.md` | NestJS throughout (service structure, ports 3001-3009) |

Two of three say NestJS. The plan leaves it open. Probably just needs writing down.

---

## 4. `local-dev-guide.md` describes the archived stack

It survived to `docs/` root rather than moving to `docs/Legacy/`, but its content is the old system: PostgreSQL, nine separate databases (`:41-51`), NestJS services on ports 3001-3009, the gateway topology.

Either it was left at root deliberately because the stack is not actually changing — which would settle §2 and §3 — or it moved by accident and belongs in `Legacy/`.

---

## 5. Sponsors — excluded but load-bearing

`MVP_Timeline_Plan_Updated.md:79` excludes "Sponsors & Newsletter" from MVP.

The spec threads sponsors through features that *are* in MVP:

| Feature | Spec reference | Sponsor dependency |
|---|---|---|
| Registration | `:438` | Sponsor selection is a required field |
| Onboarding | `:1391-1399` | Mandatory sponsor selection, cannot skip |
| Player card | `:525` | Active sponsor badge |
| Profile | `:552-560` | Sponsor stats block |
| Hall of Fame | `:978-986` | Sponsor champions section |
| Event results | `:748` | "+X fans earned for [Sponsor]" |

Excluding the sponsor service means those six surfaces need the sponsor elements stripped, not just hidden. Worth deciding which — strip the UI, or keep a minimal sponsor table so the fields resolve.

---

## 6. Challenge system ordering

Included in MVP (`MVP_Timeline_Plan_Updated.md:65`), scheduled Week 3 (`:340-347`).

Proof submission is media upload. Media lands Week 4 (`:458-466`).

The dependency runs backwards by a week. Either challenges ship without proof upload in Week 3, or media moves earlier — which §1 suggests anyway.

---

## 7. Internal date contradictions in the plan

| Value | Locations |
|---|---|
| Deadline 2 = **Oct 15** | `:13`, `:51` |
| Deadline 2 = **Oct 18** | `:581`, `:668`, `:913` |
| Break ends **Oct 9** | `:48` |
| Break ends **Oct 11** | `:15`, `:572` |
| Week 5 = **Oct 10-11** | `:50` |
| Week 5 = **Oct 17-18** | `:581` |

Three different final dates, two different break ends. Ten-minute fix, but the team will schedule against whichever they read first.

Also `:682` — "Team Size Reduced: 5 people instead of 6." The previous plan had 7 (5 FE + 2 BE).

---

## 8. Capacity

Deadline 1 gives 64h/person, 2 backend people = 128h backend total.

Weeks 1-4 already allocate 8 backend tasks × 8h × 2 people = 128h. Fully committed.

Kafka, WebSockets, and media integration work in §1 are not in that 128h. Whatever gets added displaces something already scheduled.

---

## Summary

| # | Mismatch | Resolution needed |
|---|---|---|
| 1 | Kafka absent from plan | Allocate hours, or mark spec §8 as Phase 2 |
| 2 | Plan defers WebSockets, decision says keep | Pick one; spec latency target follows |
| 3 | Media scheduled last, first to be cut | Move earlier or protect in contingency |
| 4 | NoSQL vs PostgreSQL | Due today |
| 5 | Backend framework open in plan | Write down NestJS |
| 6 | `local-dev-guide.md` at root describes old stack | Update or move to `Legacy/` |
| 7 | Sponsors excluded but wired into 6 MVP surfaces | Strip fields or keep minimal table |
| 8 | Challenges (W3) depend on media (W4) | Reorder |
| 9 | Three deadline dates, two break ends | Pick one set |
| 10 | Locked items have no hours in a full 128h | Something gets displaced |
