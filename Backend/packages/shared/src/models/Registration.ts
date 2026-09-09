import { Schema, model, Document } from 'mongoose';
import {
    uuidId,
    timestamps,
    UserSnapshot,
    UserSnapshotSchema,
    KEY_PATTERN,
    FORM_OWNER_TYPE,
    FormOwnerType,
    StatusHistoryItem,
    StatusHistorySchema,
} from './shared';

/**
 * Common Registration Service. See docs/modeldocs/registration-model.md.
 * Collections: `form_definitions`, `form_definition_versions`, `form_submissions`.
 *
 * "Registering for an event" IS creating a form_submissions doc. One service answers
 * "what does this thing ask people to fill in?" for any owner — events today, challenges later.
 */

export interface FormOwner {
    type: FormOwnerType;
    id: string | null; // null only for 'generic' forms
}

const FormOwnerSchema = new Schema<FormOwner>(
    {
        type: { type: String, enum: FORM_OWNER_TYPE, required: true },
        id: { type: String, default: null },
    },
    { _id: false }
);

/* ------------------------------------------------------------------ *
 * form_definitions
 * ------------------------------------------------------------------ */

export const FIELD_TYPE = [
    'short_text',
    'long_text',
    'number',
    'email',
    'phone',
    'url',
    'select',
    'multi_select',
    'checkbox',
    'date',
    'file',
    'user_ref',
] as const;
export const VISIBLE_IF_OP = ['eq', 'neq', 'in'] as const;
export const FORM_STATUS = ['draft', 'published', 'archived'] as const;
export const ALLOW_EDIT_UNTIL = ['closes_at', 'never', 'always'] as const;

export type FieldType = (typeof FIELD_TYPE)[number];
export type VisibleIfOp = (typeof VISIBLE_IF_OP)[number];
export type FormStatus = (typeof FORM_STATUS)[number];
export type AllowEditUntil = (typeof ALLOW_EDIT_UNTIL)[number];

export interface FormField {
    key: string;
    label: string;
    help_text: string | null;
    type: FieldType;
    required: boolean;
    placeholder: string | null;
    options: { value: string; label: string }[] | null;
    validation: {
        min: number | null;
        max: number | null;
        pattern: string | null;
        accept: string[] | null;
        max_size_bytes: number | null;
    };
    visible_if: { field_key: string; op: VisibleIfOp; value: unknown } | null;
    admin_only: boolean;
    order: number;
}

