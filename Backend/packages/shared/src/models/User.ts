import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

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
    PENDING_VERIFICATION = 'pending_verification',
    DELETED = 'deleted'
}

export interface IUser extends Document<string> {
    _id: string;

    // Auth — owned by BE-1's Auth Service
    email: string;
    username: string;
    password_hash: string;
    role: UserRole;
    status: UserStatus;
    is_email_verified: boolean;
    refresh_token_hash?: string | null;
    last_login_at?: Date | null;
    password_reset_token?: string | null;
    password_reset_expires?: Date | null;

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

    /** Set when the account is deleted; see docs Spec §11.2.1. Cleared on restore. */
    deletion?: {
        reason?: string | null;
        /** Opt-in (default false): may this person's identifiable data be USED for research. */
        research_consent: boolean;
        /** Self-service restore is possible until this instant; after it, admin only. */
        restorable_until: Date;
        /** Exact disclosure text shown at the gate, stored so we can prove what they agreed to. */
        disclosure_version: string;
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
        password_hash: { type: String, required: true, select: false },
        role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
        status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },
        is_email_verified: { type: Boolean, default: false },
        refresh_token_hash: { type: String, default: null, select: false },
        last_login_at: { type: Date, default: null },
        password_reset_token: { type: String, default: null, select: false },
        password_reset_expires: { type: Date, default: null, select: false },

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
         * The 30 days govern self-service RESTORE, not erasure.
         */
        deleted_at: { type: Date, default: null },
        deletion: {
            type: new Schema(
                {
                    reason: { type: String, default: null, maxlength: 500 },
                    research_consent: { type: Boolean, required: true, default: false },
                    restorable_until: { type: Date, required: true },
                    disclosure_version: { type: String, required: true },
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
UserSchema.index({ deleted_at: 1 }); // purge/restore-window sweeps, and 'who deleted recently' // admin "Last Active Epoch" column (Spec §5.15.5)
UserSchema.index({ username: 'text', 'profile.full_name': 'text' }); // user search (Spec §13.1)

export const User = model<IUser>('User', UserSchema, 'users');
