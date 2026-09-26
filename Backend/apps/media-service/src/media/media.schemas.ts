import { z } from 'zod';
import { MEDIA_CATEGORIES, MEDIA_TYPES, MEDIA_STATUSES } from '@bgsc/shared';

/**
 * Request schemas, applied by `validate()` in the routes — a failure is a 422 envelope, never the
 * 500 an escaped `.parse()` used to be.
 *
 * Ids that land in a storage path or a query are uuids: `event_id` went straight into the upload
 * directory name, so `../` in it was a traversal attempt and `a/b/c` made directories.
 */

const Uuid = z.string().uuid();

/** Twenty tags of forty characters: a gallery filter, not a place to store an essay. */
const Tag = z.string().trim().toLowerCase().min(1).max(40);
const Tags = z.array(Tag).max(20);

const Page = z.coerce.number().int().min(1).max(10_000).default(1);
const Limit = z.coerce.number().int().min(1).max(50).default(20);

export const UploadMediaQuerySchema = z.object({
    category: z.enum(MEDIA_CATEGORIES).default('general'),
    event_id: Uuid.optional(),
    album_id: Uuid.optional(),
    caption: z.string().trim().max(500).optional(),
    // A query string carries tags as `a,b,c`; a repeated key arrives as an array.
    tags: z
        .union([z.string().transform((val) => val.split(',').filter((s) => s.trim())), z.array(z.string())])
        .pipe(Tags)
        .optional(),
    filename: z.string().trim().max(255).optional(),
});
export type UploadMediaQuery = z.infer<typeof UploadMediaQuerySchema>;

export const ListMediaQuerySchema = z.object({
    category: z.enum(MEDIA_CATEGORIES).optional(),
    event_id: Uuid.optional(),
    tag: Tag.optional(),
    media_type: z.enum(MEDIA_TYPES).optional(),
    status: z.enum(MEDIA_STATUSES).optional(),
    album_id: Uuid.optional(),
    page: Page,
    limit: Limit,
});
export type ListMediaQuery = z.infer<typeof ListMediaQuerySchema>;

export const ListAlbumsQuerySchema = z.object({
    category: z.enum(MEDIA_CATEGORIES).optional(),
    event_id: Uuid.optional(),
    page: Page,
    limit: Limit,
});
export type ListAlbumsQuery = z.infer<typeof ListAlbumsQuerySchema>;

export const PageQuerySchema = z.object({ page: Page, limit: Limit });
export type PageQuery = z.infer<typeof PageQuerySchema>;

export const CreateAlbumSchema = z.object({
    title: z.string().trim().min(1, 'title_required').max(120),
    slug: z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'invalid_slug_format').optional(),
    description: z.string().max(1000).optional(),
    category: z.enum(MEDIA_CATEGORIES).default('general'),
    cover_media_id: Uuid.optional(),
    event_id: Uuid.optional(),
    is_public: z.boolean().default(true),
});
export type CreateAlbumInput = z.input<typeof CreateAlbumSchema>;

export const UpdateMediaSchema = z.object({
    caption: z.string().trim().max(500).optional(),
    tags: Tags.optional(),
});
export type UpdateMediaInput = z.infer<typeof UpdateMediaSchema>;

export const ModerateMediaSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    rejection_reason: z.string().trim().max(300).optional(),
});
export type ModerateMediaInput = z.infer<typeof ModerateMediaSchema>;

export const MediaIdParams = z.object({ id: Uuid });

/** An album is addressed by id or by slug. */
export const AlbumRefParams = z.object({ id: z.string().trim().min(1).max(160) });
