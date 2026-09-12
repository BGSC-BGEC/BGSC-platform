import { Schema, model, Document } from 'mongoose';
import { uuidId } from './shared';

/**
 * Immutable audit trail. Spec §7.3: "All role changes, event deletions, point modifications,
 * sponsor changes, and auction overrides logged immutably." Columns match the §5.15.5 Audit Log
 * Explorer and the Spec §4.1 AuditLog entity.
 *
 * Not in Saturday's Core Data Models list — a plan gap, same category as the Team model
 * (docs/modeldocs/README.md "Plan gaps found while designing"). Added Sep 6 because both
 * BE-1 (coordinator promotion) and BE-2 (role/status endpoints) are required to write to it.
 *
 * Append-only, like point_transactions. An audit trail that can be updated is not one.
 */

export const AUDIT_TARGET_TYPE = [
    'user',
    'event',
    'team',
    'registration',
    'point_transaction',
    'leaderboard_entry',
    'challenge',
    'announcement',
    'auction_lot',
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPE)[number];

export interface IAuditLog extends Document<string> {
    _id: string;
    actor_id: string | null;
    action: string;
    target_type: AuditTargetType;
    target_id: string;
    previous_value: unknown;
    new_value: unknown;
    /** Spec §5.15.5: promotions require "operational authorization logs detailing justifications". */
    reason: string | null;
    ip: string | null;
    created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        _id: uuidId,
        // null only for system-initiated actions (schedulers, expiry jobs).
        actor_id: { type: String, default: null },
        // Machine key: 'user.role_changed', 'user.suspended', 'event.deleted', 'points.adjusted'.
        action: { type: String, required: true, match: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/ },
        target_type: { type: String, enum: AUDIT_TARGET_TYPE, required: true },
        target_id: { type: String, required: true },
        // Only the fields that moved, not whole documents — an audit row is a diff, not a snapshot.
        previous_value: { type: Schema.Types.Mixed, default: null },
        new_value: { type: Schema.Types.Mixed, default: null },
        reason: { type: String, default: null },
        ip: { type: String, default: null },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

AuditLogSchema.pre('validate', function (this: IAuditLog) {
    if (this.previous_value === null && this.new_value === null) {
        throw new Error('AuditLog invariant: a row must record at least one of previous_value / new_value');
    }
});

/** Spec §7.3 says immutable. Block every query that would rewrite history. */
AuditLogSchema.pre(
    /^(updateOne|updateMany|replaceOne|deleteOne|deleteMany|findOneAndUpdate|findOneAndReplace|findOneAndDelete)$/,
    function () {
        throw new Error('audit_logs is append-only: entries are never modified or removed');
    }
);

AuditLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 }); // "history of this user"
AuditLogSchema.index({ actor_id: 1, created_at: -1 }); // "what did this admin do"
AuditLogSchema.index({ action: 1, created_at: -1 }); // Audit Log Explorer filter (§5.15.5)
AuditLogSchema.index({ created_at: -1 }); // 7-year retention sweep (§15.3)

export const AuditLog = model<IAuditLog>('AuditLog', AuditLogSchema, 'audit_logs');

/**
 * Single place audit rows are written. Callers pass the diff, not the document, so a whole user
 * record (hashes included) can never be copied into the trail by accident.
 */
export async function recordAudit(entry: {
    actor_id: string | null;
    action: string;
    target_type: AuditTargetType;
    target_id: string;
    previous_value?: unknown;
    new_value?: unknown;
    reason?: string | null;
    ip?: string | null;
}): Promise<IAuditLog> {
    return AuditLog.create({
        previous_value: null,
        new_value: null,
        reason: null,
        ip: null,
        ...entry,
    });
}
