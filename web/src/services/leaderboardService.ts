import { apiClient } from './apiClient'
import type {
  LeaderboardDomain,
  LeaderboardEntry,
  LeaderboardPeriod,
  PointsAdjustmentPayload,
  PointsTransaction,
} from '../types/leaderboard'
import {
  DEFAULT_LEADERBOARD_DATA,
  DEFAULT_POINTS_TRANSACTIONS,
} from '../data/leaderboardData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

export interface RawBackendStanding {
  rank: number
  user_id: string
  display_name: string
  username: string
  avatar_url?: string | null
  points: number
  domain?: LeaderboardDomain
  change?: number
}

export interface RawBackendTransaction {
  id?: string
  _id?: string
  user_id?: string
  user_name?: string
  amount: number
  note?: string
  reason?: string
  created_at?: string
  balance_after?: number
}

export function mapBackendStanding(raw: RawBackendStanding): LeaderboardEntry {
  return {
    rank: raw.rank,
    userId: raw.user_id,
    name: raw.display_name,
    username: raw.username,
    domain: raw.domain || 'sports',
    points: raw.points,
    change: raw.change ?? 0,
    avatarUrl: raw.avatar_url || null,
  }
}

export function mapBackendTransaction(raw: RawBackendTransaction): PointsTransaction {
  return {
    id: raw.id || raw._id || `tx-${Date.now()}`,
    userId: raw.user_id || '',
    userName: raw.user_name || 'Member',
    amount: raw.amount,
    note: raw.note || raw.reason || 'Points adjustment',
    createdAt: raw.created_at || new Date().toISOString(),
    balanceAfter: raw.balance_after,
  }
}

export async function getGlobalLeaderboard(
  period: LeaderboardPeriod = 'all',
  domain: LeaderboardDomain = 'all'
): Promise<LeaderboardEntry[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    let result = [...DEFAULT_LEADERBOARD_DATA]

    if (domain !== 'all') {
      result = result.filter((entry) => entry.domain === domain)
    }

    result.sort((a, b) => b.points - a.points)
    return result.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
  }

  try {
    const res = await apiClient.get<
      { standings?: RawBackendStanding[] } | RawBackendStanding[]
    >(`/leaderboard/global?period=${period}&domain=${domain}`)

    const list = Array.isArray(res) ? res : res?.standings || []
    return list.map(mapBackendStanding)
  } catch (error) {
    console.warn('[leaderboardService] Failed to fetch global leaderboard:', error)
    return isMock ? DEFAULT_LEADERBOARD_DATA : []
  }
}

export async function adjustPoints(
  payload: PointsAdjustmentPayload
): Promise<{ success: boolean; newBalance: number; transaction: PointsTransaction }> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const entry = DEFAULT_LEADERBOARD_DATA.find((e) => e.userId === payload.userId)
    const currentBalance = entry ? entry.points : 1000
    const newBalance = Math.max(0, currentBalance + payload.amount)

    if (entry) {
      entry.points = newBalance
    }

    const transaction: PointsTransaction = {
      id: `tx-${Date.now()}`,
      userId: payload.userId,
      userName: entry?.name || 'Member',
      amount: payload.amount,
      note: payload.note,
      createdAt: new Date().toISOString(),
      balanceAfter: newBalance,
    }

    DEFAULT_POINTS_TRANSACTIONS.unshift(transaction)

    // Re-sort in place and recalculate ranks
    DEFAULT_LEADERBOARD_DATA.sort((a, b) => b.points - a.points)
    DEFAULT_LEADERBOARD_DATA.forEach((e, idx) => {
      e.rank = idx + 1
    })

    return {
      success: true,
      newBalance,
      transaction,
    }
  }

  const requestId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const res = await apiClient.post<{
    success?: boolean
    balance_after?: number
    new_balance?: number
    transaction?: RawBackendTransaction
  }>('/points/adjust', {
    user_id: payload.userId,
    amount: payload.amount,
    note: payload.note,
    request_id: requestId,
  })

  const newBalance = res.balance_after ?? res.new_balance ?? 0
  const transaction: PointsTransaction = res.transaction
    ? mapBackendTransaction(res.transaction)
    : {
        id: `tx-${Date.now()}`,
        userId: payload.userId,
        userName: 'Member',
        amount: payload.amount,
        note: payload.note,
        createdAt: new Date().toISOString(),
        balanceAfter: newBalance,
      }

  return {
    success: true,
    newBalance,
    transaction,
  }
}

export async function getPointsTransactions(): Promise<PointsTransaction[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return [...DEFAULT_POINTS_TRANSACTIONS]
  }

  try {
    const res = await apiClient.get<
      { transactions?: RawBackendTransaction[] } | RawBackendTransaction[]
    >('/points/me/transactions')

    const list = Array.isArray(res) ? res : res?.transactions || []
    return list.map(mapBackendTransaction)
  } catch (error) {
    console.warn('[leaderboardService] Failed to fetch points transactions:', error)
    return isMock ? DEFAULT_POINTS_TRANSACTIONS : []
  }
}

export const leaderboardService = {
  getGlobalLeaderboard,
  adjustPoints,
  getPointsTransactions,
  mapBackendStanding,
  mapBackendTransaction,
}

export default leaderboardService
