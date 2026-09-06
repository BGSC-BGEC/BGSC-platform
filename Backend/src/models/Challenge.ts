import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps, StatusHistoryItem, StatusHistorySchema } from './shared';

/**
 * Challenge Service. See docs/modeldocs/challenge-model.md.
 * Collections: `challenges` (admin-authored catalog), `challenge_participations` (one per challenge + participant).
 *
 * Acceptance and submission are not separate collections: a submission without an acceptance cannot exist,
 * and the UI always shows them together.
 */

export const CHALLENGE_DOMAIN = ['sports', 'esports', 'dev', 'general'] as const;
export const CHALLENGE_KIND = ['physical', 'digital'] as const;
export const CHALLENGE_DIFFICULTY = ['easy', 'medium', 'hard', 'legend'] as const;
export const CHALLENGE_STATUS = ['draft', 'active', 'completed', 'archived'] as const;
export const PROOF_TYPE = ['url', 'text', 'image', 'video'] as const;

export type ChallengeDomain = (typeof CHALLENGE_DOMAIN)[number];
export type ChallengeKind = (typeof CHALLENGE_KIND)[number];
export type ChallengeDifficulty = (typeof CHALLENGE_DIFFICULTY)[number];
export type ChallengeStatus = (typeof CHALLENGE_STATUS)[number];
export type ProofType = (typeof PROOF_TYPE)[number];

/** Media Service lands in Week 4; until then only these two proof types are accepted. */
export const MVP_PROOF_TYPES: ProofType[] = ['url', 'text'];

export interface IChallenge extends Document<string> {
    _id: string;
    slug: string;

    title: string;
    description: string;
    brief_hidden_until_accept: boolean;
    cover_media_url: string | null;

    domain: ChallengeDomain;
    kind: ChallengeKind;
    difficulty: ChallengeDifficulty;
    tags: string[];

    award_points: number;
    grants_hall_of_fame: boolean;

    window: {
        opens_at: Date | null;
        closes_at: Date | null;
        submissions_close_at: Date | null;
        time_limit_minutes: number | null;
    };

    location: { name: string; details: string | null } | null;

    teaming: {
        enabled: boolean;
        team_size_min: number | null;
        team_size_max: number | null;
        max_teams: number | null;
    };

    max_participants: number | null;
    resources: { label: string; url: string }[];

    submission: {
        requires_proof: boolean;
        proof_types: ProofType[];
        max_files: number;
        auto_approve: boolean;
    };

    status: ChallengeStatus;
    counts: { accepted: number; submitted: number; approved: number };

