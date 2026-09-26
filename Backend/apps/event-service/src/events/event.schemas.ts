import { z } from 'zod';
import {
    EVENT_CATEGORY,
    EVENT_TYPE,
    EVENT_DOMAIN,
    EVENT_STATUS,
    EVENT_VISIBILITY,
    LEADERBOARD_FORMAT,
    OC_OVERRIDE_QUOTA_MAX,
    SCORING_KIND,
} from '@bgsc/shared';

const dateCoerce = z.preprocess((val) => {
    if (typeof val === 'string' || val instanceof Date) return new Date(val);
    return val;
}, z.date());

/** A query-string date. Invalid input is a 422 here, not a CastError (500) inside the query. */
const queryDate = z
    .string()
    .max(40)
    .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid_date')
    .transform((s) => new Date(s));

/**
 * A link a client renders: http(s), or one of our own `/uploads/...` files. `javascript:` and
 * `data:` URLs were accepted and handed to every browser that opened the event (audit #2).
 */
const safeUrl = z
    .string()
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u) || u.startsWith('/uploads/'), 'must_be_http_or_uploads');

export const ScoringParamSchema = z.object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, 'Invalid scoring param key'),
    label: z.string().min(1).max(50),
    kind: z.enum(SCORING_KIND),
    weight: z.number().default(1),
});

export const ContactSchema = z.object({
    user_id: z.string(),
    display_name: z.string().min(1).max(100),
    role_label: z.string().min(1).max(50),
    contact: z.string().nullable().default(null),
});

export const AwardSchema = z.object({
    place: z.number().int().min(1),
    title: z.string().min(1).max(100),
    description: z.string().nullable().default(null),
});

/** Auction macro variables at creation. `status` is not an input: every auction starts `not_started`. */
export const AuctionConfigSchema = z.object({
    k_multiplier: z.number().positive().default(1.0),
    min_bid_increment: z.number().int().positive().default(100),
    bid_timer_seconds: z.number().int().min(5).max(60).default(5),
    oc_override_quota: z.number().min(0).max(OC_OVERRIDE_QUOTA_MAX).default(OC_OVERRIDE_QUOTA_MAX),
    oc_captain_override_quota: z.number().min(0).max(1).default(OC_OVERRIDE_QUOTA_MAX),
    captain_user_ids: z.array(z.string().min(1)).max(64).default([]),
    purse_per_team: z.number().int().min(0).nullable().default(null),
});

export const CreateEventSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(10000).default(''),
    category: z.enum(EVENT_CATEGORY),
    type: z.enum(EVENT_TYPE).default('LE'),
    domain: z.enum(EVENT_DOMAIN).default('sports'),
    tags: z.array(z.string().toLowerCase().max(50)).max(20).default([]),

    status: z.enum(['draft', 'upcoming']).default('draft'),
    visibility: z.enum(EVENT_VISIBILITY).default('public'),

    start_at: dateCoerce,
    end_at: dateCoerce,
    venue: z.string().nullable().default(null),
    timezone: z.string().default('Asia/Kolkata'),

    registration: z.object({
        opens_at: dateCoerce.nullable().default(null),
        closes_at: dateCoerce,
        roster_finalizes_at: dateCoerce.nullable().default(null),
        form_id: z.string().nullable().default(null),
        max_participants: z.number().int().positive().nullable().default(null),
        waitlist_enabled: z.boolean().default(false),
        requires_approval: z.boolean().default(false),
    }),

    teaming: z.object({
        is_teamed: z.boolean().default(false),
        team_size_min: z.number().int().positive().nullable().default(null),
        team_size_max: z.number().int().positive().nullable().default(null),
        max_teams: z.number().int().positive().nullable().default(null),
        captain_application_required: z.boolean().default(false),
    }).default({ is_teamed: false, team_size_min: null, team_size_max: null, max_teams: null, captain_application_required: false }),

    rules_pdf_url: safeUrl.nullable().default(null),
    rules_summary: z.string().nullable().default(null),
    awards: z.array(AwardSchema).max(50).default([]),
    contacts: z.array(ContactSchema).max(20).default([]),
    core_admins: z.array(z.string().min(1)).max(20).default([]),

    points_pool: z.object({
        participation: z.number().nonnegative().default(10),
        podium_multipliers: z.array(z.number().positive()).default([3, 2, 1.5]),
        sponsor_bonus: z.number().nonnegative().default(0),
        investment_enabled: z.boolean().default(false),
        investment_cap: z.number().positive().nullable().default(null),
    }).default({ participation: 10, podium_multipliers: [3, 2, 1.5], sponsor_bonus: 0, investment_enabled: false, investment_cap: null }),

    scoring: z.object({
        parameters: z.array(ScoringParamSchema).max(32).default([]),
        normalization: z.object({
            lower: z.number().min(0).max(1000).default(0),
            upper: z.number().min(1).max(1000).default(1000),
        }).default({ lower: 0, upper: 1000 }),
    }).default({ parameters: [], normalization: { lower: 0, upper: 1000 } }),

    leaderboard: z.object({
        format: z.enum(LEADERBOARD_FORMAT).default('points_table'),
        elim_after_n: z.number().int().positive().nullable().default(null),
        min_participants: z.number().int().positive().default(2),
    }).nullable().default(null),

    auction: AuctionConfigSchema.nullable().default(null),
});

