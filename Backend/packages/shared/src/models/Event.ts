import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps, UserSnapshot, UserSnapshotSchema, KEY_PATTERN } from './shared';

/**
 * Event Service aggregate root. See docs/modeldocs/event-model.md.
 * Collections: `events` (this file's Event) and `auction_lots` (AuctionLot).
 * Anything unbounded (registrations, teams, bids, scores) lives elsewhere and points back with event_id.
 */

export const EVENT_CATEGORY = ['leagues', 'bgec', 'fitsoc', 'general'] as const;
export const EVENT_TYPE = ['LE', 'DE', 'ALL', 'DLL'] as const;
export const EVENT_DOMAIN = ['sports', 'esports', 'fitness', 'general'] as const;
export const EVENT_STATUS = ['draft', 'upcoming', 'ongoing', 'past', 'cancelled'] as const;
export const EVENT_VISIBILITY = ['public', 'unlisted'] as const;
export const LEADERBOARD_FORMAT = [
    'round_robin',
    'single_elim',
    'double_elim',
    'elim_after_n',
    'points_table',
] as const;
export const AUCTION_STATUS = ['not_started', 'live', 'paused', 'finished'] as const;
export const SCORING_KIND = ['int', 'float', 'bool'] as const;

export type EventCategory = (typeof EVENT_CATEGORY)[number];
export type EventType = (typeof EVENT_TYPE)[number];
export type EventDomain = (typeof EVENT_DOMAIN)[number];
export type EventStatus = (typeof EVENT_STATUS)[number];
export type EventVisibility = (typeof EVENT_VISIBILITY)[number];
export type LeaderboardFormat = (typeof LEADERBOARD_FORMAT)[number];
export type AuctionStatus = (typeof AUCTION_STATUS)[number];
export type ScoringKind = (typeof SCORING_KIND)[number];

/** Spec §5.15.4 hard ceiling on the Organising Committee base-price override. */
export const OC_OVERRIDE_QUOTA_MAX = 3 / 7;

export interface IEvent extends Document<string> {
    _id: string;
    slug: string;

    title: string;
    description: string;
    cover_media_url: string | null;
    logo_url: string | null;

    category: EventCategory;
    type: EventType;
    domain: EventDomain;
    tags: string[];

    status: EventStatus;
    visibility: EventVisibility;

    start_at: Date;
    end_at: Date;
    venue: string | null;
    timezone: string;

    registration: {
        opens_at: Date | null;
        closes_at: Date;
        roster_finalizes_at: Date | null;
        form_id: string | null;
        max_participants: number | null;
        waitlist_enabled: boolean;
        requires_approval: boolean;
    };

    teaming: {
        is_teamed: boolean;
        team_size_min: number | null;
        team_size_max: number | null;
        max_teams: number | null;
        captain_application_required: boolean;
    };

    rules_pdf_url: string | null;
    rules_summary: string | null;
    awards: { place: number; title: string; description: string | null }[];

    contacts: { user_id: string; display_name: string; role_label: string; contact: string | null }[];

    created_by: string;
    core_admins: string[];

    points_pool: {
        participation: number;
        podium_multipliers: number[];
        sponsor_bonus: number;
        investment_enabled: boolean;
        investment_cap: number | null;
    };

    scoring: {
        parameters: { key: string; label: string; kind: ScoringKind; weight: number }[];
        normalization: { lower: number; upper: number };
    };

    leaderboard: {
        format: LeaderboardFormat;
        elim_after_n: number | null;
        min_participants: number;
    } | null;

    auction: {
        k_multiplier: number;
        min_bid_increment: number;
        bid_timer_seconds: number;
        oc_override_quota: number;
        status: AuctionStatus;
        captain_user_ids: string[];
        purse_per_team: number | null;
    } | null;

    /** Reserved for the Week 4 bracket engine. */
    bracket: null;

    counts: {
        registrations_confirmed: number;
        registrations_waitlisted: number;
        teams: number;
    };

    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

const AwardSchema = new Schema(
    {
        place: { type: Number, required: true, min: 1 },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: null },
    },
    { _id: false }
);

