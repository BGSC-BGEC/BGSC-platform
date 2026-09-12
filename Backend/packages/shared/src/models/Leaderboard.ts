import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

/**
 * Leaderboard Service. See docs/modeldocs/leaderboard-model.md.
 * Collections: `leaderboard_entries`, `leaderboard_snapshots`. Redis ZSETs are a read cache on top.
 *
 * Config (format, scoring parameters, normalization bounds) lives on `events` and is read-only here.
 * The GLOBAL leaderboard is a query over point_transactions plus a Redis ZSET — it has no collection.
 */

export const PARTICIPANT_TYPE = ['user', 'team'] as const;
export type ParticipantType = (typeof PARTICIPANT_TYPE)[number];

export interface ILeaderboardEntry extends Document<string> {
    _id: string;
    event_id: string;
    participant: {
        type: ParticipantType;
        id: string;
        display_name: string;
        avatar_url: string | null;
    };
    registration_id: string | null;

    raw: Record<string, number | boolean>;
    raw_score: number;
    normalized_score: number;
    invested_points: number;
    final_score: number;

    stats: {
        played: number;
        won: number;
        lost: number;
        drawn: number;
        round_reached: number | null;
        fails: number | null;
        eliminated: boolean;
    };

    rank: number | null;
    previous_rank: number | null;
    last_scored_at: Date | null;
    scored_by: string | null;

    version: number;
    created_at: Date;
    updated_at: Date;
}

const ParticipantSchema = new Schema(
    {
        type: { type: String, enum: PARTICIPANT_TYPE, required: true },
        id: { type: String, required: true }, // user_id or teams._id
        display_name: { type: String, required: true }, // snapshot
        avatar_url: { type: String, default: null }, // snapshot
    },
    { _id: false }
);

const LeaderboardEntrySchema = new Schema<ILeaderboardEntry>(
    {
        _id: uuidId,
        event_id: { type: String, required: true },
        participant: { type: ParticipantSchema, required: true },
        registration_id: { type: String, default: null }, // user entries only

        // Keys must be a subset of events.scoring.parameters[].key; validated by the service against the event.
        raw: { type: Schema.Types.Mixed, default: {} },
        raw_score: { type: Number, default: 0 }, // Σ weight_i × value_i (bool -> 0/1)
        normalized_score: { type: Number, default: 0 }, // min-max mapped into [lower, upper]
        invested_points: { type: Number, default: 0, min: 0 },
        final_score: { type: Number, default: 0 },

        stats: {
            played: { type: Number, default: 0, min: 0 },
            won: { type: Number, default: 0, min: 0 },
            lost: { type: Number, default: 0, min: 0 },
            drawn: { type: Number, default: 0, min: 0 },
            round_reached: { type: Number, default: null, min: 0 }, // single/double elim
            fails: { type: Number, default: null, min: 0 }, // elim_after_n
            eliminated: { type: Boolean, default: false },
        },

        // Materialized so "my rank" is one read instead of sorting the event on every profile view.
        rank: { type: Number, default: null, min: 1 }, // null until min_participants is met
        previous_rank: { type: Number, default: null, min: 1 },
        last_scored_at: { type: Date, default: null },
        scored_by: { type: String, default: null },

        version: { type: Number, default: 0 }, // optimistic lock for concurrent investments
    },
    timestamps
);

// leaderboard-model.md §3.2
LeaderboardEntrySchema.pre('validate', function (this: ILeaderboardEntry) {
    const e = this;
    const fail = (msg: string): never => {
        throw new Error(`LeaderboardEntry invariant: ${msg}`);
    };

    if ((e.registration_id !== null) !== (e.participant.type === 'user')) {
        return fail("registration_id must be set exactly when participant.type == 'user'");
    }
    if (e.invested_points < 0) return fail('invested_points must not be negative');

    e.final_score = e.normalized_score + e.invested_points;
});

LeaderboardEntrySchema.index({ event_id: 1, 'participant.id': 1 }, { unique: true });
LeaderboardEntrySchema.index({ event_id: 1, final_score: -1, 'participant.display_name': 1 }); // deterministic tiebreak
LeaderboardEntrySchema.index({ event_id: 1, rank: 1 }); // podium, pagination
LeaderboardEntrySchema.index({ 'participant.id': 1, event_id: 1 }); // profile "my results"

export const LeaderboardEntry = model<ILeaderboardEntry>('LeaderboardEntry', LeaderboardEntrySchema, 'leaderboard_entries');

/* ------------------------------------------------------------------ *
 * leaderboard_snapshots — history, rank deltas, freeze audit
 * ------------------------------------------------------------------ */

export const SNAPSHOT_REASON = ['score_update', 'investment', 'final', 'freeze'] as const;
export type SnapshotReason = (typeof SNAPSHOT_REASON)[number];

export interface ILeaderboardSnapshot extends Document<string> {
    _id: string;
    event_id: string;
    taken_at: Date;
    reason: SnapshotReason;
    frozen: boolean;
    ranks: { participant_id: string; rank: number; final_score: number }[];
}

const LeaderboardSnapshotSchema = new Schema<ILeaderboardSnapshot>(
    {
        _id: uuidId,
        event_id: { type: String, required: true },
        taken_at: { type: Date, required: true, default: Date.now },
        reason: { type: String, enum: SNAPSHOT_REASON, required: true },
        frozen: { type: Boolean, default: false },
        ranks: {
            type: [
                new Schema(
                    {
                        participant_id: { type: String, required: true },
                        rank: { type: Number, required: true, min: 1 },
                        final_score: { type: Number, required: true },
                    },
                    { _id: false }
                ),
            ],
            default: [],
        },
    },
    { versionKey: false }
);

// previous_rank on entries = rank in the previous snapshot. A cleanup job keeps the last 20 per event.
LeaderboardSnapshotSchema.index({ event_id: 1, taken_at: -1 });

export const LeaderboardSnapshot = model<ILeaderboardSnapshot>(
    'LeaderboardSnapshot',
    LeaderboardSnapshotSchema,
    'leaderboard_snapshots'
);

/* ------------------------------------------------------------------ *
 * Scoring math (leaderboard-model.md §5). Pure functions — no DB, no service.
 * ------------------------------------------------------------------ */

export interface ScoringParameter {
    key: string;
    kind: 'int' | 'float' | 'bool';
    weight: number;
}

/** Σ weight × value, booleans counted as 0/1. Unknown keys are the caller's problem to reject first. */
export function rawScore(raw: Record<string, number | boolean>, parameters: ScoringParameter[]): number {
    return parameters.reduce((sum, p) => {
        const v = raw[p.key];
        if (v === undefined) return sum;
        return sum + p.weight * (typeof v === 'boolean' ? Number(v) : v);
    }, 0);
}

/**
 * Min-max across the whole event, rounded to 2dp. One participant's score moves everyone's normalized value,
 * so this is recomputed for every entry whenever any raw changes.
 * ponytail: min-max. Swap to z-score or admin-fixed bounds if a sport needs absolute scales.
 */
export function normalize(value: number, min: number, max: number, lower: number, upper: number): number {
    if (max === min) return lower;
    return Math.round((lower + ((value - min) / (max - min)) * (upper - lower)) * 100) / 100;
}
