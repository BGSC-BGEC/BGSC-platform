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
    domain?: ClubEvent['domain']
    status?: ClubEvent['status']
    start_at?: string | Date
    end_at?: string | Date
    venue?: string | null
    registration?: {
    max_participants?: number | null
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
    category: raw.category,
    domain: raw.domain || 'sports',
    status: raw.status || 'draft',
    startAt: formatDate(raw.start_at),
    endAt: formatDate(raw.end_at),
    venue: raw.venue || null,
    maxParticipants: raw.registration?.max_participants ?? null,
    currentParticipants: raw.counts?.registrations_confirmed ?? 0,
    isTeamed: Boolean(raw.teaming?.is_teamed),
    bannerUrl: raw.media?.banner_url || null,
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

export async function createEvent(payload: Partial<ClubEvent> | Record<string, unknown>): Promise<ClubEvent> {
    if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const mockCreated = mapBackendEvent({
        ...payload,
        id: `evt-${Date.now()}`,
        title: String(payload.title || 'Untitled Event'),
        category: (payload.category as ClubEvent['category']) || 'general',
    } as RawBackendEvent)
    DEFAULT_EVENTS_DATA.unshift(mockCreated)
    return mockCreated
    }

    const res = await apiClient.post<RawBackendEvent | { event: RawBackendEvent }>('/events', payload)
    const raw = 'event' in res && res.event ? res.event : (res as RawBackendEvent)
    return mapBackendEvent(raw)
}

export const eventService = {
    getEvents,
    createEvent,
    mapBackendEvent,
}

export default eventService