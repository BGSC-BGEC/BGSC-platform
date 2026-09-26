export type EventCategory = 'leagues' | 'bgec' | 'fitsoc' | 'general'
export type EventDomain = 'sports' | 'esports' | 'fitness' | 'general'
export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled'

export interface ClubEvent {
    id: string
    title: string
    slug: string
    description: string
    category: EventCategory
    domain: EventDomain
    status: EventStatus
    startAt: string
    endAt: string
    venue: string | null
    maxParticipants: number | null
    currentParticipants: number
    isTeamed: boolean
    bannerUrl: string | null
}

export type EventItem = ClubEvent