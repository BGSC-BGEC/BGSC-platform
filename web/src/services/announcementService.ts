import { apiClient } from './apiClient'
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
} from '../types/announcement'
import { DEFAULT_ANNOUNCEMENTS_DATA } from '../data/announcementsData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

export interface RawBackendAnnouncement {
  _id?: string
  id?: string
  title: string
  body: string
  categories: AnnouncementCategory[]
  tags?: string[]
  priority?: AnnouncementPriority
  status?: AnnouncementStatus
  is_pinned?: boolean
  pinned_until?: string | null
  scheduled_for?: string | null
  published_at?: string | null
  created_at?: string
  media_url?: string | null
  author?: {
    id?: string
    user_id?: string
    name?: string
    display_name?: string
    role?: string
    role_label?: string
  }
}

interface BackendAnnouncementsResponse {
  announcements?: RawBackendAnnouncement[]
  data?: RawBackendAnnouncement[]
}

function formatDateString(val?: string | Date | null): string | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function mapBackendAnnouncement(raw: RawBackendAnnouncement): Announcement {
  const isPinned = Boolean(
    raw.is_pinned || (raw.pinned_until && new Date(raw.pinned_until) > new Date())
  )

  const authorName =
    raw.author?.name || raw.author?.display_name || 'Admin Operations'

  return {
    id: raw._id || raw.id || '',
    title: raw.title,
    body: raw.body,
    categories: raw.categories || [],
    tags: raw.tags || [],
    priority: raw.priority || 'normal',
    status: raw.status || 'draft',
    isPinned,
    pinnedUntil: formatDateString(raw.pinned_until),
    scheduledFor: formatDateString(raw.scheduled_for),
    publishedAt: formatDateString(raw.published_at),
    createdAt: formatDateString(raw.created_at) || new Date().toISOString(),
    authorName,
    mediaUrl: raw.media_url || null,
  }
}

export interface AnnouncementFilters {
  category?: string
  priority?: string
  status?: string
}

export async function getAnnouncements(
  filters?: AnnouncementFilters
): Promise<Announcement[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    let result = [...DEFAULT_ANNOUNCEMENTS_DATA]

    if (filters?.category && filters.category !== 'all') {
      result = result.filter((a) =>
        a.categories.includes(filters.category as AnnouncementCategory)
      )
    }

    if (filters?.priority && filters.priority !== 'all') {
      result = result.filter((a) => a.priority === filters.priority)
    }

    if (filters?.status && filters.status !== 'all') {
      result = result.filter((a) => a.status === filters.status)
    }

    return result
  }

  try {
    const res = await apiClient.get<BackendAnnouncementsResponse | RawBackendAnnouncement[]>(
      '/announcements'
    )
    const list = Array.isArray(res)
      ? res
      : res?.announcements || res?.data || []
    return list.map(mapBackendAnnouncement)
  } catch (error) {
    console.warn('[announcementService] Failed to fetch announcements from backend:', error)
    return isMock ? DEFAULT_ANNOUNCEMENTS_DATA : []
  }
}

export async function createAnnouncement(
  payload: Partial<Announcement>
): Promise<Announcement> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const now = new Date().toISOString()
    const isPinned = Boolean(
      payload.isPinned || (payload.pinnedUntil && new Date(payload.pinnedUntil) > new Date())
    )

    const mockCreated: Announcement = {
      id: `anc-${Date.now()}`,
      title: payload.title || 'Untitled Broadcast',
      body: payload.body || '',
      categories: payload.categories || ['highlight'],
      tags: payload.tags || [],
      priority: payload.priority || 'normal',
      status: payload.status || 'draft',
      isPinned,
      pinnedUntil: payload.pinnedUntil || null,
      scheduledFor: payload.scheduledFor || null,
      publishedAt: payload.status === 'published' ? now : payload.publishedAt || null,
      createdAt: now,
      authorName: payload.authorName || 'Admin Operations',
      mediaUrl: payload.mediaUrl || null,
    }

    DEFAULT_ANNOUNCEMENTS_DATA.unshift(mockCreated)
    return mockCreated
  }

  const backendPayload = {
    title: payload.title,
    body: payload.body,
    categories: payload.categories,
    tags: payload.tags,
    priority: payload.priority,
    status: payload.status,
    media_url: payload.mediaUrl,
    pinned_until: payload.pinnedUntil,
    scheduled_for: payload.scheduledFor,
    published_at: payload.publishedAt,
  }

  const res = await apiClient.post<
    RawBackendAnnouncement | { announcement: RawBackendAnnouncement }
  >('/announcements', backendPayload)

  const raw =
    'announcement' in res && res.announcement
      ? res.announcement
      : (res as RawBackendAnnouncement)

  return mapBackendAnnouncement(raw)
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const idx = DEFAULT_ANNOUNCEMENTS_DATA.findIndex((a) => a.id === id)
    if (idx !== -1) {
      DEFAULT_ANNOUNCEMENTS_DATA.splice(idx, 1)
      return true
    }
    return false
  }

  try {
    await apiClient.delete(`/announcements/${id}`)
    return true
  } catch (error) {
    console.warn(`[announcementService] Failed to delete announcement ${id}:`, error)
    return false
  }
}

export async function publishAnnouncement(
  id: string,
  scheduledFor?: string
): Promise<Announcement | null> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const item = DEFAULT_ANNOUNCEMENTS_DATA.find((a) => a.id === id)
    if (!item) return null

    if (scheduledFor) {
      item.status = 'scheduled'
      item.scheduledFor = scheduledFor
      item.publishedAt = null
    } else {
      item.status = 'published'
      item.publishedAt = new Date().toISOString()
      item.scheduledFor = null
    }
    return { ...item }
  }

  try {
    const res = await apiClient.post<
      RawBackendAnnouncement | { announcement: RawBackendAnnouncement }
    >(`/announcements/${id}/publish`, { scheduled_for: scheduledFor })

    const raw =
      'announcement' in res && res.announcement
        ? res.announcement
        : (res as RawBackendAnnouncement)

    return mapBackendAnnouncement(raw)
  } catch (error) {
    console.warn(`[announcementService] Failed to publish announcement ${id}:`, error)
    return null
  }
}

export const announcementService = {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  mapBackendAnnouncement,
}

export default announcementService
