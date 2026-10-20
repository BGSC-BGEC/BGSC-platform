import { apiClient } from './apiClient'
import type {
  Bracket,
  BracketFormat,
  BracketParticipant,
  BracketSeeding,
  BracketStatus,
  Match,
  MatchSide,
  MatchStatus,
  MatchWinner,
} from '../types/bracket'
import { DEFAULT_BRACKET_DATA } from '../data/bracketData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

export interface RawBackendMatch {
  _id?: string
  id?: string
  event_id: string
  bracket_id: string
  round: number
  slot: number
  a: MatchSide | null
  b: MatchSide | null
  score_a: number | null
  score_b: number | null
  winner: MatchWinner
  status: MatchStatus
  scheduled_at?: string | null
  venue?: string | null
  advances_to?: { match_id: string; slot: 'a' | 'b' } | null
}

export interface RawBackendBracket {
  _id?: string
  id?: string
  event_id: string
  format?: BracketFormat
  seeding?: BracketSeeding
  status?: BracketStatus
  rounds?: number
  participants?: BracketParticipant[]
}

export function mapBackendMatch(raw: RawBackendMatch): Match {
  return {
    id: raw._id || raw.id || '',
    eventId: raw.event_id,
    bracketId: raw.bracket_id,
    round: raw.round,
    slot: raw.slot,
    a: raw.a || null,
    b: raw.b || null,
    scoreA: raw.score_a ?? null,
    scoreB: raw.score_b ?? null,
    winner: raw.winner ?? null,
    status: raw.status || 'scheduled',
    scheduledAt: raw.scheduled_at ? new Date(raw.scheduled_at).toISOString() : null,
    venue: raw.venue || null,
    advancesTo: raw.advances_to
      ? { matchId: raw.advances_to.match_id, slot: raw.advances_to.slot }
      : null,
  }
}

export function mapBackendBracket(
  raw: RawBackendBracket | Record<string, unknown>,
  matches: Match[]
): Bracket {
  const rawRecord = raw as Record<string, unknown>
  const rounds =
    typeof rawRecord.rounds === 'number'
      ? rawRecord.rounds
      : matches.length > 0
      ? Math.max(...matches.map((m) => m.round))
      : 1

  return {
    id: (rawRecord._id as string) || (rawRecord.id as string) || '',
    eventId: (rawRecord.event_id as string) || '',
    format: (rawRecord.format as BracketFormat) || 'single_elim',
    seeding: (rawRecord.seeding as BracketSeeding) || 'registration',
    status: (rawRecord.status as BracketStatus) || 'active',
    rounds,
    participants: (rawRecord.participants as BracketParticipant[]) || [],
    matches,
  }
}

function createMockSingleElimBracket(eventId: string, seeding: BracketSeeding): Bracket {
  const bracketId = `brk-${eventId}`
  const participants: BracketParticipant[] = [
    { id: `pt-${eventId}-1`, seed: 1, displayName: 'Alpha Squad', avatarUrl: null },
    { id: `pt-${eventId}-2`, seed: 2, displayName: 'Bravo Titans', avatarUrl: null },
    { id: `pt-${eventId}-3`, seed: 3, displayName: 'Charlie Vipers', avatarUrl: null },
    { id: `pt-${eventId}-4`, seed: 4, displayName: 'Delta Force', avatarUrl: null },
    { id: `pt-${eventId}-5`, seed: 5, displayName: 'Echo Strikers', avatarUrl: null },
    { id: `pt-${eventId}-6`, seed: 6, displayName: 'Foxtrot Wolves', avatarUrl: null },
    { id: `pt-${eventId}-7`, seed: 7, displayName: 'Golf Gliders', avatarUrl: null },
    { id: `pt-${eventId}-8`, seed: 8, displayName: 'Hotel Hazards', avatarUrl: null },
  ]

  const qf1Id = `match-${eventId}-qf-1`
  const qf2Id = `match-${eventId}-qf-2`
  const qf3Id = `match-${eventId}-qf-3`
  const qf4Id = `match-${eventId}-qf-4`
  const sf1Id = `match-${eventId}-sf-1`
  const sf2Id = `match-${eventId}-sf-2`
  const fnId = `match-${eventId}-fn-1`

  const matches: Match[] = [
    {
      id: qf1Id,
      eventId,
      bracketId,
      round: 1,
      slot: 1,
      a: { id: participants[0].id, seed: 1, displayName: participants[0].displayName },
      b: { id: participants[7].id, seed: 8, displayName: participants[7].displayName },
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: { matchId: sf1Id, slot: 'a' },
    },
    {
      id: qf2Id,
      eventId,
      bracketId,
      round: 1,
      slot: 2,
      a: { id: participants[3].id, seed: 4, displayName: participants[3].displayName },
      b: { id: participants[4].id, seed: 5, displayName: participants[4].displayName },
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: { matchId: sf1Id, slot: 'b' },
    },
    {
      id: qf3Id,
      eventId,
      bracketId,
      round: 1,
      slot: 3,
      a: { id: participants[1].id, seed: 2, displayName: participants[1].displayName },
      b: { id: participants[6].id, seed: 7, displayName: participants[6].displayName },
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: { matchId: sf2Id, slot: 'a' },
    },
    {
      id: qf4Id,
      eventId,
      bracketId,
      round: 1,
      slot: 4,
      a: { id: participants[2].id, seed: 3, displayName: participants[2].displayName },
      b: { id: participants[5].id, seed: 6, displayName: participants[5].displayName },
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: { matchId: sf2Id, slot: 'b' },
    },
    {
      id: sf1Id,
      eventId,
      bracketId,
      round: 2,
      slot: 1,
      a: null,
      b: null,
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: { matchId: fnId, slot: 'a' },
    },
    {
      id: sf2Id,
      eventId,
      bracketId,
      round: 2,
      slot: 2,
      a: null,
      b: null,
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: { matchId: fnId, slot: 'b' },
    },
    {
      id: fnId,
      eventId,
      bracketId,
      round: 3,
      slot: 1,
      a: null,
      b: null,
      scoreA: null,
      scoreB: null,
      winner: null,
      status: 'scheduled',
      scheduledAt: null,
      venue: null,
      advancesTo: null,
    },
  ]

  return {
    id: bracketId,
    eventId,
    format: 'single_elim',
    seeding,
    status: 'active',
    rounds: 3,
    participants,
    matches,
  }
}

