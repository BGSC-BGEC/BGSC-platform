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
          setIsRefreshing(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to fetch tickets')
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [statusFilter, categoryFilter, severityFilter, kindFilter, searchTerm])

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
      setError(err instanceof Error ? err.message : 'Failed to refresh inbox')
    } finally {
      setIsRefreshing(false)
    }
  }, [statusFilter, categoryFilter, severityFilter, kindFilter, searchTerm])

  // Metric computations from allTickets
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

  // Reset all filters to default
  const handleResetFilters = () => {
    setStatusFilter('all')
    setCategoryFilter('all')
    setSeverityFilter('all')
    setKindFilter('all')
    setSearchTerm('')
  }

  const isFiltered =
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    severityFilter !== 'all' ||
    kindFilter !== 'all' ||
    searchTerm.trim() !== ''

  // Open modal for ticket
  const handleSelectTicket = (ticket: FeedbackTicket) => {
    setSelectedTicket(ticket)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedTicket(null)
  }

  // Handle status update from modal
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Feedback & Support Inbox
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary">
              Triage Desk
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Triage member grievances, bug reports, feature suggestions, and campus partner inquiries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-foreground flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="font-bold underline hover:no-underline text-destructive cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <div className="bg-card p-4 rounded-2xl border border-border space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Total Inbound
            </span>
            <Inbox className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.total}
          </div>
          <p className="text-[11px] text-muted-foreground">All registered tickets</p>
        </div>

        {/* Pending Action */}
        <div className="bg-card p-4 rounded-2xl border border-primary/40 space-y-1 shadow-xs ring-1 ring-primary/20">
          <div className="flex items-center justify-between text-primary">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Pending Action
            </span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.pending}
          </div>
          <p className="text-[11px] text-muted-foreground">Requires triage or reply</p>
        </div>

        {/* Escalated Issues */}
        <div className="bg-card p-4 rounded-2xl border border-destructive/30 bg-destructive/5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-destructive">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Escalated / High
            </span>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-black text-destructive">
            {metrics.escalated}
          </div>
          <p className="text-[11px] text-destructive/80">Critical & high severity</p>
        </div>

        {/* Resolved Rate */}
        <div className="bg-card p-4 rounded-2xl border border-border space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Resolved Rate
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.resolvedRate}%
          </div>
          <p className="text-[11px] text-muted-foreground">
            {metrics.resolved} of {metrics.total} resolved
          </p>
        </div>
      </div>

      {/* 4. Filter & Search Toolbar */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by subject, description, ticket #, reporter email..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Kind Selector Pills */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                kindFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('feedback')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                kindFilter === 'feedback'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Feedback
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('contact')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                kindFilter === 'contact'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              Contact Us
            </button>
          </div>
        </div>

        {/* Dropdown Selectors Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground font-semibold whitespace-nowrap">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | 'all')}
              className="w-full py-1.5 px-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted (In Queue)</option>
              <option value="under_review">Under Review (Investigating)</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground font-semibold whitespace-nowrap">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as FeedbackCategory | 'all')
              }
              className="w-full py-1.5 px-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Categories</option>
              <option value="bug">Bug Reports</option>
              <option value="feature">Feature Requests</option>
              <option value="complaint">Complaints / Moderation</option>
              <option value="general">General Inquiries</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground font-semibold whitespace-nowrap">Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as FeedbackSeverity | 'all')
              }
              className="w-full py-1.5 px-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Reset Filters Quick Pill */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
            <span className="text-muted-foreground text-[11px]">
              Filtered results: <strong className="text-foreground">{tickets.length}</strong> of {allTickets.length} tickets
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* 5. Tickets Table View */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-2xl bg-card">
          Loading support inbox...
        </div>
      ) : (
        <FeedbackTable
          tickets={tickets}
          onSelectTicket={handleSelectTicket}
          selectedTicketId={selectedTicket?.id}
        />
      )}

      {/* 6. Ticket Detail & Triage Modal */}
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
