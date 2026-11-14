import { apiClient } from './apiClient'
import type { ClubEvent } from '../types/event'
import { DEFAULT_EVENTS_DATA } from '../data/eventsData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

interface RawBackendEvent {
  _id?: string
  id?: string
  title: string
  slug?: string
  description?: string
  category: ClubEvent['category']
  type?: ClubEvent['type']
  domain?: ClubEvent['domain']
  status?: ClubEvent['status']
  start_at?: string | Date
  end_at?: string | Date
  venue?: string | null
  registration?: {
    form_id?: string | null
    max_participants?: number | null
    waitlist_enabled?: boolean
    requires_approval?: boolean
    closes_at?: string | Date
  }
  counts?: {
    registrations_confirmed?: number
  }
  teaming?: {
    is_teamed?: boolean
  }
  media?: {
    banner_url?: string | null
  }
}

interface BackendEventsResponse {
  events?: RawBackendEvent[]
}

export interface AttendanceRecord {
  registration_id: string
  user_id?: string
  attended: boolean
  checked_in_at?: string | null
}

function formatDate(dateValue?: string | Date | null): string {
  if (!dateValue) return ''
  const d = new Date(dateValue)
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0]
}

export function mapBackendEvent(raw: RawBackendEvent): ClubEvent {
  return {
    id: raw._id || raw.id || '',
    title: raw.title,
    slug: raw.slug || '',
    description: raw.description || '',
    category: raw.category || 'general',
    type: raw.type || 'LE',
    domain: raw.domain || 'sports',
    status: raw.status || 'draft',
    startAt: formatDate(raw.start_at),
    endAt: formatDate(raw.end_at),
    venue: raw.venue || null,
    maxParticipants: raw.registration?.max_participants ?? null,
    currentParticipants: raw.counts?.registrations_confirmed ?? 0,
    isTeamed: Boolean(raw.teaming?.is_teamed),
    bannerUrl: raw.media?.banner_url || null,
    registrationFormId: raw.registration?.form_id || null,
    waitlistEnabled: Boolean(raw.registration?.waitlist_enabled),
    requiresApproval: Boolean(raw.registration?.requires_approval),
  }
}

export async function getEvents(): Promise<ClubEvent[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return DEFAULT_EVENTS_DATA
  }

  try {
    const res = await apiClient.get<BackendEventsResponse | RawBackendEvent[]>('/events')
    const list = Array.isArray(res) ? res : res?.events || []
    return list.map(mapBackendEvent)
  } catch (error) {
    console.warn('[eventService] Failed to fetch events from backend:', error)
    return isMock ? DEFAULT_EVENTS_DATA : []
  }
}

