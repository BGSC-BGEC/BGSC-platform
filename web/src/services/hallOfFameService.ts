import { apiClient } from './apiClient'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

/** Mirrors HALL_OF_FAME_CATEGORY in @bgsc/shared (models/HallOfFame.ts). */
export type HofCategory =
  | 'event_winner'
  | 'challenge_legend'
  | 'sponsor_champion'
  | 'custom'

export type HofHonoreeType = 'user' | 'team'
export type HofSourceType = 'event' | 'challenge' | 'manual'

export interface HofHonoree {
  type: HofHonoreeType
  id: string
  displayName: string
  avatarUrl: string | null
  deleted: boolean
}

export interface HofMember {
  userId: string
  displayName: string
  avatarUrl: string | null
  deleted: boolean
}

export interface HofSource {
  type: HofSourceType
  id: string | null
  title: string | null
}

export interface HofAchievement {
  domain: string
  season: string
  year: number
  difficulty: string
  awardPoints: number | null
}

export interface HallOfFameEntry {
  id: string
  slug: string
  category: HofCategory
  title: string
  description: string
  quote: string
  honoree: HofHonoree
  members: HofMember[]
  source: HofSource
  achievement: HofAchievement
  mediaUrl: string | null
  coverUrl: string | null
  tags: string[]
  featured: boolean
  featuredOrder: number | null
}

/**
 * Wire shapes, field for field with CreateHallOfFameEntrySchema / UpdateHallOfFameEntrySchema
 * (leaderboard-service/src/hall-of-fame/hallOfFame.schemas.ts).
 */
export interface HofHonoreeBody {
  type: HofHonoreeType
  id: string
  display_name: string
  avatar_url?: string | null
}

export interface HofMemberBody {
  user_id: string
  display_name: string
  avatar_url?: string | null
}

export interface HofSourceBody {
  type: HofSourceType
  id?: string | null
  title?: string | null
}

export interface HofAchievementBody {
  domain?: string
  season?: string
  year: number
  difficulty?: string
  award_points?: number
}

export interface CreateHofEntryBody {
  category: HofCategory
  title: string
  description?: string | null
  quote?: string | null
  honoree: HofHonoreeBody
  members?: HofMemberBody[]
  source: HofSourceBody
  achievement: HofAchievementBody
  media_url?: string | null
  cover_url?: string | null
  tags?: string[]
  featured?: boolean
  featured_order?: number | null
}

/** PATCH: every field optional, nested groups partial (the service merges them). */
export type UpdateHofEntryBody = Partial<
  Omit<CreateHofEntryBody, 'honoree' | 'source' | 'achievement'>
> & {
  honoree?: Partial<HofHonoreeBody>
  source?: Partial<HofSourceBody>
  achievement?: Partial<HofAchievementBody>
}

/** Same rule as the backend `Link`: http(s) URL or an /uploads/ path, max 2048 chars. */
export const HOF_LINK_PATTERN = /^(https?:\/\/[^\s]+|\/uploads\/[^\s]+)$/i

export function isValidHofLink(value: string): boolean {
  const v = value.trim()
  return v.length <= 2048 && HOF_LINK_PATTERN.test(v)
}

const mockHofEntries: HallOfFameEntry[] = [
  {
    id: 'hof-001',
    slug: 'bgsc-badminton-smash-open-s2-champion-2026',
    category: 'event_winner',
    title: 'BGSC Badminton Smash Open S2 Champion',
    description: 'Undefeated singles run across 6 rounds without dropping a set.',
    quote: 'Consistency on the court beats raw power every single day.',
    honoree: {
      type: 'user',
      id: '00000000-0000-4000-8000-000000000001',
      displayName: 'Arjun Sharma',
      avatarUrl: null,
      deleted: false,
    },
    members: [],
    source: { type: 'manual', id: null, title: null },
    achievement: { domain: 'sports', season: '2026', year: 2026, difficulty: '', awardPoints: null },
    mediaUrl: null,
    coverUrl: null,
    tags: [],
    featured: true,
    featuredOrder: null,
  },
]

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

