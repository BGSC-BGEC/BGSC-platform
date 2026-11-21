export type LeaderboardPeriod = 'all' | 'semester' | 'month' | 'week'
/** Mirrors QueryGlobalLeaderboardSchema.domain (leaderboard.schemas.ts): event + challenge domains. */
export type LeaderboardDomain = 'all' | 'sports' | 'esports' | 'fitness' | 'dev' | 'general'
/** Mirrors QueryGlobalLeaderboardSchema.source. */
export type LeaderboardSource = 'all' | 'challenge' | 'event'

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  username: string
  /** The global board does not return a per-row domain; absent unless the backend sends one. */
  domain?: LeaderboardDomain
  points: number
  change: number // e.g. +2 (moved up), -1 (dropped), 0 (unchanged)
  avatarUrl?: string | null
}

export interface GlobalLeaderboardPage {
  entries: LeaderboardEntry[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PointsAdjustmentPayload {
  userId: string
  amount: number // Positive grants points, negative claws back
  note: string // Required audit justification (min 3 chars)
  /** Idempotency key (uuid): keep the same one when retrying the same adjustment. */
  requestId?: string
}

export interface PointsTransaction {
  id: string
  userId: string
  userName?: string
  amount: number
  note: string
  createdAt: string
  balanceAfter?: number
  type?: string
  source?: string
  reason?: string
  reference?: { type: string; id: string } | null
  actor?: { type: string; userId: string | null } | null
  expiresAt?: string | null
}

export interface PointsTransactionPage {
  transactions: PointsTransaction[]
  nextCursor: string | null
}

export interface EventLedgerPage extends PointsTransactionPage {
  /** Audit rows of action `points.podium_conflict`, passed through as returned. */
  podiumConflicts: Record<string, unknown>[]
}

/** A row of GET /users/search, reduced to what the console shows. */
export interface UserSearchResult {
  id: string
  username: string
  fullName: string | null
  pointsBalance: number | null
}

/* ---------------------------- event leaderboards ---------------------------- */

export type ScoringKind = 'int' | 'float' | 'bool'

export interface ScoringParameter {
  key: string
  label: string
  kind: ScoringKind
  weight: number
}

export interface EventLeaderboardEntry {
  id: string
  participant: {
    type: 'user' | 'team'
    id: string
    displayName: string
    avatarUrl: string | null
  }
  raw: Record<string, number | boolean>
  rawScore: number
  normalizedScore: number
  investedPoints: number
  finalScore: number
  rank: number | null
  previousRank: number | null
  lastScoredAt: string | null
  eliminated: boolean
}

export interface EventLeaderboardPage {
  eventId: string
  eventTitle: string
  format: string
  minParticipants: number
  thresholdMet: boolean
  page: number
  limit: number
  total: number
  totalPages: number
  standings: EventLeaderboardEntry[]
}

export interface EventPodium {
  thresholdMet: boolean
  podium: EventLeaderboardEntry[]
}

/** What score entry needs from GET /events/:ref (fields ClubEvent does not carry). */
export interface EventScoringContext {
  id: string
  type: string
  status: string
  createdBy: string | null
  coreAdmins: string[]
  isTeamed: boolean
  parameters: ScoringParameter[]
}

/** A confirmed registration from GET /events/:ref/participants. */
export interface EventParticipant {
  userId: string
  displayName: string
  teamId: string | null
}

export interface ScoreSubmission {
  participantId: string
  raw: Record<string, number | boolean>
}
