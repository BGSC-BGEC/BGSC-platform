import { apiClient } from './apiClient'
import type {
  EventLeaderboardEntry,
  EventLeaderboardPage,
  EventLedgerPage,
  EventParticipant,
  EventPodium,
  EventScoringContext,
  GlobalLeaderboardPage,
  LeaderboardDomain,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardSource,
  PointsAdjustmentPayload,
  PointsTransaction,
  PointsTransactionPage,
  ScoreSubmission,
  ScoringParameter,
  UserSearchResult,
} from '../types/leaderboard'
import {
  DEFAULT_LEADERBOARD_DATA,
  DEFAULT_POINTS_TRANSACTIONS,
} from '../data/leaderboardData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

/* --------------------------------- helpers --------------------------------- */

/** RFC 4122 v4 uuid: the points service validates `request_id` as a uuid. */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const enc = encodeURIComponent

/* ------------------------------ global board ------------------------------ */

export interface RawBackendStanding {
  rank: number
  user_id: string
  display_name: string
  username?: string
  avatar_url?: string | null
  points: number
  domain?: LeaderboardDomain
  change?: number
}

interface RawGlobalResponse {
  page?: number
  limit?: number
  total?: number
  total_pages?: number
  standings?: RawBackendStanding[]
}

export function mapBackendStanding(raw: RawBackendStanding): LeaderboardEntry {
  return {
    rank: raw.rank,
    userId: raw.user_id,
    name: raw.display_name,
    username: raw.username || '',
    domain: raw.domain,
    points: raw.points,
    change: raw.change ?? 0,
    avatarUrl: raw.avatar_url || null,
  }
}

export interface GlobalLeaderboardQuery {
  period?: LeaderboardPeriod
  domain?: LeaderboardDomain
  source?: LeaderboardSource
  page?: number
  limit?: number
}

/** GET /leaderboards/global — public; `limit` max 100. Throws on failure. */
export async function getGlobalLeaderboardPage(
  query: GlobalLeaderboardQuery = {}
): Promise<GlobalLeaderboardPage> {
  const { period = 'all', domain = 'all', source = 'all', page = 1, limit = 50 } = query

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    let result = [...DEFAULT_LEADERBOARD_DATA]
    if (domain !== 'all') result = result.filter((entry) => entry.domain === domain)
    result.sort((a, b) => b.points - a.points)
    const entries = result.map((entry, index) => ({ ...entry, rank: index + 1 }))
    return { entries, page: 1, limit, total: entries.length, totalPages: 1 }
  }

  const params = new URLSearchParams({
    period,
    domain,
    source,
    page: String(page),
    limit: String(limit),
  })
  const res = await apiClient.get<RawGlobalResponse>(`/leaderboards/global?${params}`)
  const list = res?.standings || []
  return {
    entries: list.map(mapBackendStanding),
    page: res?.page ?? page,
    limit: res?.limit ?? limit,
    total: res?.total ?? list.length,
    totalPages: res?.total_pages ?? 1,
  }
}

/** First page of the global board. Kept for the dashboard; swallows errors as before. */
export async function getGlobalLeaderboard(
  period: LeaderboardPeriod = 'all',
  domain: LeaderboardDomain = 'all'
): Promise<LeaderboardEntry[]> {
  try {
    return (await getGlobalLeaderboardPage({ period, domain })).entries
  } catch (error) {
    console.warn('[leaderboardService] Failed to fetch global leaderboard:', error)
    return []
  }
}

/* ------------------------------ event boards ------------------------------ */

interface RawEventEntry {
  _id: string
  participant?: { type?: 'user' | 'team'; id?: string; display_name?: string; avatar_url?: string | null }
  raw?: Record<string, number | boolean>
  raw_score?: number
  normalized_score?: number
  invested_points?: number
  final_score?: number
  rank?: number | null
  previous_rank?: number | null
  last_scored_at?: string | null
  stats?: { eliminated?: boolean }
}

