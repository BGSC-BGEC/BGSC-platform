import { apiClient } from '../api/ApiClient'
import type { User } from '../types'

export const UserRepository = {
  getMe(): Promise<User> {
    return apiClient.get<User>('/users/me')
  },

  updateMe(patch: Partial<User>): Promise<User> {
    return apiClient.patch<User>('/users/me', patch)
  },

  listUsers(params: {
    page?: number
    limit?: number
    role?: string
    status?: string
    search?: string
    sort?: string
    summary?: boolean
  }): Promise<{
    data: Array<{
      id: string
      displayName?: string
      username: string
      email: string
      phone?: string | null
      role: string
      status: string
      sponsorName?: string | null
      pointsBalance: number
      createdAt: string
      lastSeen?: string | null
      avatarUrl?: string | null
    }>
    meta: {
      total: number
      page: number
      limit: number
      totalPages: number
      summary?: { total: number; activeThisWeek: number; newThisMonth: number }
    }
  }> {
    const q = new URLSearchParams()
    if (params.page != null) q.set('page', String(params.page))
    if (params.limit != null) q.set('limit', String(params.limit))
    if (params.role) q.set('role', params.role)
    if (params.status) q.set('status', params.status)
    if (params.search) q.set('search', params.search)
    if (params.sort) q.set('sort', params.sort)
    if (params.summary) q.set('summary', 'true')
    return apiClient.get(`/users?${q.toString()}`)
  },

  updateUserRole(userId: string, role: string): Promise<void> {
    return apiClient.patch(`/users/${userId}`, { role })
  },

  disableAccount(userId: string): Promise<void> {
    return apiClient.patch('/account/disable', { userId })
  },
}
