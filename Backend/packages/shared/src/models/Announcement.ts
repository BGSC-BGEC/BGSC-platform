import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps, RoleName, ROLE_RANK, roleRank } from './shared';

/**
 * Announcement Service. See docs/modeldocs/announcement-model.md.
 * Collection: `announcements`. Per-user read state lives on the User doc, not here.
 *
 * Delivery (WhatsApp, push) is tracked ON the document per category, so the composer can show
 * sent / failed / rate-limited without a second collection.
 */

/** The nine Spec §6.4 composer tags, snake_cased. Multi-select wins over Spec §4.1's singular `type`. */
export const ANNOUNCEMENT_CATEGORY = [
    'bgec',
    'fitsoc',
    'airball',
    'offside',
    'powerplay',
    'around_the_net',
    'deuce',
    'highlight',
    'teams',
] as const;
export const ANNOUNCEMENT_PRIORITY = ['normal', 'important', 'urgent'] as const;
export const ANNOUNCEMENT_STATUS = ['draft', 'scheduled', 'published', 'archived'] as const;
export const DELIVERY_STATUS = ['pending', 'sent', 'failed', 'rate_limited', 'skipped'] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORY)[number];
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITY)[number];
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUS)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

/** Spec §6.4: the Teams tag is visible to Core, Coordinator and Founder only. */
export const ROLE_GATED_CATEGORY: AnnouncementCategory = 'teams';
export const ROLE_GATED_MIN_ROLE: RoleName = 'core';

/** Spec §5.2 / §15.3: 4 months live, then archived; hard-deleted at 1 year total. */
export const ACTIVE_MONTHS = 4;
export const ARCHIVE_MONTHS = 8;

export function expiryFor(published_at: Date): Date {
    const d = new Date(published_at);
    d.setMonth(d.getMonth() + ACTIVE_MONTHS);
    return d;
}

export interface IAnnouncement extends Document<string> {
    _id: string;

    title: string;
    body: string;
    media_url: string | null;

    categories: AnnouncementCategory[];
    tags: string[];
    priority: AnnouncementPriority;

    audience: {
        min_role: RoleName;
        event_id: string | null;
    };

    author: {
        user_id: string;
        display_name: string;
        role_label: string;
        avatar_url: string | null;
    };

    status: AnnouncementStatus;
    scheduled_for: Date | null;
    published_at: Date | null;
    expires_at: Date | null;
    pinned_until: Date | null;

