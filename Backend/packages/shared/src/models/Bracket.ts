import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';
// "user or team" is already defined once, for leaderboard entries. A bracket asks the same question
// of the same events, so it asks it with the same enum rather than a second one that must agree.
import { PARTICIPANT_TYPE, ParticipantType } from './Leaderboard';

/**
 * Bracket Service (:3012). See docs/modeldocs/bracket-model.md.
 * Collections: `brackets` (the draw) and `matches` (the fixtures) — Spec §4.1 `Match`,
 * §5.5 Spectator Bracket View, §5.15.2 Visual Bracket Generator.
 *
 * A bracket is a plan; a match is a fixture. Keeping them apart is what makes "redo the draw" one
 * delete and "report a score" one update.
 *
 * Note what is NOT here: `events.bracket`. That slot is reserved on a document the Event Service
 * owns (relationships.md §1), and `brackets.event_id` is the same link from the side that owns it.
 */

/**
 * The formats generated today. `events.leaderboard.format` carries five (Event.ts); `double_elim`
 * and `elim_after_n` are not generated yet — the first is loser-bracket routing, the
 * second is a standings rule rather than a tree.
 */
export const BRACKET_FORMAT = ['round_robin', 'single_elim'] as const;
export const BRACKET_SEEDING = ['registration', 'random', 'manual'] as const;
/**
 * `draft` is the delete claim: `DELETE /brackets/:event_id` moves `active` → `draft` before it
 * checks for results, and a report that finds `draft` backs out (bracket-service match.service.ts).
 */
export const BRACKET_STATUS = ['draft', 'active', 'completed'] as const;

export type BracketFormat = (typeof BRACKET_FORMAT)[number];
export type BracketSeeding = (typeof BRACKET_SEEDING)[number];
export type BracketStatus = (typeof BRACKET_STATUS)[number];

export interface BracketParticipant {
    seed: number;
    id: string;
    display_name: string;
    avatar_url: string | null;
    /** Raised when the account behind the seed is deleted; the seed and the results stay. */
    deleted?: boolean;
}

const ParticipantSchema = new Schema<BracketParticipant>(
    {
        seed: { type: Number, required: true, min: 1 },
        id: { type: String, required: true },
        display_name: { type: String, required: true },
        avatar_url: { type: String, default: null },
        deleted: { type: Boolean, default: false },
    },
    { _id: false }
);

export interface IBracket extends Document<string> {
    _id: string;
    event_id: string;
    format: BracketFormat;
    participant_type: ParticipantType;
    seeding: BracketSeeding;
    /** Frozen at generation: a draw is a record of who was in it, not a live view of who still is. */
    participants: BracketParticipant[];
    rounds: number;
    status: BracketStatus;
    generated_by: string;
    /** When a delete claimed this bracket (`status: 'draft'`). A stale claim is a dead deleter's. */
    claimed_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

const BracketSchema = new Schema<IBracket>(
    {
        _id: uuidId,
        event_id: { type: String, required: true, unique: true },
        format: { type: String, enum: BRACKET_FORMAT, required: true },
        participant_type: { type: String, enum: PARTICIPANT_TYPE, required: true },
        seeding: { type: String, enum: BRACKET_SEEDING, default: 'registration' },
        participants: { type: [ParticipantSchema], required: true },
        rounds: { type: Number, required: true, min: 1 },
        status: { type: String, enum: BRACKET_STATUS, default: 'active' },
        generated_by: { type: String, required: true },
        claimed_at: { type: Date, default: null },
    },
    timestamps
);

BracketSchema.pre('validate', function (this: IBracket) {
    const b = this;
    const fail = (msg: string): never => {
        throw new Error(`Bracket invariant: ${msg}`);
    };
    if (b.participants.length < 2) return fail('a bracket needs at least two participants');
    const ids = b.participants.map((p) => p.id);
    if (new Set(ids).size !== ids.length) return fail('participants must be unique');
    const seeds = b.participants.map((p) => p.seed).sort((x, y) => x - y);
    if (seeds.some((s, i) => s !== i + 1)) return fail('seeds must be 1..n with no gaps');
});

// One bracket per event, enforced by the unique index the `event_id` field definition already
// declares — a second `schema.index()` for it only earns a duplicate-index warning.

export const Bracket = model<IBracket>('Bracket', BracketSchema, 'brackets');

/* ------------------------------------------------------------------ *
 * matches
 * ------------------------------------------------------------------ */

export const MATCH_STATUS = ['scheduled', 'ongoing', 'completed', 'bye', 'cancelled'] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

/** Nothing the sweep or the bracket-completion check should wait on any longer. */
export const MATCH_TERMINAL: readonly MatchStatus[] = ['completed', 'bye', 'cancelled'];
export const isTerminalMatch = (s: MatchStatus): boolean => MATCH_TERMINAL.includes(s);

/** `main` is every match today. The two others are the double-elimination seam. */
export const BRACKET_SIDE = ['main', 'upper', 'lower'] as const;
export type BracketSide = (typeof BRACKET_SIDE)[number];

export const MATCH_WINNER = ['a', 'b', 'draw'] as const;
export type MatchWinner = (typeof MATCH_WINNER)[number];

export interface MatchSide {
    seed: number;
    id: string;
    display_name: string;
    deleted?: boolean;
}

const MatchSideSchema = new Schema<MatchSide>(
    {
        seed: { type: Number, required: true, min: 1 },
        id: { type: String, required: true },
        display_name: { type: String, required: true },
        // Anonymized on UserDeleted like every other display snapshot; the seed and the id stay,
        // because the result is still the result (relationships.md §4).
        deleted: { type: Boolean, default: false },
    },
    { _id: false }
);

export interface IMatch extends Document<string> {
    _id: string;
    event_id: string;
    bracket_id: string;
    round: number;
    slot: number;
    bracket_side: BracketSide;

