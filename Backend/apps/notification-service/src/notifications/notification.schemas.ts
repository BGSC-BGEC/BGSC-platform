import { NOTIFICATION_CATEGORY } from '@bgsc/shared';
import { z } from 'zod';

/**
 * Request schemas. Zod strips unknown keys, which is the sanitization half of the job: a client
 * cannot set `user_id`, `read_at` or `dedupe_key` by adding the field to a body — every one of
 * those is the server's.
 */

/** Uncapped, one client asks for 100000 rows and the index stops protecting anything. */
const Limit = z.coerce.number().int().min(1).max(50).default(20);

/**
 * `z.coerce.boolean()` is NOT usable here: it follows JavaScript truthiness, so the string
 * "false" coerces to `true` and `?unread=false` would filter to unread only — the exact opposite
 * of what was asked. An explicit enum is the only safe spelling for a boolean in a query string.
 */
const QueryBoolean = z.enum(['true', 'false']).transform((v) => v === 'true');

export const ListNotificationsQuery = z.object({
    unread: QueryBoolean.optional(),
    category: z.enum(NOTIFICATION_CATEGORY).optional(),
    limit: Limit,
    cursor: z.string().max(400).optional(),
});

export const IdParams = z.object({ id: z.string().uuid() });

/**
 * Preference patch. Only leaf booleans, and only for categories that exist — a merge-update, so an
 * absent key is "leave it alone" rather than "set it false".
 *
 * `_id` is never in the body: it is the caller's own id, taken from the token. A preferences route
 * that accepted a user id would let anyone mute anyone.
 */
export const UpdatePreferencesSchema = z
    .object({
        in_app: z
            .object(
                Object.fromEntries(NOTIFICATION_CATEGORY.map((c) => [c, z.boolean().optional()])) as Record<
                    (typeof NOTIFICATION_CATEGORY)[number],
                    z.ZodOptional<z.ZodBoolean>
                >
            )
            .optional(),
    })
    .refine(
        (v) => v.in_app !== undefined && Object.keys(v.in_app).length > 0,
        { message: 'no fields to update' }
    );

export type ListNotificationsInput = z.infer<typeof ListNotificationsQuery>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