const FormFieldSchema = new Schema<FormField>(
    {
        key: { type: String, required: true, match: KEY_PATTERN },
        label: { type: String, required: true },
        help_text: { type: String, default: null },
        type: { type: String, enum: FIELD_TYPE, required: true },
        required: { type: Boolean, default: false }, // Spec §5.5 "compulsory or not"
        placeholder: { type: String, default: null },
        options: {
            type: [new Schema({ value: { type: String, required: true }, label: { type: String, required: true } }, { _id: false })],
            default: null,
        },
        validation: {
            // min/max mean: number -> value, text -> length, multi_select -> count
            min: { type: Number, default: null },
            max: { type: Number, default: null },
            pattern: { type: String, default: null },
            accept: { type: [String], default: null }, // file mime types
            max_size_bytes: { type: Number, default: null },
        },
        visible_if: {
            type: new Schema(
                {
                    field_key: { type: String, required: true },
                    op: { type: String, enum: VISIBLE_IF_OP, required: true },
                    value: { type: Schema.Types.Mixed },
                },
                { _id: false }
            ),
            default: null,
        },
        admin_only: { type: Boolean, default: false }, // filled by admin, rejected on a user submission
        order: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

export interface IFormDefinition extends Document<string> {
    _id: string;
    owner: FormOwner;
    title: string;
    description: string | null;
    version: number;
    status: FormStatus;
    fields: FormField[];
    settings: {
        allow_edit_until: AllowEditUntil;
        confirmation_message: string | null;
    };
    created_by: string;
    created_at: Date;
    updated_at: Date;
    published_at: Date | null;
}

const FormDefinitionSchema = new Schema<IFormDefinition>(
    {
        _id: uuidId,
        owner: { type: FormOwnerSchema, required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: null },

        // Fields are immutable once published: editing bumps version and archives the old fields.
        version: { type: Number, default: 1, min: 1 },
        status: { type: String, enum: FORM_STATUS, default: 'draft' },
        fields: { type: [FormFieldSchema], default: [] },

        settings: {
            allow_edit_until: { type: String, enum: ALLOW_EDIT_UNTIL, default: 'closes_at' },
            confirmation_message: { type: String, default: null },
        },

        created_by: { type: String, required: true },
        published_at: { type: Date, default: null },
    },
    timestamps
);

FormDefinitionSchema.pre('validate', function (this: IFormDefinition) {
    const f = this;
    const keys = f.fields.map((x) => x.key);
    if (new Set(keys).size !== keys.length) throw new Error('FormDefinition invariant: fields[].key must be unique');

    const needsOptions = (t: FieldType) => t === 'select' || t === 'multi_select';
    for (const field of f.fields) {
        if (needsOptions(field.type) && (!field.options || field.options.length === 0)) {
            throw new Error(`FormDefinition invariant: field '${field.key}' of type ${field.type} needs options`);
        }
        if (field.visible_if && !keys.includes(field.visible_if.field_key)) {
            throw new Error(`FormDefinition invariant: field '${field.key}' references unknown visible_if.field_key`);
        }
    }
    if (f.status === 'published' && f.fields.length === 0) {
        throw new Error('FormDefinition invariant: cannot publish a form with no fields');
    }
});

FormDefinitionSchema.index({ 'owner.type': 1, 'owner.id': 1 });
FormDefinitionSchema.index({ status: 1 });
FormDefinitionSchema.index({ created_by: 1 });

export const FormDefinition = model<IFormDefinition>('FormDefinition', FormDefinitionSchema, 'form_definitions');

/**
 * Frozen copy of a published form's fields, so submissions made against an old version still render.
 * ponytail: history in a side collection instead of an array on the definition — keeps the hot doc small.
 */
export interface IFormDefinitionVersion extends Document<string> {
    _id: string;
    form_id: string;
    version: number;
    fields: FormField[];
    published_at: Date;
}

const FormDefinitionVersionSchema = new Schema<IFormDefinitionVersion>(
    {
        _id: uuidId,
        form_id: { type: String, required: true },
        version: { type: Number, required: true, min: 1 },
        fields: { type: [FormFieldSchema], required: true },
        published_at: { type: Date, required: true, default: Date.now },
    },
    { versionKey: false }
);

FormDefinitionVersionSchema.index({ form_id: 1, version: 1 }, { unique: true });

export const FormDefinitionVersion = model<IFormDefinitionVersion>(
    'FormDefinitionVersion',
    FormDefinitionVersionSchema,
    'form_definition_versions'
);

/* ------------------------------------------------------------------ *
 * form_submissions
 * ------------------------------------------------------------------ */

export const SUBMISSION_STATUS = [
    'draft',
    'submitted',
    'confirmed',
    'waitlisted',
    'rejected',
    'cancelled',
] as const;
export const EVENT_ROLE = ['solo', 'captain', 'member'] as const;
export const TEAM_VISIBILITY = ['open', 'invite_only', 'closed'] as const;
export const CAPTAIN_APPLICATION_STATUS = ['none', 'pending', 'approved', 'declined'] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];
export type EventRole = (typeof EVENT_ROLE)[number];
export type TeamVisibility = (typeof TEAM_VISIBILITY)[number];
export type CaptainApplicationStatus = (typeof CAPTAIN_APPLICATION_STATUS)[number];

/** Only `confirmed` counts as "registered" for points, leaderboard and teams. */
export const REGISTERED_STATUS: SubmissionStatus = 'confirmed';
/** Statuses that no longer occupy the one-active-registration-per-user slot. */
export const INACTIVE_SUBMISSION_STATUS: SubmissionStatus[] = ['cancelled', 'rejected'];

/**
 * The complement of INACTIVE_SUBMISSION_STATUS, enumerated rather than negated.
 *
 * MongoDB rejects `$nin` (and `$not`) inside a partialFilterExpression — only `$eq`, `$exists`,
 * range operators, `$type`, `$and`, `$or` and `$in` are allowed. Written as a negation the index
 * is silently never created, which quietly removes the duplicate-registration guard entirely.
 * The status enum is closed, so listing the active states is exactly equivalent.
 */
export const ACTIVE_SUBMISSION_STATUS: SubmissionStatus[] = [
    'draft',
    'submitted',
    'confirmed',
    'waitlisted',
];

export interface IFormSubmission extends Document<string> {
    _id: string;
    form_id: string;
    form_version: number;
    owner: FormOwner;
    user: UserSnapshot;

    answers: Record<string, unknown>;
    files: { field_key: string; url: string; name: string; size: number; mime: string }[];

    context: {
        event?: {
            role: EventRole;
            team_id: string | null;
            team_visibility: TeamVisibility;
            base_price: number | null;
            captain_application: {
                status: CaptainApplicationStatus;
                reviewed_by: string | null;
                reviewed_at: Date | null;
                note: string | null;
            };
            attended: boolean | null;
        };
        challenge?: {
            team_id: string | null;
        };
    };

    status: SubmissionStatus;
    waitlist_position: number | null;
    status_history: StatusHistoryItem[];

    submitted_at: Date | null;
    confirmed_at: Date | null;
    cancelled_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

const SubmissionFileSchema = new Schema(
    {
        field_key: { type: String, required: true },
        url: { type: String, required: true },
        name: { type: String, required: true },
        size: { type: Number, required: true, min: 0 },
        mime: { type: String, required: true },
    },
    { _id: false }
);

const EventContextSchema = new Schema(
    {
        role: { type: String, enum: EVENT_ROLE, required: true },
        team_id: { type: String, default: null },
        // Spec §5.5 per-user-per-event toggle: controls whether others may invite this user to a team.
        team_visibility: { type: String, enum: TEAM_VISIBILITY, default: 'open' },
        base_price: { type: Number, default: null, min: 0 }, // auction leagues only
        captain_application: {
            status: { type: String, enum: CAPTAIN_APPLICATION_STATUS, default: 'none' },
            reviewed_by: { type: String, default: null },
            reviewed_at: { type: Date, default: null },
            note: { type: String, default: null },
        },
        attended: { type: Boolean, default: null },
    },
    { _id: false }
);

const FormSubmissionSchema = new Schema<IFormSubmission>(
    {
        _id: uuidId,
        form_id: { type: String, required: true },
        form_version: { type: Number, required: true, min: 1 }, // which field set this was validated against
        owner: { type: FormOwnerSchema, required: true }, // denormalized from the form; immutable
        user: { type: UserSnapshotSchema, required: true },

        // Validated against form_definition_versions[form_version] by the Registration Service, not by mongoose.
        answers: { type: Schema.Types.Mixed, default: {} },
        files: { type: [SubmissionFileSchema], default: [] },

        // Exactly one branch populated, matching owner.type.
        context: {
            event: { type: EventContextSchema, default: undefined },
            challenge: {
                type: new Schema({ team_id: { type: String, default: null } }, { _id: false }),
                default: undefined,
            },
        },

        status: { type: String, enum: SUBMISSION_STATUS, default: 'draft' },
        waitlist_position: { type: Number, default: null, min: 0 },
        status_history: { type: [StatusHistorySchema], default: [] },

        submitted_at: { type: Date, default: null },
        confirmed_at: { type: Date, default: null },
        cancelled_at: { type: Date, default: null },
    },
    timestamps
);

// registration-model.md §3.2.1
FormSubmissionSchema.pre('validate', function (this: IFormSubmission) {
    const s = this;
    const fail = (msg: string): never => {
        throw new Error(`FormSubmission invariant: ${msg}`);
    };

    const ctx = s.context ?? {};
    if (s.owner.type === 'event' && (!ctx.event || ctx.challenge)) return fail("owner 'event' requires context.event and no context.challenge");
    if (s.owner.type === 'challenge' && (!ctx.challenge || ctx.event)) return fail("owner 'challenge' requires context.challenge and no context.event");
    if (s.owner.type === 'generic' && (ctx.event || ctx.challenge)) return fail("owner 'generic' takes no context branch");

    if (ctx.event) {
        if (ctx.event.team_id !== null && s.status !== 'confirmed') {
            return fail('a team_id may only be set on a confirmed registration');
        }
    }

    if ((s.waitlist_position !== null) !== (s.status === 'waitlisted')) {
        return fail("waitlist_position must be set exactly when status == 'waitlisted'");
    }
});

/**
 * One active registration per user per form. Partial so a cancelled/rejected user can re-register.
 * The DB enforces this, not the app — duplicates are the common failure and must cost nothing to reject.
 */
FormSubmissionSchema.index(
    { form_id: 1, 'user.user_id': 1 },
    { unique: true, partialFilterExpression: { status: { $in: ACTIVE_SUBMISSION_STATUS } } }
);
FormSubmissionSchema.index({ 'owner.id': 1, status: 1, submitted_at: 1 }); // participants list, waitlist order, CSV
FormSubmissionSchema.index({ 'user.user_id': 1, 'owner.type': 1, submitted_at: -1 }); // profile History
FormSubmissionSchema.index({ 'owner.id': 1, 'context.event.team_visibility': 1, status: 1 }); // users open to join
FormSubmissionSchema.index({ 'owner.id': 1, 'context.event.captain_application.status': 1 }); // captain review queue
FormSubmissionSchema.index({ 'owner.id': 1, 'context.event.role': 1 }); // auction: members with a base_price

export const FormSubmission = model<IFormSubmission>('FormSubmission', FormSubmissionSchema, 'form_submissions');
