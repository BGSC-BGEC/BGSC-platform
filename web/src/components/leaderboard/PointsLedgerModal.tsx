import React, { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import type { PointsTransaction, UserSearchResult } from '../../types/leaderboard'
import type { ClubEvent } from '../../types/event'
import {
  getEventLedger,
  getUserPointsSummary,
  getUserTransactions,
} from '../../services/leaderboardService'
import type { UserPointsSummary } from '../../services/leaderboardService'
import { UserSearchPicker } from './UserSearchPicker'

export interface PointsLedgerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Events offered for the per-event ledger. */
  events: ClubEvent[]
}

type LedgerMode = 'member' | 'event'

function formatTxDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || '-'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const shortId = (id: string | null | undefined) => (id ? `${id.slice(0, 8)}…` : '-')

function actorLabel(tx: PointsTransaction): string {
  if (!tx.actor) return '-'
  if (tx.actor.type === 'system') return 'system'
  return `${tx.actor.type} ${shortId(tx.actor.userId)}`
}

const LedgerContent: React.FC<Omit<PointsLedgerModalProps, 'isOpen'>> = ({ onClose, events }) => {
  const [mode, setMode] = useState<LedgerMode>('member')
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [selectedEventId, setSelectedEventId] = useState('')

  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [podiumConflicts, setPodiumConflicts] = useState(0)
  const [summary, setSummary] = useState<UserPointsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const targetId = mode === 'member' ? selectedUser?.id ?? '' : selectedEventId

  const resetResults = () => {
    setTransactions([])
    setNextCursor(null)
    setPodiumConflicts(0)
    setSummary(null)
    setError(null)
  }

  useEffect(() => {
    if (!targetId) return
    let ignore = false
    if (mode === 'member') {
      getUserPointsSummary(targetId)
        .then((s) => {
          if (!ignore) setSummary(s)
        })
        .catch(() => undefined)
    }
    const load =
      mode === 'member'
        ? getUserTransactions(targetId).then((p) => ({ ...p, podiumConflicts: [] as unknown[] }))
        : getEventLedger(targetId)
    load
      .then((page) => {
        if (ignore) return
        setTransactions(page.transactions)
        setNextCursor(page.nextCursor)
        setPodiumConflicts(page.podiumConflicts.length)
        setError(null)
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load ledger')
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [mode, targetId])

  const handleLoadMore = async () => {
    if (!nextCursor || !targetId) return
    setIsLoading(true)
    try {
      const page =
        mode === 'member'
          ? await getUserTransactions(targetId, { cursor: nextCursor })
          : await getEventLedger(targetId, { cursor: nextCursor })
      setTransactions((prev) => [...prev, ...page.transactions])
      setNextCursor(page.nextCursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more rows')
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = (next: LedgerMode) => {
    if (next === mode) return
    resetResults()
    setIsLoading(false)
    setMode(next)
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
      active ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Points Ledger & Audit History
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Append-only ledger, per member or per event. There is no club-wide ledger view.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 gap-2">
          <button type="button" onClick={() => switchMode('member')} className={tabClass(mode === 'member')}>
            By Member
          </button>
          <button type="button" onClick={() => switchMode('event')} className={tabClass(mode === 'event')}>
            By Event
          </button>
        </div>

        {/* Target selection */}
        {mode === 'member' ? (
          <UserSearchPicker
            selected={selectedUser}
            onSelect={(u) => {
              resetResults()
              setIsLoading(Boolean(u))
              setSelectedUser(u)
            }}
          />
        ) : (
          <select
            value={selectedEventId}
            onChange={(e) => {
              resetResults()
              setIsLoading(Boolean(e.target.value))
              setSelectedEventId(e.target.value)
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
          >
            <option value="">Select an event...</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.status})
              </option>
            ))}
          </select>
        )}

        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>
        )}

        {mode === 'member' && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['Balance', `${summary.balance.toLocaleString()} pts`],
              ['Lifetime Earned', `${summary.lifetimeEarned.toLocaleString()} pts`],
              ['Lifetime Spent', `${summary.lifetimeSpent.toLocaleString()} pts`],
              ['Ledger Synced', summary.ledgerSynced ? 'Yes' : 'NO - drift'],
            ].map(([label, value]) => (
              <div key={label} className="p-2 border border-gray-200 rounded bg-gray-50">
                <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{label}</div>
                <div className="font-mono font-bold text-black">{value}</div>
              </div>
            ))}
          </div>
        )}

        {mode === 'event' && podiumConflicts > 0 && (
          <div className="p-3 text-xs text-black bg-gray-50 border border-gray-300 rounded">
            {podiumConflicts} podium conflict audit record(s) exist for this event.
          </div>
        )}

        {/* Ledger Table */}
        {!targetId ? (
          <div className="p-8 text-center border border-gray-200 rounded bg-gray-50 space-y-2">
            <FileText className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">
              {mode === 'member'
                ? 'Search and select a member to view their points history.'
                : 'Select an event to view the points it issued.'}
            </p>
          </div>
        ) : isLoading && transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 border border-gray-200 rounded bg-gray-50">
            Loading ledger...
          </div>
        ) : transactions.length === 0 && !error ? (
          <div className="p-8 text-center border border-gray-200 rounded bg-gray-50 space-y-2">
            <FileText className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">No points transactions recorded.</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-black">
                <tr>
                  <th className="px-3 py-2.5">Date & Time</th>
                  {mode === 'event' && <th className="px-3 py-2.5">Member ID</th>}
                  <th className="px-3 py-2.5">Type / Reason</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Note</th>
                  <th className="px-3 py-2.5">Actor</th>
                  <th className="px-3 py-2.5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const isPositive = tx.amount > 0
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-[11px]">
                        {formatTxDate(tx.createdAt)}
                      </td>
                      {mode === 'event' && (
                        <td className="px-3 py-2 font-mono text-[11px] text-black whitespace-nowrap" title={tx.userId}>
                          {shortId(tx.userId)}
                        </td>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-black">
                          {tx.type || '-'}
                          {tx.source ? ` · ${tx.source}` : ''}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">{tx.reason || '-'}</div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-mono font-bold">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[11px] ${
                            isPositive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                          }`}
                        >
                          {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} pts
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs break-words">{tx.note || '-'}</td>
                      <td
                        className="px-3 py-2 text-gray-600 font-mono text-[11px] whitespace-nowrap"
                        title={tx.actor?.userId ?? undefined}
                      >
                        {actorLabel(tx)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600 whitespace-nowrap">
                        {tx.balanceAfter !== undefined ? `${tx.balanceAfter.toLocaleString()} pts` : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div>
            {nextCursor && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-4 py-1.5 text-xs border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export const PointsLedgerModal: React.FC<PointsLedgerModalProps> = ({ isOpen, onClose, events }) => {
  if (!isOpen) return null
  return <LedgerContent onClose={onClose} events={events} />
}

export default PointsLedgerModal
