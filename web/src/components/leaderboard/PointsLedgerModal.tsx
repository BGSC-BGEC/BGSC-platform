import React, { useEffect, useState } from 'react'
import { FileText, X, AlertTriangle, Loader2 } from 'lucide-react'
import type { PointsTransaction, UserSearchResult } from '../../types/leaderboard'
import type { ClubEvent } from '../../types/event'
import {
  getEventLedger,
  getUserPointsSummary,
  getUserTransactions,
} from '../../services/leaderboardService'
import type { UserPointsSummary } from '../../services/leaderboardService'
import { UserSearchPicker } from './UserSearchPicker'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'

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
      active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
    }`

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Points Ledger & Audit History
            </h2>
            <p className="text-xs text-muted-foreground">
              Append-only ledger, per member or per event. There is no club-wide ledger view.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4 overflow-y-auto flex-1">
        {/* Mode tabs */}
        <div className="flex border-b border-border gap-2">
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
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
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
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl border border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'member' && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ['Balance', `${summary.balance.toLocaleString()} pts`],
              ['Lifetime Earned', `${summary.lifetimeEarned.toLocaleString()} pts`],
              ['Lifetime Spent', `${summary.lifetimeSpent.toLocaleString()} pts`],
              ['Ledger Synced', summary.ledgerSynced ? 'Yes' : 'NO - drift'],
            ].map(([label, value]) => (
              <div key={label} className="p-2.5 rounded-xl border border-border bg-muted/20">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</div>
                <div className="font-mono font-bold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        )}

        {mode === 'event' && podiumConflicts > 0 && (
          <div className="p-3 text-xs rounded-xl border border-border bg-muted/20 text-foreground">
            {podiumConflicts} podium conflict audit record(s) exist for this event.
          </div>
        )}

        {/* Ledger Table */}
        {!targetId ? (
          <div className="p-10 text-center border border-dashed border-border rounded-xl bg-muted/10 space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <p className="text-xs text-muted-foreground font-semibold">
              {mode === 'member'
                ? 'Search and select a member to view their points history.'
                : 'Select an event to view the points it issued.'}
            </p>
          </div>
        ) : isLoading && transactions.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Loading ledger...</span>
          </div>
        ) : transactions.length === 0 && !error ? (
          <div className="p-10 text-center border border-dashed border-border rounded-xl bg-muted/10 space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <p className="text-xs text-muted-foreground font-semibold">No points transactions recorded.</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Date & Time</th>
                    {mode === 'event' && <th className="px-3.5 py-2.5">Member ID</th>}
                    <th className="px-3.5 py-2.5">Type / Reason</th>
                    <th className="px-3.5 py-2.5 text-right">Amount</th>
                    <th className="px-3.5 py-2.5">Note</th>
                    <th className="px-3.5 py-2.5">Actor</th>
                    <th className="px-3.5 py-2.5 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount > 0
                    return (
                      <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3.5 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                          {formatTxDate(tx.createdAt)}
                        </td>
                        {mode === 'event' && (
                          <td className="px-3.5 py-2.5 font-mono text-[11px] text-foreground whitespace-nowrap" title={tx.userId}>
                            {shortId(tx.userId)}
                          </td>
                        )}
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                            {tx.type || '-'}
                            {tx.source ? ` · ${tx.source}` : ''}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">{tx.reason || '-'}</div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap font-mono font-bold">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[11px] ${
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15'
                                : 'text-rose-600 dark:text-rose-400 bg-rose-500/15'
                            }`}
                          >
                            {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} pts
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground max-w-xs break-words">{tx.note || '-'}</td>
                        <td
                          className="px-3.5 py-2.5 text-muted-foreground font-mono text-[11px] whitespace-nowrap"
                          title={tx.actor?.userId ?? undefined}
                        >
                          {actorLabel(tx)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {tx.balanceAfter !== undefined ? `${tx.balanceAfter.toLocaleString()} pts` : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0">
        <div>
          {nextCursor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="text-xs px-4"
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs px-4">
          Close
        </Button>
      </div>
    </>
  )
}

export const PointsLedgerModal: React.FC<PointsLedgerModalProps> = ({ isOpen, onClose, events }) => (
  <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl">
    <LedgerContent onClose={onClose} events={events} />
  </Modal>
)

export default PointsLedgerModal
