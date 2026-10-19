export type LeaderboardPeriod = 'all' | 'semester' | 'month' | 'week'
export type LeaderboardDomain = 'all' | 'sports' | 'esports' | 'fitness' | 'general'

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  username: string
  domain: LeaderboardDomain
  points: number
  change: number // e.g. +2 (moved up), -1 (dropped), 0 (unchanged)
  avatarUrl?: string | null
}

export interface PointsAdjustmentPayload {
  userId: string
  amount: number // Positive grants points, negative claws back
  note: string // Required audit justification (min 3 chars)
}

export interface PointsTransaction {
  id: string
  userId: string
  userName: string
  amount: number
  note: string
  createdAt: string
  balanceAfter?: number
}
