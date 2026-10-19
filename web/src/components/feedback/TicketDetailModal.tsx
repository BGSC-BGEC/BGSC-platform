import React, { useState, useEffect } from 'react'
import {
  X,
  EyeOff,
  User,
  UserCheck,
  Trophy,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Shield,
  ArrowRight,
} from 'lucide-react'
import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTicket,
} from '../../types/feedback'

export interface TicketDetailModalProps {
  ticket: FeedbackTicket | null
  isOpen: boolean
  onClose: () => void
  onUpdateStatus: (
    ticketNo: string,
    newStatus: FeedbackStatus,
    responseNote?: string
  ) => Promise<void>
  onUpdateSeverity: (
    ticketNo: string,
    newSeverity: FeedbackSeverity
  ) => Promise<void>
}

interface TicketDetailModalContentProps {
  ticket: FeedbackTicket
  onClose: () => void
  onUpdateStatus: (
    ticketNo: string,
    newStatus: FeedbackStatus,
    responseNote?: string
  ) => Promise<void>
  onUpdateSeverity: (
    ticketNo: string,
    newSeverity: FeedbackSeverity
  ) => Promise<void>
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

function renderCategoryPill(category: FeedbackCategory) {
  switch (category) {
    case 'bug':
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700">
          Bug Report
        </span>
      )
    case 'feature':
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
          Feature Suggestion
        </span>
      )
    case 'complaint':
      return (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
          Grievance
        </span>
      )
    case 'general':
    default:
      return (
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-700">
          General Inquiry
        </span>
      )
  }
}

