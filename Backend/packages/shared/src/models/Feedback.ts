import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps, StatusHistoryItem, StatusHistorySchema, UserSnapshot, UserSnapshotSchema } from './shared';

/**
 * Feedback Service (:3011). See docs/modeldocs/feedback-model.md.
 * Collection: `feedback_tickets` — Spec §4.1 `FeedbackTicket`, Spec §5.12 Feedback & Contact Us.
 *
 * Contact-us and feedback are one collection with two front doors (`kind`): the same subject, body,
 * status ladder and response. Two collections would duplicate all four and give the staff inbox two
 * places to look.
 */

export const FEEDBACK_KIND = ['feedback', 'contact'] as const;
/** Spec §5.12: Bug Report, Feature Request, Event Complaint, General. */
export const FEEDBACK_CATEGORY = ['bug', 'feature', 'complaint', 'general'] as const;
export const FEEDBACK_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
/** Spec §5.12: Submitted → Under Review → Resolved → Closed. */
export const FEEDBACK_STATUS = ['submitted', 'under_review', 'resolved', 'closed'] as const;

export type FeedbackKind = (typeof FEEDBACK_KIND)[number];
export type FeedbackCategory = (typeof FEEDBACK_CATEGORY)[number];
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITY)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUS)[number];

/**
 * The ladder only ever moves forward, except that a closed ticket can be reopened for review —
 * a resolution the reporter disputes is the one transition that has to go back.
 */
export const FEEDBACK_TRANSITIONS: Record<FeedbackStatus, readonly FeedbackStatus[]> = {
    submitted: ['under_review', 'resolved', 'closed'],
    under_review: ['resolved', 'closed'],
    resolved: ['closed', 'under_review'],
    closed: ['under_review'],
};

export interface IFeedbackTicket extends Document<string> {
    _id: string;

    /** The human-readable id the auto-reply quotes (Spec §5.12). Unique. */
    ticket_no: string;
    kind: FeedbackKind;
    category: FeedbackCategory;
    severity: FeedbackSeverity;

    subject: string;
    description: string;
    /** URLs only — Media Service owns uploads (plan D7). */
    attachments: string[];
    /** An event complaint names its event. */
    event_id: string | null;

    is_anonymous: boolean;
    /**
     * Null exactly when `is_anonymous`. Nothing anywhere records who filed an anonymous ticket:
     * not this field, and not the audit row, which carries a null actor and a null ip.
     */
    reporter: UserSnapshot | null;
    /** Where the reply goes. Required when anonymous; otherwise the account's address is used. */
    contact_email: string | null;

    status: FeedbackStatus;
    response: { body: string; by_user_id: string; at: Date } | null;
    status_history: StatusHistoryItem[];

    created_at: Date;
    updated_at: Date;
}

const ResponseSchema = new Schema(
    {
        body: { type: String, required: true, maxlength: 5000 },
        by_user_id: { type: String, required: true },
        at: { type: Date, required: true, default: Date.now },
    },
    { _id: false }
);

const FeedbackTicketSchema = new Schema<IFeedbackTicket>(
    {
        _id: uuidId,

        ticket_no: { type: String, required: true, unique: true, uppercase: true, trim: true },
        kind: { type: String, enum: FEEDBACK_KIND, required: true },
        category: { type: String, enum: FEEDBACK_CATEGORY, required: true },
        severity: { type: String, enum: FEEDBACK_SEVERITY, default: 'low' },

        subject: { type: String, required: true, trim: true, minlength: 1, maxlength: 140 },
        description: { type: String, required: true, minlength: 1, maxlength: 5000 },
        attachments: { type: [String], default: [] },
        event_id: { type: String, default: null },

        is_anonymous: { type: Boolean, default: false },
        reporter: { type: UserSnapshotSchema, default: null },
        contact_email: { type: String, default: null, lowercase: true, trim: true },

        status: { type: String, enum: FEEDBACK_STATUS, default: 'submitted' },
        response: { type: ResponseSchema, default: null },
        status_history: { type: [StatusHistorySchema], default: [] },
    },
    timestamps
);

// feedback-model.md §2.2
FeedbackTicketSchema.pre('validate', function (this: IFeedbackTicket) {
    const t = this;
    const fail = (msg: string): never => {
        throw new Error(`FeedbackTicket invariant: ${msg}`);
    };

    // The toggle is the whole promise. A ticket that says anonymous and carries a reporter is worse
    // than one that never offered the choice, because the person believed it.
    if (t.is_anonymous && t.reporter !== null) return fail('an anonymous ticket must not carry a reporter');
    if (!t.is_anonymous && t.reporter === null) return fail('an attributed ticket requires a reporter');

    // Without an address there is no way to send the Spec §5.12 auto-reply, and no account to fall
    // back to. The ticket would be a message into a void.
    if (t.is_anonymous && !t.contact_email) return fail('an anonymous ticket requires contact_email');

    if (t.attachments.length > 5) return fail('at most 5 attachments');
    return undefined as unknown as void;
});

// `ticket_no` already has its unique index from the field definition above — declaring it twice
// makes mongoose drop the options on the second one and warn about it.
/**
 * The staff inbox, in its own order.
 *
 * `{ status, severity, created_at }` could not serve it: the inbox filters on `status` and sorts on
 * `created_at`, and `severity` sitting between them breaks the sort prefix — `explain()` showed
 * `SORT <- FETCH <- IXSCAN` (audit, Sep 27). Two indexes, each matching a real query shape, and both
 * carrying `_id` because the cursor sorts on `(created_at, _id)`.
 */
FeedbackTicketSchema.index({ status: 1, created_at: -1, _id: -1 });
FeedbackTicketSchema.index({ status: 1, severity: 1, created_at: -1, _id: -1 });
/** "My tickets". */
FeedbackTicketSchema.index({ 'reporter.user_id': 1, created_at: -1, _id: -1 });
/** The kind/category filters on the inbox. */
FeedbackTicketSchema.index({ kind: 1, category: 1, created_at: -1 });
/** Complaints about one event. */
FeedbackTicketSchema.index({ event_id: 1, created_at: -1 }, { sparse: true });

export const FeedbackTicket = model<IFeedbackTicket>('FeedbackTicket', FeedbackTicketSchema, 'feedback_tickets');

/**
 * Rate-limit bookkeeping for a PUBLIC write (plan §5).
 *
 * `POST /feedback` takes no token, so the only handle on a flood is the submitter — an account id
 * when there is one, and otherwise the address. The address is stored **hashed**: it is only ever
 * compared for equality, and a raw-IP column on an anonymous feedback form is a privacy liability
 * nobody asked for. TTL'd, because a rate limit has no memory worth keeping.
 */
export interface IFeedbackThrottle extends Document<string> {
    _id: string;
    /** `user:<id>` or `ip:<sha256>` — never a raw address. */
    subject_key: string;
    created_at: Date;
    expires_at: Date;
}

const FeedbackThrottleSchema = new Schema<IFeedbackThrottle>(
    {
        _id: uuidId,
        subject_key: { type: String, required: true },
        expires_at: { type: Date, required: true },
    },
    timestamps
);

FeedbackThrottleSchema.index({ subject_key: 1, created_at: -1 });
FeedbackThrottleSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const FeedbackThrottle = model<IFeedbackThrottle>(
    'FeedbackThrottle',
    FeedbackThrottleSchema,
    'feedback_throttle'
);

/** Spec §5.12 does not name a number; five an hour is generous for a human and useless for a script. */
export const FEEDBACK_RATE_PER_HOUR = 5;
