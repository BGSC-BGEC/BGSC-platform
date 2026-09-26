import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';
import { ANNOUNCEMENT_CATEGORY, AnnouncementCategory, DELIVERY_STATUS, DeliveryStatus } from './Announcement';

/**
 * Notification Service (:3010). See docs/modeldocs/notification-model.md.
 *
 * Three collections, one domain:
 *  - `notifications`            the per-user in-app inbox (Spec §4.1 Notification, §10)
 *  - `notification_dispatches`  outbound channel jobs: the claim, the retry and the delivery record
 *  - `notification_preferences` per-user, per-category toggles (Spec §10.3)
 *
 * `DeliveryStatus` is imported from Announcement rather than redeclared: the same five values are
 * written back into `announcements.delivery.*`, and two enums
 * that must agree are one enum with extra steps.
 */

/* ------------------------------------------------------------------ *
 * notifications
 * ------------------------------------------------------------------ */

/** Spec §10.2's groups, minus the domains that are out of MVP (social, sponsor, union). */
export const NOTIFICATION_CATEGORY = ['announcement', 'event', 'challenge', 'system'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORY)[number];

/** Spec §4.1's `channel` enum. Only `in_app` is written today; the rest are the seam. */
export const NOTIFICATION_CHANNEL = ['in_app', 'push', 'email', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNEL)[number];

/** An inbox is not an audit trail. 90 days, enforced by a TTL index rather than a sweep. */
export const NOTIFICATION_TTL_DAYS = 90;

export function notificationExpiry(from: Date = new Date()): Date {
    return new Date(from.getTime() + NOTIFICATION_TTL_DAYS * 86_400_000);
}

export interface INotification extends Document<string> {
    _id: string;

    user_id: string;
    category: NotificationCategory;
    /** Template key: 'announcement.published', 'registration.confirmed', … */
    type: string;
    title: string;
    body: string;
    /** Deep-link ids the client routes on. Display data only — never authorization input. */
    data: Record<string, unknown>;
    channel: NotificationChannel;

    /**
     * Derived from the document that caused this notification, never from the event envelope —
     * a replay carries a fresh `message_id`, so envelope dedupe cannot survive one.
     */
    dedupe_key: string;

    read_at: Date | null;
    /**
     * Set by the user's dismiss. The row stays, hidden from every inbox read, because it is also the
     * dedupe record: deleting it let the next replay or reconcile hand the dismissed card back.
     */
    dismissed_at: Date | null;
    expires_at: Date;

    created_at: Date;
    updated_at: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        _id: uuidId,

        user_id: { type: String, required: true },
        category: { type: String, enum: NOTIFICATION_CATEGORY, required: true },
        type: { type: String, required: true, maxlength: 64 },
        title: { type: String, required: true, trim: true, maxlength: 140 },
        body: { type: String, required: true, maxlength: 500 },
        data: { type: Schema.Types.Mixed, default: {} },
        channel: { type: String, enum: NOTIFICATION_CHANNEL, default: 'in_app' },

        dedupe_key: { type: String, required: true, maxlength: 200 },

        read_at: { type: Date, default: null },
        dismissed_at: { type: Date, default: null },
        expires_at: { type: Date, required: true, default: () => notificationExpiry() },
    },
    timestamps
);

/**
 * Keyset feed: filter on `user_id`, sort `(created_at, _id)` descending. The `_id` key is part of
 * the index because it is part of the sort — without it the tie-breaker is an in-memory sort of
 * whatever the first two keys returned.
 */
NotificationSchema.index({ user_id: 1, created_at: -1, _id: -1 });

/** Badge count and `?unread=true`, both of which filter on read_at before ordering. */
NotificationSchema.index({ user_id: 1, read_at: 1, created_at: -1 });

/**
 * The idempotency guard AND the retraction query, in one index.
 *
 * `dedupe_key` leads deliberately: a deleted announcement is retracted with
 * `deleteMany({ dedupe_key })` across every recipient, which needs the key as the index
 * prefix. Unique on the pair, so one user gets one notification per cause while every user still
 * gets their own.
 */
NotificationSchema.index({ dedupe_key: 1, user_id: 1 }, { unique: true });

/**
 * `UserDeleted` erasing a player's name from captain auction cards. User Service replays recent
 * deletions on a timer, so this runs far more often than once per deletion; partial on the one
 * type that carries the field, which is also the query's own `type` filter.
 */
