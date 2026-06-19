/**
 * Shared domain & state types for the MVVM layer.
 *
 * This file is mirrored (intentionally duplicated) in the web app — the two
 * clients follow one identical pattern. Keep the two copies in sync until a
 * shared package is introduced.
 */

/** Generic async state used by ViewModels to drive loading/success/error UI. */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data?: T;
  error?: string;
}

export function idle<T>(): AsyncState<T> {
  return { status: 'idle' };
}

/** Roles as defined by the backend RBAC (spec §7.1). */
export type UserRole = 'guest' | 'user' | 'member' | 'core' | 'coordinator' | 'founder';

export type UserStatus = 'active' | 'suspended' | 'pending_deletion';

/** Public/own user shape returned by the user-service. */
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  contact?: string | null;
  avatarUrl?: string | null;
  pointsBalance?: number;
  activeSponsorId?: string | null;
  createdAt?: string;
  lastActive?: string;
}

/** Response shape of POST /auth/login and /auth/register. */
export interface AuthResponse {
  user: User;
  accessToken: string;
  isNewUser?: boolean;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  acceptedTos: boolean;
  contact?: string;
}

export interface LoginInput {
  usernameOrEmail: string;
  password: string;
}

/** Event entity, trimmed to MVP fields (spec §4 / Milestone 1.2). */
export type EventType = 'LE' | 'DE' | 'ALL' | 'DLL';
export type EventStatus = 'upcoming' | 'ongoing' | 'past';

export interface PlatformEvent {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  startDate: string;
  endDate: string;
  venue?: string;
}
