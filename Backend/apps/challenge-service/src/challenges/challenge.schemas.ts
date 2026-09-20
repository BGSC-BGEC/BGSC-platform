import {
    CHALLENGE_DIFFICULTY,
    CHALLENGE_DOMAIN,
    CHALLENGE_KIND,
    MVP_PROOF_TYPES,
    PARTICIPATION_STATUS,
} from '@bgsc/shared';
import { z } from 'zod';

/**
 * Request schemas. Zod strips unknown keys, which is the sanitization half of the job: a client
 * cannot set `status`, `counts`, `created_by` or `slug` by adding the field to a create body —
 * every one of those is the server's to decide (be2-challenge-service-plan.md §2.2).
 */

const Uuid = z.string().uuid();
/** Uncapped, one client asks for 100000 rows and the index stops protecting anything. */
const Limit = z.coerce.number().int().min(1).max(50).default(20);
const Cursor = z.string().max(400).optional();

/**
 * Proof types are restricted to what Media Service has not yet enabled (`MVP_PROOF_TYPES`,
 * Challenge.ts:25). The model's enum accepts 'image' and 'video'; accepting them here would store
 * a challenge whose submissions can never be satisfied, because nothing can upload a file until
 * Week 4 (challenge-model.md §6).
 */
const MvpProofType = z.enum(MVP_PROOF_TYPES as [string, ...string[]]);

const WindowBody = z
    .object({
        opens_at: z.coerce.date().nullable().default(null),
        closes_at: z.coerce.date().nullable().default(null),
        submissions_close_at: z.coerce.date().nullable().default(null),
        time_limit_minutes: z.number().int().min(1).max(525_600).nullable().default(null),
    })
    .default({ opens_at: null, closes_at: null, submissions_close_at: null, time_limit_minutes: null });

const TeamingBody = z
    .object({
        enabled: z.boolean().default(false),
        team_size_min: z.number().int().min(1).max(100).nullable().default(null),
        team_size_max: z.number().int().min(1).max(100).nullable().default(null),
        max_teams: z.number().int().min(1).max(1000).nullable().default(null),
    })
    .default({ enabled: false, team_size_min: null, team_size_max: null, max_teams: null });

const SubmissionBody = z
    .object({
        requires_proof: z.boolean().default(true),
        proof_types: z.array(MvpProofType).max(4).optional(),
        max_files: z.number().int().min(0).max(20).default(5),
        auto_approve: z.boolean().default(false),
    })
    .default({ requires_proof: true, max_files: 5, auto_approve: false });

const LocationBody = z
    .object({ name: z.string().trim().min(1).max(200), details: z.string().trim().max(1000).nullable().default(null) })
    .nullable()
    .default(null);

export const CreateChallengeBody = z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(20_000),
    brief_hidden_until_accept: z.boolean().default(false),
    cover_media_url: z.string().url().max(2000).nullable().default(null),

    domain: z.enum(CHALLENGE_DOMAIN),
    kind: z.enum(CHALLENGE_KIND),
    difficulty: z.enum(CHALLENGE_DIFFICULTY),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20).default([]),

    award_points: z.number().int().min(1).max(100_000),
    // Optional, not defaulted: `undefined` is what lets the service apply the Legend rule
    // (challenge-model.md §2.2) while `false` stays an explicit admin override (D2).
    grants_hall_of_fame: z.boolean().optional(),

    window: WindowBody,
    location: LocationBody,
    teaming: TeamingBody,
    max_participants: z.number().int().min(1).max(100_000).nullable().default(null),
    resources: z
        .array(z.object({ label: z.string().trim().min(1).max(120), url: z.string().url().max(2000) }))
        .max(20)
        .default([]),
    submission: SubmissionBody,
    reviewers: z.array(Uuid).max(50).default([]),
});

/**
 * Every field optional, but the same shapes — so a partial update cannot smuggle a half-built
 * `window` past the invariants. `status` is absent on purpose: it moves through the transition
 * routes, which are compare-and-swaps, never through a PATCH.
 */
export const UpdateChallengeBody = CreateChallengeBody.partial().refine(
    (b) => Object.keys(b).length > 0,
    'at least one field must be present'
);

export const ListChallengesQuery = z.object({
    status: z.enum(['draft', 'active', 'completed', 'archived']).default('active'),
    domain: z.enum(CHALLENGE_DOMAIN).optional(),
    difficulty: z.enum(CHALLENGE_DIFFICULTY).optional(),
    kind: z.enum(CHALLENGE_KIND).optional(),
    tag: z.string().trim().toLowerCase().min(1).max(40).optional(),
    q: z.string().trim().min(1).max(120).optional(),
    limit: Limit,
    cursor: Cursor,
});

export const MyParticipationsQuery = z.object({
    status: z.enum(PARTICIPATION_STATUS).optional(),
    limit: Limit,
    cursor: Cursor,
});

export const QueueQuery = z.object({
    status: z.enum(PARTICIPATION_STATUS).default('under_review'),
    limit: Limit,
    cursor: Cursor,
});

export const IdParams = z.object({ id: Uuid });
/** The detail route takes an id OR a slug, so it cannot be `.uuid()`. */
export const KeyParams = z.object({ key: z.string().trim().min(1).max(160) });

export const AcceptBody = z
    .object({ team_id: Uuid.optional() })
    .default({});

export const ProgressBody = z
    .object({
        percent: z.number().int().min(0).max(100).optional(),
        steps: z
            .array(
                z.object({
                    key: z.string().trim().min(1).max(40),
                    label: z.string().trim().min(1).max(200),
                    done: z.boolean().default(false),
                })
            )
            .max(50)
            .optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, 'at least one field must be present');

export const SubmitBody = z.object({
    proofs: z
        .array(
            z.object({
                type: MvpProofType,
                // A url proof and a text proof share one field; the service checks the shape per type.
                value: z.string().trim().min(1).max(5000),
                name: z.string().trim().max(200).nullable().default(null),
            })
        )
        .min(1)
        .max(20),
    notes: z.string().trim().max(500).nullable().default(null),
});

export const ReviewBody = z.object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(1000).nullable().default(null),
});

export const WithdrawBody = z
    .object({ reason: z.string().trim().max(1000).nullable().default(null) })
    .default({ reason: null });

export type CreateChallengeInput = z.infer<typeof CreateChallengeBody>;
export type UpdateChallengeInput = z.infer<typeof UpdateChallengeBody>;
export type ListChallengesInput = z.infer<typeof ListChallengesQuery>;
export type MyParticipationsInput = z.infer<typeof MyParticipationsQuery>;
export type QueueInput = z.infer<typeof QueueQuery>;
export type AcceptInput = z.infer<typeof AcceptBody>;
export type ProgressInput = z.infer<typeof ProgressBody>;
export type SubmitInput = z.infer<typeof SubmitBody>;
export type ReviewInput = z.infer<typeof ReviewBody>;
