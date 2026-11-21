import { apiClient } from './apiClient'
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementDelivery,
  AnnouncementPriority,
  AnnouncementStats,
  AnnouncementStatus,
  AudienceRole,
  DeliveryStatus,
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
  audience?: { min_role?: AudienceRole; event_id?: string | null }
  delivery?: {
    whatsapp?: {
      requested?: boolean
      per_category?: {
        category: AnnouncementCategory
        group_id: string
        status: DeliveryStatus
        attempted_at?: string | null
        error?: string | null
      }[]
    }
    push?: { requested?: boolean; status?: DeliveryStatus; sent_count?: number | null }
  }
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
  next_cursor?: string | null
}

function formatDateString(val?: string | Date | null): string | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function mapDelivery(raw: RawBackendAnnouncement['delivery']): AnnouncementDelivery | null {
  if (!raw) return null
  return {
    whatsapp: {
      requested: Boolean(raw.whatsapp?.requested),
      perCategory: (raw.whatsapp?.per_category || []).map((r) => ({
        category: r.category,
        groupId: r.group_id,
        status: r.status,
        attemptedAt: formatDateString(r.attempted_at),
        error: r.error ?? null,
      })),
    },
    push: {
      requested: Boolean(raw.push?.requested),
      status: raw.push?.status || 'pending',
      sentCount: raw.push?.sent_count ?? null,
    },
  }
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
    audience: {
      minRole: raw.audience?.min_role || 'guest',
      eventId: raw.audience?.event_id ?? null,
    },
    delivery: mapDelivery(raw.delivery),
  }
}

function unwrapOne(
  res: RawBackendAnnouncement | { announcement: RawBackendAnnouncement }
): Announcement {
  const raw =
    'announcement' in res && res.announcement
      ? res.announcement
      : (res as RawBackendAnnouncement)
  return mapBackendAnnouncement(raw)
}

export interface AnnouncementFilters {
  category?: string
  priority?: string
  status?: string
}

const ALL_STATUSES: AnnouncementStatus[] = ['draft', 'scheduled', 'published', 'archived']

/**
 * The backend list returns ONE status per call (published when none is given), 50 per page at
 * most, with a keyset cursor. The console shows every status, so it asks for each and walks the
 * cursor to the end.
 */
async function fetchAllWithStatus(status: AnnouncementStatus): Promise<RawBackendAnnouncement[]> {
  const all: RawBackendAnnouncement[] = []
  let cursor: string | null = null
  for (;;) {
    const qs = new URLSearchParams({ status, limit: '50' })
    if (cursor) qs.set('cursor', cursor)
    const res: BackendAnnouncementsResponse | RawBackendAnnouncement[] = await apiClient.get<
      BackendAnnouncementsResponse | RawBackendAnnouncement[]
    >(`/announcements?${qs.toString()}`)
    if (Array.isArray(res)) return res
    all.push(...(res?.announcements || res?.data || []))
    const next: string | null = res?.next_cursor ?? null
    if (!next || next === cursor) break
    cursor = next
  }
  return all
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

  const statuses =
    filters?.status && filters.status !== 'all'
      ? [filters.status as AnnouncementStatus]
      : ALL_STATUSES
  const lists = await Promise.all(statuses.map(fetchAllWithStatus))
  return lists.flat().map(mapBackendAnnouncement)
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  categories: AnnouncementCategory[]
  tags: string[]
  priority: AnnouncementPriority
  mediaUrl?: string | null
  /** ISO timestamp with zone, or null for not pinned. */
  pinnedUntil: string | null
  audience?: { minRole?: AudienceRole; eventId?: string | null }
}

/**
 * Always creates a DRAFT — POST /announcements takes no status. Publishing or scheduling is a
 * second call: `publishAnnouncement(id)` / `publishAnnouncement(id, scheduledFor)`.
 */