export async function getBracket(eventId: string): Promise<Bracket | null> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 200))
    return DEFAULT_BRACKET_DATA[eventId] || null
  }

  try {
    const rawBracket = await apiClient.get<RawBackendBracket | { bracket: RawBackendBracket }>(
      `/brackets/${eventId}`
    )
    const bracketData =
      'bracket' in rawBracket && rawBracket.bracket ? rawBracket.bracket : rawBracket

    const rawMatches = await apiClient.get<
      { matches: RawBackendMatch[] } | RawBackendMatch[]
    >(`/matches?event_id=${eventId}`)

    const matchesList = Array.isArray(rawMatches)
      ? rawMatches
      : rawMatches?.matches || []

    const mappedMatches = matchesList.map(mapBackendMatch)
    return mapBackendBracket(bracketData, mappedMatches)
  } catch (error) {
    console.warn(`[bracketService] Failed to fetch bracket for event ${eventId}:`, error)
    return isMock ? DEFAULT_BRACKET_DATA[eventId] || null : null
  }
}

export async function generateBracket(
  eventId: string,
  seeding: BracketSeeding = 'registration'
): Promise<Bracket> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (DEFAULT_BRACKET_DATA[eventId]) {
      return DEFAULT_BRACKET_DATA[eventId]
    }
    const generated = createMockSingleElimBracket(eventId, seeding)
    DEFAULT_BRACKET_DATA[eventId] = generated
    return generated
  }

  const res = await apiClient.post<
    RawBackendBracket | { bracket: RawBackendBracket }
  >('/brackets', { event_id: eventId, seeding })

  const rawBracket = 'bracket' in res && res.bracket ? res.bracket : res
  const rawMatches = await apiClient.get<
    { matches: RawBackendMatch[] } | RawBackendMatch[]
  >(`/matches?event_id=${eventId}`)

  const matchesList = Array.isArray(rawMatches)
    ? rawMatches
    : rawMatches?.matches || []

  return mapBackendBracket(rawBracket, matchesList.map(mapBackendMatch))
}

export async function reportMatchResult(
  matchId: string,
  scoreA: number,
  scoreB: number
): Promise<Match> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    for (const bracket of Object.values(DEFAULT_BRACKET_DATA)) {
      const match = bracket.matches.find((m) => m.id === matchId)
      if (match) {
        match.scoreA = scoreA
        match.scoreB = scoreB
        match.status = 'completed'
        const winner: MatchWinner =
          scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'draw'
        match.winner = winner

        // Auto-advance winner to the next round if applicable
        if (match.advancesTo && (winner === 'a' || winner === 'b')) {
          const nextMatch = bracket.matches.find(
            (m) => m.id === match.advancesTo!.matchId
          )
          if (nextMatch) {
            const winningSide = winner === 'a' ? match.a : match.b
            if (winningSide) {
              if (match.advancesTo.slot === 'a') {
                nextMatch.a = { ...winningSide }
              } else {
                nextMatch.b = { ...winningSide }
              }
            }
          }
        }
        return { ...match }
      }
    }
    throw new Error(`Match with id ${matchId} not found in mock data`)
  }

  const res = await apiClient.patch<
    RawBackendMatch | { match: RawBackendMatch }
  >(`/matches/${matchId}`, { score_a: scoreA, score_b: scoreB })

  const raw = 'match' in res && res.match ? res.match : (res as RawBackendMatch)
  return mapBackendMatch(raw)
}

export async function scheduleMatch(
  matchId: string,
  scheduledAt?: string | null,
  venue?: string | null
): Promise<Match> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    for (const bracket of Object.values(DEFAULT_BRACKET_DATA)) {
      const match = bracket.matches.find((m) => m.id === matchId)
      if (match) {
        match.scheduledAt = scheduledAt || null
        match.venue = venue || null
        return { ...match }
      }
    }
    throw new Error(`Match with id ${matchId} not found in mock data`)
  }

  const res = await apiClient.patch<
    RawBackendMatch | { match: RawBackendMatch }
  >(`/matches/${matchId}/schedule`, {
    scheduled_at: scheduledAt,
    venue,
  })

  const raw = 'match' in res && res.match ? res.match : (res as RawBackendMatch)
  return mapBackendMatch(raw)
}

export async function resetBracket(eventId: string): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    delete DEFAULT_BRACKET_DATA[eventId]
    return true
  }

  try {
    await apiClient.delete(`/brackets/${eventId}`)
    return true
  } catch (error) {
    console.warn(`[bracketService] Failed to reset bracket for event ${eventId}:`, error)
    return false
  }
}

export const bracketService = {
  getBracket,
  generateBracket,
  reportMatchResult,
  scheduleMatch,
  resetBracket,
  mapBackendMatch,
  mapBackendBracket,
}

export default bracketService
