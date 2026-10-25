import { apiClient } from './apiClient'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

export type ChallengeDomain = 'sports' | 'esports' | 'dev' | 'general'
export type ChallengeKind = 'physical' | 'digital'
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'legend'
export type ChallengeStatus = 'draft' | 'active' | 'completed' | 'archived'

export interface ChallengeItem {
  id: string
  title: string
  description: string
  domain: ChallengeDomain
  kind: ChallengeKind
  difficulty: ChallengeDifficulty
  awardPoints: number
  status: ChallengeStatus
  grantsHallOfFame: boolean
  autoApprove: boolean
  participantsCount: number
}

export interface ChallengeParticipation {
  id: string
  challengeId: string
  userId: string
  username: string
  displayName: string
  status: 'joined' | 'under_review' | 'approved' | 'rejected'
  proofText?: string
  proofUrl?: string
  submittedAt?: string
}

const mockChallenges: ChallengeItem[] = [
  {
    id: 'chl-001',
    title: '100km Monthly Running Streak',
    description: 'Log 100 kilometers of outdoor running within 30 days via Strava or GPS proof.',
    domain: 'sports',
    kind: 'physical',
    difficulty: 'hard',
    awardPoints: 500,
    status: 'active',
    grantsHallOfFame: false,
    autoApprove: false,
    participantsCount: 18,
  },
  {
    id: 'chl-002',
    title: 'Valorant Aim Lab 100k Gridshot Challenge',
    description: 'Score 100,000+ in Aim Lab Gridshot Ultimate and submit screenshot/video link.',
    domain: 'esports',
    kind: 'digital',
    difficulty: 'medium',
    awardPoints: 250,
    status: 'active',
    grantsHallOfFame: false,
    autoApprove: false,
    participantsCount: 24,
  },
  {
    id: 'chl-003',
    title: 'Ironman Campus Triathlon Legend',
    description: 'Complete all three endurance legs under 4 hours during FitSoc weekend.',
    domain: 'sports',
    kind: 'physical',
    difficulty: 'legend',
    awardPoints: 1200,
    status: 'draft',
    grantsHallOfFame: true,
    autoApprove: false,
    participantsCount: 0,
  },
]

const mockParticipations: ChallengeParticipation[] = [
  {
    id: 'prt-001',
    challengeId: 'chl-001',
    userId: 'usr-001',
    username: 'arjun_sharma',
    displayName: 'Arjun Sharma',
    status: 'under_review',
    proofText: 'Completed 104.2 km across 14 runs this month.',
    proofUrl: 'https://strava.com/activities/mock-100km',
    submittedAt: '2026-10-20',
  },
]

function normalizeChallenge(raw: Record<string, unknown>): ChallengeItem {
  const submission = (raw.submission as Record<string, unknown>) || {}
  const counts = (raw.counts as Record<string, unknown>) || {}
  return {
    id: String(raw._id || raw.id || ''),
    title: String(raw.title || 'Untitled Challenge'),
    description: String(raw.description || ''),
    domain: (raw.domain as ChallengeDomain) || 'sports',
    kind: (raw.kind as ChallengeKind) || 'physical',
    difficulty: (raw.difficulty as ChallengeDifficulty) || 'medium',
    awardPoints: Number(raw.award_points ?? raw.awardPoints ?? 100),
    status: (raw.status as ChallengeStatus) || 'active',
    grantsHallOfFame: Boolean(raw.grants_hall_of_fame ?? raw.grantsHallOfFame),
    autoApprove: Boolean(submission.auto_approve ?? raw.autoApprove),
    participantsCount: Number(counts.participants ?? raw.participantsCount ?? 0),
  }
}

function normalizeParticipation(raw: Record<string, unknown>): ChallengeParticipation {
  const user = (raw.user as Record<string, unknown>) || {}
  const submission = (raw.submission as Record<string, unknown>) || {}
  return {
    id: String(raw._id || raw.id || ''),
    challengeId: String(raw.challenge_id || raw.challengeId || ''),
    userId: String(user.id || raw.user_id || ''),
    username: String(user.username || raw.username || 'member'),
    displayName: String(
      user.display_name || user.full_name || user.username || 'Club Member'
    ),
    status: (raw.status as ChallengeParticipation['status']) || 'under_review',
    proofText: String(submission.notes || submission.text || raw.proof_text || ''),
    proofUrl: String(submission.proof_url || submission.url || raw.proof_url || ''),
    submittedAt: raw.submitted_at
      ? new Date(String(raw.submitted_at)).toLocaleDateString()
      : new Date().toLocaleDateString(),
  }
}

