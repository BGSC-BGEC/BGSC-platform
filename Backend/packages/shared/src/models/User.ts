import { Schema, model, Document } from 'mongoose';
import { z } from 'zod';
import { uuidId, timestamps, UserSnapshot } from './shared';

/**
 * User / Auth Service (BE-1). Converted Sep 6, 2026 to the conventions in docs/modeldocs/README.md:
 * snake_case fields and a UUID string `_id`.
 *
 * The `_id` change is not cosmetic. Every BE-2 collection stores a user reference as a String —
 * `point_transactions.user_id`, `teams.members[].user_id`, `leaderboard_entries.participant.id`, and the
 * `{ user_id, display_name, avatar_url }` snapshot in six collections. While `_id` was an ObjectId those
 * lookups compared a string to an ObjectId and matched nothing.
 */

export enum UserRole {
    GUEST = 'guest',
    USER = 'user',
    MEMBER = 'member',
    CORE = 'core',
    COORDINATOR = 'coordinator',
    FOUNDER = 'founder'
}

export enum UserStatus {
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    DELETED = 'deleted'
}

export interface IUser extends Document<string> {
    _id: string;

    // Auth — owned by BE-1's Auth Service
    email: string;
    username: string;
    password_hash?: string;
    google_id?: string | null;
    role: UserRole;
    status: UserStatus;
    is_email_verified: boolean;
    email_verification_token?: string | null;
    email_verification_expires?: Date | null;
    is_phone_verified: boolean;
    pending_phone_number?: string | null;
    phone_verification_otp_hash?: string | null;
    phone_verification_expires?: Date | null;
    phone_verification_attempts?: number;
    refresh_token_hash?: string | null;
    /** Session family of the current refresh token (its `sid` claim). */
    refresh_session_id?: string | null;
    /** Digest of the token the last rotation retired, and when: a second tab's late refresh is not a replay. */
    refresh_previous_hash?: string | null;
    refresh_rotated_at?: Date | null;
    last_login_at?: Date | null;
    password_reset_token?: string | null;
    password_reset_expires?: Date | null;
    oauth_login_code_hash?: string | null;
    oauth_login_code_expires?: Date | null;

    profile: {
        full_name: string;
        avatar_url?: string | null;
        phone_number?: string | null;
        bio?: string;
        interests?: string[];
        social_links?: {
            strava_id?: string | null;
            instagram?: string | null;
            linkedin?: string | null;
            steam_id?: string | null;
        };
    };

    player_card: {
        card_tier?: string;
        stats: Record<string, unknown>;
    };

    /** Written only by the Points Service (relationships.md §1). */
    points_balance?: number;

    /** Written only by the Announcement Service (announcement-model.md §3). */
    announcements: {
        last_seen_at?: Date | null;
        read_ids: string[];
    };

    settings: {
        notifications: {
            email: boolean;
            whatsapp: boolean;
        };
        privacy: {
            is_profile_public: boolean;
        };
        theme: 'light' | 'dark' | 'system';
    };

    last_active_at?: Date | null;
    deleted_at?: Date | null;
    /** Last self-service restore. The UserRestored replay sweep keys on it. */
    restored_at?: Date | null;

    /** Set when the account is deleted; see docs Spec §11.2.1. Cleared on restore. */
    deletion?: {
        reason?: string | null;
        /** Opt-in (default false): may this person's identifiable data be USED for research. */
        research_consent: boolean;
        /**
         * Self-service restore is possible until this instant. After it the account cannot be
         * restored, and its email, username and verified phone go to the next sign-up that asks.
         */
        restorable_until: Date;
        /** Exact disclosure text shown at the gate, stored so we can prove what they agreed to. */
        disclosure_version: string;
        /** Status at the moment of deletion. Restore puts it back — deleting must not lift a suspension. */
        prior_status?: UserStatus;
    } | null;

    created_at: Date;
    updated_at: Date;
}

