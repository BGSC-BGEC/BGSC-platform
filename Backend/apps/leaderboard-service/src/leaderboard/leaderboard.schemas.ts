import { z } from 'zod';

export const QueryGlobalLeaderboardSchema = z.object({
    period: z.enum(['all', 'semester', 'month', 'week']).default('all'),
    // The union of event domains and challenge domains: the board spans both.
    domain: z.enum(['all', 'sports', 'esports', 'fitness', 'dev', 'general']).default('all'),
    source: z.enum(['all', 'challenge', 'event']).default('all').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).default(1),
});

export const EventRefParamSchema = z.object({
    ref: z.string().min(1).max(260),
});

export const QueryEventLeaderboardSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().max(64).optional(),
});

export const SubmitScoresSchema = z.object({
    scores: z
        .array(
            z.object({
                participant_id: z.string().min(1).max(64),
                raw: z
                    .record(z.string().max(64), z.union([z.number().finite(), z.boolean()]))
                    .refine((r) => Object.keys(r).length <= 50, 'at most 50 parameters'),
            })
        )
        .min(1)
        .max(500),
});

export const InvestPointsSchema = z.object({
    amount: z.number().int().min(10, 'minimum investment is 10 points').max(100_000),
    // Idempotency key: send the same one on a retry (or use the Idempotency-Key header).
    request_id: z.string().uuid().optional(),
});

export const ProjectInvestmentSchema = z.object({
    amount: z.coerce.number().int().min(1),
});

export type QueryGlobalLeaderboardInput = z.infer<typeof QueryGlobalLeaderboardSchema>;
export type EventRefParamInput = z.infer<typeof EventRefParamSchema>;
export type QueryEventLeaderboardInput = z.infer<typeof QueryEventLeaderboardSchema>;
export type SubmitScoresInput = z.infer<typeof SubmitScoresSchema>;
export type InvestPointsInput = z.infer<typeof InvestPointsSchema>;
export type ProjectInvestmentInput = z.infer<typeof ProjectInvestmentSchema>;
