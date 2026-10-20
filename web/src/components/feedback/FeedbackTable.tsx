import React from 'react'
import {
  EyeOff,
  User,
  CheckCircle2,
  Clock,
  Paperclip,
  Trophy,
  Inbox,
} from 'lucide-react'
import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTicket,
} from '../../types/feedback'

export interface FeedbackTableProps {
  tickets: FeedbackTicket[]
  onSelectTicket: (ticket: FeedbackTicket) => void
  selectedTicketId?: string | null
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

function renderCategoryBadge(category: FeedbackCategory) {
  switch (category) {
    case 'bug':
      return (
        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700">
          Bug
        </span>
      )
    case 'feature':
      return (
        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
          Feature
        </span>
      )
    case 'complaint':
      return (
        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
          Complaint
        </span>
      )
    case 'general':
    default:
      return (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-700">
          General
        </span>
      )
  }
}

function renderSeverityBadge(severity: FeedbackSeverity) {
  switch (severity) {
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
          Critical
        </span>
      )
    case 'high':
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-orange-200 bg-orange-50 text-orange-700">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          High
        </span>
      )
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Medium
        </span>
      )
    case 'low':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Low
        </span>
      )
  }
}

function renderStatusBadge(status: FeedbackStatus) {
  switch (status) {
    case 'submitted':
      return (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700">
          Submitted
        </span>
      )
    case 'under_review':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
          <Clock className="w-3 h-3 text-amber-600" />
          Under Review
        </span>
      )
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700">
          <CheckCircle2 className="w-3 h-3 text-green-600" />
          Resolved
        </span>
      )
    case 'closed':
    default:
      return (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-500">
          Closed
        </span>
      )
  }
}

export const FeedbackTable: React.FC<FeedbackTableProps> = ({
  tickets,
  onSelectTicket,
  selectedTicketId,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              <th className="py-2.5 px-4 w-32">Ticket #</th>
              <th className="py-2.5 px-3 w-28">Category</th>
              <th className="py-2.5 px-3 w-28">Severity</th>
              <th className="py-2.5 px-4">Subject & Details</th>
              <th className="py-2.5 px-4 w-44">Reporter</th>
              <th className="py-2.5 px-3 w-32">Status</th>
              <th className="py-2.5 px-4 w-20 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Inbox className="w-7 h-7 text-gray-300" />
                    <p className="text-xs font-semibold text-gray-600">
                      No feedback tickets found
                    </p>
                    <p className="text-[11px] text-gray-400">
                      No tickets match your search or filter criteria.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const isSelected =
                  ticket.id === selectedTicketId ||
                  ticket.ticket_no === selectedTicketId

                return (
                  <tr
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-50 border-l-2 border-l-black font-medium'
                        : 'hover:bg-gray-50/80'
                    }`}
                  >
                    {/* Ticket # & Kind */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="font-mono text-xs font-bold text-black block">
                          {ticket.ticket_no}
                        </span>
                        <span
                          className={`inline-block text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded border ${
                            ticket.kind === 'contact'
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-gray-100 text-gray-700'
                          }`}
                        >
                          {ticket.kind}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      {renderCategoryBadge(ticket.category)}
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-3">
                      {renderSeverityBadge(ticket.severity)}
                    </td>

                    {/* Subject & Context */}
                    <td className="py-3 px-4 max-w-md">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-black text-xs truncate">
                            {ticket.subject}
                          </span>
                          {ticket.attachments && ticket.attachments.length > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 flex-shrink-0"
                              title={`${ticket.attachments.length} attachment(s)`}
                            >
                              <Paperclip className="w-3 h-3 text-gray-400" />
                              <span>{ticket.attachments.length}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">
                          {ticket.description}
                        </p>
                        {ticket.event_title && (
                          <div className="pt-0.5 flex items-center gap-1 text-[10px] text-gray-600 font-medium truncate">
                            <Trophy className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{ticket.event_title}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Reporter */}
                    <td className="py-3 px-4">
                      {ticket.is_anonymous ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-gray-700 font-semibold text-[11px]">
                            <EyeOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span>Anonymous</span>
                          </div>
                          {ticket.contact_email && (
                            <span className="text-[10px] font-mono text-gray-500 truncate block">
                              {ticket.contact_email}
                            </span>
                          )}
                        </div>
                      ) : ticket.reporter ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-semibold text-black text-xs truncate">
                            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">
                              {ticket.reporter.display_name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-gray-500 block truncate">
                            @{ticket.reporter.username}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-600 font-mono truncate">
                          {ticket.contact_email || 'Public Visitor'}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {renderStatusBadge(ticket.status)}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-gray-500">
                      {formatDate(ticket.created_at)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default FeedbackTable
