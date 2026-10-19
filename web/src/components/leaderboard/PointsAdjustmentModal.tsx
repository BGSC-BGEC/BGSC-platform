import React, { useState, useEffect } from 'react'
import type {
  LeaderboardEntry,
  PointsTransaction,
} from '../../types/leaderboard'
import { leaderboardService } from '../../services/leaderboardService'

export interface PointsAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  targetEntry: LeaderboardEntry | null
  allEntries: LeaderboardEntry[]
  onAdjusted: (result: {
    userId: string
    newBalance: number
    transaction: PointsTransaction
  }) => void
}

interface PointsAdjustmentModalContentProps {
  onClose: () => void
  targetEntry: LeaderboardEntry | null
  allEntries: LeaderboardEntry[]
  onAdjusted: (result: {
    userId: string
    newBalance: number
    transaction: PointsTransaction
  }) => void
}

const PointsAdjustmentModalContent: React.FC<
  PointsAdjustmentModalContentProps
> = ({ onClose, targetEntry, allEntries, onAdjusted }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    targetEntry?.userId || allEntries[0]?.userId || ''
  )
  const [adjustmentType, setAdjustmentType] = useState<'grant' | 'deduct'>('grant')
  const [amount, setAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const selectedMember = allEntries.find((e) => e.userId === selectedUserId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) {
      setError('Please select a member to adjust points for.')
      return
    }

    if (amount === '' || Number(amount) <= 0) {
      setError('Please enter a valid points amount greater than 0.')
      return
    }

    if (Number(amount) > 100000) {
      setError('Points amount cannot exceed 100,000 in a single transaction.')
      return
    }

    if (note.trim().length < 3) {
      setError('An audit justification note of at least 3 characters is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const numericAmount = Number(amount)
      const signedAmount =
        adjustmentType === 'grant' ? numericAmount : -numericAmount

      const result = await leaderboardService.adjustPoints({
        userId: selectedUserId,
        amount: signedAmount,
        note: note.trim(),
      })

      onAdjusted({
        userId: selectedUserId,
        newBalance: result.newBalance,
        transaction: result.transaction,
      })
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to adjust points balance'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Adjust Member Points
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Admin Ledger Audit Action
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

        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Select Member <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            >
              {allEntries.map((entry) => (
                <option key={entry.userId} value={entry.userId}>
                  {entry.name} (@{entry.username}) — {entry.points.toLocaleString()} pts
                </option>
              ))}
            </select>
            {selectedMember && (
              <div className="text-[11px] text-gray-500 mt-1 flex justify-between">
                <span>Domain: <strong className="uppercase text-black">{selectedMember.domain}</strong></span>
                <span>Current Balance: <strong className="text-black">{selectedMember.points.toLocaleString()} pts</strong></span>
              </div>
            )}
          </div>

          {/* Adjustment Type Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Adjustment Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('grant')}
                className={`py-2 text-xs font-bold rounded border transition-colors cursor-pointer ${
                  adjustmentType === 'grant'
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                + Award Points
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('deduct')}
                className={`py-2 text-xs font-bold rounded border transition-colors cursor-pointer ${
                  adjustmentType === 'deduct'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                - Deduct Points
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Points Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              max="100000"
              step="1"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === '' ? '' : parseInt(e.target.value, 10))
              }
              placeholder="e.g. 250"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black font-mono"
            />
          </div>

          {/* Audit Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Audit Justification Note <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Champion prize for Smash Open or Conduct penalty"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black resize-y"
            />
            <span className="text-[10px] text-gray-500 mt-0.5 block">
              Required for compliance ledger auditing (min 3 characters).
            </span>
          </div>

          {/* Projected Balance */}
          {selectedMember && amount !== '' && Number(amount) > 0 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-black space-y-1">
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Projected Balance
              </div>
              <div className="font-mono font-bold text-sm">
                {selectedMember.points.toLocaleString()} pts{' '}
                <span className={adjustmentType === 'grant' ? 'text-green-600' : 'text-red-600'}>
                  {adjustmentType === 'grant' ? '+' : '-'}
                  {Number(amount).toLocaleString()} pts
                </span>{' '}
                ={' '}
                {Math.max(
                  0,
                  selectedMember.points +
                    (adjustmentType === 'grant' ? Number(amount) : -Number(amount))
                ).toLocaleString()}{' '}
                pts
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-bold rounded transition-colors cursor-pointer disabled:opacity-50 ${
                adjustmentType === 'grant'
                  ? 'border border-black bg-black text-white hover:bg-gray-800'
                  : 'border border-red-600 bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isSubmitting
                ? 'Processing...'
                : adjustmentType === 'grant'
                ? 'Confirm Point Award'
                : 'Confirm Point Deduction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const PointsAdjustmentModal: React.FC<PointsAdjustmentModalProps> = ({
  isOpen,
  onClose,
  targetEntry,
  allEntries,
  onAdjusted,
}) => {
  if (!isOpen) return null

  return (
    <PointsAdjustmentModalContent
      key={targetEntry?.userId || 'default'}
      onClose={onClose}
      targetEntry={targetEntry}
      allEntries={allEntries}
      onAdjusted={onAdjusted}
    />
  )
}

export default PointsAdjustmentModal