export async function createAnnouncement(
  payload: CreateAnnouncementInput
): Promise<Announcement> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const now = new Date().toISOString()
    const mockCreated: Announcement = {
      id: `anc-${Date.now()}`,
      title: payload.title,
      body: payload.body,
      categories: payload.categories,
      tags: payload.tags,
      priority: payload.priority,
      status: 'draft',
      isPinned: Boolean(payload.pinnedUntil && new Date(payload.pinnedUntil) > new Date()),
      pinnedUntil: payload.pinnedUntil,
      scheduledFor: null,
      publishedAt: null,
      createdAt: now,
      authorName: 'Admin Operations',
      mediaUrl: payload.mediaUrl || null,
      audience: {
        minRole: payload.audience?.minRole || 'guest',
        eventId: payload.audience?.eventId ?? null,
      },
      delivery: null,
    }
    DEFAULT_ANNOUNCEMENTS_DATA.unshift(mockCreated)
    return mockCreated
  }

  const audience: { min_role?: AudienceRole; event_id?: string } = {}
  if (payload.audience?.minRole) audience.min_role = payload.audience.minRole
  if (payload.audience?.eventId) audience.event_id = payload.audience.eventId

  const backendPayload = {
    title: payload.title,
    body: payload.body,
    categories: payload.categories,
    tags: payload.tags,
    priority: payload.priority,
    ...(payload.mediaUrl ? { media_url: payload.mediaUrl } : {}),
    pinned_until: payload.pinnedUntil,
    ...(Object.keys(audience).length > 0 ? { audience } : {}),
  }

  const res = await apiClient.post<
    RawBackendAnnouncement | { announcement: RawBackendAnnouncement }
  >('/announcements', backendPayload)
  return unwrapOne(res)
}

/** Throws on failure (apiClient error message), so the caller can show why. */
export async function deleteAnnouncement(id: string): Promise<void> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const idx = DEFAULT_ANNOUNCEMENTS_DATA.findIndex((a) => a.id === id)
    if (idx !== -1) DEFAULT_ANNOUNCEMENTS_DATA.splice(idx, 1)
    return
  }
  await apiClient.delete(`/announcements/${id}`)
}

/**
 * POST /announcements/:id/publish. No `scheduledFor` = Send Now (empty body); with it = Schedule
 * for Later (`{ scheduled_for }`, ISO with zone, must be in the future). Works from draft or
 * scheduled (a reschedule). Throws on failure.
 */
export async function publishAnnouncement(
  id: string,
  scheduledFor?: string
): Promise<Announcement> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const item = DEFAULT_ANNOUNCEMENTS_DATA.find((a) => a.id === id)
    if (!item) throw new Error('announcement_not_found')
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

  const res = await apiClient.post<
    RawBackendAnnouncement | { announcement: RawBackendAnnouncement }
  >(`/announcements/${id}/publish`, scheduledFor ? { scheduled_for: scheduledFor } : {})
  return unwrapOne(res)
}

/** POST /announcements/:id/unschedule — back to draft. Throws on failure. */
export async function unscheduleAnnouncement(id: string): Promise<Announcement> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const item = DEFAULT_ANNOUNCEMENTS_DATA.find((a) => a.id === id)
    if (!item) throw new Error('announcement_not_found')
    item.status = 'draft'
    item.scheduledFor = null
    return { ...item }
  }

  const res = await apiClient.post<
    RawBackendAnnouncement | { announcement: RawBackendAnnouncement }
  >(`/announcements/${id}/unschedule`)
  return unwrapOne(res)
}

interface RawStats {
  announcement_id: string
  eligible: number
  read: number
  read_rate: number | null
}

function mapStats(raw: RawStats): AnnouncementStats {
  return {
    announcementId: raw.announcement_id,
    eligible: raw.eligible,
    read: raw.read,
    readRate: raw.read_rate,
  }
}

/** The backend accepts at most 50 ids per call. */
const STATS_BATCH = 50

/**
 * GET /announcements/stats?ids=… (coordinator+). Published/archived only; ids that are not are
 * simply absent from the result. Batches of 50, the endpoint's cap.
 */
export async function getAnnouncementStats(ids: string[]): Promise<AnnouncementStats[]> {
  if (isMock) {
    throw new Error('Read statistics are not available in mock mode')
  }
  if (ids.length === 0) return []
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += STATS_BATCH) batches.push(ids.slice(i, i + STATS_BATCH))
  const results = await Promise.all(
    batches.map((b) =>
      apiClient.get<{ stats: RawStats[] }>(
        `/announcements/stats?ids=${encodeURIComponent(b.join(','))}`
      )
    )
  )
  return results.flatMap((r) => (r?.stats || []).map(mapStats))
}

export const announcementService = {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  unscheduleAnnouncement,
  getAnnouncementStats,
  mapBackendAnnouncement,
}

export default announcementService