const UserSchema = new Schema<IUser>(
    {
        _id: uuidId,

        // Auth
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        username: { type: String, required: true, unique: true, lowercase: true, trim: true },
        // Secrets never load on an ordinary read; ask for them explicitly with .select('+password_hash').
        password_hash: { type: String, select: false },
        google_id: { type: String, default: null, sparse: true, select: false },
        role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
        status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
        is_email_verified: { type: Boolean, default: false },
        // Every one-time token below is stored as a sha256 hex digest, never the raw value: a read of
        // this collection must not be enough to reset a password or resume a session.
        // The refresh token is sha256 rather than bcrypt because bcrypt reads only the first 72 bytes,
        // which for a JWT is the header plus half the user id — every refresh token a user was ever
        // issued matched the stored hash.
        email_verification_token: { type: String, default: null, select: false },
        email_verification_expires: { type: Date, default: null, select: false },
        is_phone_verified: { type: Boolean, default: false },
        pending_phone_number: { type: String, default: null, select: false },
        phone_verification_otp_hash: { type: String, default: null, select: false },
        phone_verification_expires: { type: Date, default: null, select: false },
        phone_verification_attempts: { type: Number, default: 0, select: false },
        refresh_token_hash: { type: String, default: null, select: false },
        refresh_session_id: { type: String, default: null, select: false },
        refresh_previous_hash: { type: String, default: null, select: false },
        refresh_rotated_at: { type: Date, default: null, select: false },
        last_login_at: { type: Date, default: null },
        password_reset_token: { type: String, default: null, select: false },
        password_reset_expires: { type: Date, default: null, select: false },
        // One-time code the Google callback hands the browser instead of the tokens themselves.
        oauth_login_code_hash: { type: String, default: null, select: false },
        oauth_login_code_expires: { type: Date, default: null, select: false },

        // Profile
        profile: {
            full_name: { type: String, required: true, trim: true },
            avatar_url: { type: String, default: null },
            phone_number: { type: String, default: null },
            bio: { type: String, maxlength: 250, default: '' },
            interests: { type: [String], default: [] },
            social_links: {
                strava_id: { type: String, default: null },
                instagram: { type: String, default: null },
                linkedin: { type: String, default: null },
                steam_id: { type: String, default: null },
            },
        },

        // Player card & points
        player_card: {
            card_tier: { type: String, default: 'Rookie' },
            stats: { type: Schema.Types.Mixed, default: {} },
        },
        points_balance: { type: Number, default: 0 },

        // Announcement read state (announcement-model.md §3). read_ids capped at 200 by the owner service.
        announcements: {
            last_seen_at: { type: Date, default: null },
            read_ids: { type: [String], default: [] },
        },

        // Settings
        settings: {
            notifications: {
                email: { type: Boolean, default: true },
                whatsapp: { type: Boolean, default: true },
            },
            privacy: {
                is_profile_public: { type: Boolean, default: true },
            },
            theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        },

        last_active_at: { type: Date, default: null },

        /**
         * Deletion hides the account; nothing is destroyed and no purge job exists (Spec §11.2.1).
         * The ACCOUNT_DELETION_GRACE_DAYS window governs self-service RESTORE, not erasure.
         */
        deleted_at: { type: Date, default: null },
        restored_at: { type: Date, default: null },
        deletion: {
            type: new Schema(
                {
                    reason: { type: String, default: null, maxlength: 500 },
                    research_consent: { type: Boolean, required: true, default: false },
                    restorable_until: { type: Date, required: true },
                    disclosure_version: { type: String, required: true },
                    // No default. A missing value means "not recorded" (pre-Sep-26 deletions), and
                    // defaulting it to active would wave a suspended-then-deleted account back in.
                    prior_status: { type: String, enum: Object.values(UserStatus) },
                },
                { _id: false }
            ),
            default: null,
        },
    },
    timestamps
);

