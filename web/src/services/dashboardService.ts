import { apiClient } from './apiClient'
import { mapBackendEvent } from './eventService'
import { mapBackendStanding, type RawBackendStanding } from './leaderboardService'
import { getLots } from './auctionService'
import type { ClubEvent, EventType } from '../types/event'
import type { LeaderboardEntry } from '../types/leaderboard'

/**
 * Everything the admin dashboard shows, read from the live API. There is no backend stats
 * endpoint, so the aggregates are computed here from the list endpoints. Each source is fetched
 * independently: one failing (e.g. a coordinator-only route) leaves its cards empty with an error
 * instead of blanking the whole page — and never substitutes sample data.
 */

const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000'

// Hard caps so a large deployment cannot turn one dashboard load into hundreds of requests.
const USER_PAGE_SIZE = 100
const USER_MAX_PAGES = 50
const EVENT_PAGE_SIZE = 100
const EVENT_MAX_PAGES = 20
const AUCTION_EVENTS_SCANNED = 5

export interface DashboardUser {
  id: string
  role: string
  status: string
  createdAt: Date | null
  lastActiveAt: Date | null
}

interface RawUser {
  id: string
  role?: string
  status?: string
  created_at?: string
  last_active_at?: string | null
}

interface RawEvent {
  type?: EventType
  [key: string]: unknown
}

export interface DashboardEvent extends ClubEvent {
  type?: EventType
  startDate: Date | null
}

export interface AuctionSale {
  lotId: string
  athlete: string
  team: string
  amount: number
  eventTitle: string
}

export interface GatewayHealth {
  ok: boolean
  latencyMs: number | null
  uptimeSeconds: number | null
  env: string | null
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** True when the user list was cut off by USER_MAX_PAGES / EVENT_MAX_PAGES. */
export interface Paged<T> {
  items: T[]
  truncated: boolean
}

const toDate = (value?: string | null): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function settle<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: errorText(e) }
  }
}

export async function fetchAllUsers(): Promise<Paged<DashboardUser>> {
  const items: DashboardUser[] = []
  let cursor: string | null | undefined
  for (let page = 0; page < USER_MAX_PAGES; page++) {
    const qs = new URLSearchParams({ limit: String(USER_PAGE_SIZE) })
    if (cursor) qs.set('cursor', cursor)
    const res = await apiClient.get<{ users?: RawUser[]; next_cursor?: string | null }>(
      `/users?${qs.toString()}`
    )
    for (const u of res?.users ?? []) {
      items.push({
        id: u.id,
        role: u.role || 'user',
        status: u.status || 'active',
        createdAt: toDate(u.created_at),
        lastActiveAt: toDate(u.last_active_at),
      })
    }
    cursor = res?.next_cursor
    if (!cursor) return { items, truncated: false }
  }
  return { items, truncated: true }
}

export async function fetchAllEvents(): Promise<Paged<DashboardEvent>> {
  const items: DashboardEvent[] = []
  for (let page = 1; page <= EVENT_MAX_PAGES; page++) {
    const res = await apiClient.get<{ events?: RawEvent[]; total_pages?: number }>(
      `/events?page=${page}&limit=${EVENT_PAGE_SIZE}&sort=date_asc`
    )
    for (const raw of res?.events ?? []) {
      const mapped = mapBackendEvent(raw as unknown as Parameters<typeof mapBackendEvent>[0])
      items.push({
        ...mapped,
        type: raw.type,
        startDate: toDate((raw as { start_at?: string }).start_at),
      })
    }
    const totalPages = res?.total_pages ?? 1
    if (page >= totalPages) return { items, truncated: false }
  }
  return { items, truncated: true }
}

/** Highest settled sales across the most recent auction-league events. */
export async function fetchTopAuctionSales(events: DashboardEvent[]): Promise<AuctionSale[]> {
  const auctionEvents = events
    .filter((e) => e.type === 'ALL' && e.status !== 'draft' && e.status !== 'cancelled')
    .sort((a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0))
    .slice(0, AUCTION_EVENTS_SCANNED)

  const perEvent = await Promise.allSettled(
    auctionEvents.map(async (event) => {
      const lots = await getLots(event.id, 'sold')
      return lots.map<AuctionSale>((lot) => ({
        lotId: lot.id,
        athlete: lot.player.display_name,
        team: lot.sold_to_team_name || '—',
        amount: lot.sold_amount ?? lot.current_bid ?? 0,
        eventTitle: event.title,
      }))
    })
  )

  return perEvent
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
}

export async function fetchGatewayHealth(): Promise<GatewayHealth> {
  const started = performance.now()
  try {
    const res = await fetch(`${BASE_URL.replace(/\/+$/, '')}/health`, { cache: 'no-store' })
    const latencyMs = Math.round(performance.now() - started)
    if (!res.ok) return { ok: false, latencyMs, uptimeSeconds: null, env: null }
    const body = (await res.json()) as { status?: string; uptime_s?: number; env?: string }
    return {
      ok: body.status === 'ok',
      latencyMs,
      uptimeSeconds: typeof body.uptime_s === 'number' ? body.uptime_s : null,
      env: body.env ?? null,
    }
  } catch {
    return { ok: false, latencyMs: null, uptimeSeconds: null, env: null }
  }
}

export interface DashboardData {
  users: Result<Paged<DashboardUser>>
  events: Result<Paged<DashboardEvent>>
  leaderboard: Result<LeaderboardEntry[]>
  auctionSales: Result<AuctionSale[]>
  health: GatewayHealth
  loadedAt: Date
}

export async function loadDashboard(): Promise<DashboardData> {
  const [users, events, leaderboard, health] = await Promise.all([
    settle(fetchAllUsers),
    settle(fetchAllEvents),
    // Not leaderboardService.getGlobalLeaderboard: it swallows errors into [], so an empty board
    // and a failed request would look alike here.
    settle(async () => {
      const res = await apiClient.get<{ standings?: RawBackendStanding[] } | RawBackendStanding[]>(
        '/leaderboards/global?period=all&domain=all&limit=5'
      )
      return (Array.isArray(res) ? res : res?.standings ?? []).map(mapBackendStanding)
    }),
    fetchGatewayHealth(),
  ])

  const auctionSales: Result<AuctionSale[]> = events.ok
    ? await settle(() => fetchTopAuctionSales(events.data.items))
    : { ok: false, error: events.error }

  return { users, events, leaderboard, auctionSales, health, loadedAt: new Date() }
}

export const dashboardService = { loadDashboard }
export default dashboardService
