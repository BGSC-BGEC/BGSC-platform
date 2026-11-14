import React, { useState } from 'react'
import {
  X,
  Coins,
  AlertTriangle,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import type {
  LeaderboardEntry,
  PointsTransaction,
} from '../../types/leaderboard'
import { leaderboardService } from '../../services/leaderboardService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

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

const PointsAdjustmentModalContent: React.FC<PointsAdjustmentModalContentProps> = ({
  onClose,
  targetEntry,
  allEntries,
  onAdjusted,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(
    targetEntry?.userId || allEntries[0]?.userId || ''
  )
  const [adjustmentType, setAdjustmentType] = useState<'grant' | 'deduct'>('grant')
  const [amount, setAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const numericAmount = typeof amount === 'number' ? amount : 0
  const projectedBalance = selectedMember
    ? Math.max(
        0,
        selectedMember.points +
          (adjustmentType === 'grant' ? numericAmount : -numericAmount)
      )
    : 0

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Adjust Member Points
            </h2>
            <p className="text-xs text-muted-foreground">
              Official ledger audit action with append-only verification
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

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl border border-destructive/40 bg-destructive/10 text-destructive animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Select Member <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              {allEntries.map((entry) => (
                <option key={entry.userId} value={entry.userId}>
                  {entry.name} (@{entry.username}) — {entry.points.toLocaleString()} pts
                </option>
              ))}
            </select>
            {selectedMember && (
              <div className="text-[11px] text-muted-foreground mt-1.5 flex justify-between px-1">
                <span>
                  Division Domain:{' '}
                  <strong className="uppercase text-foreground">{selectedMember.domain}</strong>
                </span>
                <span>
                  Current Balance:{' '}
                  <strong className="text-foreground font-mono">
                    {selectedMember.points.toLocaleString()} PTS
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Adjustment Type Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Adjustment Type <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAdjustmentType('grant')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer',
                  adjustmentType === 'grant'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <TrendingUp className="w-4 h-4" />
                <span>+ Award Points</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('deduct')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer',
                  adjustmentType === 'deduct'
                    ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold shadow-xs'
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <TrendingDown className="w-4 h-4" />
                <span>- Deduct Points</span>
              </button>
            </div>
          </div>

          {/* Points Amount */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Points Amount <span className="text-destructive">*</span>
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
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          {/* Audit Justification Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Audit Justification Note <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. 1st Place Tournament Bonus / Conduct penalty"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-y leading-relaxed"
            />
            <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-primary" />
              Permanent entry recorded in compliance ledger (min 3 chars).
            </span>
          </div>

          {/* Projected Balance Card */}
          {selectedMember && numericAmount > 0 && (
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5 animate-in fade-in">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Projected Balance
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-muted-foreground">{selectedMember.points.toLocaleString()} PTS</span>
                <span
                  className={cn(
                    'font-bold',
                    adjustmentType === 'grant'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {adjustmentType === 'grant' ? '+' : '-'}
                  {numericAmount.toLocaleString()} PTS
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-bold text-sm text-foreground">
                  {projectedBalance.toLocaleString()} PTS
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            variant={adjustmentType === 'deduct' ? 'destructive' : 'default'}
            className="text-xs font-semibold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing...
              </>
            ) : adjustmentType === 'grant' ? (
              'Confirm Point Award'
            ) : (
              'Confirm Point Deduction'
            )}
          </Button>
        </div>
      </form>
    </>
  )
}

export const PointsAdjustmentModal: React.FC<PointsAdjustmentModalProps> = ({
  isOpen,
  onClose,
  targetEntry,
  allEntries,
  onAdjusted,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <PointsAdjustmentModalContent
        key={targetEntry?.userId || 'default'}
        onClose={onClose}
        targetEntry={targetEntry}
        allEntries={allEntries}
        onAdjusted={onAdjusted}
      />
    </Modal>
  )
}

export default PointsAdjustmentModal