export async function getChallenges(filters?: {
  status?: string
  domain?: string
}): Promise<ChallengeItem[]> {
  const status = filters?.status || 'active'
  const domain = filters?.domain

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return mockChallenges.filter(
      (c) =>
        (!status || status === 'all' || c.status === status) &&
        (!domain || domain === 'all' || c.domain === domain)
    )
  }

  try {
    const query = `/challenges?status=${status}${
      domain && domain !== 'all' ? `&domain=${domain}` : ''
    }`
    const res = await apiClient.get<
      { challenges?: Record<string, unknown>[] } | Record<string, unknown>[]
    >(query)
    const list = Array.isArray(res) ? res : res?.challenges || []
    return list.map(normalizeChallenge)
  } catch (error) {
    console.warn('[challengeService] Failed to fetch challenges:', error)
    return isMock ? mockChallenges : []
  }
}

export async function createChallenge(payload: {
  title: string
  description: string
  domain: ChallengeDomain
  kind: ChallengeKind
  difficulty: ChallengeDifficulty
  award_points: number
  grants_hall_of_fame?: boolean
  autoApprove?: boolean
  locationName?: string
}): Promise<ChallengeItem> {
  const body = {
    title: payload.title,
    description: payload.description,
    domain: payload.domain,
    kind: payload.kind,
    difficulty: payload.difficulty,
    award_points: Number(payload.award_points),
    grants_hall_of_fame: Boolean(payload.grants_hall_of_fame),
    location:
      payload.kind === 'physical'
        ? {
            name: payload.locationName?.trim() || 'Campus Ground / Sports Complex',
            details: null,
          }
        : null,
    submission: {
      requires_proof: true,
      proof_types: ['text', 'url'],
      auto_approve: Boolean(payload.autoApprove),
    },
  }

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const created: ChallengeItem = {
      id: `chl-${Date.now()}`,
      title: body.title,
      description: body.description,
      domain: body.domain,
      kind: body.kind,
      difficulty: body.difficulty,
      awardPoints: body.award_points,
      status: 'draft',
      grantsHallOfFame: body.grants_hall_of_fame,
      autoApprove: Boolean(payload.autoApprove),
      participantsCount: 0,
    }
    mockChallenges.unshift(created)
    return created
  }

  const res = await apiClient.post<
    Record<string, unknown> | { challenge: Record<string, unknown> }
  >('/challenges', body)
  const raw =
    res && typeof res === 'object' && 'challenge' in res && res.challenge
      ? (res.challenge as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeChallenge(raw)
}

export async function transitionChallenge(
  id: string,
  verb: 'activate' | 'complete' | 'archive'
): Promise<ChallengeItem> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const item = mockChallenges.find((c) => c.id === id)
    if (item) {
      item.status =
        verb === 'activate'
          ? 'active'
          : verb === 'complete'
            ? 'completed'
            : 'archived'
      return { ...item }
    }
    throw new Error('Challenge not found')
  }

  const res = await apiClient.post<
    Record<string, unknown> | { challenge: Record<string, unknown> }
  >(`/challenges/${id}/${verb}`)
  const raw =
    res && typeof res === 'object' && 'challenge' in res && res.challenge
      ? (res.challenge as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeChallenge(raw)
}

export async function deleteChallenge(id: string): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const idx = mockChallenges.findIndex((c) => c.id === id)
    if (idx !== -1) mockChallenges.splice(idx, 1)
    return true
  }

  await apiClient.delete(`/challenges/${id}`)
  return true
}

export async function getReviewQueue(
  challengeId: string,
  status = 'under_review'
): Promise<ChallengeParticipation[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return mockParticipations.filter(
      (p) =>
        (p.challengeId === challengeId || challengeId === 'chl-001') &&
        (!status || p.status === status)
    )
  }

  try {
    const res = await apiClient.get<
      { participations?: Record<string, unknown>[] } | Record<string, unknown>[]
    >(`/challenges/${challengeId}/participations?status=${status}`)
    const list = Array.isArray(res) ? res : res?.participations || []
    return list.map(normalizeParticipation)
  } catch (error) {
    console.warn('[challengeService] Failed to fetch review queue:', error)
    return []
  }
}

export async function reviewParticipation(
  participationId: string,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<ChallengeParticipation | null> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const p = mockParticipations.find((item) => item.id === participationId)
    if (p) {
      p.status = decision
      return { ...p }
    }
    return null
  }

  const res = await apiClient.post<
    Record<string, unknown> | { participation: Record<string, unknown> }
  >(`/challenges/participations/${participationId}/review`, {
    decision,
    reason,
  })
  const raw =
    res && typeof res === 'object' && 'participation' in res && res.participation
      ? (res.participation as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeParticipation(raw)
}

export const challengeService = {
  getChallenges,
  createChallenge,
  transitionChallenge,
  deleteChallenge,
  getReviewQueue,
  reviewParticipation,
}

export default challengeService
