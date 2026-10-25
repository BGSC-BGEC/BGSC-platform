export type EventCategory = 'leagues' | 'bgec' | 'fitsoc' | 'general'
export type EventDomain = 'sports' | 'esports' | 'fitness' | 'general'
export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled'
export type EventType = 'LE' | 'DE' | 'ALL' | 'DLL'

export interface ClubEvent {
  id: string
  title: string
  slug: string
  description: string
  category: EventCategory
  type?: EventType
  domain: EventDomain
  status: EventStatus
  startAt: string
  endAt: string
  venue: string | null
  maxParticipants: number | null
  currentParticipants: number
  isTeamed: boolean
  bannerUrl: string | null
  registrationFormId?: string | null
  waitlistEnabled?: boolean
  requiresApproval?: boolean
}

export type EventItem = ClubEvent
