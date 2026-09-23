import { LOT_STATUS } from '@bgsc/shared';
import { z } from 'zod';

export const EventRefParamSchema = z.object({
    ref: z.string().min(1, 'event_ref_required'),
});

export const LotIdParamSchema = z.object({
    id: z.string().min(1, 'lot_id_required'),
});

export const PlaceBidSchema = z.object({
    amount: z.number().int().positive('amount_must_be_positive'),
    version: z.number().int().nonnegative('version_must_be_nonnegative'),
});

export const CreateLotsSchema = z.object({
    lots: z
        .array(
            z.object({
                registration_id: z.string().min(1, 'registration_id_required'),
                user_id: z.string().min(1, 'user_id_required'),
                base_price: z.number().int().min(0, 'base_price_must_be_nonnegative'),
                oc_adjusted_price: z.number().int().min(0).optional().nullable(),
                order: z.number().int().min(0, 'order_must_be_nonnegative'),
            })
        )
        .min(1, 'at_least_one_lot_required')
        .refine(
            (lots) => {
                const orders = lots.map((l) => l.order);
                return orders.length === new Set(orders).size;
            },
            { message: 'lot orders must be unique within an event' }
        )
        .refine(
            (lots) => {
                const users = lots.map((l) => l.user_id);
                return users.length === new Set(users).size;
            },
            { message: 'each player can appear at most once in a lot batch' }
        ),
});

export const UpdateAuctionConfigSchema = z.object({
    k_multiplier: z.number().min(0).optional(),
    min_bid_increment: z.number().int().min(1).optional(),
    bid_timer_seconds: z.number().int().min(5).max(60).optional(),
    oc_override_quota: z.number().min(0).max(1).optional(),
    oc_captain_override_quota: z.number().min(0).max(1).optional(),
    purse_per_team: z.number().int().min(0).optional(),
});

export const OverrideCaptainBudgetSchema = z.object({
    purse_total: z.number().int().min(0, 'purse_total_must_be_nonnegative'),
    reason: z.string().max(200).optional(),
});
export type OverrideCaptainBudgetInput = z.infer<typeof OverrideCaptainBudgetSchema>;

export const TeamIdParamSchema = z.object({
    ref: z.string().min(1, 'event_ref_required'),
    teamId: z.string().min(1, 'team_id_required'),
});

export const OverridePriceSchema = z.object({
    oc_adjusted_price: z.number().int().min(0, 'oc_adjusted_price_must_be_nonnegative'),
});

export const QueryLotsSchema = z.object({
    status: z.enum(LOT_STATUS).optional(),
});

export type PlaceBidInput = z.infer<typeof PlaceBidSchema>;
export type CreateLotsInput = z.infer<typeof CreateLotsSchema>;
export type UpdateAuctionConfigInput = z.infer<typeof UpdateAuctionConfigSchema>;
export type OverridePriceInput = z.infer<typeof OverridePriceSchema>;
export type QueryLotsInput = z.infer<typeof QueryLotsSchema>;
