export type AnnouncementCategory =
  | 'bgec'
  | 'fitsoc'
  | 'airball'
  | 'offside'
  | 'powerplay'
  | 'around_the_net'
  | 'deuce'
  | 'highlight'
  | 'teams'

export type AnnouncementPriority = 'normal' | 'important' | 'urgent'

export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export interface Announcement {
  id: string
  title: string
  body: string
  mediaUrl?: string | null
  categories: AnnouncementCategory[]
  tags: string[]
  priority: AnnouncementPriority
  status: AnnouncementStatus
  isPinned: boolean
  pinnedUntil?: string | null
  scheduledFor?: string | null
  publishedAt?: string | null
  createdAt: string
  authorName?: string
}
