import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MessageSquare,
  Search,
  RefreshCw,
  RotateCcw,
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import type {
  FeedbackCategory,
  FeedbackKind,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTicket,
} from '../types/feedback'
import { feedbackService } from '../services/feedbackService'
import { FeedbackTable } from '../components/feedback/FeedbackTable'
import { TicketDetailModal } from '../components/feedback/TicketDetailModal'

export const Feedback: React.FC = () => {
  const [allTickets, setAllTickets] = useState<FeedbackTicket[]>([])
  const [tickets, setTickets] = useState<FeedbackTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<FeedbackSeverity | 'all'>('all')
  const [kindFilter, setKindFilter] = useState<FeedbackKind | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Load tickets on mount & whenever filters change
  useEffect(() => {
    let ignore = false

    Promise.all([
      feedbackService.getInbox(),
      feedbackService.getInbox({
        status: statusFilter,
        category: categoryFilter,
        severity: severityFilter,
        kind: kindFilter,
        search: searchTerm,
      }),
    ])
      .then(([allData, filteredData]) => {
        if (!ignore) {
          setAllTickets(allData)
          setTickets(filteredData)
          setError(null)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to fetch feedback tickets.'
          )
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [statusFilter, categoryFilter, severityFilter, kindFilter, searchTerm])

  // Explicit refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      const [allData, filteredData] = await Promise.all([
        feedbackService.getInbox(),
        feedbackService.getInbox({
          status: statusFilter,
          category: categoryFilter,
          severity: severityFilter,
          kind: kindFilter,
          search: searchTerm,
        }),
      ])
      setAllTickets(allData)
      setTickets(filteredData)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to refresh feedback inbox.'
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [statusFilter, categoryFilter, severityFilter, kindFilter, searchTerm])

  // Computed global metrics
  const metrics = useMemo(() => {
    const total = allTickets.length
    const pending = allTickets.filter(
      (t) => t.status === 'submitted' || t.status === 'under_review'
    ).length
    const escalated = allTickets.filter(
      (t) => t.severity === 'critical' || t.severity === 'high'
    ).length
    const resolved = allTickets.filter((t) => t.status === 'resolved').length
    const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0

    return { total, pending, escalated, resolved, resolvedRate }
  }, [allTickets])

  // Ticket detail actions
  const handleSelectTicket = (ticket: FeedbackTicket) => {
    setSelectedTicket(ticket)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTicket(null)
  }

  const handleUpdateStatus = async (
    ticketNo: string,
    newStatus: FeedbackStatus,
    responseNote?: string
  ) => {
    const updated = await feedbackService.updateStatus(
      ticketNo,
      newStatus,
      responseNote
    )
    setSelectedTicket(updated)
    setTickets((prev) =>
      prev.map((t) => (t.ticket_no === ticketNo ? updated : t))
    )
    setAllTickets((prev) =>
      prev.map((t) => (t.ticket_no === ticketNo ? updated : t))
    )
  }

  const handleUpdateSeverity = async (
    ticketNo: string,
    newSeverity: FeedbackSeverity
  ) => {
    const updated = await feedbackService.updateSeverity(ticketNo, newSeverity)
    setSelectedTicket(updated)
    setTickets((prev) =>
      prev.map((t) => (t.ticket_no === ticketNo ? updated : t))
    )
    setAllTickets((prev) =>
      prev.map((t) => (t.ticket_no === ticketNo ? updated : t))
    )
  }

  const handleResetDemo = async () => {
    feedbackService.resetMockTickets()
    await handleRefresh()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-black" />
              Feedback & Support Inbox
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black text-white">
              Triage Desk
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Triage member grievances, bug reports, feature suggestions, and campus partner inquiries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-gray-600 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:text-black hover:border-gray-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="font-bold underline hover:no-underline text-red-800 cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Total Inbound
            </span>
            <Inbox className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.total}
          </div>
          <p className="text-[11px] text-gray-500">All registered tickets</p>
        </div>

        {/* Pending Action */}
        <div className="bg-white p-4 rounded-lg border-2 border-black space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-black">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Pending Action
            </span>
            <Clock className="w-4 h-4 text-black" />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.pending}
          </div>
          <p className="text-[11px] text-gray-600">Requires triage or reply</p>
        </div>

        {/* Escalated Issues */}
        <div className="bg-white p-4 rounded-lg border border-red-200 bg-red-50/20 space-y-1">
          <div className="flex items-center justify-between text-red-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Escalated / High
            </span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-700">
            {metrics.escalated}
          </div>
          <p className="text-[11px] text-red-600/80">Critical & high severity</p>
        </div>

        {/* Resolved Rate */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Resolved Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.resolvedRate}%
          </div>
          <p className="text-[11px] text-gray-500">
            {metrics.resolved} of {metrics.total} resolved
          </p>
        </div>
      </div>

      {/* 4. Filter & Search Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by subject, description, ticket #, reporter email..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded text-black placeholder-gray-400 focus:outline-none focus:border-black"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Kind Selector Pills */}
          <div className="inline-flex rounded-md border border-gray-200 p-0.5 bg-gray-50 text-xs self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                kindFilter === 'all'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('feedback')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                kindFilter === 'feedback'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
            >
              Feedback
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('contact')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                kindFilter === 'contact'
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
            >
              Contact Us
            </button>
          </div>
        </div>

        {/* Dropdown Selectors Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as FeedbackStatus | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Category:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as FeedbackCategory | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            >
              <option value="all">All Categories</option>
              <option value="bug">Bug Reports</option>
              <option value="feature">Feature Suggestions</option>
              <option value="complaint">Grievances</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Severity:
            </label>
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as FeedbackSeverity | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Tickets Table View */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-black animate-spin mx-auto" />
          <p className="text-xs uppercase font-bold tracking-wider text-gray-500">
            Loading Support Inbox...
          </p>
        </div>
      ) : (
        <FeedbackTable
          tickets={tickets}
          onSelectTicket={handleSelectTicket}
          selectedTicketId={selectedTicket?.id}
        />
      )}

      {/* 6. Triage & Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdateStatus={handleUpdateStatus}
        onUpdateSeverity={handleUpdateSeverity}
      />
    </div>
  )
}

export default Feedback
