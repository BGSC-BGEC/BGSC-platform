import { POINTS_SOURCE, POINTS_TYPE } from '@bgsc/shared';
import { z } from 'zod';

/**
 * Request schemas. Zod strips unknown keys, which is the sanitization half of the job: a client
 * cannot set `type`, `balance_after` or `idempotency_key` by adding the field to an adjust body —
 * every one of those is the server's to decide.
 */

const UserId = z.string().uuid();

/** Uncapped, one client asks for 100000 rows and the index stops protecting anything. */
const Limit = z.coerce.number().int().min(1).max(50).default(20);

export const HistoryQuery = z.object({
    type: z.enum(POINTS_TYPE).optional(),
    source: z.enum(POINTS_SOURCE).optional(),
    limit: Limit,
    cursor: z.string().max(400).optional(),
});

export const EventLedgerQuery = z.object({
    limit: Limit,
    cursor: z.string().max(400).optional(),
});

export const UserIdParams = z.object({ id: UserId });
export const EventIdParams = z.object({ eventId: z.string().uuid() });
export const TransactionIdParams = z.object({ id: z.string().uuid() });
/** A rule id is its reason key ('event.participation'), not a uuid — same pattern as the model. */
export const RuleIdParams = z.object({ id: z.string().regex(/^[a-z][a-z0-9_.]{0,63}$/) });

/**
 * The bound on a manual adjustment. Not a policy about how many points anything is worth — a guard
 * against a fat-fingered extra zero, which on an append-only ledger is corrected by a second row
 * rather than undone.
 */
const ADJUST_LIMIT = 100_000;

export const AdjustBody = z.object({
    user_id: UserId,
    // Signed and non-zero: positive grants, negative claws back. The one route where the client
    // chooses the sign.
    amount: z.number().int().refine((n) => n !== 0, 'amount must not be zero').refine(
        (n) => Math.abs(n) <= ADJUST_LIMIT,
        `amount must be within +/-${ADJUST_LIMIT}`
    ),
    // Spec §5.15.5 wants a justification on operational overrides; the audit row carries it.
    note: z.string().trim().min(3).max(500),
    // Stable across a retry — it is the idempotency key. A fresh uuid is a second adjustment.
    request_id: UserId,
});

export const AwardBody = z.object({
    user_id: UserId,
    event_id: z.string().uuid(),
    // Only places the event pays and the rule table knows (1-3 seeded) are accepted; the service
    // re-checks against the event's own multipliers.
    place: z.coerce.number().int().min(1).max(3),
});

export const SpendBody = z.object({
    user_id: UserId,
    // Positive magnitude only. The route debits; a signed amount here would be a second sign rule.
    amount: z.number().int().min(1).max(ADJUST_LIMIT),
    reference: z.object({
        type: z.literal('leaderboard_entry'),
        id: z.string().uuid(),
    }),
    request_id: UserId,
});

export const RulePatchBody = z
    .object({
        // Never negative: a rule states a magnitude and the transaction type carries the sign.
        // A negative default on a credit rule resolves to a negative `earn`, which
        // `assertRecordable` refuses inside a consumer where nobody is listening — points silently
        // stop being awarded. Every seeded rule is >= 0; debits get their sign from `signed()`.
        default_amount: z.number().int().min(0).max(10_000).optional(),
        enabled: z.boolean().optional(),
        expires_after_days: z.number().int().min(1).max(3650).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, 'at least one field must be present');

export const RefundBody = z.object({
    user_id: UserId,
    // Optional and only cross-checked: the refund is always exactly what the spend took.
    amount: z.number().int().min(1).max(ADJUST_LIMIT).optional(),
    reference: z.object({
        type: z.literal('leaderboard_entry'),
        id: z.string().uuid(),
    }),
    request_id: UserId,
});

export type HistoryQueryInput = z.infer<typeof HistoryQuery>;
export type EventLedgerQueryInput = z.infer<typeof EventLedgerQuery>;
export type AdjustBodyInput = z.infer<typeof AdjustBody>;
export type AwardBodyInput = z.infer<typeof AwardBody>;
export type SpendBodyInput = z.infer<typeof SpendBody>;
export type RefundBodyInput = z.infer<typeof RefundBody>;
export type RulePatchBodyInput = z.infer<typeof RulePatchBody>;
