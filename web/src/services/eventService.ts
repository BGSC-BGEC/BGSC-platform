import { apiClient } from './apiClient'
import type {
  ClubEvent,
  EventCategory,
  EventDomain,
  EventType,
  LeaderboardFormat,
} from '../types/event'
import { DEFAULT_POINTS_POOL, canPublishWithoutForm, rulesFor } from '../types/event'
import type { EventPointsPool } from '../types/event'
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
    team_size_min?: number | null
    team_size_max?: number | null
    max_teams?: number | null
    captain_application_required?: boolean
  }
  leaderboard?: {
    format: LeaderboardFormat
    elim_after_n?: number | null
    min_participants?: number
  } | null
  auction?: {
    k_multiplier: number
    min_bid_increment: number
    bid_timer_seconds: number
    purse_per_team?: number | null
    status: 'not_started' | 'live' | 'paused' | 'finished'
    captain_user_ids?: string[]
  } | null
  media?: {
    banner_url?: string | null
  }
  cover_media_url?: string | null
  logo_url?: string | null
  points_pool?: {
    participation?: number
    podium_multipliers?: number[]
    sponsor_bonus?: number
    investment_enabled?: boolean
    investment_cap?: number | null
  }
}

function toPointsPoolBody(p: EventPointsPool) {
  return {
    participation: p.participation,
    podium_multipliers: p.podiumMultipliers,
    sponsor_bonus: p.sponsorBonus,
    investment_enabled: p.investmentEnabled,
    investment_cap: p.investmentEnabled ? p.investmentCap : null,
  }
}

/** What the create form collects. Type-specific blocks are only sent for types that use them. */
export interface CreateEventInput {
  title: string
  description: string
  category: EventCategory
  type: EventType
  domain: EventDomain
  status: 'draft' | 'upcoming'
  venue: string | null
  /** datetime-local strings (local time) */
  startAt: string
  endAt: string
  registrationClosesAt: string
  /** Team events only: roster lock, between registration close and start. */
  rosterFinalizesAt: string | null
  maxParticipants: number | null
  waitlistEnabled: boolean
  requiresApproval: boolean
  isTeamed: boolean
  teamSizeMin: number | null
  teamSizeMax: number | null
  maxTeams: number | null
  captainApplicationRequired: boolean
  leaderboardFormat: LeaderboardFormat
  elimAfterN: number | null
  minParticipants: number
  auction: {
    kMultiplier: number
    minBidIncrement: number
    bidTimerSeconds: number
    pursePerTeam: number | null
  }
  pointsPool: EventPointsPool
}

interface BackendEventsResponse {
  events?: RawBackendEvent[]
  total_pages?: number
}

/** A league's captain pool (GET /events/:ref/captains). Approved captain applications land here. */
export interface EventCaptain {
  userId: string
  displayName: string
  avatarUrl: string | null
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
    registrationClosesAt: raw.registration?.closes_at
      ? new Date(raw.registration.closes_at).toISOString()
      : null,
    waitlistEnabled: Boolean(raw.registration?.waitlist_enabled),
    requiresApproval: Boolean(raw.registration?.requires_approval),
    teaming: {
      teamSizeMin: raw.teaming?.team_size_min ?? null,
      teamSizeMax: raw.teaming?.team_size_max ?? null,
      maxTeams: raw.teaming?.max_teams ?? null,
      captainApplicationRequired: Boolean(raw.teaming?.captain_application_required),
    },
    leaderboard: raw.leaderboard
      ? {
          format: raw.leaderboard.format,
          elimAfterN: raw.leaderboard.elim_after_n ?? null,
          minParticipants: raw.leaderboard.min_participants ?? 2,
        }
      : null,
    auction: raw.auction
      ? {
          kMultiplier: raw.auction.k_multiplier,
          minBidIncrement: raw.auction.min_bid_increment,
          bidTimerSeconds: raw.auction.bid_timer_seconds,
          pursePerTeam: raw.auction.purse_per_team ?? null,
          status: raw.auction.status,
          captainUserIds: raw.auction.captain_user_ids ?? [],
        }
      : null,
    coverMediaUrl: raw.cover_media_url ?? raw.media?.banner_url ?? null,
    logoUrl: raw.logo_url ?? null,
    pointsPool: {
      participation: raw.points_pool?.participation ?? DEFAULT_POINTS_POOL.participation,
      podiumMultipliers: raw.points_pool?.podium_multipliers ?? DEFAULT_POINTS_POOL.podiumMultipliers,
      sponsorBonus: raw.points_pool?.sponsor_bonus ?? DEFAULT_POINTS_POOL.sponsorBonus,
      investmentEnabled: raw.points_pool?.investment_enabled ?? DEFAULT_POINTS_POOL.investmentEnabled,
      investmentCap: raw.points_pool?.investment_cap ?? DEFAULT_POINTS_POOL.investmentCap,
    },
  }
}

