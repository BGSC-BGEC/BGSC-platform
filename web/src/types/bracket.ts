export type BracketFormat = 'single_elim' | 'round_robin'
export type BracketSeeding = 'registration' | 'random' | 'manual'
export type BracketStatus = 'draft' | 'active' | 'completed'
export type MatchStatus = 'scheduled' | 'ongoing' | 'completed' | 'bye' | 'cancelled'
export type MatchWinner = 'a' | 'b' | 'draw' | null

export interface BracketParticipant {
  id: string
  seed: number
  displayName: string
  avatarUrl?: string | null
}

export interface MatchSide {
  id: string
  seed: number
  displayName: string
}

export interface Match {
  id: string
  eventId: string
  bracketId: string
  round: number // 1 (Quarterfinals), 2 (Semifinals), 3 (Finals)
  slot: number // Match index within the round
  a: MatchSide | null // First team/player
  b: MatchSide | null // Second team/player
  scoreA: number | null
  scoreB: number | null
  winner: MatchWinner
  status: MatchStatus
  scheduledAt?: string | null
  venue?: string | null
  advancesTo?: { matchId: string; slot: 'a' | 'b' } | null
}

export interface Bracket {
  id: string
  eventId: string
  format: BracketFormat
  seeding: BracketSeeding
  status: BracketStatus
  rounds: number
  participants: BracketParticipant[]
  matches: Match[]
}