export async function createEvent(
  payload: Partial<ClubEvent> & Record<string, unknown>
): Promise<ClubEvent> {
  // The form sends date-only values (YYYY-MM-DD). Read them as local times: the start is the
  // beginning of its day and the end is the end of its day, so a one-day event (start date ==
  // end date) still satisfies the backend rule start_at < end_at.
  const toIso = (value: unknown, endOfDay: boolean): string => {
    const raw = String(value || '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date(`${raw}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString()
    }
    return new Date(raw || Date.now()).toISOString()
  }
  const startIso = toIso(payload.startAt || payload.start_at, false)
  const endIso = toIso(payload.endAt || payload.end_at, true)
  // Backend rule: registration must close at or before the event starts. A closing date on the
  // start date itself means "when the event starts"; an earlier date means the end of that day.
  const closesDate = String(payload.registrationClosesAt || payload.startAt || payload.start_at || '')
  const closesIso =
    closesDate && closesDate !== String(payload.startAt || payload.start_at)
      ? toIso(closesDate, true)
      : startIso

  const isTeamed = Boolean(payload.type === 'ALL' || payload.isTeamed)
  const formId = (payload.registrationFormId || (payload.registration as Record<string, unknown> | undefined)?.form_id) as string | undefined
  const hasForm = Boolean(formId)
  const canBeUpcoming = hasForm || (payload.type === 'DE' && !isTeamed && !payload.maxParticipants)
  const status = (payload.status === 'upcoming' && canBeUpcoming) ? 'upcoming' : 'draft'

  const requestBody = {
    title: payload.title,
    description: payload.description || '',
    category: payload.category || 'leagues',
    type: payload.type || 'LE',
    domain: payload.domain || 'sports',
    status,
    start_at: startIso,
    end_at: endIso,
    venue: payload.venue || null,
    registration: {
      closes_at: closesIso,
      form_id: formId || null,
      max_participants: payload.maxParticipants ?? null,
      waitlist_enabled: Boolean(payload.waitlistEnabled),
      requires_approval: Boolean(payload.requiresApproval),
    },
    teaming: {
      is_teamed: isTeamed,
      team_size_min: isTeamed ? (Number(payload.teamSizeMin) || 2) : null,
      team_size_max: isTeamed ? (Number(payload.teamSizeMax) || 5) : null,
      max_teams: isTeamed ? (Number(payload.maxTeams) || 16) : null,
    },
    auction:
      payload.type === 'ALL'
        ? {
            k_multiplier: 1.0,
            min_bid_increment: 100,
            bid_timer_seconds: 15,
            purse_per_team: 10000,
          }
        : null,
  }

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const mockCreated = mapBackendEvent({
      ...requestBody,
      id: `evt-${Date.now()}`,
      title: String(payload.title || 'Untitled Event'),
      category: (payload.category as ClubEvent['category']) || 'general',
    } as RawBackendEvent)
    DEFAULT_EVENTS_DATA.unshift(mockCreated)
    return mockCreated
  }

  const res = await apiClient.post<RawBackendEvent | { event: RawBackendEvent }>(
    '/events',
    requestBody
  )
  const raw = 'event' in res && res.event ? res.event : (res as RawBackendEvent)
  return mapBackendEvent(raw)
}

export async function updateEvent(
  id: string,
  payload: Record<string, unknown>
): Promise<ClubEvent> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const existing = DEFAULT_EVENTS_DATA.find((e) => e.id === id)
    if (existing) {
      if (typeof payload.status === 'string') {
        existing.status = payload.status as ClubEvent['status']
      }
      if (typeof payload.title === 'string') {
        existing.title = payload.title
      }
      if (typeof payload.venue === 'string') {
        existing.venue = payload.venue
      }
      if (payload.registration && typeof payload.registration === 'object') {
        const reg = payload.registration as Record<string, unknown>
        if (typeof reg.form_id === 'string') {
          existing.registrationFormId = reg.form_id
        }
      }
      return { ...existing }
    }
    throw new Error('Event not found')
  }

  const res = await apiClient.patch<RawBackendEvent | { event: RawBackendEvent }>(
    `/events/${id}`,
    payload
  )
  const raw = 'event' in res && res.event ? res.event : (res as RawBackendEvent)
  return mapBackendEvent(raw)
}

export async function deleteEvent(id: string): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const idx = DEFAULT_EVENTS_DATA.findIndex((e) => e.id === id)
    if (idx !== -1) {
      DEFAULT_EVENTS_DATA.splice(idx, 1)
    }
    return true
  }

  await apiClient.delete(`/events/${id}`)
  return true
}

export async function getAttendance(eventId: string): Promise<AttendanceRecord[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return []
  }

  try {
    const res = await apiClient.get<{ attendance?: AttendanceRecord[] } | AttendanceRecord[]>(
      `/events/${eventId}/attendance`
    )
    return Array.isArray(res) ? res : res?.attendance || []
  } catch (error) {
    console.warn(`[eventService] Failed to fetch attendance for ${eventId}:`, error)
    return []
  }
}

export async function recordAttendance(
  eventId: string,
  attendances: { registration_id: string; attended: boolean }[]
): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return true
  }

  await apiClient.post(`/events/${eventId}/attendance`, { attendances })
  return true
}

export async function promoteWaitlist(
  eventId: string,
  registrationId: string
): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return true
  }

  await apiClient.post(`/events/${eventId}/waitlist/${registrationId}/promote`)
  return true
}

export const eventService = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getAttendance,
  recordAttendance,
  promoteWaitlist,
  mapBackendEvent,
}

export default eventService