function mapEventEntry(raw: RawEventEntry): EventLeaderboardEntry {
  return {
    id: raw._id,
    participant: {
      type: raw.participant?.type ?? 'user',
      id: raw.participant?.id ?? '',
      displayName: raw.participant?.display_name ?? 'Unknown',
      avatarUrl: raw.participant?.avatar_url ?? null,
    },
    raw: raw.raw ?? {},
    rawScore: raw.raw_score ?? 0,
    normalizedScore: raw.normalized_score ?? 0,
    investedPoints: raw.invested_points ?? 0,
    finalScore: raw.final_score ?? 0,
    rank: raw.rank ?? null,
    previousRank: raw.previous_rank ?? null,
    lastScoredAt: raw.last_scored_at ?? null,
    eliminated: Boolean(raw.stats?.eliminated),
  }
}

/** GET /leaderboards/events/:ref — public (non-draft, non-DE events); `limit` max 100. */
export async function getEventLeaderboard(
  ref: string,
  opts: { page?: number; limit?: number; search?: string } = {}
): Promise<EventLeaderboardPage> {
  const { page = 1, limit = 50, search } = opts
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search?.trim()) params.set('search', search.trim().slice(0, 64))
  const res = await apiClient.get<{
    event_id: string
    event_title: string
    format: string
    min_participants: number
    threshold_met: boolean
    page: number
    limit: number
    total: number
    total_pages: number
    standings: RawEventEntry[]
  }>(`/leaderboards/events/${enc(ref)}?${params}`)
  return {
    eventId: res.event_id,
    eventTitle: res.event_title,
    format: res.format,
    minParticipants: res.min_participants,
    thresholdMet: res.threshold_met,
    page: res.page,
    limit: res.limit,
    total: res.total,
    totalPages: res.total_pages,
    standings: (res.standings || []).map(mapEventEntry),
  }
}

/** Every entry of an event board (walks the pages at the max page size). */
export async function getAllEventEntries(ref: string): Promise<EventLeaderboardEntry[]> {
  const all: EventLeaderboardEntry[] = []
  for (let page = 1; page <= 50; page++) {
    const res = await getEventLeaderboard(ref, { page, limit: 100 })
    all.push(...res.standings)
    if (page >= res.totalPages) break
  }
  return all
}

/** GET /leaderboards/events/:ref/podium — entries ranked 1..3. */
export async function getEventPodium(ref: string): Promise<EventPodium> {
  const res = await apiClient.get<{ threshold_met: boolean; podium: RawEventEntry[] }>(
    `/leaderboards/events/${enc(ref)}/podium`
  )
  return { thresholdMet: res.threshold_met, podium: (res.podium || []).map(mapEventEntry) }
}

/**
 * GET /events/:ref — the event document. Score entry needs its scoring parameters and its admin
 * list, which the shared ClubEvent mapping does not carry.
 */
export async function getEventScoringContext(ref: string): Promise<EventScoringContext> {
  const raw = await apiClient.get<{
    _id: string
    type?: string
    status?: string
    created_by?: string
    core_admins?: string[]
    teaming?: { is_teamed?: boolean }
    scoring?: { parameters?: ScoringParameter[] }
  }>(`/events/${enc(ref)}`)
  return {
    id: raw._id,
    type: raw.type ?? '',
    status: raw.status ?? '',
    createdBy: raw.created_by ?? null,
    coreAdmins: raw.core_admins ?? [],
    isTeamed: Boolean(raw.teaming?.is_teamed),
    parameters: raw.scoring?.parameters ?? [],
  }
}

/** GET /events/:ref/participants?status=confirmed — every page (limit max 100). */
export async function getConfirmedParticipants(ref: string): Promise<EventParticipant[]> {
  const all: EventParticipant[] = []
  for (let page = 1; page <= 50; page++) {
    const res = await apiClient.get<{
      participants?: {
        user?: { user_id?: string; display_name?: string }
        team_id?: string | null
      }[]
      total_pages?: number
    }>(`/events/${enc(ref)}/participants?status=confirmed&limit=100&page=${page}`)
    for (const p of res?.participants || []) {
      if (!p.user?.user_id) continue
      all.push({
        userId: p.user.user_id,
        displayName: p.user.display_name || p.user.user_id,
        teamId: p.team_id ?? null,
      })
    }
    if (!res?.total_pages || page >= res.total_pages) break
  }
  return all
}

