import React, { useState, useEffect, useMemo } from 'react'
import { Search, FileText, PlusCircle, Trophy, AlertCircle } from 'lucide-react'
import type {
  LeaderboardDomain,
  LeaderboardEntry,
  LeaderboardPeriod,
  PointsTransaction,
} from '../types/leaderboard'
import { leaderboardService } from '../services/leaderboardService'
import { PodiumCards } from '../components/leaderboard/PodiumCards'
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable'
import { PointsAdjustmentModal } from '../components/leaderboard/PointsAdjustmentModal'
import { PointsLedgerModal } from '../components/leaderboard/PointsLedgerModal'
import { Button } from '../components/ui/button'

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ledgerUserId, setLedgerUserId] = useState<string | null>(null)

  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [domain, setDomain] = useState<LeaderboardDomain>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [targetEntryForAdjustment, setTargetEntryForAdjustment] =
    useState<LeaderboardEntry | null>(null)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false)

  useEffect(() => {
    let ignore = false

    leaderboardService
      .getGlobalLeaderboard(period, domain)
      .then((boardData) => {
        if (!ignore) {
          setEntries(boardData)
          setError(null)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : 'Failed to load leaderboard'
          )
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [period, domain])

  const handleDomainChange = (val: LeaderboardDomain) => {
    setIsLoading(true)
    setError(null)
    setDomain(val)
  }

  const handlePeriodChange = (val: LeaderboardPeriod) => {
    setIsLoading(true)
    setError(null)
    setPeriod(val)
  }

  const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    leaderboardService
      .getGlobalLeaderboard(period, domain)
      .then((data) => setEntries(data))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Failed to load leaderboard'
        )
      )
      .finally(() => setIsLoading(false))
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
    const entry = entries.find((e) => e.userId === result.userId)
    const name = entry ? entry.name : result.userId
    const delta = result.transaction.amount
    const sign = delta > 0 ? `+${delta}` : `${delta}`
    setNotice(
      `Points adjusted for ${name}: ${sign} points for "${result.transaction.note}". Note: the global standings reflect the official database record.`
    )
    setLedgerUserId(result.userId)
  }

  const handleReset = () => {
    setSearchTerm('')
    setDomain('all')
    setPeriod('all')
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const term = searchTerm.toLowerCase().trim()
      if (term === '') return true
      return (
        entry.name.toLowerCase().includes(term) ||
        entry.username.toLowerCase().includes(term)
      )
    })
  }, [entries, searchTerm])

  const topThree = useMemo(() => {
    return filteredEntries.slice(0, 3)
  }, [filteredEntries])

  const showPodium = topThree.length >= 3 && searchTerm.trim() === ''

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            Leaderboards & Activity Points
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track club athlete standings, view category rankings, and adjust member activity points.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
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

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-55">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name or @username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>

        <select
          value={domain}
          onChange={(e) => handleDomainChange(e.target.value as LeaderboardDomain)}
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
        >
          <option value="all">All Domains</option>
          <option value="sports">Sports</option>
          <option value="esports">Esports</option>
          <option value="fitness">Fitness</option>
          <option value="general">General</option>
        </select>

        <select
          value={period}
          onChange={(e) => handlePeriodChange(e.target.value as LeaderboardPeriod)}
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
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
                onAdjustPoints={handleOpenAdjustment}
              />
            </div>
          )}

          {/* Full Division Standings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Full Division Standings ({filteredEntries.length} Participants)
              </div>
            </div>

            <LeaderboardTable
              entries={filteredEntries}
              onAdjustPoints={handleOpenAdjustment}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <PointsAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        targetEntry={targetEntryForAdjustment}
        allEntries={entries}
        onAdjusted={handlePointsAdjusted}
      />

      <PointsLedgerModal
        isOpen={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        members={entries}
        initialUserId={ledgerUserId}
      />
    </div>
  )
}

export default Leaderboard