const ContactSchema = new Schema(
    {
        user_id: { type: String, required: true },
        display_name: { type: String, required: true },
        role_label: { type: String, required: true },
        contact: { type: String, default: null },
    },
    { _id: false }
);

const ScoringParameterSchema = new Schema(
    {
        key: { type: String, required: true, match: KEY_PATTERN },
        label: { type: String, required: true },
        kind: { type: String, enum: SCORING_KIND, required: true },
        weight: { type: Number, required: true },
    },
    { _id: false }
);

const EventSchema = new Schema<IEvent>(
    {
        _id: uuidId,
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

        // Identity
        title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
        description: { type: String, default: '', maxlength: 10_000 },
        cover_media_url: { type: String, default: null },
        logo_url: { type: String, default: null },

        // Classification: `category` is where it shows (Events page tab), `type` is how it behaves.
        category: { type: String, enum: EVENT_CATEGORY, required: true },
        type: { type: String, enum: EVENT_TYPE, required: true },
        domain: { type: String, enum: EVENT_DOMAIN, required: true },
        tags: { type: [String], default: [], lowercase: true },

        // Lifecycle. upcoming/ongoing/past are stored, not derived — a scheduler flips them.
        status: { type: String, enum: EVENT_STATUS, default: 'draft' },
        visibility: { type: String, enum: EVENT_VISIBILITY, default: 'public' },

        // Schedule
        start_at: { type: Date, required: true },
        end_at: { type: Date, required: true },
        venue: { type: String, default: null },
        timezone: { type: String, default: 'Asia/Kolkata' },

        registration: {
            opens_at: { type: Date, default: null },
            closes_at: { type: Date, required: true },
            roster_finalizes_at: { type: Date, default: null },
            form_id: { type: String, default: null },
            max_participants: { type: Number, default: null, min: 1 },
            waitlist_enabled: { type: Boolean, default: false },
            requires_approval: { type: Boolean, default: false },
        },

        teaming: {
            is_teamed: { type: Boolean, default: false },
            team_size_min: { type: Number, default: null, min: 1 },
            team_size_max: { type: Number, default: null, min: 1 },
            max_teams: { type: Number, default: null, min: 1 },
            captain_application_required: { type: Boolean, default: false },
        },

        rules_pdf_url: { type: String, default: null },
        rules_summary: { type: String, default: null },
        awards: { type: [AwardSchema], default: [] },
        contacts: { type: [ContactSchema], default: [] },

        created_by: { type: String, required: true },
        core_admins: { type: [String], default: [] },

        points_pool: {
            participation: { type: Number, default: 10, min: 0 },
            podium_multipliers: { type: [Number], default: [3, 2, 1.5] },
            sponsor_bonus: { type: Number, default: 0, min: 0 },
            investment_enabled: { type: Boolean, default: false },
            investment_cap: { type: Number, default: null, min: 0 },
        },

        scoring: {
            parameters: { type: [ScoringParameterSchema], default: [] },
            normalization: {
                lower: { type: Number, default: 0, min: 0, max: 1000 },
                upper: { type: Number, default: 1000, min: 0, max: 1000 },
            },
        },

        // leaderboard != null <=> type != 'DE'; auction != null <=> type == 'ALL'. No separate enabled flags.
        leaderboard: {
            type: new Schema(
                {
                    format: { type: String, enum: LEADERBOARD_FORMAT, required: true },
                    elim_after_n: { type: Number, default: null, min: 1 },
                    min_participants: { type: Number, default: 2, min: 1 },
                },
                { _id: false }
            ),
            default: null,
        },

        auction: {
            type: new Schema(
                {
                    k_multiplier: { type: Number, required: true, min: 0 },
                    min_bid_increment: { type: Number, required: true, min: 1 },
                    bid_timer_seconds: { type: Number, default: 5, min: 1 },
                    oc_override_quota: { type: Number, default: OC_OVERRIDE_QUOTA_MAX, min: 0 },
                    status: { type: String, enum: AUCTION_STATUS, default: 'not_started' },
                    captain_user_ids: { type: [String], default: [] },
                    purse_per_team: { type: Number, default: null, min: 0 },
                },
                { _id: false }
            ),
            default: null,
        },

        bracket: { type: Schema.Types.Mixed, default: null },

        // Denormalized; owner service $incs these in the same write as the cause. Nightly recount repairs drift.
        counts: {
            registrations_confirmed: { type: Number, default: 0, min: 0 },
            registrations_waitlisted: { type: Number, default: 0, min: 0 },
            teams: { type: Number, default: 0, min: 0 },
        },

        deleted_at: { type: Date, default: null },
    },
    timestamps
);

