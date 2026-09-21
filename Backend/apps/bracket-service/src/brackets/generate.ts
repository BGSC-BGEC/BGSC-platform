import { BracketFormat, BracketParticipant, MatchStatus, MatchWinner } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';

/**
 * The draw, as pure functions (be2-feedback-bracket-plan.md §7, §11).
 *
 * No database, no clock, no randomness unless a caller hands it in. A round-robin schedule is
 * either correct — every pair exactly once, nobody twice in a round — or it is not, and that has
 * nothing to do with Mongo. Keeping this file pure is what lets the selfcheck assert the shape of a
 * 5, 6, 7 and 8-participant bracket without a connection.
 */

export interface GeneratedMatch {
    _id: string;
    round: number;
    slot: number;
    a: BracketParticipant | null;
    b: BracketParticipant | null;
    status: MatchStatus;
    winner: MatchWinner | null;
    advances_to: { match_id: string; slot: 'a' | 'b' } | null;
}

export interface GeneratedDraw {
    rounds: number;
    matches: GeneratedMatch[];
}

/** Injected so a test can pin ids to `m<round>-<slot>` and read the wiring; production passes uuids. */
export type IdFactory = (round: number, slot: number) => string;

const defaultIds: IdFactory = () => uuid();

/**
 * One participant is not a tournament, and the shapes below quietly produce nonsense for it — a
 * round robin with no fixtures, and an elimination tree with no rounds at all to index into. The
 * service refuses a short field before it gets here; this is so that a direct caller of these pure
 * functions gets an error rather than an empty draw that looks generated.
 */
function assertDrawable(participants: BracketParticipant[]): void {
    if (participants.length < 2) {
        throw new Error(`a bracket needs at least two participants, got ${participants.length}`);
    }
}

/* ------------------------------------------------------------------ *
 * Round robin
 * ------------------------------------------------------------------ */

/**
 * The circle method: fix the first participant, rotate the rest. An odd field gets a ghost, and
 * whoever is drawn against the ghost sits that round out — which is why an odd `n` plays `n` rounds
 * rather than `n-1`, and why every participant gets exactly one bye round rather than one player
 * getting all of them.
 *
 * Produces exactly `n(n-1)/2` fixtures: every pair once.
 */
export function roundRobin(participants: BracketParticipant[], idFor: IdFactory): GeneratedDraw {
    assertDrawable(participants);
    const field: (BracketParticipant | null)[] = [...participants];
    if (field.length % 2 === 1) field.push(null); // the ghost

    const size = field.length;
    const rounds = size - 1;
    const half = size / 2;
    const matches: GeneratedMatch[] = [];

    // Everyone but the fixed first participant rotates.
    let rotating = field.slice(1);

    for (let r = 1; r <= rounds; r++) {
        const row = [field[0], ...rotating];
        let slot = 0;

        for (let i = 0; i < half; i++) {
            const a = row[i];
            const b = row[size - 1 - i];
            // One of them is the ghost: that participant sits out. No fixture, and deliberately no
            // `bye` row either — a round robin has no bracket to advance through, so a bye here is
            // an absence, not a result.
            if (!a || !b) continue;

            matches.push({
                _id: idFor(r, slot),
                round: r,
                slot,
                a,
                b,
                status: 'scheduled',
                winner: null,
                advances_to: null, // nobody advances in a round robin; the table decides
            });
            slot += 1;
        }

        // Rotate clockwise: last element moves to the front of the rotating group.
        rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
    }

    return { rounds, matches };
}

/* ------------------------------------------------------------------ *
 * Single elimination
 * ------------------------------------------------------------------ */

/** The next power of two at or above n. A bracket has to be a full tree; byes fill the difference. */
export function bracketSize(n: number): number {
    let size = 1;
    while (size < n) size *= 2;
    return size;
}

/**
 * Standard seeding order for a bracket of `size`, as a flat list of seed numbers read left to right.
 *
 * Built by doubling, each seed `s` becoming the pair `(s, size + 1 - s)`: `[1, 2]` becomes
 * `[1, 4, 2, 3]` becomes `[1, 8, 4, 5, 2, 7, 3, 6]`. The property that matters is that the two
 * strongest seeds can only meet in the final, the top four only in the semi-finals, and so on —
 * which is the entire point of seeding, and the reason this is not simply `1 vs 2, 3 vs 4`.
 */