    created_by: string;
    reviewers: string[];
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

const ChallengeSchema = new Schema<IChallenge>(
    {
        _id: uuidId,
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

        title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
        description: { type: String, required: true },
        // Spec §5.7: for digital challenges the full brief may be hidden until acceptance.
        brief_hidden_until_accept: { type: Boolean, default: false },
        cover_media_url: { type: String, default: null },

        domain: { type: String, enum: CHALLENGE_DOMAIN, required: true },
        kind: { type: String, enum: CHALLENGE_KIND, required: true },
        difficulty: { type: String, enum: CHALLENGE_DIFFICULTY, required: true },
        tags: { type: [String], default: [], lowercase: true },

        award_points: { type: Number, required: true, min: 1 },
        grants_hall_of_fame: { type: Boolean, default: false },

        window: {
            opens_at: { type: Date, default: null }, // null = open now
            closes_at: { type: Date, default: null }, // last moment to accept; null = evergreen
            submissions_close_at: { type: Date, default: null }, // hard stop regardless of personal deadline
            time_limit_minutes: { type: Number, default: null, min: 1 }, // per-participant, from accepted_at
        },

        location: {
            type: new Schema(
                { name: { type: String, required: true }, details: { type: String, default: null } },
                { _id: false }
            ),
            default: null,
        },

        teaming: {
            enabled: { type: Boolean, default: false },
            team_size_min: { type: Number, default: null, min: 1 },
            team_size_max: { type: Number, default: null, min: 1 },
            max_teams: { type: Number, default: null, min: 1 },
        },

        max_participants: { type: Number, default: null, min: 1 },
        resources: {
            type: [new Schema({ label: { type: String, required: true }, url: { type: String, required: true } }, { _id: false })],
            default: [],
        },

        submission: {
            requires_proof: { type: Boolean, default: true },
            proof_types: { type: [String], enum: PROOF_TYPE, default: () => [...MVP_PROOF_TYPES] },
            max_files: { type: Number, default: 5, min: 0 },
            auto_approve: { type: Boolean, default: false }, // trust-based digital challenges
        },

        status: { type: String, enum: CHALLENGE_STATUS, default: 'draft' },
        counts: {
            accepted: { type: Number, default: 0, min: 0 },
            submitted: { type: Number, default: 0, min: 0 },
            approved: { type: Number, default: 0, min: 0 },
        },

        created_by: { type: String, required: true },
        reviewers: { type: [String], default: [] }, // Core+ is always allowed on top of this list
        deleted_at: { type: Date, default: null },
    },
    timestamps
);

// challenge-model.md §2.2
ChallengeSchema.pre('validate', function (this: IChallenge) {
    const c = this;
    const fail = (msg: string): never => {
        throw new Error(`Challenge invariant: ${msg}`);
    };

    if (c.kind === 'physical' && c.location === null) return fail("a 'physical' challenge needs a location");

    const t = c.teaming;
    if (!t.enabled) {
        if (t.team_size_min !== null || t.team_size_max !== null || t.max_teams !== null) {
            return fail('non-teammable challenge must leave team_size_* and max_teams null');
        }
    } else if (!(t.team_size_min !== null && t.team_size_max !== null && t.team_size_min >= 1 && t.team_size_min <= t.team_size_max)) {
        return fail('teammable challenge needs 1 <= team_size_min <= team_size_max');
    }

    const w = c.window;
    const chain = [w.opens_at, w.closes_at, w.submissions_close_at].filter((d): d is Date => d != null);
    if (chain.some((d, i) => i > 0 && d < chain[i - 1])) {
        return fail('window dates must be ordered opens_at <= closes_at <= submissions_close_at');
    }

    const s = c.submission;
    if (!s.requires_proof && s.proof_types.length > 0) {
        return fail('proof_types must be empty when requires_proof is false');
    }
    if (s.auto_approve && !s.requires_proof) {
        return fail('auto_approve needs requires_proof: something must be submitted to approve');
    }
});

ChallengeSchema.index({ status: 1, domain: 1, difficulty: 1 }); // challenge browser filters
ChallengeSchema.index({ status: 1, 'window.closes_at': 1 }); // scheduler: complete expired
ChallengeSchema.index({ tags: 1, status: 1 });
ChallengeSchema.index({ created_by: 1 });
ChallengeSchema.index({ reviewers: 1 });

export const Challenge = model<IChallenge>('Challenge', ChallengeSchema, 'challenges');

/* ------------------------------------------------------------------ *
 * challenge_participations — the whole lifecycle in one document
 * ------------------------------------------------------------------ */

export const PARTICIPATION_STATUS = [
    'accepted', // also the "in progress" state; no separate start step
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'expired',
    'withdrawn',
] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUS)[number];

export interface IChallengeParticipation extends Document<string> {
    _id: string;
    challenge_id: string;
    challenge_snapshot: { title: string; difficulty: ChallengeDifficulty; award_points: number };

    participant: {
        type: 'user' | 'team';
        id: string;
        display_name: string;
        avatar_url: string | null;
    };
    member_user_ids: string[];

    status: ParticipationStatus;

    accepted_at: Date;
    deadline_at: Date | null;

    progress: {
        percent: number;
        steps: { key: string; label: string; done: boolean; done_at: Date | null }[];
        notes: string | null;
    };

    submission: {
        proofs: { type: ProofType; value: string; name: string | null; size_bytes: number | null; mime: string | null }[];
        notes: string | null;
        submitted_at: Date;
        version: number;
    } | null;

    review: {
        reviewer_user_id: string;
        decision: 'approved' | 'rejected';
        reason: string | null;
        reviewed_at: Date;
    } | null;

    reward: {
        points_awarded: number;
        point_transaction_ids: string[];
        hall_of_fame_entry_id: string | null;
    } | null;

    status_history: StatusHistoryItem[];
    created_at: Date;
    updated_at: Date;
}

