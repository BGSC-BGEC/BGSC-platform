import { IBracket, IMatch, POINTS_DRAW, POINTS_LOSS, POINTS_WIN } from '@bgsc/shared';

/**
 * Standings, derived from the fixtures every time they are asked for.
 *
 * Never stored. A match result is the only input, there are at most a few hundred fixtures in an
 * event, and a materialized table is a second copy of the truth that has to be kept in step with
 * every correction a coordinator makes. When this stops being cheap, `leaderboard_entries.stats`
 * already has the fields for it (`Leaderboard.ts`) and a service that owns them.
 */

export interface StandingRow {
    seed: number;
    id: string;
    display_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    points: number;
    scored: number;
    conceded: number;
    difference: number;
    /** Single elimination: the furthest round this participant reached. */
    round_reached: number | null;
    eliminated: boolean;
}

export interface Standings {
    format: IBracket['format'];
    /** Set once the draw is finished; null while it is still being played. */
    champion: { id: string; display_name: string } | null;
    rows: StandingRow[];
}

const blank = (p: { seed: number; id: string; display_name: string }): StandingRow => ({
    ...p,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    scored: 0,
    conceded: 0,
    difference: 0,
    round_reached: null,
    eliminated: false,
});

export function standingsOf(bracket: IBracket, matches: IMatch[]): Standings {
    /**
     * Winning a fixture puts you in the NEXT round — except in the final, where there is no next
     * round to reach. Without that cap the champion reads `round_reached: 4` in a three-round
     * bracket while the runner-up reads 3, and the column stops meaning "the furthest round this
     * participant reached" for exactly one row. `eliminated` is what separates the winner from the
     * loser of the final, and it already does.
     */
    const through = (round: number) => Math.min(round + 1, bracket.rounds);

    const rows = new Map<string, StandingRow>(
        bracket.participants.map((p) => [p.id, blank({ seed: p.seed, id: p.id, display_name: p.display_name })])
    );

    for (const m of matches) {
        // A bye is not a game played. It advances somebody, and the bracket shows it, but counting
        // it as a win would put a participant top of a table without them kicking a ball.
        if (m.status !== 'completed' || !m.a || !m.b) {
            if (m.status === 'bye') {
                const advanced = m.winner === 'a' ? m.a : m.b;
                const row = advanced && rows.get(advanced.id);
                if (row) row.round_reached = Math.max(row.round_reached ?? 0, through(m.round));
            }
            continue;
        }

        const a = rows.get(m.a.id);
        const b = rows.get(m.b.id);
        const sa = m.score_a ?? 0;
        const sb = m.score_b ?? 0;

        for (const [row, mine, theirs] of [
            [a, sa, sb],
            [b, sb, sa],
        ] as const) {
            if (!row) continue;
            row.played += 1;
            row.scored += mine;
            row.conceded += theirs;
            row.difference = row.scored - row.conceded;
            row.round_reached = Math.max(row.round_reached ?? 0, m.round);
        }

        if (m.winner === 'draw') {
            if (a) { a.drawn += 1; a.points += POINTS_DRAW; }
            if (b) { b.drawn += 1; b.points += POINTS_DRAW; }
            continue;
        }

        const [win, lose] = m.winner === 'a' ? [a, b] : [b, a];
        if (win) {
            win.won += 1;
            win.points += POINTS_WIN;
            // The winner is through to the next round; the loser's run ended here.
            win.round_reached = Math.max(win.round_reached ?? 0, through(m.round));
        }
        if (lose) {
            lose.lost += 1;
            lose.points += POINTS_LOSS;
            if (bracket.format === 'single_elim') lose.eliminated = true;
        }
    }

    const table = [...rows.values()];

    if (bracket.format === 'round_robin') {
        // Points, then goal difference, then goals scored, then the seed — a deterministic order,
        // because a table that reshuffles equal rows between two requests looks broken.
        table.sort(
            (x, y) =>
                y.points - x.points ||
                y.difference - x.difference ||
                y.scored - x.scored ||
                x.seed - y.seed
        );
    } else {
        // Furthest round first, then still standing before knocked out — the finalists share a
        // round_reached, and the seed alone put a higher-seeded runner-up above the champion —
        // then the seed: the bracket's own idea of standing.
        table.sort(
            (x, y) =>
                (y.round_reached ?? 0) - (x.round_reached ?? 0) ||
                Number(x.eliminated) - Number(y.eliminated) ||
                x.seed - y.seed
        );
    }

    return { format: bracket.format, champion: championOf(bracket, matches, table), rows: table };
}

/**
 * Who won the whole thing, or null while anything is still to play.
 *
 * Elimination reads the final; a round robin reads the top of the table — and only once every
 * fixture is done, because a leader halfway through a league is not a champion.
 */
export function championOf(
    bracket: IBracket,
    matches: IMatch[],
    table?: StandingRow[]
): { id: string; display_name: string } | null {
    const outstanding = matches.some((m) => m.status === 'scheduled' || m.status === 'ongoing');
    if (outstanding) return null;

    if (bracket.format === 'single_elim') {
        const final = matches.find((m) => m.round === bracket.rounds);
        if (!final || !final.winner || final.winner === 'draw') return null;
        const side = final.winner === 'a' ? final.a : final.b;
        return side ? { id: side.id, display_name: side.display_name } : null;
    }

    const top = (table ?? standingsOf(bracket, matches).rows)[0];
    return top ? { id: top.id, display_name: top.display_name } : null;
}