NotificationSchema.index(
    { 'data.player_user_id': 1 },
    { partialFilterExpression: { type: 'auction.sold.captain' } }
);

/** Mongo drops the row when `expires_at` passes. New collection, so no index migration to do. */
NotificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const Notification = model<INotification>('Notification', NotificationSchema, 'notifications');

/* ------------------------------------------------------------------ *
 * notification_dispatches
 * ------------------------------------------------------------------ */

export const DISPATCH_CHANNEL = ['whatsapp', 'push'] as const;
export type DispatchChannel = (typeof DISPATCH_CHANNEL)[number];

/** Only announcements are broadcast today. An enum so a second source has to be declared, not typoed. */
export const DISPATCH_SOURCE_TYPE = ['announcement'] as const;
export type DispatchSourceType = (typeof DISPATCH_SOURCE_TYPE)[number];

/**
 * A status the sweeper will pick up again, and one it will not.
 *
 * `skipped` is terminal on purpose: configuring WhatsApp credentials next week must not make three
 * weeks of `no_group_mapped` rows suddenly broadcast. `outcome_unknown` is terminal
 * because the message may already be in the group: a retry is a possible double post.
 */
export const DISPATCH_TERMINAL: readonly DeliveryStatus[] = ['sent', 'skipped', 'outcome_unknown'];
export const DISPATCH_RETRYABLE: readonly DeliveryStatus[] = ['pending', 'failed', 'rate_limited'];
export const isTerminalDispatch = (s: DeliveryStatus): boolean => DISPATCH_TERMINAL.includes(s);

/** Five attempts, then the row is left alone. */
export const DISPATCH_MAX_ATTEMPTS = 5;

export interface INotificationDispatch extends Document<string> {
    _id: string;

    channel: DispatchChannel;
    source: { type: DispatchSourceType; id: string };
    /** The announcement category whose group this send is for. Null for channels with no fan-out. */
    category: AnnouncementCategory | null;
    /** Opaque provider destination. PII: never surfaced over HTTP by this service. */
    destination: string | null;

    status: DeliveryStatus;
    attempts: number;
    provider_message_id: string | null;
    /** Provider failure, clipped. Never carries a credential. */
    error: string | null;

    attempted_at: Date | null;
    /** Set exactly when `status` is retryable; null when it is terminal. */
    next_attempt_at: Date | null;
    /** When this row's outcome reached the announcement document. */
    writeback_at: Date | null;
    /**
     * When the writeback sweep last tried this row. The sweep takes the least recently tried first,
     * so rows whose writeback keeps coming back `retry` cannot hold its bounded page forever.
     */
    writeback_tried_at: Date | null;
    /**
     * Set immediately before the provider call, cleared by every settle. A row found `pending` with
     * this set and its lease lapsed died mid-send: it is closed as `outcome_unknown`, never re-sent.
     */
    sending_at: Date | null;
    /**
     * Bumped by every state change. The writeback reads a row, makes an HTTP call, and then marks
     * what it reported — and a settle can land in between. Pinning that mark to the revision the
     * writeback actually saw is what keeps it from claiming to have reported a state it never did.
     * `updated_at` cannot do this job: it has millisecond resolution, so a settle inside the same
     * millisecond is invisible to it.
     */
    revision: number;

    created_at: Date;
    updated_at: Date;
}

const NotificationDispatchSchema = new Schema<INotificationDispatch>(
    {
        _id: uuidId,

        channel: { type: String, enum: DISPATCH_CHANNEL, required: true },
        source: {
            type: { type: String, enum: DISPATCH_SOURCE_TYPE, required: true },
            id: { type: String, required: true },
        },
        category: { type: String, enum: ANNOUNCEMENT_CATEGORY, default: null },
        destination: { type: String, default: null },

        status: { type: String, enum: DELIVERY_STATUS, default: 'pending' },
        attempts: { type: Number, default: 0, min: 0 },
        provider_message_id: { type: String, default: null },
        error: { type: String, default: null, maxlength: 300 },

        attempted_at: { type: Date, default: null },
        next_attempt_at: { type: Date, default: null },
        writeback_at: { type: Date, default: null },
        writeback_tried_at: { type: Date, default: null },
        sending_at: { type: Date, default: null },
        revision: { type: Number, default: 0 },
    },
    timestamps
);

