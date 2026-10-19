import { apiClient } from './apiClient'
import type {
  FeedbackCategory,
  FeedbackKind,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTicket,
} from '../types/feedback'
import { DEFAULT_FEEDBACK_TICKETS } from '../data/feedbackData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

// In-memory working copy for local testing
const mockTickets: FeedbackTicket[] = structuredClone(DEFAULT_FEEDBACK_TICKETS)

export interface FeedbackFilters {
  status?: FeedbackStatus | 'all'
  category?: FeedbackCategory | 'all'
  severity?: FeedbackSeverity | 'all'
  kind?: FeedbackKind | 'all'
  search?: string
}

export async function getInbox(
  filters?: FeedbackFilters
): Promise<FeedbackTicket[]> {
  const buildQuery = () => {
    const params = new URLSearchParams()
    if (filters?.status && filters.status !== 'all') {
      params.append('status', filters.status)
    }
    if (filters?.category && filters.category !== 'all') {
      params.append('category', filters.category)
    }
    if (filters?.severity && filters.severity !== 'all') {
      params.append('severity', filters.severity)
    }
    if (filters?.kind && filters.kind !== 'all') {
      params.append('kind', filters.kind)
    }
    if (filters?.search && filters.search.trim()) {
      params.append('search', filters.search.trim())
    }
    return params.toString() ? `?${params.toString()}` : ''
  }

  const applyMockFilters = (): FeedbackTicket[] => {
    let result = structuredClone(mockTickets)

    if (filters?.status && filters.status !== 'all') {
      result = result.filter((t) => t.status === filters.status)
    }
    if (filters?.category && filters.category !== 'all') {
      result = result.filter((t) => t.category === filters.category)
    }
    if (filters?.severity && filters.severity !== 'all') {
      result = result.filter((t) => t.severity === filters.severity)
    }
    if (filters?.kind && filters.kind !== 'all') {
      result = result.filter((t) => t.kind === filters.kind)
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase()
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.ticket_no.toLowerCase().includes(term) ||
          (t.reporter?.display_name &&
            t.reporter.display_name.toLowerCase().includes(term)) ||
          (t.contact_email && t.contact_email.toLowerCase().includes(term))
      )
    }

    result.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    return result
  }

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return applyMockFilters()
  }

  try {
    const queryString = buildQuery()
    const res = await apiClient.get<
      FeedbackTicket[] | { tickets?: FeedbackTicket[] }
    >(`/feedback${queryString}`)
    const list = Array.isArray(res) ? res : res?.tickets || []
    return list
  } catch (error) {
    console.warn('[feedbackService] Fetch inbox failed:', error)
    return isMock ? applyMockFilters() : []
  }
}

export async function getTicket(ticketNo: string): Promise<FeedbackTicket> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    const ticket = mockTickets.find(
      (t) => t.ticket_no === ticketNo || t.id === ticketNo
    )
    if (!ticket) {
      throw new Error(`Ticket ${ticketNo} not found.`)
    }
    return structuredClone(ticket)
  }

  try {
    const res = await apiClient.get<FeedbackTicket>(`/feedback/${ticketNo}`)
    return res
  } catch (error) {
    console.warn(`[feedbackService] Fetch ticket ${ticketNo} failed:`, error)
    if (isMock) {
      const ticket = mockTickets.find(
        (t) => t.ticket_no === ticketNo || t.id === ticketNo
      )
      if (!ticket) {
        throw new Error(`Ticket ${ticketNo} not found.`, { cause: error })
      }
      return structuredClone(ticket)
    }
    throw error
  }
}

export async function updateStatus(
  ticketNo: string,
  newStatus: FeedbackStatus,
  responseNote?: string
): Promise<FeedbackTicket> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    const ticket = mockTickets.find(
      (t) => t.ticket_no === ticketNo || t.id === ticketNo
    )
    if (!ticket) {
      throw new Error(`Ticket ${ticketNo} not found.`)
    }

    const now = new Date().toISOString()
    ticket.status_history.push({
      from_status: ticket.status,
      to_status: newStatus,
      by_user_id: 'usr-admin',
      by_user_name: 'Admin Desk',
      at: now,
      note: responseNote || undefined,
    })

    ticket.status = newStatus
    ticket.updated_at = now

    if (responseNote && responseNote.trim()) {
      ticket.response = {
        body: responseNote.trim(),
        by_user_id: 'usr-admin',
        by_user_name: 'Admin Desk',
        at: now,
      }
    }

    return structuredClone(ticket)
  }

  try {
    const res = await apiClient.patch<FeedbackTicket>(
      `/feedback/${ticketNo}/status`,
      {
        status: newStatus,
        response: responseNote,
      }
    )
    return res
  } catch (error) {
    if (!isMock) {
      throw error
    }
    console.warn(
      `[feedbackService] Update status for ${ticketNo} failed, updating local mock:`,
      error
    )
    const ticket = mockTickets.find(
      (t) => t.ticket_no === ticketNo || t.id === ticketNo
    )
    if (!ticket) {
      throw new Error(`Ticket ${ticketNo} not found.`, { cause: error })
    }

    const now = new Date().toISOString()
    ticket.status_history.push({
      from_status: ticket.status,
      to_status: newStatus,
      by_user_id: 'usr-admin',
      by_user_name: 'Admin Desk',
      at: now,
      note: responseNote || undefined,
    })

    ticket.status = newStatus
    ticket.updated_at = now

    if (responseNote && responseNote.trim()) {
      ticket.response = {
        body: responseNote.trim(),
        by_user_id: 'usr-admin',
        by_user_name: 'Admin Desk',
        at: now,
      }
    }

    return structuredClone(ticket)
  }
}

export async function updateSeverity(
  ticketNo: string,
  newSeverity: FeedbackSeverity
): Promise<FeedbackTicket> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    const ticket = mockTickets.find(
      (t) => t.ticket_no === ticketNo || t.id === ticketNo
    )
    if (!ticket) {
      throw new Error(`Ticket ${ticketNo} not found.`)
    }

    ticket.severity = newSeverity
    ticket.updated_at = new Date().toISOString()
    return structuredClone(ticket)
  }

  try {
    const res = await apiClient.patch<FeedbackTicket>(
      `/feedback/${ticketNo}/severity`,
      {
        severity: newSeverity,
      }
    )
    return res
  } catch (error) {
    if (!isMock) {
      throw error
    }
    console.warn(
      `[feedbackService] Update severity for ${ticketNo} failed, updating local mock:`,
      error
    )
    const ticket = mockTickets.find(
      (t) => t.ticket_no === ticketNo || t.id === ticketNo
    )
    if (!ticket) {
      throw new Error(`Ticket ${ticketNo} not found.`, { cause: error })
    }

    ticket.severity = newSeverity
    ticket.updated_at = new Date().toISOString()
    return structuredClone(ticket)
  }
}

export function resetMockTickets(): void {
  mockTickets.length = 0
  mockTickets.push(...structuredClone(DEFAULT_FEEDBACK_TICKETS))
}

export const feedbackService = {
  getInbox,
  getTicket,
  updateStatus,
  updateSeverity,
  resetMockTickets,
}

export default feedbackService
