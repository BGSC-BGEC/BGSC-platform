import assert from 'assert';
import { BracketParticipant } from '@bgsc/shared';
import { bracketSize, generate, roundRobin, seedOrder, seedParticipants, singleElim } from '../brackets/generate';

/**
 * The draw, checked as a function.
 *
 * No database: a round-robin schedule is either every pair exactly once with nobody playing twice
 * in a round, or it is wrong, and Mongo has no opinion on that. Pinned ids (`m<round>-<slot>`) make
 * the `advances_to` wiring readable in an assertion.
 */

const ids = (round: number, slot: number) => `m${round}-${slot}`;

const field = (n: number): BracketParticipant[] =>
    Array.from({ length: n }, (_, i) => ({
        seed: i + 1,
        id: `p${i + 1}`,
        display_name: `Player ${i + 1}`,
        avatar_url: null,
    }));

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

function main(): void {
    /* ---- round robin ---------------------------------------------------- */

    for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) {
        const { rounds, matches } = roundRobin(field(n), ids);

        assert.strictEqual(
            matches.length,
            (n * (n - 1)) / 2,
            `${n} participants play every pair once: ${(n * (n - 1)) / 2} fixtures`
        );

        const pairs = new Set(matches.map((m) => pairKey(m.a!.id, m.b!.id)));
        assert.strictEqual(pairs.size, matches.length, `${n}: no pair is drawn twice`);

        // An odd field plays one more round than an even one, because somebody sits out each round.
        assert.strictEqual(rounds, n % 2 === 0 ? n - 1 : n, `${n}: round count`);

        // Nobody is in two fixtures in the same round — the one thing a rotation gets wrong.
        for (let r = 1; r <= rounds; r++) {
            const inRound = matches.filter((m) => m.round === r);
            const seen = inRound.flatMap((m) => [m.a!.id, m.b!.id]);
            assert.strictEqual(new Set(seen).size, seen.length, `${n}: nobody plays twice in round ${r}`);
            const slots = inRound.map((m) => m.slot);
            assert.strictEqual(new Set(slots).size, slots.length, `${n}: slots are unique within round ${r}`);
        }

        // An odd field means exactly one sit-out each, and an even field none at all.
        for (const p of field(n)) {
            const played = matches.filter((m) => m.a!.id === p.id || m.b!.id === p.id).length;
            assert.strictEqual(played, n - 1, `${n}: ${p.id} plays everyone else exactly once`);
        }

        assert.ok(
            matches.every((m) => m.advances_to === null && m.status === 'scheduled'),
            `${n}: nobody advances in a round robin — the table decides`
        );
    }
    console.log('✓ round robin: every pair once, nobody twice in a round, one sit-out each when odd');

    /* ---- seeding order --------------------------------------------------- */

    assert.deepStrictEqual(seedOrder(2), [1, 2]);
    // The classic doubling: each seed s becomes the pair (s, size+1-s), so 1 meets the weakest,
    // 2 sits in the opposite half, and the two can only meet in the final.
    assert.deepStrictEqual(seedOrder(4), [1, 4, 2, 3]);
    assert.deepStrictEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
    assert.deepStrictEqual(bracketSize(5), 8);
    assert.deepStrictEqual(bracketSize(8), 8);
    assert.deepStrictEqual(bracketSize(9), 16);
    console.log('✓ seeding order doubles correctly and the field pads to a power of two');

    /* ---- single elimination ---------------------------------------------- */

    for (const n of [2, 3, 4, 5, 6, 7, 8, 16]) {
        const size = bracketSize(n);
        const { rounds, matches } = singleElim(field(n), ids);

        assert.strictEqual(rounds, Math.log2(size), `${n}: ${Math.log2(size)} rounds`);
        assert.strictEqual(matches.length, size - 1, `${n}: a full tree of ${size} has ${size - 1} slots`);

        const byes = matches.filter((m) => m.status === 'bye');
        assert.strictEqual(byes.length, size - n, `${n}: ${size - n} byes`);
        assert.ok(
            byes.every((m) => (m.a === null) !== (m.b === null) && m.winner !== null),
            `${n}: a bye has one participant and a known winner`
        );

        // Every participant appears exactly once in the first round.
        const firstRound = matches.filter((m) => m.round === 1);
        const seated = firstRound.flatMap((m) => [m.a, m.b]).filter(Boolean).map((p) => p!.id);
        assert.strictEqual(seated.length, n, `${n}: everyone is seated`);
        assert.strictEqual(new Set(seated).size, n, `${n}: nobody is seated twice`);

        // The point of seeding: the top two can only meet in the final.
        const half = firstRound.length / 2;
        if (n >= 4) {
            const sideOf = (id: string) => {
                const idx = firstRound.findIndex((m) => m.a?.id === id || m.b?.id === id);
                return idx < half ? 'top' : 'bottom';
            };
            assert.notStrictEqual(sideOf('p1'), sideOf('p2'), `${n}: seeds 1 and 2 are in opposite halves`);
        }

        // Wiring: everything but the final advances, and no two matches feed the same slot.
        const finals = matches.filter((m) => m.round === rounds);
        assert.strictEqual(finals.length, 1, `${n}: exactly one final`);
        assert.strictEqual(finals[0].advances_to, null, `${n}: the final advances nowhere`);

        const targets = matches.filter((m) => m.advances_to).map((m) => `${m.advances_to!.match_id}:${m.advances_to!.slot}`);
        assert.strictEqual(new Set(targets).size, targets.length, `${n}: no two matches advance into one slot`);
        assert.strictEqual(targets.length, matches.length - 1, `${n}: every non-final match advances`);

        // A bye's winner is already showing in the next round, not left as a hole.
        for (const bye of byes) {
            const target = matches.find((m) => m._id === bye.advances_to!.match_id)!;
            const landed = target[bye.advances_to!.slot];
            const winner = bye.winner === 'a' ? bye.a : bye.b;
            assert.strictEqual(landed?.id, winner!.id, `${n}: the bye's winner is seated in the next round`);
        }
    }
    console.log('✓ single elim: full tree, correct byes, top seeds apart, every advance wired once');

    // The wiring, spelled out once on a bracket small enough to read.
    const four = singleElim(field(4), ids);
    assert.deepStrictEqual(
        four.matches.map((m) => `${m._id}:${m.a?.id ?? '-'}v${m.b?.id ?? '-'}->${m.advances_to?.match_id ?? 'end'}${m.advances_to?.slot ?? ''}`),
        ['m1-0:p1vp4->m2-0a', 'm1-1:p2vp3->m2-0b', 'm2-0:-v-->end'],
        'a four-player bracket reads exactly as drawn'
    );
    console.log('✓ a four-player draw is 1v4 and 2v3 feeding one final');

    /* ---- seeding modes ----------------------------------------------------- */

    const raw = field(4).map(({ seed, ...rest }) => rest);
    const byRegistration = seedParticipants(raw, 'registration');
    assert.deepStrictEqual(byRegistration.map((p) => p.id), ['p1', 'p2', 'p3', 'p4'], 'registration order is arrival order');
    assert.deepStrictEqual(byRegistration.map((p) => p.seed), [1, 2, 3, 4], 'seeds are 1..n');

    const manual = seedParticipants(raw, 'manual', ['p3', 'p1', 'p4', 'p2']);
    assert.deepStrictEqual(manual.map((p) => p.id), ['p3', 'p1', 'p4', 'p2'], 'manual seeding is honoured exactly');
    assert.strictEqual(manual[0].seed, 1, 'and re-numbers the seeds');

    assert.throws(() => seedParticipants(raw, 'manual', ['p1', 'p2']), /every participant exactly once/);
    assert.throws(() => seedParticipants(raw, 'manual', ['p1', 'p1', 'p3', 'p4']), /every participant exactly once/);
    assert.throws(() => seedParticipants(raw, 'manual', ['p1', 'p2', 'p3', 'ghost']), /every participant exactly once/);
    console.log('✓ seeding modes: arrival order, honoured manual list, and refusals for anything else');

    const random = seedParticipants(raw, 'random');
    assert.strictEqual(new Set(random.map((p) => p.id)).size, 4, 'a shuffle loses nobody');
    assert.deepStrictEqual(random.map((p) => p.seed), [1, 2, 3, 4], 'and still seeds 1..n');

    /* ---- the entry point --------------------------------------------------- */

    assert.strictEqual(generate(field(4), 'round_robin', ids).matches.length, 6);
    assert.strictEqual(generate(field(4), 'single_elim', ids).matches.length, 3);
    console.log('✓ generate() dispatches on format');

    console.log('\ngenerate selfcheck: all checks passed');
}

main();