// event-model.md §6
EventSchema.pre('validate', function (this: IEvent) {
    const e = this;
    const fail = (msg: string): never => {
        throw new Error(`Event invariant: ${msg}`);
    };

    if (!(e.start_at < e.end_at)) return fail('start_at must be before end_at');

    const reg = e.registration;
    if (reg.opens_at && !(reg.opens_at < reg.closes_at)) {
        return fail('registration.opens_at must be before registration.closes_at');
    }
    if (reg.closes_at > e.start_at) return fail('registration.closes_at must be at or before start_at');
    if (reg.roster_finalizes_at && (reg.roster_finalizes_at < reg.closes_at || reg.roster_finalizes_at > e.start_at)) {
        return fail('registration.roster_finalizes_at must fall in [closes_at, start_at]');
    }

    const t = e.teaming;
    if (!t.is_teamed) {
        if (t.team_size_min !== null || t.team_size_max !== null || t.max_teams !== null || reg.roster_finalizes_at !== null) {
            return fail('non-teamed event must leave team_size_*, max_teams and roster_finalizes_at null');
        }
    } else if (!(t.team_size_min !== null && t.team_size_max !== null && t.team_size_min >= 1 && t.team_size_min <= t.team_size_max)) {
        return fail('teamed event needs 1 <= team_size_min <= team_size_max');
    }

    if ((e.leaderboard !== null) !== (e.type !== 'DE')) {
        return fail("leaderboard must be present exactly when type != 'DE'");
    }
    if ((e.auction !== null) !== (e.type === 'ALL')) {
        return fail("auction must be present exactly when type == 'ALL'");
    }
    if (e.type === 'ALL' && !t.is_teamed) return fail("type 'ALL' requires teaming.is_teamed");
    if (e.auction && e.auction.oc_override_quota > OC_OVERRIDE_QUOTA_MAX) {
        return fail('auction.oc_override_quota exceeds the 3/7 ceiling');
    }

    if (reg.form_id === null && (t.is_teamed || reg.max_participants !== null || e.type !== 'DE')) {
        return fail("no registration form is only valid for a non-teamed, uncapped 'DE' event");
    }

    if (e.leaderboard) {
        const hasN = e.leaderboard.elim_after_n !== null && e.leaderboard.elim_after_n >= 1;
        if ((e.leaderboard.format === 'elim_after_n') !== hasN) {
            return fail("elim_after_n must be set exactly when format == 'elim_after_n'");
        }
    }

    const n = e.scoring.normalization;
    if (!(n.lower >= 0 && n.lower < n.upper && n.upper <= 1000)) {
        return fail('scoring.normalization requires 0 <= lower < upper <= 1000');
    }
    const keys = e.scoring.parameters.map((p) => p.key);
    if (new Set(keys).size !== keys.length) return fail('scoring.parameters[].key must be unique');

    if (!e.core_admins.includes(e.created_by)) e.core_admins.push(e.created_by);

    const mult = e.points_pool.podium_multipliers;
    if (mult.some((m, i) => i > 0 && m > mult[i - 1])) {
        return fail('points_pool.podium_multipliers must be non-increasing');
    }
    if (mult.length > Math.max(e.awards.length, 3)) {
        return fail('points_pool.podium_multipliers has more entries than awards');
    }
});

