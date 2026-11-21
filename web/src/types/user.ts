import type { UserRole } from "./admin";

/** Matches the backend UserStatus enum (shared/models/User.ts). */
export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
    pointsBalance: number;
    joinDate: string;
    /** ISO timestamp of the last authenticated request, if known. */
    lastActiveAt?: string | null;
}

/** One row of GET /users/:ref/audit (latest 50, newest first). */
export interface UserAuditEntry {
    id: string;
    actorId: string | null;
    action: string;
    previousValue: unknown;
    newValue: unknown;
    reason: string | null;
    createdAt: string;
}
