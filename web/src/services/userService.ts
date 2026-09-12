import { apiClient } from './apiClient'
import type { User } from '../types/user'
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
}

interface BackendUsersResponse {
    users?: RawBackendUser[]
    next_cursor?: string
}

function mapBackendUser(raw: RawBackendUser): User {
    return {
    id: raw.id,
    name: raw.profile?.full_name || raw.username || 'Anonymous',
    username: raw.username,
    email: raw.email || '',
    phone: raw.profile?.phone_number || '',
    role: (raw.role as User['role']) || 'member',
    status: (raw.status as User['status']) || 'active',
    pointsBalance: raw.points_balance ?? 0,
    joinDate: raw.created_at
        ? new Date(raw.created_at).toLocaleDateString()
        : new Date().toLocaleDateString(),
    }
}

export async function getUsers(): Promise<User[]> {
    if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return DEFAULT_USER_DATA
    }

    try {
    const response = await apiClient.get<BackendUsersResponse | RawBackendUser[]>('/users')
    // Handle both { users: [...] } envelope and bare array
    const rawList = Array.isArray(response) ? response : response?.users || []
    return rawList.map(mapBackendUser)
    } catch (error) {
    console.warn('[userService] Backend unreachable, falling back to mock data:', error)
    return DEFAULT_USER_DATA
    }
}

export async function getUserById(id: string): Promise<User | null> {
    if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return DEFAULT_USER_DATA.find((u) => u.id === id) || null
    }

    try {
    const response = await apiClient.get<RawBackendUser | { user: RawBackendUser }>(`/users/${id}`)
    const raw = 'user' in response && response.user ? response.user : (response as RawBackendUser)
    return raw ? mapBackendUser(raw) : null
    } catch (error) {
    console.warn(`[userService] Backend unreachable for user ${id}, falling back to mock:`, error)
    return DEFAULT_USER_DATA.find((u) => u.id === id) || null
    }
}

export const userService = {
    getUsers,
    getUserById,
}

export default userService