const ChallengeParticipationSchema = new Schema<IChallengeParticipation>(
    {
        _id: uuidId,
        challenge_id: { type: String, required: true },
        // Historical: what the challenge was worth when accepted. Never refreshed.
        challenge_snapshot: {
            title: { type: String, required: true },
            difficulty: { type: String, enum: CHALLENGE_DIFFICULTY, required: true },
            award_points: { type: Number, required: true, min: 0 },
        },

        participant: {
            type: { type: String, enum: ['user', 'team'], required: true },
            id: { type: String, required: true },
            display_name: { type: String, required: true },
            avatar_url: { type: String, default: null },
        },
        // Team: all members at acceptance. User: [user_id]. Points fan out to exactly these.
        member_user_ids: { type: [String], required: true },

        status: { type: String, enum: PARTICIPATION_STATUS, default: 'accepted' },

        accepted_at: { type: Date, required: true, default: Date.now },
        // min(accepted_at + time_limit_minutes, window.submissions_close_at); null if neither is set.
        deadline_at: { type: Date, default: null },

        progress: {
            percent: { type: Number, default: 0, min: 0, max: 100 },
            steps: {
                type: [
                    new Schema(
                        {
                            key: { type: String, required: true },
                            label: { type: String, required: true },
                            done: { type: Boolean, default: false },
                            done_at: { type: Date, default: null },
                        },
                        { _id: false }
                    ),
                ],
                default: [],
            },
            notes: { type: String, default: null },
        },

        submission: {
            type: new Schema(
                {
                    proofs: {
                        type: [
                            new Schema(
                                {
                                    type: { type: String, enum: PROOF_TYPE, required: true },
                                    value: { type: String, required: true },
                                    name: { type: String, default: null },
                                    size_bytes: { type: Number, default: null, min: 0 },
                                    mime: { type: String, default: null },
                                },
                                { _id: false }
                            ),
                        ],
                        default: [],
                    },
                    notes: { type: String, default: null, maxlength: 500 },
                    submitted_at: { type: Date, required: true, default: Date.now },
                    version: { type: Number, default: 1, min: 1 }, // increments on re-submit while under_review
                },
                { _id: false }
            ),
            default: null,
        },

        review: {
            type: new Schema(
                {
                    reviewer_user_id: { type: String, required: true },
                    decision: { type: String, enum: ['approved', 'rejected'], required: true },
                    reason: { type: String, default: null },
                    reviewed_at: { type: Date, required: true, default: Date.now },
                },
                { _id: false }
            ),
            default: null,
        },

        reward: {
            type: new Schema(
                {
                    points_awarded: { type: Number, required: true, min: 0 },
                    point_transaction_ids: { type: [String], default: [] }, // one per member_user_id
                    hall_of_fame_entry_id: { type: String, default: null },
                },
                { _id: false }
            ),
            default: null,
        },

        status_history: { type: [StatusHistorySchema], default: [] },
    },
    timestamps
);

ChallengeParticipationSchema.pre('validate', function (this: IChallengeParticipation) {
    const p = this;
    const fail = (msg: string): never => {
        throw new Error(`ChallengeParticipation invariant: ${msg}`);
    };

    if (p.member_user_ids.length === 0) return fail('member_user_ids must not be empty');
    if (new Set(p.member_user_ids).size !== p.member_user_ids.length) return fail('member_user_ids must be unique');
    if (p.participant.type === 'user' && !(p.member_user_ids.length === 1 && p.member_user_ids[0] === p.participant.id)) {
        return fail('a solo participation must have exactly its own user id in member_user_ids');
    }
    if (p.status === 'approved' && p.submission === null && p.review === null) {
        return fail('an approved participation needs either a submission or a reviewer decision');
    }
    if (p.review && p.review.decision !== (p.status === 'approved' ? 'approved' : 'rejected') && ['approved', 'rejected'].includes(p.status)) {
        return fail('review.decision must match status');
    }
    if (p.reward && p.status !== 'approved') return fail('only an approved participation carries a reward');
});

ChallengeParticipationSchema.index({ challenge_id: 1, 'participant.id': 1 }, { unique: true });
ChallengeParticipationSchema.index({ member_user_ids: 1, status: 1, accepted_at: -1 }); // "my challenges", profile history
ChallengeParticipationSchema.index({ challenge_id: 1, status: 1, 'submission.submitted_at': 1 }); // reviewer queue
ChallengeParticipationSchema.index(
    { status: 1, deadline_at: 1 },
    { partialFilterExpression: { status: 'accepted' } } // expiry scheduler
);
ChallengeParticipationSchema.index({ 'review.reviewer_user_id': 1, 'review.reviewed_at': -1 }); // reviewer audit

export const ChallengeParticipation = model<IChallengeParticipation>(
    'ChallengeParticipation',
    ChallengeParticipationSchema,
    'challenge_participations'
);
