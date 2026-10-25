import { api, cleanParams } from '../api/client';

export type FeedbackCategory = 'bug' | 'feature' | 'complaint' | 'general';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'submitted' | 'under_review' | 'resolved' | 'closed';
export interface FeedbackInput {
  subject: string;
  description: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  attachments: string[];
  event_id?: string;
  is_anonymous: boolean;
  contact_email?: string;
}
export interface TicketReceipt { ticket_no: string; status: FeedbackStatus; created_at: string }
export interface FeedbackTicket extends TicketReceipt {
  subject: string;
  description: string;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  is_anonymous: boolean;
  response: { body: string; at: string } | null;
}
export interface TicketPage { tickets: FeedbackTicket[]; next_cursor: string | null }

export const feedbackRepository = {
  submit: (input: FeedbackInput, contact = false) => {
    if (contact) {
      const { category: _category, severity: _severity, ...contactBody } = input;
      return api.post<TicketReceipt>('/contact', contactBody);
    }
    return api.post<TicketReceipt>('/feedback', input);
  },
  get: (ticketNo: string) => api.get<FeedbackTicket>(`/feedback/${encodeURIComponent(ticketNo)}`),
  mine: (status?: FeedbackStatus, cursor?: string) => api.get<TicketPage>('/feedback/me', {
    params: cleanParams({ status, cursor, limit: 20 }),
  }),
};
