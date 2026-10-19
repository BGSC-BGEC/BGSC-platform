export type FeedbackKind = 'feedback' | 'contact'
export type FeedbackCategory = 'bug' | 'feature' | 'complaint' | 'general'
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical'
export type FeedbackStatus = 'submitted' | 'under_review' | 'resolved' | 'closed'

export interface FeedbackReporter {
  user_id: string
  username: string
  display_name: string
  email?: string
  avatar_url?: string
}

export interface TicketResponse {
  body: string
  by_user_id: string
  by_user_name?: string
  at: string
}

export interface StatusHistoryItem {
  from_status: FeedbackStatus
  to_status: FeedbackStatus
  by_user_id: string
  by_user_name?: string
  at: string
  note?: string
}

export interface FeedbackTicket {
  id: string
  ticket_no: string
  kind: FeedbackKind
  category: FeedbackCategory
  severity: FeedbackSeverity
  subject: string
  description: string
  attachments: string[]
  event_id?: string | null
  event_title?: string | null
  is_anonymous: boolean
  reporter: FeedbackReporter | null
  contact_email: string | null
  status: FeedbackStatus
  response: TicketResponse | null
  status_history: StatusHistoryItem[]
  created_at: string
  updated_at: string
}

export interface UpdateStatusPayload {
  status: FeedbackStatus
  response?: string
}

export interface UpdateSeverityPayload {
  severity: FeedbackSeverity
}
