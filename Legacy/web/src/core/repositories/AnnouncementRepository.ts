import { apiClient } from '../api/ApiClient'

export interface Announcement {
  id: string
  title: string
  body: string
  type: string
  tags: string[]
  createdAt: string
  expiresAt?: string | null
}

export interface AnnouncementListResponse {
  data: Announcement[]
  total: number
  page: number
  limit: number
}

export const AnnouncementRepository = {
  list(params?: { page?: number; limit?: number; type?: string }): Promise<AnnouncementListResponse> {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.type) q.set('type', params.type)
    const qs = q.toString()
    return apiClient.get(`/announcements${qs ? `?${qs}` : ''}`)
  },

  getById(id: string): Promise<Announcement> {
    return apiClient.get(`/announcements/${id}`)
  },

  create(body: { title: string; body: string; type: string; tags?: string[] }): Promise<Announcement> {
    return apiClient.post('/announcements', body)
  },

  update(id: string, body: Partial<{ title: string; body: string; type: string; tags: string[] }>): Promise<Announcement> {
    return apiClient.patch(`/announcements/${id}`, body)
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/announcements/${id}`)
  },
}