const TicketDetailModalContent: React.FC<TicketDetailModalContentProps> = ({
  ticket,
  onClose,
  onUpdateStatus,
  onUpdateSeverity,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus>(
    ticket.status
  )
  const [selectedSeverity, setSelectedSeverity] = useState<FeedbackSeverity>(
    ticket.severity
  )
  const [replyText, setReplyText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const statusChanged = selectedStatus !== ticket.status
    const severityChanged = selectedSeverity !== ticket.severity
    const hasReply = replyText.trim().length > 0

    if (!statusChanged && !severityChanged && !hasReply) {
      setError('No changes detected to save.')
      return
    }

    setIsSubmitting(true)
    try {
      if (severityChanged) {
        await onUpdateSeverity(ticket.ticket_no, selectedSeverity)
      }

      if (statusChanged || hasReply) {
        await onUpdateStatus(
          ticket.ticket_no,
          selectedStatus,
          hasReply ? replyText.trim() : undefined
        )
      }

      setSuccessMsg('Ticket updated successfully.')
      setReplyText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Modal Header */}
      <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between gap-3 bg-gray-50/50">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-sm font-bold text-black px-2 py-0.5 rounded bg-gray-100 border border-gray-300">
            {ticket.ticket_no}
          </span>
          {renderCategoryPill(ticket.category)}
          <span
            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
              ticket.kind === 'contact'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-gray-100 text-gray-700'
            }`}
          >
            {ticket.kind}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Modal Body: Two-Column Split Layout */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Ticket Content & Evidence) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Subject & Tournament Context */}
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-black leading-snug">
              {ticket.subject}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span>Submitted {formatDate(ticket.created_at)}</span>
              {ticket.event_title && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                  <Trophy className="w-3 h-3 text-gray-500" />
                  {ticket.event_title}
                </span>
              )}
            </div>
          </div>

          {/* Description Block */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-black">
              Detailed Description
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>
          </div>

          {/* Attachments / Evidence */}
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-black">
                Attached Media & Evidence ({ticket.attachments.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ticket.attachments.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-gray-400 transition-all"
                  >
                    <div className="h-28 overflow-hidden bg-gray-100 flex items-center justify-center">
                      <img
                        src={url}
                        alt={`Attachment ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="p-2 flex items-center justify-between text-[11px] text-gray-600">
                      <span className="truncate">Evidence file #{idx + 1}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-black flex-shrink-0" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reporter Information Card */}
          <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50/50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black block">
              Reporter Identity & Privacy
            </span>
            {ticket.is_anonymous ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <EyeOff className="w-4 h-4 text-gray-500" />
                  <span>Anonymous Grievance Filing</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  The reporter requested complete anonymity. Contact email:{' '}
                  <strong className="font-mono text-gray-700">
                    {ticket.contact_email || 'Not provided'}
                  </strong>
                </p>
              </div>
            ) : ticket.reporter ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                  <UserCheck className="w-4 h-4 text-black" />
                  <span>{ticket.reporter.display_name}</span>
                  <span className="text-[11px] text-gray-500 font-mono font-normal">
                    @{ticket.reporter.username}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Verified campus student &bull; User ID: {ticket.reporter.user_id}{' '}
                  &bull; Email:{' '}
                  <span className="font-mono text-gray-700">
                    {ticket.contact_email || ticket.reporter.email}
                  </span>
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                  <User className="w-4 h-4 text-gray-600" />
                  <span>Public Contact Inquiry</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Email:{' '}
                  <span className="font-mono text-gray-700">
                    {ticket.contact_email || 'Not provided'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Official Resolution Highlight */}
          {ticket.response && (
            <div className="border border-green-200 bg-green-50/70 rounded-lg p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-green-900">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-700" />
                  Official Resolution
                </span>
                <span className="text-[10px] text-green-800 font-normal">
                  {formatDate(ticket.response.at)}
                </span>
              </div>
              <p className="text-xs text-green-950 whitespace-pre-wrap leading-relaxed">
                {ticket.response.body}
              </p>
              <div className="text-[10px] text-green-800 pt-1 border-t border-green-200/60">
                Answered by: {ticket.response.by_user_name || 'Admin Desk'}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Staff Triage & Resolution Actions) */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handleSaveChanges}
            className="border border-gray-200 rounded-lg p-4 bg-white space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-black" />
                Staff Triage & Actions
              </span>
            </div>

            {error && (
              <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 rounded bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Severity Level Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                Severity Level
              </label>
              <select
                value={selectedSeverity}
                onChange={(e) =>
                  setSelectedSeverity(e.target.value as FeedbackSeverity)
                }
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
              >
                <option value="low">Low (Standard request / cosmetic)</option>
                <option value="medium">Medium (Normal bug / proposal)</option>
                <option value="high">High (Disruption / tournament issue)</option>
                <option value="critical">Critical (Severe incident / abuse)</option>
              </select>
            </div>

            {/* Status Progression Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                Ticket Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(e.target.value as FeedbackStatus)
                }
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
              >
                <option value="submitted">Submitted (In Queue)</option>
                <option value="under_review">Under Review (Investigating)</option>
                <option value="resolved">Resolved (Completed)</option>
                <option value="closed">Closed (Archived / Dismissed)</option>
              </select>
            </div>

            {/* Official Reply Composer */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                Official Reply to Reporter
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                placeholder="Write resolution notes, explanation, or requests for more information..."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded text-black placeholder-gray-400 focus:outline-none focus:border-black resize-none"
              />
              <p className="text-[10px] text-gray-400">
                This response will be recorded in the audit trail and emailed to the reporter.
              </p>
            </div>

            {/* Update Action Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-bold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Update Ticket</span>
                </>
              )}
            </button>
          </form>

          {/* Audit History Timeline */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-600" />
                Audit & Status History
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                {ticket.status_history.length} transition(s)
              </span>
            </div>

            {ticket.status_history.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No status changes recorded yet.
              </p>
            ) : (
              <div className="space-y-3 relative pl-4 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {ticket.status_history.map((hist, idx) => (
                  <div key={idx} className="relative text-xs space-y-1">
                    <span className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-black" />
                    <div className="flex items-center gap-1.5 font-semibold text-black text-[11px]">
                      <span className="uppercase">{hist.from_status}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="uppercase text-black underline">
                        {hist.to_status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      by {hist.by_user_name || 'Admin'} &bull; {formatDate(hist.at)}
                    </div>
                    {hist.note && (
                      <p className="text-[11px] text-gray-700 bg-white p-2 rounded border border-gray-200 leading-normal">
                        {hist.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onUpdateStatus,
  onUpdateSeverity,
}) => {
  if (!isOpen || !ticket) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <TicketDetailModalContent
        key={ticket.id}
        ticket={ticket}
        onClose={onClose}
        onUpdateStatus={onUpdateStatus}
        onUpdateSeverity={onUpdateSeverity}
      />
    </div>
  )
}

export default TicketDetailModal
