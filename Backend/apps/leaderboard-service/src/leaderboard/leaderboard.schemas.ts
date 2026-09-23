import { z } from 'zod';

export const QueryGlobalLeaderboardSchema = z.object({
    period: z.enum(['all', 'semester', 'month', 'week']).default('all'),
    domain: z.enum(['all', 'sports', 'esports', 'fitness', 'general']).default('all'),
    source: z.enum(['all', 'challenge', 'event']).default('all').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).default(1),
});

export const EventRefParamSchema = z.object({
    ref: z.string().min(1),
});

export const QueryEventLeaderboardSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().optional(),
});

export const SubmitScoresSchema = z.object({
    scores: z
        .array(
            z.object({
                participant_id: z.string().min(1),
                raw: z.record(z.string(), z.union([z.number(), z.boolean()])),
            })
        )
        .min(1),
});

export const InvestPointsSchema = z.object({
    amount: z.number().int().min(10, 'minimum investment is 10 points'),
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
