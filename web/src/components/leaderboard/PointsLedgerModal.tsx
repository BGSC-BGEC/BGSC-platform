import React, { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import type { LeaderboardEntry, PointsTransaction } from '../../types/leaderboard'
import { leaderboardService } from '../../services/leaderboardService'

export interface PointsLedgerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Members to choose from (the backend only serves one member's history at a time). */
  members: LeaderboardEntry[]
  /** Member to show first, e.g. the one just adjusted. */
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Each time the modal opens, start on the requested member (or the first one).
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Points Ledger & Audit History
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Append-only compliance audit trail for point adjustments
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

        {/* Member picker */}
        <div>
          <label className="block text-xs font-bold uppercase text-black mb-1">
            Member
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
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
          <div className="p-3 border border-red-200 rounded bg-red-50 text-xs text-red-700">
            {error}
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading points history...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center border border-gray-200 rounded bg-gray-50 space-y-2">
            <FileText className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">
              No points transactions recorded yet for this member.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-black">
                <tr>
                  <th className="px-3 py-2.5">Date & Time</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5 text-right">Adjustment</th>
                  <th className="px-3 py-2.5">Audit Justification</th>
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
                      <td className="px-3 py-2 font-semibold text-black whitespace-nowrap">
                        {tx.userName}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-mono font-bold">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[11px] ${
                            isPositive
                              ? 'text-green-700 bg-green-50'
                              : 'text-red-700 bg-red-50'
                          }`}
                        >
                          {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} pts
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs break-words">
                        {tx.note}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-600 whitespace-nowrap">
                        {tx.balanceAfter !== undefined
                          ? `${tx.balanceAfter.toLocaleString()} pts`
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end pt-2 border-t border-gray-200">
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

export default PointsLedgerModal