    delivery: {
        whatsapp: {
            requested: boolean;
            per_category: {
                category: AnnouncementCategory;
                group_id: string;
                status: DeliveryStatus;
                message_id: string | null;
                attempted_at: Date | null;
                error: string | null;
            }[];
        };
        push: { requested: boolean; status: DeliveryStatus; sent_count: number | null };
    };

    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

const WhatsAppDeliverySchema = new Schema(
    {
        category: { type: String, enum: ANNOUNCEMENT_CATEGORY, required: true },
        group_id: { type: String, required: true },
        // rate_limited still publishes in-app (Spec §9.4 fallback): 1 message per tag per hour.
        status: { type: String, enum: DELIVERY_STATUS, default: 'pending' },
        message_id: { type: String, default: null },
        attempted_at: { type: Date, default: null },
        error: { type: String, default: null },
    },
    { _id: false }
);

const AnnouncementSchema = new Schema<IAnnouncement>(
    {
        _id: uuidId,

        title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
        body: { type: String, required: true, minlength: 1, maxlength: 5000 },
        media_url: { type: String, default: null },

        categories: { type: [String], enum: ANNOUNCEMENT_CATEGORY, required: true },
        tags: { type: [String], default: [], lowercase: true },
        priority: { type: String, enum: ANNOUNCEMENT_PRIORITY, default: 'normal' },

        audience: {
            min_role: { type: String, enum: ROLE_RANK, default: 'guest' },
            event_id: { type: String, default: null }, // null = everyone; else registrants of that event
        },

        // Snapshot: the announcement stays attributed even if the coordinator's role changes later.
        author: {
            user_id: { type: String, required: true },
            display_name: { type: String, required: true },
            role_label: { type: String, required: true },
            avatar_url: { type: String, default: null },
        },

        status: { type: String, enum: ANNOUNCEMENT_STATUS, default: 'draft' },
        scheduled_for: { type: Date, default: null },
        published_at: { type: Date, default: null },
        // No TTL index: Spec §15.3 wants a 1-year archive, so a scheduler archives and a purge job deletes.
        expires_at: { type: Date, default: null },
        pinned_until: { type: Date, default: null }, // homepage banner

        delivery: {
            whatsapp: {
                requested: { type: Boolean, default: false },
                per_category: { type: [WhatsAppDeliverySchema], default: [] },
            },
            push: {
                requested: { type: Boolean, default: false },
                status: { type: String, enum: DELIVERY_STATUS, default: 'pending' },
                sent_count: { type: Number, default: null, min: 0 },
            },
        },

        deleted_at: { type: Date, default: null },
    },
    timestamps
);

// announcement-model.md §2.3
AnnouncementSchema.pre('validate', function (this: IAnnouncement) {
    const a = this;
    const fail = (msg: string): never => {
        throw new Error(`Announcement invariant: ${msg}`);
    };

    if (a.categories.length === 0) return fail('categories must not be empty');
    if (new Set(a.categories).size !== a.categories.length) return fail('categories must be unique');

    // Derived at publish, and the admin may raise it but never lower it below the derived value.
    if (a.categories.includes(ROLE_GATED_CATEGORY) && roleRank(a.audience.min_role) < roleRank(ROLE_GATED_MIN_ROLE)) {
        a.audience.min_role = ROLE_GATED_MIN_ROLE;
    }

    const scheduled = a.status === 'scheduled';
    if (scheduled !== (a.scheduled_for !== null && a.published_at === null)) {
        return fail("status 'scheduled' means scheduled_for is set and published_at is not");
    }

    const live = a.status === 'published' || a.status === 'archived';
    if (live) {
        if (a.published_at === null) return fail(`status '${a.status}' requires published_at`);
        if (a.expires_at === null || a.expires_at.getTime() !== expiryFor(a.published_at).getTime()) {
            a.expires_at = expiryFor(a.published_at);
        }
    } else if (a.published_at !== null || a.expires_at !== null) {
        return fail(`status '${a.status}' must leave published_at and expires_at null`);
    }

    if (a.pinned_until && a.expires_at && a.pinned_until > a.expires_at) {
        return fail('pinned_until must not outlast expires_at');
    }

    const extra = a.delivery.whatsapp.per_category.find((r) => !a.categories.includes(r.category));
    if (extra) return fail(`delivery row references category '${extra.category}' which is not on this announcement`);
});

// audience.min_role is filtered in memory: a 4-month window is at most a few hundred live docs.
AnnouncementSchema.index({ status: 1, published_at: -1 }); // feed
AnnouncementSchema.index({ status: 1, categories: 1, published_at: -1 }); // category chips
AnnouncementSchema.index({ status: 1, 'audience.event_id': 1, published_at: -1 }); // event detail
AnnouncementSchema.index({ 'author.user_id': 1, status: 1, published_at: -1 }); // "What Our Heads Have to Say"
AnnouncementSchema.index({ status: 1, scheduled_for: 1 }, { partialFilterExpression: { status: 'scheduled' } });
AnnouncementSchema.index({ status: 1, expires_at: 1 }); // archive + purge jobs
AnnouncementSchema.index({ status: 1, pinned_until: 1 }); // homepage banner
AnnouncementSchema.index({ title: 'text', body: 'text' }); // MVP stand-in for Elasticsearch

export const Announcement = model<IAnnouncement>('Announcement', AnnouncementSchema, 'announcements');

/**
 * announcement-model.md §4. The event-scoped check is server-side: the caller passes the viewer's
 * confirmed event IDs fetched from Registration Service, never a client-supplied list.
 */
export function isVisibleTo(
    a: Pick<IAnnouncement, 'status' | 'audience'>,
    viewer: { role: RoleName; confirmed_event_ids: string[] }
): boolean {
    if (a.status !== 'published') return false;
    if (roleRank(viewer.role) < roleRank(a.audience.min_role)) return false;
    return a.audience.event_id === null || viewer.confirmed_event_ids.includes(a.audience.event_id);
}
