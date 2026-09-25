import { z } from 'zod';
import { MEDIA_CATEGORIES, MEDIA_TYPES, MEDIA_STATUSES } from '@bgsc/shared';

export const UploadMediaQuerySchema = z.object({
    category: z.enum(MEDIA_CATEGORIES).default('general'),
    event_id: z.string().trim().optional(),
    album_id: z.string().trim().optional(),
    caption: z.string().max(500).optional(),
    tags: z
        .union([
            z.string().transform((val) =>
                val
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean)
            ),
            z.array(z.string().trim().toLowerCase()),
        ])
        .optional(),
    filename: z.string().optional(),
});
export type UploadMediaQuery = z.infer<typeof UploadMediaQuerySchema>;

export const ListMediaQuerySchema = z.object({
    category: z.enum(MEDIA_CATEGORIES).optional(),
    event_id: z.string().trim().optional(),
    tag: z.string().trim().toLowerCase().optional(),
    media_type: z.enum(MEDIA_TYPES).optional(),
    status: z.enum(MEDIA_STATUSES).optional(),
    album_id: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListMediaQuery = z.infer<typeof ListMediaQuerySchema>;

export const CreateAlbumSchema = z.object({
    title: z.string().min(1, 'title_required').max(120),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'invalid_slug_format').optional(),
    description: z.string().max(1000).optional(),
    category: z.enum(MEDIA_CATEGORIES).default('general'),
    cover_media_id: z.string().optional(),
    event_id: z.string().optional(),
    is_public: z.boolean().default(true),
});
export type CreateAlbumInput = z.input<typeof CreateAlbumSchema>;

export const UpdateMediaSchema = z.object({
    caption: z.string().max(500).optional(),
    tags: z.array(z.string().trim().toLowerCase()).optional(),
});
export type UpdateMediaInput = z.infer<typeof UpdateMediaSchema>;

export const ModerateMediaSchema = z.object({
    status: z.enum(['approved', 'rejected']),
    rejection_reason: z.string().max(300).optional(),
});
export type ModerateMediaInput = z.infer<typeof ModerateMediaSchema>;

export const IdParamSchema = z.object({
    id: z.string().min(1, 'id_required'),
});
