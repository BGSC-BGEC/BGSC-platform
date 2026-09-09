import { randomUUID } from 'crypto';
import { Schema } from 'mongoose';

/**
 * Conventions from docs/modeldocs/README.md:
 *  - _id is a service-generated UUID v4 string, not an ObjectId (portable across services, safe in JWTs/URLs/events).
 *  - Field names are snake_case; timestamps are UTC and end in _at.
 *  - Cross-service references are ID strings only. No joins.
 */

export const uuidId = { type: String, default: () => randomUUID() };

/** created_at / updated_at instead of mongoose's default createdAt / updatedAt. */
export const timestamps = {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
} as const;

/**
 * Display-only copy of another service's user (relationships.md §4).
 * Accepted stale. Never read for authorization or points math — those re-fetch by ID.
 */
export interface UserSnapshot {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
}

export const UserSnapshotSchema = new Schema<UserSnapshot>(
    {
        user_id: { type: String, required: true },
        display_name: { type: String, required: true },
        avatar_url: { type: String, default: null },
    },
    { _id: false }
);

/** Polymorphic owner ref used by teams and form_definitions/form_submissions. */
export const OWNER_TYPE = ['event', 'challenge'] as const;
export type OwnerType = (typeof OWNER_TYPE)[number];

export const FORM_OWNER_TYPE = ['event', 'challenge', 'generic'] as const;
export type FormOwnerType = (typeof FORM_OWNER_TYPE)[number];

export interface Owner {
    type: OwnerType;
    id: string;
}

export const OwnerSchema = new Schema<Owner>(
    {
        type: { type: String, enum: OWNER_TYPE, required: true },
        id: { type: String, required: true },
    },
    { _id: false }
);

/** Status transition audit trail embedded on registrations and challenge participations. */
export interface StatusHistoryItem {
    from: string;
    to: string;
    by: string;
    at: Date;
    reason?: string | null;
}

export const StatusHistorySchema = new Schema<StatusHistoryItem>(
    {
        from: { type: String, required: true },
        to: { type: String, required: true },
        by: { type: String, required: true },
        at: { type: Date, required: true, default: Date.now },
        reason: { type: String, default: null },
    },
    { _id: false }
);

/** Machine key shared by scoring parameters, form fields and point rule ids. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

/** Role ladder, shared with BE-1's UserRole. Index = rank, used by announcement audience checks. */
export const ROLE_RANK = ['guest', 'user', 'member', 'core', 'coordinator', 'founder'] as const;
export type RoleName = (typeof ROLE_RANK)[number];

export function roleRank(role: RoleName): number {
    return ROLE_RANK.indexOf(role);
}