export function seedOrder(size: number): number[] {
    let order = [1, 2];
    while (order.length < size) {
        const next: number[] = [];
        const sum = order.length * 2 + 1;
        for (const seed of order) {
            next.push(seed, sum - seed);
        }
        order = next;
    }
    return order;
}

/**
 * A seeded single-elimination tree.
 *
 * Every round is laid out in full at generation, including the rounds nobody can play yet: an empty
 * fixture is how the spectator view draws the tree (Spec §5.5) and how `advances_to` has somewhere
 * to point. A first-round pairing against an absent seed is a **`bye` row**, not a silent promotion
 * — Spec §5.5 names "bypass rounds" as something to render, and a bye that exists as a row is
 * advanced by exactly the same code path as a played result.
 */
export function singleElim(participants: BracketParticipant[], idFor: IdFactory): GeneratedDraw {
    assertDrawable(participants);
    const size = bracketSize(participants.length);
    const rounds = Math.log2(size);
    const bySeed = new Map(participants.map((p) => [p.seed, p]));
    const order = seedOrder(size);

    // Lay out every round first, so `advances_to` can be wired by id before anything is filled in.
    const grid: GeneratedMatch[][] = [];
    for (let r = 1; r <= rounds; r++) {
        const count = size / 2 ** r;
        grid.push(
            Array.from({ length: count }, (_, slot) => ({
                _id: idFor(r, slot),
                round: r,
                slot,
                a: null,
                b: null,
                status: 'scheduled' as MatchStatus,
                winner: null as MatchWinner | null,
                advances_to: null as GeneratedMatch['advances_to'],
            }))
        );
    }

    // Round r slot s feeds round r+1 slot floor(s/2), into side 'a' for even slots and 'b' for odd.
    for (let r = 0; r < rounds - 1; r++) {
        for (const match of grid[r]) {
            const target = grid[r + 1][Math.floor(match.slot / 2)];
            match.advances_to = { match_id: target._id, slot: match.slot % 2 === 0 ? 'a' : 'b' };
        }
    }

    // First round: the seeded pairings, with absent seeds leaving byes.
    grid[0].forEach((match, i) => {
        match.a = bySeed.get(order[i * 2]) ?? null;
        match.b = bySeed.get(order[i * 2 + 1]) ?? null;

        if (match.a && match.b) return;
        if (!match.a && !match.b) {
            // Impossible for a bracket padded to the next power of two (a whole empty half would
            // mean fewer than size/2 participants), but a silently wrong tree is worse than a loud
            // one if the padding ever changes.
            throw new Error(`bracket of ${participants.length} produced an empty first-round slot`);
        }
        match.status = 'bye';
        match.winner = match.a ? 'a' : 'b';
    });

    // Walk the byes forward once: their winner is known at generation, so the next round should
    // show it rather than an empty slot nobody can explain.
    for (const match of grid[0]) {
        if (match.status !== 'bye' || !match.advances_to) continue;
        const winner = match.winner === 'a' ? match.a : match.b;
        const target = grid[1].find((m) => m._id === match.advances_to!.match_id)!;
        target[match.advances_to.slot] = winner;
    }

    return { rounds, matches: grid.flat() };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function generate(
    participants: BracketParticipant[],
    format: BracketFormat,
    idFor: IdFactory = defaultIds
): GeneratedDraw {
    return format === 'round_robin' ? roundRobin(participants, idFor) : singleElim(participants, idFor);
}

/**
 * Seat the field.
 *
 * `registration` is the default and the order they arrived in — deterministic, explicable to a
 * participant, and the only one of the three that produces the same draw twice. `random` shuffles
 * (Fisher-Yates over `crypto`-free `Math.random`, which is fine for a draw and wrong for a secret).
 * `manual` takes the ids an organiser listed and refuses anything that is not exactly the field.
 */
export function seedParticipants(
    field: Omit<BracketParticipant, 'seed'>[],
    seeding: 'registration' | 'random' | 'manual',
    manualIds?: string[]
): BracketParticipant[] {
    let ordered = [...field];

    if (seeding === 'random') {
        for (let i = ordered.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
        }
    }

    if (seeding === 'manual') {
        const ids = manualIds ?? [];
        const byId = new Map(field.map((p) => [p.id, p]));
        if (ids.length !== field.length || ids.some((id) => !byId.has(id)) || new Set(ids).size !== ids.length) {
            throw new Error('manual seeding must list every participant exactly once');
        }
        ordered = ids.map((id) => byId.get(id)!);
    }

    return ordered.map((p, i) => ({ ...p, seed: i + 1 }));
}
