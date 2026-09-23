import { z } from 'zod';
import {
    EVENT_CATEGORY,
    EVENT_TYPE,
    EVENT_DOMAIN,
    EVENT_STATUS,
    EVENT_VISIBILITY,
    LEADERBOARD_FORMAT,
    SCORING_KIND,
} from '@bgsc/shared';

const dateCoerce = z.preprocess((val) => {
    if (typeof val === 'string' || val instanceof Date) return new Date(val);
    return val;
}, z.date());

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

    rules_pdf_url: z.string().nullable().default(null),
    rules_summary: z.string().nullable().default(null),
    awards: z.array(AwardSchema).default([]),
    contacts: z.array(ContactSchema).default([]),
    core_admins: z.array(z.string()).default([]),

    points_pool: z.object({
        participation: z.number().nonnegative().default(10),
        podium_multipliers: z.array(z.number().positive()).default([3, 2, 1.5]),
        sponsor_bonus: z.number().nonnegative().default(0),
        investment_enabled: z.boolean().default(false),
        investment_cap: z.number().positive().nullable().default(null),
    }).default({ participation: 10, podium_multipliers: [3, 2, 1.5], sponsor_bonus: 0, investment_enabled: false, investment_cap: null }),

    scoring: z.object({
        parameters: z.array(ScoringParamSchema).default([]),
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

    auction: z.object({
        k_multiplier: z.number().positive().default(1.0),
        min_bid_increment: z.number().positive().default(100),
        bid_timer_seconds: z.number().int().positive().default(5),
        oc_override_quota: z.number().min(0).max(3 / 7).default(3 / 7),
        oc_captain_override_quota: z.number().min(0).max(1).default(3 / 7),
        status: z.enum(['not_started', 'live', 'paused', 'finished']).default('not_started'),
        captain_user_ids: z.array(z.string()).default([]),
        purse_per_team: z.number().positive().nullable().default(null),
    }).nullable().default(null),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
    status: z.enum(EVENT_STATUS).optional(),
});

export const QueryEventsSchema = z.object({
    category: z.string().optional(),
    status: z.string().optional(),
    domain: z.string().optional(),
    type: z.string().optional(),
    tags: z.string().optional(),
    search: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort: z.enum(['date_asc', 'date_desc', 'popular', 'title']).default('date_asc'),
    page: z.coerce.number().int().min(1).optional(),
    cursor: z.string().optional(),
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
    team_id: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PromoteWaitlistSchema = z.object({
    admin_override: z.boolean().default(false),
});

export const RecordAttendanceItemSchema = z.object({
    registration_id: z.string().min(1),
    attended: z.boolean(),
    note: z.string().max(500).optional(),
});

export const RecordAttendanceSchema = z.object({
    // Capped as well as floored: the handler runs one query per item, so an uncapped array is an
    // unbounded amount of work for one request. Five hundred is a bulk check-in at a big event.
    attendances: z.array(RecordAttendanceItemSchema).min(1).max(500),
});

export const SingleAttendanceSchema = z.object({
    attended: z.boolean(),
    note: z.string().max(500).optional(),
});

export const ManageCaptainSchema = z.object({
    user_id: z.string().min(1),
});

export const RefParamSchema = z.object({
    ref: z.string().min(1),
});

export const ReserveSeatSchema = z.object({
    registration_id: z.string().min(1),
    idempotency_key: z.string().min(1),
});

export const ReleaseSeatSchema = z.object({
    registration_id: z.string().min(1),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type QueryEventsInput = z.infer<typeof QueryEventsSchema>;
export type QueryParticipantsInput = z.infer<typeof QueryParticipantsSchema>;
export type PromoteWaitlistInput = z.infer<typeof PromoteWaitlistSchema>;
export type RecordAttendanceInput = z.infer<typeof RecordAttendanceSchema>;
export type SingleAttendanceInput = z.infer<typeof SingleAttendanceSchema>;
export type ManageCaptainInput = z.infer<typeof ManageCaptainSchema>;
export type ReserveSeatInput = z.infer<typeof ReserveSeatSchema>;
export type ReleaseSeatInput = z.infer<typeof ReleaseSeatSchema>;