/**
 * The same shape with every default stripped and every key optional, recursing into nested objects.
 *
 * `CreateEventSchema.partial()` was the update schema, and under zod 4 a defaulted key inside
 * `.partial()` still fills its default: `PATCH { title }` came out carrying `type:'LE'`,
 * `auction:null`, `core_admins:[]`, … and `Object.assign` wrote all of it onto the event (audit
 * Sep 26, C2). A patch must describe exactly what the client sent. Arrays are left alone — they are
 * replaced whole, so their element defaults are wanted.
 */
export function patchOf(schema: z.ZodType): z.ZodType {
    if (schema instanceof z.ZodDefault) return patchOf(schema.unwrap() as z.ZodType);
    if (schema instanceof z.ZodOptional) return patchOf(schema.unwrap() as z.ZodType);
    if (schema instanceof z.ZodNullable) return patchOf(schema.unwrap() as z.ZodType).nullable();
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape as Record<string, z.ZodType>;
        return z.object(Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, patchOf(v).optional()])));
    }
    return schema;
}

/**
 * `type` is fixed at creation: changing it re-shapes leaderboard, auction and registrations under
 * a live event, so a wrong type is fixed by deleting the draft. `auction` has its own endpoints with
 * lifecycle rules (`/auction/events/:ref/config`, captains), which PATCH used to bypass wholesale.
 * `status` moves through the transition map in event.service.ts, not by assignment.
 */
export const UpdateEventSchema = (patchOf(CreateEventSchema.omit({ type: true, auction: true, status: true })) as z.ZodObject).extend({
    status: z.enum(EVENT_STATUS).optional(),
});

export const QueryEventsSchema = z.object({
    category: z.string().max(200).optional(),
    status: z.string().max(200).optional(),
    domain: z.string().max(50).optional(),
    type: z.string().max(10).optional(),
    tags: z.string().max(500).optional(),
    search: z.string().max(100).optional(),
    from: queryDate.optional(),
    to: queryDate.optional(),
    sort: z.enum(['date_asc', 'date_desc', 'popular', 'title']).default('date_asc'),
    page: z.coerce.number().int().min(1).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const QueryParticipantsSchema = z.object({
    status: z.enum(['confirmed', 'waitlisted', 'rejected', 'cancelled']).optional(),
    role: z.enum(['solo', 'captain', 'member']).optional(),
    attended: z.preprocess((v) => {
        if (v === 'true' || v === true) return true;
        if (v === 'false' || v === false) return false;
        return undefined;
    }, z.boolean().optional()),
    team_id: z.string().max(64).optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const RecordAttendanceItemSchema = z.object({
    // Registration ids are uuids; anything else is a 422 here, not a wasted downstream lookup.
    registration_id: z.uuid(),
    attended: z.boolean(),
});

export const RecordAttendanceSchema = z.object({
    // Capped as well as floored: one request is one bulk call downstream. Five hundred is a bulk
    // check-in at a big event.
    attendances: z.array(RecordAttendanceItemSchema).min(1).max(500),
});

export const ManageCaptainSchema = z.object({
    user_id: z.string().min(1),
});

export const RefParamSchema = z.object({
    ref: z.string().min(1).max(200),
});

export const ReserveSeatSchema = z.object({
    registration_id: z.string().min(1),
    // The seat is idempotent per registration_id (the contract's key); this is accepted for the wire.
    idempotency_key: z.string().min(1).optional(),
});

export const ReleaseSeatSchema = z.object({
    registration_id: z.string().min(1),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = Partial<Omit<CreateEventInput, 'type' | 'auction' | 'status'>> & {
    status?: (typeof EVENT_STATUS)[number];
};
export type QueryEventsInput = z.infer<typeof QueryEventsSchema>;
export type QueryParticipantsInput = z.infer<typeof QueryParticipantsSchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceSchema>;
export type ManageCaptainInput = z.infer<typeof ManageCaptainSchema>;
export type ReserveSeatInput = z.infer<typeof ReserveSeatSchema>;
export type ReleaseSeatInput = z.infer<typeof ReleaseSeatSchema>;
