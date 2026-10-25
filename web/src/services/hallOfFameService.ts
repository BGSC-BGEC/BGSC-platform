import { apiClient } from './apiClient'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

export type HofCategory =
  | 'event_winner'
  | 'challenge_legend'
  | 'sponsor_champion'
  | 'custom'

export interface HallOfFameEntry {
  id: string
  category: HofCategory
  title: string
  description: string
  quote: string
  honoreeId: string
  honoreeName: string
  honoreeType: 'user' | 'team'
  domain: string
  year: number
  season: string
  featured: boolean
}

const mockHofEntries: HallOfFameEntry[] = [
  {
    id: 'hof-001',
    category: 'event_winner',
    title: 'BGSC Badminton Smash Open S2 Champion',
    description: 'Undefeated singles run across 6 rounds without dropping a set.',
    quote: 'Consistency on the court beats raw power every single day.',
    honoreeId: '00000000-0000-4000-8000-000000000001',
    honoreeName: 'Arjun Sharma',
    honoreeType: 'user',
    domain: 'sports',
    year: 2026,
    season: '2026',
    featured: true,
  },
  {
    id: 'hof-002',
    category: 'challenge_legend',
    title: 'Ironman Campus Endurance Legend',
    description: 'First club athlete to complete the 100km monthly running streak 3 months in a row.',
    quote: 'Every mile counts.',
    honoreeId: '00000000-0000-4000-8000-000000000002',
    honoreeName: 'Priya Nair',
    honoreeType: 'user',
    domain: 'fitness',
    year: 2026,
    season: '2026',
    featured: true,
  },
]

function normalizeEntry(raw: Record<string, unknown>): HallOfFameEntry {
  const honoree = (raw.honoree as Record<string, unknown>) || {}
  const achievement = (raw.achievement as Record<string, unknown>) || {}
  return {
    id: String(raw._id || raw.id || ''),
    category: (raw.category as HofCategory) || 'event_winner',
    title: String(raw.title || 'Hall of Fame Inductee'),
    description: String(raw.description || ''),
    quote: String(raw.quote || ''),
    honoreeId: String(honoree.id || raw.honoreeId || ''),
    honoreeName: String(honoree.display_name || raw.honoreeName || 'Club Legend'),
    honoreeType: (honoree.type as 'user' | 'team') || 'user',
    domain: String(achievement.domain || raw.domain || 'sports'),
    year: Number(achievement.year || raw.year || new Date().getFullYear()),
    season: String(achievement.season || raw.season || '2026'),
    featured: Boolean(raw.featured),
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
        e.honoreeName.toLowerCase().includes(term) ||
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
      params.set('search', filters.search.trim())
    }
    if (filters?.featured !== undefined) {
      params.set('featured', String(filters.featured))
    }
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

export async function createEntry(payload: {
  category: HofCategory
  title: string
  description?: string
  quote?: string
  honoreeType?: 'user' | 'team'
  honoreeId: string
  honoreeName: string
  sourceTitle?: string
  domain?: string
  year: number
  season?: string
  awardPoints?: number
  featured?: boolean
}): Promise<HallOfFameEntry> {
  const body = {
    category: payload.category,
    title: payload.title,
    description: payload.description || '',
    quote: payload.quote || '',
    honoree: {
      type: payload.honoreeType || 'user',
      id: payload.honoreeId,
      display_name: payload.honoreeName,
    },
    source: {
      type: 'manual',
      title: payload.sourceTitle || 'Club Induction',
    },
    achievement: {
      domain: payload.domain || 'sports',
      year: Number(payload.year),
      season: payload.season || String(payload.year),
      award_points: Number(payload.awardPoints || 0),
    },
    featured: Boolean(payload.featured),
  }

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const created = normalizeEntry({
      ...body,
      id: `hof-${Date.now()}`,
    })
    mockHofEntries.unshift(created)
    return created
  }

  const res = await apiClient.post<
    Record<string, unknown> | { entry?: Record<string, unknown>; item?: Record<string, unknown> }
  >('/hall-of-fame', body)
  const raw =
    res && typeof res === 'object' && ('entry' in res || 'item' in res)
      ? ((res as { entry?: Record<string, unknown>; item?: Record<string, unknown> }).entry ||
          (res as { entry?: Record<string, unknown>; item?: Record<string, unknown> }).item ||
          (res as Record<string, unknown>))
      : (res as Record<string, unknown>)
  return normalizeEntry(raw)
}

export async function updateEntry(
  id: string,
  payload: Record<string, unknown>
): Promise<HallOfFameEntry> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const item = mockHofEntries.find((e) => e.id === id)
    if (item) {
      if (typeof payload.featured === 'boolean') item.featured = payload.featured
      if (typeof payload.title === 'string') item.title = payload.title
      return { ...item }
    }
    throw new Error('Hall of Fame entry not found')
  }

  const res = await apiClient.patch<Record<string, unknown>>(`/hall-of-fame/${id}`, payload)
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

export const hallOfFameService = {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
}

export default hallOfFameService
