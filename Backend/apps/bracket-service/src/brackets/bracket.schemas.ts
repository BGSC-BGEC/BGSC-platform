import { BRACKET_SEEDING, MATCH_STATUS } from '@bgsc/shared';
import { z } from 'zod';

/**
 * Request schemas. Zod strips unknown keys, which is the sanitization half of the job: a client
 * cannot set `winner`, `status`, `advances_to` or `reported_by` by adding the field to a body —
 * every one of those is the server's (be2-feedback-bracket-plan.md §8).
 *
 * The format is deliberately NOT a parameter: it comes from `events.leaderboard.format`, which an
 * organiser already chose when they configured the event. Accepting it here would let a draw
 * disagree with the event that owns it.
 */

const Uuid = z.string().uuid();

export const GenerateBracketSchema = z.object({
    event_id: Uuid,
    seeding: z.enum(BRACKET_SEEDING).default('registration'),
    /** Required for `manual`, refused otherwise — checked in the service against the real field. */
    seeds: z.array(Uuid).min(2).max(256).optional(),
});

export const EventIdParams = z.object({ event_id: Uuid });
export const MatchIdParams = z.object({ id: Uuid });

export const ListMatchesQuery = z.object({
    event_id: Uuid,
    round: z.coerce.number().int().min(1).max(64).optional(),
    status: z.enum(MATCH_STATUS).optional(),
});

/**
 * A score is two non-negative integers. `status` is not a parameter: reporting a score IS
 * completing the match, and a body that could say `scheduled` while carrying a score would be two
 * sources of truth for one fact.
 */
export const ReportResultSchema = z.object({
    score_a: z.number().int().min(0).max(100000),
    score_b: z.number().int().min(0).max(100000),
});

export const ScheduleMatchSchema = z
    .object({
        scheduled_at: z.coerce.date().nullable().optional(),
        venue: z.string().trim().max(140).nullable().optional(),
    })
    .refine((v) => v.scheduled_at !== undefined || v.venue !== undefined, { message: 'no fields to update' });

export type GenerateBracketInput = z.infer<typeof GenerateBracketSchema>;
export type ListMatchesInput = z.infer<typeof ListMatchesQuery>;
export type ReportResultInput = z.infer<typeof ReportResultSchema>;
export type ScheduleMatchInput = z.infer<typeof ScheduleMatchSchema>;
