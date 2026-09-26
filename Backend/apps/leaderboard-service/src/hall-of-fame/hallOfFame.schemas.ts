import { z } from 'zod';
import { HALL_OF_FAME_CATEGORY } from '@bgsc/shared';

/**
 * Every string is bounded, and every link is either http(s) or one of our own `/uploads/` paths:
 * `z.string().url()` accepted `javascript:` and `data:` (rendered as an <a href> or <img src>), and
 * refused the relative `/uploads/...` URLs media-service actually hands out.
 */
const Link = z
    .string()
    .trim()
    .max(2048)
    .regex(/^(https?:\/\/[^\s]+|\/uploads\/[^\s]+)$/i, 'must be an http(s) URL or an /uploads/ path');

const Text = (max: number) => z.string().trim().max(max);

export const HallOfFameQuerySchema = z.object({
    category: z.enum(HALL_OF_FAME_CATEGORY as any).optional(),
    year: z.coerce.number().int().min(1900).max(2100).optional(),
    domain: Text(40).optional(),
    // Title or honoree name, literal substring.
    search: Text(64).optional(),
    featured: z.preprocess((val) => val === 'true', z.boolean()).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
});

const HonoreeSchema = z.object({
    type: z.enum(['user', 'team']),
    id: z.string().uuid(),
    display_name: Text(120).min(1),
    avatar_url: Link.nullable().optional(),
});

const MemberSchema = z.object({
    user_id: z.string().uuid(),
    display_name: Text(120).min(1),
    avatar_url: Link.nullable().optional(),
});

const SourceSchema = z.object({
    type: z.enum(['event', 'challenge', 'manual']),
    id: z.string().uuid().nullable().optional(),
    title: Text(200).nullable().optional(),
});

const AchievementSchema = z.object({
    domain: Text(40).optional(),
    season: Text(40).optional(),
    year: z.number().int().min(1900).max(2100),
    difficulty: Text(40).optional(),
    award_points: z.number().int().min(0).max(1_000_000).optional(),
});

const fields = {
    category: z.enum(HALL_OF_FAME_CATEGORY as any),
    title: Text(200).min(1),
    description: Text(2000).nullable().optional(),
    quote: Text(500).nullable().optional(),
    honoree: HonoreeSchema,
    members: z.array(MemberSchema).max(50).optional(),
    source: SourceSchema,
    achievement: AchievementSchema,
    media_url: Link.nullable().optional(),
    cover_url: Link.nullable().optional(),
    tags: z.array(Text(40).min(1)).max(20).optional(),
    featured: z.boolean().optional(),
    featured_order: z.number().int().min(0).max(1000).nullable().optional(),
};

export const CreateHallOfFameEntrySchema = z.object(fields);

/**
 * A PATCH names only what changes, down to the nested groups: `{ achievement: { season } }` edits
 * the season and keeps the year. (The service merges; the snapshot's `deleted` flag is never
 * accepted from a body.)
 */
export const UpdateHallOfFameEntrySchema = z.object({
    ...fields,
    honoree: HonoreeSchema.partial(),
    source: SourceSchema.partial(),
    achievement: AchievementSchema.partial(),
}).partial();

export const HallOfFameIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const HallOfFameSlugOrIdParamSchema = z.object({
    slugOrId: z.string().min(1).max(260),
});