    /** Null is an unfilled slot (an earlier round has not been played) or the empty half of a bye. */
    a: MatchSide | null;
    b: MatchSide | null;

    score_a: number | null;
    score_b: number | null;
    winner: MatchWinner | null;
    status: MatchStatus;

    scheduled_at: Date | null;
    venue: string | null;

    /** Where the winner goes. Null in a final, and in every round-robin fixture. */
    advances_to: { match_id: string; slot: 'a' | 'b' } | null;

    /**
     * Who reported the result. Null on a bye — nobody played it — which is exactly what makes this
     * the right field to ask "has this draw been played yet".
     */
    reported_by: string | null;

    created_at: Date;
    updated_at: Date;
}

const AdvancesToSchema = new Schema(
    {
        match_id: { type: String, required: true },
        slot: { type: String, enum: ['a', 'b'], required: true },
    },
    { _id: false }
);

const MatchSchema = new Schema<IMatch>(
    {
        _id: uuidId,
        event_id: { type: String, required: true },
        bracket_id: { type: String, required: true },
        round: { type: Number, required: true, min: 1 },
        slot: { type: Number, required: true, min: 0 },
        bracket_side: { type: String, enum: BRACKET_SIDE, default: 'main' },

        a: { type: MatchSideSchema, default: null },
        b: { type: MatchSideSchema, default: null },

        score_a: { type: Number, default: null },
        score_b: { type: Number, default: null },
        winner: { type: String, enum: MATCH_WINNER, default: null },
        status: { type: String, enum: MATCH_STATUS, default: 'scheduled' },

        scheduled_at: { type: Date, default: null },
        venue: { type: String, default: null, maxlength: 140 },

        advances_to: { type: AdvancesToSchema, default: null },
        reported_by: { type: String, default: null },
    },
    timestamps
);

// bracket-model.md §3.2
MatchSchema.pre('validate', function (this: IMatch) {
    const m = this;
    const fail = (msg: string): never => {
        throw new Error(`Match invariant: ${msg}`);
    };

    if ((m.score_a === null) !== (m.score_b === null)) {
        return fail('scores are both set or both null');
    }

    // A winner without a result, or a result without a winner, is a fixture nobody can read.
    const decided = m.status === 'completed' || m.status === 'bye';
    if (decided !== (m.winner !== null)) {
        return fail(`status '${m.status}' and winner must agree`);
    }
    if (m.winner === 'a' && m.a === null) return fail('winner "a" needs a participant in slot a');
    if (m.winner === 'b' && m.b === null) return fail('winner "b" needs a participant in slot b');

    if (m.status === 'bye') {
        if ((m.a === null) === (m.b === null)) return fail('a bye has exactly one participant');
        if (m.score_a !== null) return fail('a bye has no score');
    }
    if (m.status === 'completed' && (m.a === null || m.b === null)) {
        return fail('a completed match has two participants');
    }
    if (m.a && m.b && m.a.id === m.b.id) return fail('a participant cannot play itself');
});

/** The draw's shape, and what makes the generator idempotent under a retry. */
MatchSchema.index({ bracket_id: 1, round: 1, slot: 1 }, { unique: true });
/** The spectator view: every fixture of an event, in bracket order. */
MatchSchema.index({ event_id: 1, round: 1, slot: 1 });
/** "What is still to play". */
MatchSchema.index({ event_id: 1, status: 1 });

export const Match = model<IMatch>('Match', MatchSchema, 'matches');

/** Round-robin points: Spec does not name a scheme, so the football default, stated in one place. */
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = 0;