/**
 * PUT /leaderboards/events/:ref/scores (core+, event admin). PUT and POST run the same controller;
 * PUT is used because each participant's `raw` REPLACES their stored raw values. Max 500 rows per
 * request, so larger batches are split.
 */
export async function submitEventScores(
  ref: string,
  scores: ScoreSubmission[]
): Promise<{ count: number; thresholdMet: boolean }> {
  let count = 0
  let thresholdMet = false
  for (let i = 0; i < scores.length; i += 500) {
    const chunk = scores.slice(i, i + 500)
    const res = await apiClient.put<{ count: number; threshold_met: boolean }>(
      `/leaderboards/events/${enc(ref)}/scores`,
      { scores: chunk.map((s) => ({ participant_id: s.participantId, raw: s.raw })) }
    )
    count += res?.count ?? 0
    thresholdMet = Boolean(res?.threshold_met)
  }
  return { count, thresholdMet }
}

/* ------------------------------ points ledger ------------------------------ */

export interface RawBackendTransaction {
  id?: string
  _id?: string
  user_id?: string
  amount: number
  type?: string
  source?: string
  reason?: string
  reference?: { type: string; id: string } | null
  note?: string | null
  actor?: { type: string; user_id: string | null } | null
  balance_after?: number
  expires_at?: string | null
  created_at?: string
}

export function mapBackendTransaction(raw: RawBackendTransaction): PointsTransaction {
  return {
    id: raw.id || raw._id || `tx-${raw.created_at ?? ''}-${raw.amount}`,
    userId: raw.user_id || '',
    amount: raw.amount,
    note: raw.note || '',
    createdAt: raw.created_at || '',
    balanceAfter: raw.balance_after,
    type: raw.type,
    source: raw.source,
    reason: raw.reason,
    reference: raw.reference ?? null,
    actor: raw.actor ? { type: raw.actor.type, userId: raw.actor.user_id } : null,
    expiresAt: raw.expires_at ?? null,
  }
}

/** GET /points/users/:id/transactions (core+). Cursor-paged, `limit` max 50. */
export async function getUserTransactions(
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<PointsTransactionPage> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 50) })
  if (opts.cursor) params.set('cursor', opts.cursor)
  const res = await apiClient.get<{ transactions?: RawBackendTransaction[]; next_cursor?: string | null }>(
    `/points/users/${enc(userId)}/transactions?${params}`
  )
  return {
    transactions: (res?.transactions || []).map(mapBackendTransaction),
    nextCursor: res?.next_cursor ?? null,
  }
}

export interface UserPointsSummary {
  balance: number
  lifetimeEarned: number
  lifetimeSpent: number
  ledgerSynced: boolean
}

/** GET /points/users/:id (core+): live balance, lifetime totals and the ledger drift flag. */
export async function getUserPointsSummary(userId: string): Promise<UserPointsSummary> {
  const res = await apiClient.get<{
    balance: number
    lifetime_earned: number
    lifetime_spent: number
    ledger_synced: boolean
  }>(`/points/users/${enc(userId)}`)
  return {
    balance: res.balance,
    lifetimeEarned: res.lifetime_earned,
    lifetimeSpent: res.lifetime_spent,
    ledgerSynced: res.ledger_synced,
  }
}