/**
 * A retryable row with no `next_attempt_at` is invisible to the sweep's `$lte` filter forever, and
 * a terminal row with one is picked up and re-sent. Both are silent, so the model refuses them.
 *
 * Document middleware only — every update path in the service is a `findOneAndUpdate`, which runs
 * no hooks. This catches the construction bug; the service is what keeps the pair correct on update
 * (`dispatch.ts:settle`).
 */
NotificationDispatchSchema.pre('validate', function (this: INotificationDispatch) {
    const terminal = isTerminalDispatch(this.status);
    if (terminal && this.next_attempt_at !== null) {
        throw new Error(`Dispatch invariant: terminal status '${this.status}' must leave next_attempt_at null`);
    }
    if (!terminal && this.next_attempt_at === null) {
        throw new Error(`Dispatch invariant: retryable status '${this.status}' requires next_attempt_at`);
    }
});

/**
 * The claim. An insert that collides here means another instance (or an earlier delivery) already
 * owns this send — which is exactly how a replayed `AnnouncementPublished` stops at one message.
 */
NotificationDispatchSchema.index(
    { 'source.type': 1, 'source.id': 1, channel: 1, category: 1 },
    { unique: true }
);

/** The retry sweep. */
NotificationDispatchSchema.index({ status: 1, next_attempt_at: 1 });

/** The writeback-retry sweep: terminal rows whose outcome never reached the announcement. */
NotificationDispatchSchema.index({ writeback_at: 1, status: 1 });

/** Reconciliation asks "does this announcement have any rows at all". */
NotificationDispatchSchema.index({ 'source.id': 1 });

export const NotificationDispatch = model<INotificationDispatch>(
    'NotificationDispatch',
    NotificationDispatchSchema,
    'notification_dispatches'
);

/* ------------------------------------------------------------------ *
 * notification_rate_slots
 * ------------------------------------------------------------------ */

/**
 * Spec §9.4's "1 per tag per hour", as one document per (channel, category) holding the times of
 * its most recent sends.
 *
 * A document rather than a count over dispatch rows because the count was check-then-send: two
 * announcements in one tag both counted zero `sent` rows and both went out. A slot is taken by a
 * single-document `findOneAndUpdate` BEFORE the provider call, so the second taker sees the first.
 * Durable rather than a Redis TTL key: Redis is optional here and forgets.
 */
export interface INotificationRateSlot extends Document<string> {
    /** `<channel>:<category>`, e.g. `whatsapp:fitsoc`. */
    _id: string;
    /** Newest last, capped at the configured rate. */
    sends: Date[];
}

const NotificationRateSlotSchema = new Schema<INotificationRateSlot>({
    _id: { type: String, required: true },
    sends: { type: [Date], default: [] },
});

export const NotificationRateSlot = model<INotificationRateSlot>(
    'NotificationRateSlot',
    NotificationRateSlotSchema,
    'notification_rate_slots'
);

/* ------------------------------------------------------------------ *
 * notification_preferences
 * ------------------------------------------------------------------ */

/**
 * `_id` IS the user id: one document per user, no second index, no lookup key to get wrong.
 *
 * An absent document means every default, so nothing is created at signup and there is no backfill.
 * Only the in_app map is enforced today; `push` and `email` slot into the same shape when they
 * have a provider.
 */
export interface INotificationPreference extends Document<string> {
    _id: string;
    channels: {
        in_app: Record<NotificationCategory, boolean>;
    };
    created_at: Date;
    updated_at: Date;
}

/** What a user with no preferences document gets, and what `GET /notifications/preferences` returns. */
export const DEFAULT_NOTIFICATION_PREFERENCES: { in_app: Record<NotificationCategory, boolean> } = {
    in_app: { announcement: true, event: true, challenge: true, system: true },
};

const InAppSchema = new Schema(
    {
        announcement: { type: Boolean, default: true },
        event: { type: Boolean, default: true },
        challenge: { type: Boolean, default: true },
        system: { type: Boolean, default: true },
    },
    { _id: false }
);

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
    {
        // Not `uuidId`: the id is supplied, because it is the user's.
        _id: { type: String, required: true },
        channels: {
            in_app: { type: InAppSchema, default: () => ({}) },
        },
    },
    timestamps
);

export const NotificationPreference = model<INotificationPreference>(
    'NotificationPreference',
    NotificationPreferenceSchema,
    'notification_preferences'
);
