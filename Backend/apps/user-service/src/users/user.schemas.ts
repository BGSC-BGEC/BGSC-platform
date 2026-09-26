import { z } from 'zod';
import { UserRole, UserStatus, phoneNumberSchema } from '@bgsc/shared';

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
        // E.164 after stripping separators, the same rule Auth's OTP flow applies: one number, one
        // spelling, or the verified-number index would see `+91 98765-43210` as a different number.
        phone_number: phoneNumberSchema.nullable().optional(),
        interests: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
        social_links: z
            .object({
                // `strava_id` is deliberately NOT here. It records a *verified* OAuth connection and
                // is written by the Challenge Service's Strava flow (strava.service.ts), which also
                // clears it on disconnect. Accepting it from a profile PATCH gave the field two
                // writers with different standards of proof — anyone could paste an athlete id and
                // wear the badge. The other three are self-declared handles that nothing verifies,
                // so they stay editable.
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

const DAY_MS = 24 * 60 * 60 * 1000;
/** An ISO timestamp or a bare `YYYY-MM-DD` (UTC). `z.coerce.date()` also took `true` and `0`. */
const isoDate = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

export const ListUsersQuery = z.object({
    role: z.enum(UserRole).optional(),
    status: z.enum(UserStatus).optional(),
    joined_after: isoDate.transform((s) => new Date(s)).optional(),
    /**
     * Exclusive upper bound. A bare date means "up to and including that day", so it becomes the
     * next midnight (UTC) — as `$lte` on that day's midnight it silently excluded the day named.
     */
    joined_before: isoDate
        .transform((s) => (s.length === 10 ? new Date(Date.parse(s) + DAY_MS) : new Date(s)))
        .optional(),
    q: z.string().trim().min(1).max(80).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().optional(),
    sort: z.enum(['created_at', 'last_active_at', 'points_balance']).default('created_at'),
});

export const SearchQuery = z.object({
    q: z.string().trim().min(1).max(80),
    limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type ListUsersInput = z.infer<typeof ListUsersQuery>;

/**
 * Account deletion gate (Spec §11.2.1).
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