/** GET /points/events/:eventId (core+). Rows referencing the event; cursor-paged, `limit` max 50. */
export async function getEventLedger(
  eventId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<EventLedgerPage> {
  const params = new URLSearchParams({ limit: String(opts.limit ?? 50) })
  if (opts.cursor) params.set('cursor', opts.cursor)
  const res = await apiClient.get<{
    transactions?: RawBackendTransaction[]
    next_cursor?: string | null
    podium_conflicts?: Record<string, unknown>[]
  }>(`/points/events/${enc(eventId)}?${params}`)
  return {
    transactions: (res?.transactions || []).map(mapBackendTransaction),
    nextCursor: res?.next_cursor ?? null,
    podiumConflicts: res?.podium_conflicts || [],
  }
}

/** GET /users/search?q=&limit= (any active user; `limit` max 20). */
export async function searchUsers(q: string, limit = 10): Promise<UserSearchResult[]> {
  const term = q.trim().slice(0, 80)
  if (!term) return []
  const res = await apiClient.get<{
    users?: {
      id: string
      username: string
      profile?: { full_name?: string | null }
      points_balance?: number
    }[]
  }>(`/users/search?q=${enc(term)}&limit=${limit}`)
  return (res?.users || []).map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.profile?.full_name ?? null,
    pointsBalance: typeof u.points_balance === 'number' ? u.points_balance : null,
  }))
}

/* ------------------------------ manual adjust ------------------------------ */

/**
 * POST /points/adjust (coordinator+). Responds `{ transaction, replayed }`; the new balance is the
 * transaction's `balance_after`. Reuse `requestId` when retrying the same adjustment.
 */
export async function adjustPoints(
  payload: PointsAdjustmentPayload
): Promise<{ success: boolean; newBalance: number; transaction: PointsTransaction; replayed: boolean }> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const entry = DEFAULT_LEADERBOARD_DATA.find((e) => e.userId === payload.userId)
    const newBalance = Math.max(0, (entry ? entry.points : 0) + payload.amount)
    if (entry) entry.points = newBalance
    DEFAULT_LEADERBOARD_DATA.sort((a, b) => b.points - a.points)
    DEFAULT_LEADERBOARD_DATA.forEach((e, idx) => {
      e.rank = idx + 1
    })
    return {
      success: true,
      newBalance,
      replayed: false,
      transaction: {
        id: `tx-${Date.now()}`,
        userId: payload.userId,
        amount: payload.amount,
        note: payload.note,
        createdAt: new Date().toISOString(),
        balanceAfter: newBalance,
      },
    }
  }

  const res = await apiClient.post<{ transaction: RawBackendTransaction; replayed?: boolean }>(
    '/points/adjust',
    {
      user_id: payload.userId,
      amount: payload.amount,
      note: payload.note,
      request_id: payload.requestId || newRequestId(),
    }
  )

  const transaction = mapBackendTransaction(res.transaction)
  return {
    success: true,
    newBalance: transaction.balanceAfter ?? 0,
    transaction,
    replayed: Boolean(res.replayed),
  }
}

/**
 * One member's points history (admin endpoint). The backend has no all-members ledger, and
 * /points/me/transactions would be the signed-in admin's own history, not the member's.
 */
export async function getPointsTransactions(
  userId: string,
  userName = 'Member'
): Promise<PointsTransaction[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return DEFAULT_POINTS_TRANSACTIONS.filter((tx) => tx.userId === userId)
  }

  const res = await apiClient.get<
    { transactions?: RawBackendTransaction[] } | RawBackendTransaction[]
  >(`/points/users/${encodeURIComponent(userId)}/transactions?limit=50`)

  const list = Array.isArray(res) ? res : res?.transactions || []
  return list.map((raw) => ({ ...mapBackendTransaction(raw), userName }))
}

export const leaderboardService = {
  getGlobalLeaderboard,
  getGlobalLeaderboardPage,
  getEventLeaderboard,
  getAllEventEntries,
  getEventPodium,
  getEventScoringContext,
  getConfirmedParticipants,
  submitEventScores,
  getUserTransactions,
  getUserPointsSummary,
  getEventLedger,
  searchUsers,
  adjustPoints,
  getPointsTransactions,
  mapBackendStanding,
  mapBackendTransaction,
}

export default leaderboardService