function normalizeEntry(raw: Record<string, unknown>): HallOfFameEntry {
  const honoree = (raw.honoree as Record<string, unknown>) || {}
  const source = (raw.source as Record<string, unknown>) || {}
  const achievement = (raw.achievement as Record<string, unknown>) || {}
  const members = Array.isArray(raw.members) ? (raw.members as Record<string, unknown>[]) : []
  const sourceType = str(source.type)
  return {
    id: String(raw._id || raw.id || ''),
    slug: str(raw.slug),
    category: (raw.category as HofCategory) || 'custom',
    title: str(raw.title),
    description: str(raw.description),
    quote: str(raw.quote),
    honoree: {
      type: honoree.type === 'team' ? 'team' : 'user',
      id: str(honoree.id),
      displayName: str(honoree.display_name),
      avatarUrl: strOrNull(honoree.avatar_url),
      deleted: Boolean(honoree.deleted),
    },
    members: members.map((m) => ({
      userId: str(m.user_id),
      displayName: str(m.display_name),
      avatarUrl: strOrNull(m.avatar_url),
      deleted: Boolean(m.deleted),
    })),
    source: {
      type:
        sourceType === 'event' || sourceType === 'challenge' ? sourceType : 'manual',
      id: strOrNull(source.id),
      title: strOrNull(source.title),
    },
    achievement: {
      domain: str(achievement.domain),
      season: str(achievement.season),
      year: Number(achievement.year) || new Date().getFullYear(),
      difficulty: str(achievement.difficulty),
      awardPoints: numOrNull(achievement.award_points),
    },
    mediaUrl: strOrNull(raw.media_url),
    coverUrl: strOrNull(raw.cover_url),
    tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
    featured: Boolean(raw.featured),
    featuredOrder: numOrNull(raw.featured_order),
  }
}

export async function getEntries(filters?: {
  category?: string
  search?: string
  featured?: boolean
}): Promise<HallOfFameEntry[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return mockHofEntries.filter((e) => {
      const matchCat =
        !filters?.category ||
        filters.category === 'all' ||
        e.category === filters.category
      const term = (filters?.search || '').toLowerCase().trim()
      const matchSearch =
        !term ||
        e.honoree.displayName.toLowerCase().includes(term) ||
        e.title.toLowerCase().includes(term)
      return matchCat && matchSearch
    })
  }

  try {
    const params = new URLSearchParams()
    if (filters?.category && filters.category !== 'all') {
      params.set('category', filters.category)
    }
    if (filters?.search?.trim()) {
      // HallOfFameQuerySchema: search max 64 chars.
      params.set('search', filters.search.trim().slice(0, 64))
    }
    if (filters?.featured !== undefined) {
      params.set('featured', String(filters.featured))
    }
    params.set('limit', '100')
    const qs = params.toString()
    const res = await apiClient.get<
      { items?: Record<string, unknown>[]; entries?: Record<string, unknown>[] } | Record<string, unknown>[]
    >(`/hall-of-fame${qs ? `?${qs}` : ''}`)
    const list = Array.isArray(res) ? res : res?.items || res?.entries || []
    return list.map(normalizeEntry)
  } catch (error) {
    console.warn('[hallOfFameService] Failed to fetch Hall of Fame entries:', error)
    return isMock ? mockHofEntries : []
  }
}

export async function createEntry(body: CreateHofEntryBody): Promise<HallOfFameEntry> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const created = normalizeEntry({ ...body, id: `hof-${Date.now()}` } as unknown as Record<string, unknown>)
    mockHofEntries.unshift(created)
    return created
  }

  // The controller answers 201 with the entry document itself.
  const res = await apiClient.post<Record<string, unknown>>('/hall-of-fame', body)
  return normalizeEntry(res)
}

export async function updateEntry(
  id: string,
  body: UpdateHofEntryBody
): Promise<HallOfFameEntry> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const item = mockHofEntries.find((e) => e.id === id)
    if (item) {
      if (typeof body.featured === 'boolean') item.featured = body.featured
      if (typeof body.title === 'string') item.title = body.title
      return { ...item }
    }
    throw new Error('Hall of Fame entry not found')
  }

  const res = await apiClient.patch<Record<string, unknown>>(`/hall-of-fame/${id}`, body)
  return normalizeEntry(res)
}

export async function deleteEntry(id: string): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const idx = mockHofEntries.findIndex((e) => e.id === id)
    if (idx !== -1) mockHofEntries.splice(idx, 1)
    return true
  }

  await apiClient.delete(`/hall-of-fame/${id}`)
  return true
}

/** A user as the honoree / member picker needs it. */
export interface HofUserOption {
  id: string
  username: string
  fullName: string
  avatarUrl: string | null
}

/**
 * GET /users/search?q=&limit= (user-service SearchQuery: q 1..80 chars, limit 1..20).
 * Answers `{ users: SerializedUser[] }`; a private profile comes back minimal (no full_name).
 */
export async function searchUsers(q: string, limit = 10): Promise<HofUserOption[]> {
  const term = q.trim().slice(0, 80)
  if (!term) return []
  const params = new URLSearchParams({ q: term, limit: String(Math.min(Math.max(limit, 1), 20)) })
  const res = await apiClient.get<{ users?: Record<string, unknown>[] }>(`/users/search?${params}`)
  const list = Array.isArray(res?.users) ? res.users : []
  return list.map((u) => {
    const profile = (u.profile as Record<string, unknown>) || {}
    return {
      id: str(u.id || u._id),
      username: str(u.username),
      fullName: str(profile.full_name),
      avatarUrl: strOrNull(profile.avatar_url),
    }
  })
}

export const hallOfFameService = {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  searchUsers,
}

export default hallOfFameService