/**
 * Builds the POST /events body for a type (spec §4/§5.15). Only the blocks the type uses are sent:
 * DE gets no leaderboard, only ALL gets an auction, leagues are always teamed.
 */
export function buildCreateEventBody(input: CreateEventInput) {
  const rules = rulesFor(input.type)
  const isTeamed = rules.forcesTeams || input.isTeamed
  const iso = (local: string) => new Date(local).toISOString()
  const status =
    input.status === 'upcoming' && canPublishWithoutForm(input.type, isTeamed, input.maxParticipants)
      ? 'upcoming'
      : 'draft'

  return {
    title: input.title,
    description: input.description,
    category: input.category,
    type: input.type,
    domain: input.domain,
    status,
    start_at: iso(input.startAt),
    end_at: iso(input.endAt),
    venue: input.venue,
    registration: {
      // The deadline, not the event end: the backend refuses closes_at after start_at.
      closes_at: iso(input.registrationClosesAt),
      roster_finalizes_at: isTeamed && input.rosterFinalizesAt ? iso(input.rosterFinalizesAt) : null,
      max_participants: input.maxParticipants,
      waitlist_enabled: input.waitlistEnabled,
      requires_approval: input.requiresApproval,
    },
    teaming: {
      is_teamed: isTeamed,
      team_size_min: isTeamed ? input.teamSizeMin : null,
      team_size_max: isTeamed ? input.teamSizeMax : null,
      max_teams: isTeamed ? input.maxTeams : null,
      // Spec §5.5: leagues review captains; elsewhere a captain is approved by registering.
      captain_application_required: isTeamed && input.captainApplicationRequired,
    },
    leaderboard: rules.hasLeaderboard
      ? {
          format: input.leaderboardFormat,
          elim_after_n: input.leaderboardFormat === 'elim_after_n' ? input.elimAfterN : null,
          min_participants: input.minParticipants,
        }
      : null,
    auction: rules.isAuction
      ? {
          k_multiplier: input.auction.kMultiplier,
          min_bid_increment: input.auction.minBidIncrement,
          bid_timer_seconds: input.auction.bidTimerSeconds,
          purse_per_team: input.auction.pursePerTeam,
        }
      : null,
    points_pool: toPointsPoolBody(input.pointsPool),
  }
}

/** Update only the event's points settings (PATCH merges nested objects). */
export async function updatePointsPool(id: string, pool: EventPointsPool): Promise<ClubEvent> {
  return updateEvent(id, { points_pool: toPointsPoolBody(pool) })
}

/**
 * Upload the event cover/poster or logo: POST /events/:id/media?type=cover|logo with the raw
 * image bytes (JPEG/PNG/WebP, max 10 MB; event admins only, not for past/cancelled events).
 * Returns the stored `/uploads/...` URL.
 */
export async function uploadEventImage(id: string, kind: 'cover' | 'logo', file: File): Promise<string> {
  if (isMock) return URL.createObjectURL(file)
  const res = await apiClient.post<{ url: string }>(`/events/${id}/media?type=${kind}`, file)
  return res.url
}

export async function getEvents(): Promise<ClubEvent[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    return DEFAULT_EVENTS_DATA
  }

  try {
    // The API pages (default 20). An admin console needs every event, so walk the pages.
    const all: RawBackendEvent[] = []
    for (let page = 1; page <= 50; page++) {
      const res = await apiClient.get<BackendEventsResponse | RawBackendEvent[]>(
        `/events?page=${page}&limit=100&sort=date_desc`
      )
      if (Array.isArray(res)) return res.map(mapBackendEvent)
      all.push(...(res?.events || []))
      if (!res?.total_pages || page >= res.total_pages) break
    }
    return all.map(mapBackendEvent)
  } catch (error) {
    console.warn('[eventService] Failed to fetch events from backend:', error)
    return isMock ? DEFAULT_EVENTS_DATA : []
  }
}

export async function createEvent(input: CreateEventInput): Promise<ClubEvent> {
  const requestBody = buildCreateEventBody(input)

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const mockCreated = mapBackendEvent({
      ...requestBody,
      id: `evt-${Date.now()}`,
      registration: { ...requestBody.registration, closes_at: requestBody.registration.closes_at },
    } as unknown as RawBackendEvent)
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

export async function getCaptains(eventId: string): Promise<EventCaptain[]> {
  if (isMock) return []
  const res = await apiClient.get<{
    captains?: { user_id: string; display_name: string; avatar_url: string | null }[]
  }>(`/events/${eventId}/captains`)
  return (res?.captains || []).map((c) => ({
    userId: c.user_id,
    displayName: c.display_name,
    avatarUrl: c.avatar_url,
  }))
}

export async function removeCaptain(eventId: string, userId: string): Promise<void> {
  if (isMock) return
  await apiClient.delete(`/events/${eventId}/captains/${userId}`)
}

export const eventService = {
  updatePointsPool,
  uploadEventImage,
  getCaptains,
  removeCaptain,
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
