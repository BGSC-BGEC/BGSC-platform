import { apiClient } from './apiClient'
import type { User, UserAuditEntry } from '../types/user'
import type { UserRole } from '../types/admin'
import { DEFAULT_USER_DATA } from '../data/usersData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

interface RawBackendUser {
    id: string
    username: string
    email?: string
    role?: string
    status?: string
    profile?: {
        full_name?: string
        phone_number?: string | null
        avatar_url?: string | null
        bio?: string
        interests?: string[]
    }
    points_balance?: number
    created_at?: string
    last_active_at?: string | null
}

interface BackendUsersResponse {
    users?: RawBackendUser[]
    next_cursor?: string | null
}

interface RawAuditRow {
    _id?: string
    id?: string
    actor_id: string | null
    action: string
    previous_value: unknown
    new_value: unknown
    reason: string | null
    created_at: string
}

function mapBackendUser(raw: RawBackendUser): User {
    return {
        id: raw.id,
        name: raw.profile?.full_name || raw.username || 'Anonymous',
        username: raw.username,
        email: raw.email || '',
        phone: raw.profile?.phone_number || '',
        role: (raw.role as User['role']) || 'user',
        status: (raw.status as User['status']) || 'active',
        pointsBalance: raw.points_balance ?? 0,
        joinDate: raw.created_at
            ? new Date(raw.created_at).toLocaleDateString()
            : new Date().toLocaleDateString(),
        lastActiveAt: raw.last_active_at ?? null,
    }
}

/**
 * Every user, following the cursor. GET /users pages (max 100); reading only the first page is
 * why the directory and the dashboard used to stop at 25 members.
 */
export async function getUsers(): Promise<User[]> {
    if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        return DEFAULT_USER_DATA
    }

    const all: RawBackendUser[] = []
    let cursor: string | null | undefined
    for (let page = 0; page < 200; page++) {
        const qs = `limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
        const response = await apiClient.get<BackendUsersResponse | RawBackendUser[]>(`/users?${qs}`)
        if (Array.isArray(response)) return response.map(mapBackendUser)
        all.push(...(response?.users || []))
        cursor = response?.next_cursor
        if (!cursor) break
    }
    return all.map(mapBackendUser)
}

export async function getUserById(id: string): Promise<User | null> {
    if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 150))
        return DEFAULT_USER_DATA.find((u) => u.id === id) || null
    }

    const response = await apiClient.get<RawBackendUser | { user: RawBackendUser }>(`/users/${id}`)
    const raw = 'user' in response && response.user ? response.user : (response as RawBackendUser)
    return raw ? mapBackendUser(raw) : null
}

/**
 * Role change. `reason` is the admin's written justification — required by the backend and stored
 * in the audit log. Who may grant what is enforced server-side (an admin must outrank both the
 * current and the new role, so only a founder can grant or remove coordinator).
 * Throws the backend error so the dialog can show it.
 */
export async function updateUserRole(id: string, newRole: UserRole, reason: string): Promise<User> {
    if (isMock) {
        const user = DEFAULT_USER_DATA.find((u) => u.id === id)
        if (!user) throw new Error('not_found')
        user.role = newRole
        return { ...user }
    }
    const raw = await apiClient.patch<RawBackendUser>(`/users/${id}/role`, { role: newRole, reason })
    return mapBackendUser(raw)
}

/** Suspend / reactivate with the admin's written reason (audited). Throws on refusal. */
export async function updateUserStatus(
    id: string,
    newStatus: 'active' | 'suspended',
    reason: string
): Promise<User> {
    if (isMock) {
        const user = DEFAULT_USER_DATA.find((u) => u.id === id)
        if (!user) throw new Error('not_found')
        user.status = newStatus
        return { ...user }
    }
    const raw = await apiClient.patch<RawBackendUser>(`/users/${id}/status`, { status: newStatus, reason })
    return mapBackendUser(raw)
}

/** Audit trail for one user (coordinator+): role/status changes and other admin actions. */
export async function getUserAudit(id: string): Promise<UserAuditEntry[]> {
    if (isMock) return []
    const res = await apiClient.get<{ entries?: RawAuditRow[] }>(`/users/${id}/audit`)
    return (res?.entries || []).map((r) => ({
        id: String(r._id || r.id || ''),
        actorId: r.actor_id,
        action: r.action,
        previousValue: r.previous_value,
        newValue: r.new_value,
        reason: r.reason,
        createdAt: r.created_at,
    }))
}

export const userService = {
    getUsers,
    getUserById,
    updateUserRole,
    updateUserStatus,
    getUserAudit,
}

export default userService