EventSchema.index({ status: 1, category: 1, start_at: 1 }); // Events page: tab + status filter, by date
EventSchema.index({ type: 1, status: 1, start_at: -1 }); // Leaderboards card list, auction list
EventSchema.index({ tags: 1, status: 1 });
EventSchema.index({ core_admins: 1 }); // "events I administer"
EventSchema.index({ status: 1, start_at: 1 }); // scheduler: upcoming -> ongoing
EventSchema.index({ status: 1, end_at: 1 }); // scheduler: ongoing -> past
EventSchema.index({ status: 1, 'registration.opens_at': 1 }); // scheduler: open registration
EventSchema.index({ status: 1, 'registration.closes_at': 1 }); // scheduler: close registration
EventSchema.index({ deleted_at: 1 });
EventSchema.index({ title: 'text', tags: 'text' }); // MVP stand-in for Elasticsearch (Spec §13)

export const Event = model<IEvent>('Event', EventSchema, 'events');

/* ------------------------------------------------------------------ *
 * auction_lots — one document per player on the block (Spec §4.1)
 * ------------------------------------------------------------------ */

export const LOT_STATUS = ['queued', 'on_block', 'sold', 'unsold'] as const;
export type LotStatus = (typeof LOT_STATUS)[number];

export interface IAuctionLot extends Document<string> {
    _id: string;
    event_id: string;
    player: UserSnapshot;
    registration_id: string;
    base_price: number;
    oc_adjusted_price: number | null;
    order: number;

    status: LotStatus;
    current_bid: number | null;
    current_bidder: { user_id: string; team_id: string } | null;
    timer_ends_at: Date | null;

    bids: {
        bid_id: string;
        bidder_user_id: string;
        team_id: string;
        amount: number;
        placed_at: Date;
    }[];

    sold_to_team_id: string | null;
    sold_amount: number | null;
    closed_at: Date | null;

    version: number;
    created_at: Date;
    updated_at: Date;
}

const BidSchema = new Schema(
    {
        bid_id: { type: String, required: true },
        bidder_user_id: { type: String, required: true },
        team_id: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
        placed_at: { type: Date, required: true, default: Date.now },
    },
    { _id: false }
);

const AuctionLotSchema = new Schema<IAuctionLot>(
    {
        _id: uuidId,
        event_id: { type: String, required: true },
        player: { type: UserSnapshotSchema, required: true },
        registration_id: { type: String, required: true },
        base_price: { type: Number, required: true, min: 0 },
        oc_adjusted_price: { type: Number, default: null, min: 0 },
        order: { type: Number, required: true, min: 0 },

        status: { type: String, enum: LOT_STATUS, default: 'queued' },
        current_bid: { type: Number, default: null, min: 0 },
        current_bidder: {
            type: new Schema(
                { user_id: { type: String, required: true }, team_id: { type: String, required: true } },
                { _id: false }
            ),
            default: null,
        },
        // Server-authoritative (Spec §11.4) — never trust a client clock.
        timer_ends_at: { type: Date, default: null },

        // ponytail: bids embedded. Ceiling ~ a few hundred per lot; move to `auction_bids` if history needs paging.
        bids: { type: [BidSchema], default: [] },

        sold_to_team_id: { type: String, default: null },
        sold_amount: { type: Number, default: null, min: 0 },
        closed_at: { type: Date, default: null },

        // Optimistic lock for concurrent bids (Spec §11.4). Bumped by the bid $inc, not by mongoose.
        version: { type: Number, default: 0 },
    },
    timestamps
);

AuctionLotSchema.index({ event_id: 1, order: 1 });
AuctionLotSchema.index({ event_id: 1, status: 1 });
AuctionLotSchema.index({ 'player.user_id': 1, event_id: 1 }, { unique: true });

export const AuctionLot = model<IAuctionLot>('AuctionLot', AuctionLotSchema, 'auction_lots');
