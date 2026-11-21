import React, { useState, useEffect, useMemo } from 'react'
import { Search, FileText, PlusCircle, Trophy, AlertCircle, Download } from 'lucide-react'
import type {
  GlobalLeaderboardPage,
  LeaderboardDomain,
  LeaderboardEntry,
  LeaderboardPeriod,
  PointsTransaction,
} from '../types/leaderboard'
import type { ClubEvent } from '../types/event'
import { rulesFor } from '../types/event'
import { leaderboardService } from '../services/leaderboardService'
import { eventService } from '../services/eventService'
import { useCan, rankOf } from '../services/permissions'
import { useAuthStore } from '../stores/authStore'
import { PodiumCards } from '../components/leaderboard/PodiumCards'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { PointsAdjustmentModal } from '../components/leaderboard/PointsAdjustmentModal'
import { PointsLedgerModal } from '../components/leaderboard/PointsLedgerModal'
import { EventLeaderboardPanel } from '../components/leaderboard/EventLeaderboardPanel'
import { downloadCsv } from '../components/leaderboard/csv'
import { Button } from '../components/ui/button'

type BoardTab = 'global' | 'events' | 'challenges'

const PAGE_SIZE = 50

/** QueryGlobalLeaderboardSchema.domain; challenges only use CHALLENGE_DOMAIN (no fitness). */
const DOMAIN_OPTIONS: { value: LeaderboardDomain; label: string }[] = [
  { value: 'all', label: 'All Domains' },
  { value: 'sports', label: 'Sports' },
  { value: 'esports', label: 'Esports' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'dev', label: 'Dev' },
  { value: 'general', label: 'General' },
]

