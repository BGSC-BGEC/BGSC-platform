import { apiClient } from './apiClient'
import type { User } from '../types/user'
import { DEFAULT_USER_DATA } from '../data/usersData'
const isMock = import.meta.env.VITE_USE_MOCK === 'true'


export async function getUsers(): Promise<User[]> {
    if (isMock) {
    // Simulate network latency (250ms) to test loading states
    await new Promise((resolve) => setTimeout(resolve, 250))
    return DEFAULT_USER_DATA
    }

    try {
    return await apiClient.get<User[]>('/users')
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
    return await apiClient.get<User>(`/users/${id}`)
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