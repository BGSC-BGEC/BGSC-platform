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

/** Backend ROLE_RANK, lowest first. `audience.min_role` is one of these. */
export type AudienceRole = 'guest' | 'user' | 'member' | 'core' | 'coordinator' | 'founder'

export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'rate_limited'
  | 'skipped'
  | 'outcome_unknown'

export interface AnnouncementAudience {
  minRole: AudienceRole
  /** null = everyone at or above minRole; else only confirmed registrants of this event. */
  eventId: string | null
}

export interface WhatsAppDeliveryRow {
  category: AnnouncementCategory
  /** Masked label (e.g. ••••1234), never the destination itself. */
  groupId: string
  status: DeliveryStatus
  attemptedAt: string | null
  error: string | null
}

export interface AnnouncementDelivery {
  whatsapp: { requested: boolean; perCategory: WhatsAppDeliveryRow[] }
  push: { requested: boolean; status: DeliveryStatus; sentCount: number | null }
}

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
  audience?: AnnouncementAudience
  /** Only returned to core+ (the composer's view). */
  delivery?: AnnouncementDelivery | null
}

/** GET /announcements/:id/stats and GET /announcements/stats?ids= (coordinator+). */
export interface AnnouncementStats {
  announcementId: string
  /** Active, non-deleted accounts that can see it today. */
  eligible: number
  /** Of those, how many have it read (tab opened after publish, or card opened). */
  read: number
  /** 0..1, or null when nobody is eligible. */
  readRate: number | null
}
