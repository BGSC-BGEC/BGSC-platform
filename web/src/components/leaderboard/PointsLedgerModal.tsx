import React, { useEffect, useState } from 'react'
import { FileText, X, AlertTriangle, Loader2 } from 'lucide-react'
import type { LeaderboardEntry, PointsTransaction } from '../../types/leaderboard'
import { leaderboardService } from '../../services/leaderboardService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'

export interface PointsLedgerModalProps {
  isOpen: boolean
  onClose: () => void
  members: LeaderboardEntry[]
  initialUserId?: string | null
}

function formatTxDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const PointsLedgerModal: React.FC<PointsLedgerModalProps> = ({
  isOpen,
  onClose,
  members,
  initialUserId,
}) => {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [transactions, setTransactions] = useState<PointsTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Each time the modal opens, start on requested member (or the first one).
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(initialUserId || members[0]?.userId || '')
    }
  }, [isOpen, initialUserId, members])

  useEffect(() => {
    if (!isOpen || !selectedUserId) {
      setTransactions([])
      return
    }
    let ignore = false
    const member = members.find((m) => m.userId === selectedUserId)
    setIsLoading(true)
    setError(null)
    leaderboardService
      .getPointsTransactions(selectedUserId, member?.name)
      .then((txs) => {
        if (!ignore) setTransactions(txs)
      })
      .catch((err) => {
        if (!ignore) {
          setTransactions([])
          setError(err instanceof Error ? err.message : 'Failed to load points history')
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [isOpen, selectedUserId, members])

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
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
              Append-only compliance audit trail for point adjustments
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
        {/* Member picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
            Filter by Member
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name} (@{m.username})
              </option>
            ))}
          </select>
        </div>

        {/* Ledger Table */}
        {error ? (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl border border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Loading points history ledger...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-border rounded-xl bg-muted/10 space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto" />
            <p className="text-xs text-muted-foreground font-semibold">
              No points transactions recorded yet for this member.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Date & Time</th>
                    <th className="px-3.5 py-2.5">Member</th>
                    <th className="px-3.5 py-2.5 text-right">Adjustment</th>
                    <th className="px-3.5 py-2.5">Audit Justification</th>
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
                        <td className="px-3.5 py-2.5 font-semibold text-foreground whitespace-nowrap">
                          {tx.userName}
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
                        <td className="px-3.5 py-2.5 text-muted-foreground max-w-xs break-words">
                          {tx.note}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                          {tx.balanceAfter !== undefined
                            ? `${tx.balanceAfter.toLocaleString()} pts`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex justify-end px-6 py-4 border-t border-border bg-muted/20 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="text-xs px-4"
        >
          Close
        </Button>
      </div>
    </Modal>
  )
}

export default PointsLedgerModal
