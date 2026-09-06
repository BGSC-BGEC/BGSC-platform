import { z } from 'zod';
import { UserRole, UserStatus } from '@bgsc/shared';

/**
 * Request schemas. Zod strips unknown keys, so these double as the sanitization layer: a client
 * cannot raise its own role or points_balance by adding the field to a profile PATCH.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_V4.test(v);

export const RefParams = z.object({
    ref: z.string().min(1).max(64),
});

export const UpdateProfileSchema = z
    .object({
        full_name: z.string().trim().min(1).max(120).optional(),
        bio: z.string().max(250).optional(),
        phone_number: z.string().trim().max(20).nullable().optional(),
        interests: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
        social_links: z
            .object({
                strava_id: z.string().trim().max(64).nullable().optional(),
                instagram: z.string().trim().max(64).nullable().optional(),
                linkedin: z.string().trim().max(128).nullable().optional(),
                steam_id: z.string().trim().max(64).nullable().optional(),
            })
            .optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });

export const UpdateSettingsSchema = z
    .object({
        notifications: z
            .object({ email: z.boolean().optional(), whatsapp: z.boolean().optional() })
            .optional(),
        privacy: z.object({ is_profile_public: z.boolean().optional() }).optional(),
        theme: z.enum(['light', 'dark', 'system']).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });

/**
 * Spec §5.15.5 requires Founder 2FA/TOTP to promote to coordinator, and 2FA is not built.
 * The enum simply does not contain those roles, so the request is rejected at the boundary
 * rather than reaching a handler that would have to remember to refuse it.
 */
export const ASSIGNABLE_ROLES = [UserRole.USER, UserRole.MEMBER, UserRole.CORE] as const;

export const ChangeRoleSchema = z.object({
    role: z.enum(ASSIGNABLE_ROLES),
    reason: z.string().trim().min(1).max(500),
});

export const CHANGEABLE_STATUSES = [UserStatus.ACTIVE, UserStatus.SUSPENDED] as const;

export const ChangeStatusSchema = z.object({
    status: z.enum(CHANGEABLE_STATUSES),
    reason: z.string().trim().min(1).max(500),
});

export const ListUsersQuery = z.object({
    role: z.enum(UserRole).optional(),
    status: z.enum(UserStatus).optional(),
    joined_after: z.coerce.date().optional(),
    joined_before: z.coerce.date().optional(),
    q: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    sort: z.enum(['created_at', 'last_active_at', 'points_balance']).default('created_at'),
});

export const SearchQuery = z.object({
    q: z.string().trim().min(1).max(80),
    limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const SnapshotQuery = z.object({
    // Comma-separated ids; capped so one call cannot ask for the whole user table.
    ids: z
        .string()
        .min(1)
        .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
        .refine((a) => a.length > 0 && a.length <= 100, { message: 'between 1 and 100 ids' }),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type ListUsersInput = z.infer<typeof ListUsersQuery>;

/**
 * Account deletion gate (Spec §11.2.1, decision D12).
 *
 * `confirm` must be the literal string DELETE — a typed confirmation, so a stray DELETE request
 * cannot remove an account. `research_consent` is opt-IN and defaults to false: retention is
 * universal either way, this flag records whether identifiable data may be USED for research.
 */
export const DeleteAccountSchema = z.object({
    confirm: z.literal('DELETE'),
    reason: z.string().trim().max(500).optional(),
    research_consent: z.boolean().default(false),
});

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;
