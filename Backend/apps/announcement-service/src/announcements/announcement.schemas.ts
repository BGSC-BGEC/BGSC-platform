import { ANNOUNCEMENT_CATEGORY, ANNOUNCEMENT_PRIORITY, ANNOUNCEMENT_STATUS, ROLE_RANK } from '@bgsc/shared';
import { z } from 'zod';

/**
 * Request schemas. Zod strips unknown keys, so these double as the sanitization layer: a client
 * cannot set `status`, `published_at` or `delivery` by adding the field to a PATCH body.
 *
 * Three of these rules are load-bearing beyond length caps — see be2-announcement-service-plan.md §4.5.
 */

/**
 * `media_url` is rendered by the client, so an unconstrained string here is a stored-XSS vector
 * wearing a convenience hat: `javascript:` and `data:text/html` both round-trip through a plain
 * `z.string()`. Only an http(s) URL or a path this platform itself serves is accepted.
 *
 * SVG is refused by its path's extension, read from the parsed URL so `?x` or `#x` on the end cannot
 * hide it. That is a courtesy, not the defence — an extensionless URL can still serve SVG. The
 * defence is the client rendering `media_url` through <img>, which never executes script, and never
 * through <object>/<embed>/<iframe>.
 */
function isAcceptableMediaUrl(v: string): boolean {
    let path: string;
    if (v.startsWith('/')) {
        if (!/^\/uploads\/[\w./-]+$/.test(v) || v.split('/').includes('..')) return false;
        path = v;
    } else {
        try {
            const u = new URL(v);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
            path = u.pathname;
        } catch {
            return false;
        }
    }
    return !/\.svgz?$/i.test(path);
}

const MediaUrl = z
    .string()
    .trim()
    .max(500)
    .refine(isAcceptableMediaUrl, 'media_url must be an http(s) URL or an /uploads path, and must not be SVG');

/**
 * Zod has no `.unique()`. Without this refine a duplicated category reaches the model's invariant
 * hook, which throws a plain Error — so the client gets a 500 where it earned a 422.
 */
const Categories = z
    .array(z.enum(ANNOUNCEMENT_CATEGORY))
    .min(1)
    .max(ANNOUNCEMENT_CATEGORY.length)
    .refine((v) => new Set(v).size === v.length, 'categories must be unique');

const AudienceSchema = z.object({
    // The model raises this to `core` on its own when 'teams' is present; an admin may only ever
    // raise it further (announcement-model.md §2.1).
    min_role: z.enum(ROLE_RANK).optional(),
    event_id: z.string().uuid().nullable().optional(),
});

const Tags = z.array(z.string().trim().min(1).max(40)).max(20);

export const CreateAnnouncementSchema = z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(5000),
    media_url: MediaUrl.nullable().optional(),
    categories: Categories,
    tags: Tags.optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITY).optional(),
    audience: AudienceSchema.optional(),
    pinned_until: z.coerce.date().nullable().optional(),
});

export const UpdateAnnouncementSchema = z
    .object({
        title: z.string().trim().min(1).max(120).optional(),
        body: z.string().trim().min(1).max(5000).optional(),
        media_url: MediaUrl.nullable().optional(),
        // Refused by the service once the announcement has left `draft` (§4.3) — the WhatsApp
        // fan-out has already gone out against these two.
        categories: Categories.optional(),
        audience: AudienceSchema.optional(),
        tags: Tags.optional(),
        priority: z.enum(ANNOUNCEMENT_PRIORITY).optional(),
        pinned_until: z.coerce.date().nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });

/** Send Now is this body empty; Schedule for Later is the same route with a date (§D4). */
export const PublishAnnouncementSchema = z.object({
    scheduled_for: z.coerce.date().optional(),
});

export const ListAnnouncementsQuery = z.object({
    category: z.enum(ANNOUNCEMENT_CATEGORY).optional(),
    priority: z.enum(ANNOUNCEMENT_PRIORITY).optional(),
    event_id: z.string().uuid().optional(),
    author_id: z.string().uuid().optional(),
    q: z.string().trim().min(1).max(100).optional(),
    // Not z.coerce.boolean(): that maps the string "false" to true, because every non-empty
    // string is truthy. The query string only ever carries these two words.
    pinned: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => v === 'true'),
    // Honoured only for core+; everyone else is pinned to 'published' in the service (§3.5).
    status: z.enum(ANNOUNCEMENT_STATUS).optional(),
    // Capped: uncapped, one client asks for 100000 and the 4-month window protects nothing.
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(500).optional(),
});

export const IdParams = z.object({ id: z.string().uuid() });

export type CreateAnnouncementInput = z.infer<typeof CreateAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof UpdateAnnouncementSchema>;
export type PublishAnnouncementInput = z.infer<typeof PublishAnnouncementSchema>;
export type ListAnnouncementsInput = z.infer<typeof ListAnnouncementsQuery>;