export const Leaderboard: React.FC = () => {
  const canAdjust = useCan('points.adjust')
  const role = useAuthStore((s) => s.user?.role)
  // The ledger reads (GET /points/users/:id/transactions, /points/events/:id) are core+.
  const canViewLedger = rankOf(role) >= rankOf('core')

  const [tab, setTab] = useState<BoardTab>('global')

  const [board, setBoard] = useState<GlobalLeaderboardPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [domain, setDomain] = useState<LeaderboardDomain>('all')
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')

  const [events, setEvents] = useState<ClubEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

  const [targetEntryForAdjustment, setTargetEntryForAdjustment] =
    useState<LeaderboardEntry | null>(null)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false)

  const source = tab === 'challenges' ? 'challenge' : 'all'

  useEffect(() => {
    if (tab === 'events') return
    let ignore = false
    leaderboardService
      .getGlobalLeaderboardPage({ period, domain, source, page, limit: PAGE_SIZE })
      .then((data) => {
        if (!ignore) {
          setBoard(data)
          setError(null)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
          setIsLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [tab, period, domain, source, page, reloadKey])

  useEffect(() => {
    let ignore = false
    eventService
      .getEvents()
      .then((list) => {
        if (!ignore) {
          setEvents(list)
          setEventsError(null)
        }
      })
      .catch((err) => {
        if (!ignore) setEventsError(err instanceof Error ? err.message : 'Failed to load events')
      })
      .finally(() => {
        if (!ignore) setEventsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  // GET /leaderboards/events/:ref refuses drafts and DE events.
  const leaderboardEvents = useMemo(
    () => events.filter((e) => rulesFor(e.type).hasLeaderboard && e.status !== 'draft'),
    [events]
  )

  const startLoading = () => {
    setIsLoading(true)
    setError(null)
  }

  const handleTabChange = (next: BoardTab) => {
    if (next === tab) return
    if (next !== 'events') startLoading()
    setTab(next)
    setPage(1)
    setSearchTerm('')
    // 'fitness' is an event-only domain; the challenges board has none.
    if (next === 'challenges' && domain === 'fitness') setDomain('all')
  }

  const handleDomainChange = (val: LeaderboardDomain) => {
    startLoading()
    setPage(1)
    setDomain(val)
  }

  const handlePeriodChange = (val: LeaderboardPeriod) => {
    startLoading()
    setPage(1)
    setPeriod(val)
  }

  const handlePageChange = (next: number) => {
    startLoading()
    setPage(next)
  }

  const handleRetry = () => {
    startLoading()
    setReloadKey((k) => k + 1)
  }

  const handleOpenAdjustment = (entry?: LeaderboardEntry) => {
    setTargetEntryForAdjustment(entry || null)
    setIsAdjustmentModalOpen(true)
  }

  const handlePointsAdjusted = (result: {
    userId: string
    newBalance: number
    transaction: PointsTransaction
  }) => {
    const entry = board?.entries.find((e) => e.userId === result.userId)
    const name = entry ? entry.name : result.userId
    const delta = result.transaction.amount
    const sign = delta > 0 ? `+${delta}` : `${delta}`
    setNotice(`Points adjusted for ${name}: ${sign} points. New balance: ${result.newBalance.toLocaleString()} pts.`)
    if (tab !== 'events') setReloadKey((k) => k + 1)
  }

  const handleReset = () => {
    setSearchTerm('')
    startLoading()
    setPeriod('all')
    setDomain('all')
    setPage(1)
    setReloadKey((k) => k + 1)
  }

  const entries = useMemo(() => board?.entries ?? [], [board])

  const filteredEntries = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return entries.filter((entry) => {
      if (!term) return true
      return (
        entry.name.toLowerCase().includes(term) ||
        entry.username.toLowerCase().includes(term)
      )
    })
  }, [entries, searchTerm])

  const topThree = useMemo(() => {
    return filteredEntries.slice(0, 3)
  }, [filteredEntries])

  const showPodium = topThree.length >= 3 && searchTerm.trim() === '' && page === 1

  const handleExport = () => {
    const label = tab === 'challenges' ? 'challenges' : 'global'
    downloadCsv(
      `leaderboard-${label}-${period}-${domain}-page${board?.page ?? page}.csv`,
      ['rank', 'user_id', 'name', 'username', 'points'],
      filteredEntries.map((e) => [e.rank, e.userId, e.name, e.username, e.points])
    )
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
      active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  const domainOptions =
    tab === 'challenges' ? DOMAIN_OPTIONS.filter((o) => o.value !== 'fitness') : DOMAIN_OPTIONS

  const selectClass =
    'px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            Leaderboards & Activity Points
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track club standings across events and challenges, enter event scores, and adjust member activity points.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canViewLedger && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsLedgerModalOpen(true)
              }}
              className="text-xs font-semibold gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>View Points Ledger</span>
            </Button>
          )}
          {canAdjust && (
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleOpenAdjustment()
              }}
              className="text-xs font-semibold gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Adjust Points</span>
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-bold cursor-pointer"
            aria-label="Dismiss"
          >
            X
          </button>
        </div>
      )}

      {/* Board Tabs */}
      <div className="flex border-b border-border gap-2">
        <button type="button" onClick={() => handleTabChange('global')} className={tabClass(tab === 'global')}>
          Global
        </button>
        <button type="button" onClick={() => handleTabChange('events')} className={tabClass(tab === 'events')}>
          Events
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('challenges')}
          className={tabClass(tab === 'challenges')}
        >
          Challenges
        </button>
      </div>

      {tab === 'events' ? (
        <EventLeaderboardPanel
          events={leaderboardEvents}
          eventsLoading={eventsLoading}
          eventsError={eventsError}
        />
      ) : (
        <>
          {/* Toolbar / Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-55">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search this page by name or @username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
              />
            </div>

            <select
              value={domain}
              onChange={(e) => handleDomainChange(e.target.value as LeaderboardDomain)}
              className={selectClass}
            >
              {domainOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as LeaderboardPeriod)}
              className={selectClass}
            >
              <option value="all">All Time</option>
              <option value="semester">This Semester</option>
              <option value="month">This Month</option>
              <option value="week">This Week</option>
            </select>

            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
            >
              Reset
            </button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isLoading || filteredEntries.length === 0}
              className="text-xs font-semibold gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </Button>
          </div>

          {/* Main Content Area */}
          {isLoading && (
            <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-xl bg-card dark:bg-transparent">
              Loading leaderboard standings & activity points...
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4 border border-rose-500/30 text-foreground bg-rose-500/5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span className="text-sm">{error}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="px-3 py-1 text-xs border border-border hover:border-foreground rounded-lg transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && filteredEntries.length === 0 && (
            <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card dark:bg-transparent space-y-2">
              <Trophy className="w-10 h-10 text-muted-foreground/60 mx-auto" />
              <h3 className="text-base font-semibold text-foreground">
                No athlete rankings found matching your criteria
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Try adjusting your search query, domain filter, or period selection.
              </p>
            </div>
          )}

          {!isLoading && !error && filteredEntries.length > 0 && (
            <div className="space-y-6">
              {/* Visual Podium Section */}
              {showPodium && (
                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    Top Performers Podium
                  </div>
                  <PodiumCards
                    topThree={topThree}
                    onAdjustPoints={canAdjust ? handleOpenAdjustment : undefined}
                  />
                </div>
              )}

              {/* Full Division Standings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    {tab === 'challenges' ? 'Challenge Standings' : 'Full Division Standings'} (
                    {board?.total ?? filteredEntries.length} Participants)
                  </div>
                </div>

                <LeaderboardTable
                  entries={filteredEntries}
                  onAdjustPoints={canAdjust ? handleOpenAdjustment : undefined}
                />

                {board && board.totalPages > 1 && (
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                      className="text-xs"
                    >
                      Previous
                    </Button>
                    <span className="text-muted-foreground">
                      Page {board.page} of {board.totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= board.totalPages}
                      onClick={() => handlePageChange(page + 1)}
                      className="text-xs"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <PointsAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        targetEntry={targetEntryForAdjustment}
        onAdjusted={handlePointsAdjusted}
      />

      <PointsLedgerModal
        isOpen={isLedgerModalOpen && canViewLedger}
        onClose={() => setIsLedgerModalOpen(false)}
        events={events}
      />
    </div>
  )
}

export default Leaderboard
