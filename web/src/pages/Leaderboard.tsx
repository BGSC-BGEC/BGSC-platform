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

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [domain, setDomain] = useState<LeaderboardDomain>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const [targetEntryForAdjustment, setTargetEntryForAdjustment] =
    useState<LeaderboardEntry | null>(null)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false)

  useEffect(() => {
    let ignore = false

    Promise.all([
      leaderboardService.getGlobalLeaderboard(period, domain),
      leaderboardService.getPointsTransactions(),
    ])
      .then(([boardData, txData]) => {
        if (!ignore) {
          setEntries(boardData)
          setTransactions(txData)
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
    Promise.all([
      leaderboardService.getGlobalLeaderboard(period, domain),
      leaderboardService.getPointsTransactions(),
    ])
      .then(([boardData, txData]) => {
        setEntries(boardData)
        setTransactions(txData)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load leaderboard'
        )
        setIsLoading(false)
      })
  }

  const handleOpenAdjustment = (entry?: LeaderboardEntry) => {
    setTargetEntryForAdjustment(entry || null)
    setIsAdjustmentModalOpen(true)
  }

  const handlePointsAdjusted = () => {
    // Re-fetch both leaderboard and ledger history
    Promise.all([
      leaderboardService.getGlobalLeaderboard(period, domain),
      leaderboardService.getPointsTransactions(),
    ]).then(([boardData, txData]) => {
      setEntries(boardData)
      setTransactions(txData)
    })
  }

  const handleReset = () => {
    setSearchTerm('')
    setIsLoading(true)
    setError(null)
    setPeriod('all')
    setDomain('all')
  }

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

  const showPodium = topThree.length >= 3 && searchTerm.trim() === ''

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Leaderboards & Activity Points
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Track club athlete standings, view category rankings, and adjust member activity points.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsLedgerModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-gray-300 text-black bg-white hover:bg-gray-100 rounded transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-gray-600" />
            <span>View Points Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenAdjustment()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adjust Points</span>
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-55">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or @username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
          />
        </div>

        <select
          value={domain}
          onChange={(e) => handleDomainChange(e.target.value as LeaderboardDomain)}
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
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
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
        >
          <option value="all">All Time</option>
          <option value="semester">This Semester</option>
          <option value="month">This Month</option>
          <option value="week">This Week</option>
        </select>

        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading && (
        <div className="p-12 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
          Loading leaderboard standings & activity points...
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 border border-black text-black bg-white rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && filteredEntries.length === 0 && (
        <div className="p-12 text-center border border-gray-200 rounded-lg bg-white space-y-2">
          <Trophy className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-black">
            No athlete rankings found matching your criteria
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Try adjusting your search query, domain filter, or period selection.
          </p>
        </div>
      )}

      {!isLoading && !error && filteredEntries.length > 0 && (
        <div className="space-y-6">
          {/* Visual Podium Section */}
          {showPodium && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-black">
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
              <div className="text-xs font-bold uppercase tracking-wider text-black">
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
        transactions={transactions}
      />
    </div>
  )
}

export default Leaderboard
