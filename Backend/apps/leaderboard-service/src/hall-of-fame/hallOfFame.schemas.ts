import { z } from 'zod';
import { HALL_OF_FAME_CATEGORY } from '@bgsc/shared';

export const HallOfFameQuerySchema = z.object({
    category: z.enum(HALL_OF_FAME_CATEGORY as any).optional(),
    year: z.coerce.number().int().optional(),
    featured: z.preprocess((val) => val === 'true', z.boolean()).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).default(1),
});

const HonoreeSchema = z.object({
    type: z.enum(['user', 'team']),
    id: z.string().uuid(),
    display_name: z.string().min(1),
    avatar_url: z.string().url().nullable().optional(),
});

const MemberSchema = z.object({
    user_id: z.string().uuid(),
    display_name: z.string().min(1),
    avatar_url: z.string().url().nullable().optional(),
});

const SourceSchema = z.object({
    type: z.enum(['event', 'challenge', 'manual']),
    id: z.string().uuid().nullable().optional(),
    title: z.string().nullable().optional(),
});

const AchievementSchema = z.object({
    domain: z.string().optional(),
    season: z.string().optional(),
    year: z.number().int(),
    difficulty: z.string().optional(),
    award_points: z.number().int().optional(),
});

export const CreateHallOfFameEntrySchema = z.object({
    category: z.enum(HALL_OF_FAME_CATEGORY as any),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    quote: z.string().nullable().optional(),
    honoree: HonoreeSchema,
    members: z.array(MemberSchema).optional(),
    source: SourceSchema,
    achievement: AchievementSchema,
    media_url: z.string().url().nullable().optional(),
    cover_url: z.string().url().nullable().optional(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().optional(),
    featured_order: z.number().int().nullable().optional(),
});

export const UpdateHallOfFameEntrySchema = CreateHallOfFameEntrySchema.partial();

export const HallOfFameIdParamSchema = z.object({
    id: z.string().uuid(),
});

export const HallOfFameSlugOrIdParamSchema = z.object({
    slugOrId: z.string().min(1),
});