// `email` and `username` already have unique indexes from their field definitions above.
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ points_balance: -1 }); // fast leaderboard querying
UserSchema.index({ created_at: -1 });
UserSchema.index({ last_active_at: -1 });
UserSchema.index({ restored_at: 1 }, { partialFilterExpression: { restored_at: { $type: 'date' } } }); // UserRestored replay
UserSchema.index({ deleted_at: 1 }); // UserDeleted replay sweep: 'who deleted recently'
UserSchema.index({ username: 'text', 'profile.full_name': 'text' }); // user search (Spec §13.1)

// One-time token lookups. Partial so the null default on every other row costs nothing.
for (const field of ['email_verification_token', 'password_reset_token', 'oauth_login_code_hash']) {
    UserSchema.index({ [field]: 1 }, { partialFilterExpression: { [field]: { $type: 'string' } } });
}

/**
 * One account per verified phone number.
 *
 * Partial on `is_phone_verified` rather than covering every stored number: a profile update can
 * put an unverified number on file, and a plain unique index would let anyone squat a number they
 * do not own and lock its real owner out of verification. Only a number someone actually proved
 * they control is claimed.
 */
UserSchema.index(
    { 'profile.phone_number': 1 },
    {
        unique: true,
        partialFilterExpression: { is_phone_verified: true, 'profile.phone_number': { $type: 'string' } },
    }
);

export const User = model<IUser>('User', UserSchema, 'users');

/**
 * Self-service restore window for a soft-deleted account. Spec §11.2 says 45 days, then permanent
 * purge; nothing is purged here. Past the window the account simply cannot be restored, and its
 * unique keys (email, username, verified phone) are released when a new sign-up needs them.
 *
 * One constant, here beside the model it governs, because two services read it: User Service
 * reports it and stamps `deletion.restorable_until`, Auth Service decides whether a deleted user
 * may sign back in. They were 30 and 45 respectively, which left days 31–45 telling the user they
 * could restore while the restore path refused them.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 45;

/**
 * Until when a deleted account may restore itself; null for a live one. The stamped
 * `deletion.restorable_until` wins over recomputing from `deleted_at`: it is what the user was told.
 */
export function restorableUntil(user: { deleted_at?: Date | null; deletion?: { restorable_until?: Date } | null }): Date | null {
    if (!user.deleted_at) return null;
    return user.deletion?.restorable_until ?? new Date(user.deleted_at.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * `/users/<x>` segments User Service routes literally. A user with one of these names could never
 * be looked up by name — the literal route answers first.
 */
export const RESERVED_USERNAMES: readonly string[] = ['me', 'search'];

/**
 * Phone numbers are stored in one spelling, E.164, so the unique index on verified numbers sees
 * `+91 98765-43210` and `+919876543210` as the same number. Separators are stripped, then the
 * shape is checked; the country code is required.
 */
export const phoneNumberSchema = z
    .string()
    .transform((s) => s.replace(/[\s\-().]/g, ''))
    .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, { message: 'phone_number must be E.164, e.g. +919876543210' }));

/**
 * The `{ user_id, display_name, avatar_url }` snapshot embedded by form_submissions, teams,
 * leaderboard_entries, challenge_participations, announcements and auction_lots
 * (relationships.md §4).
 *
 * Lives here, next to the model it projects, so "what a display name is" has exactly one
 * definition. Services read `users` directly — the ownership table (relationships.md §1) makes
 * every service a reader of `users`, and only User/Auth Service a writer.
 */
export function userSnapshotOf(user: IUser): UserSnapshot {
    return {
        user_id: user._id,
        display_name: user.profile?.full_name ?? user.username,
        avatar_url: user.profile?.avatar_url ?? null,
        // Explicit rather than defaulted: a snapshot taken of a live account says so, and the
        // `UserDeleted` consumers are the only thing that ever flips it.
        deleted: false,
    };
}
