import React, { useState, useEffect, useRef } from 'react'
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
  UserSearchResult,
} from '../../types/leaderboard'
import {
  leaderboardService,
  newRequestId,
} from '../../services/leaderboardService'
import { useCan } from '../../services/permissions'
import { UserSearchPicker } from './UserSearchPicker'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface PointsAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  /** Pre-selected member (from a leaderboard row); null opens with a member search. */
  targetEntry: LeaderboardEntry | null
  onAdjusted: (result: {
    userId: string
    newBalance: number
    transaction: PointsTransaction
  }) => void
}

interface ContentProps {
  onClose: () => void
  targetEntry: LeaderboardEntry | null
  onAdjusted: PointsAdjustmentModalProps['onAdjusted']
}

function fromEntry(entry: LeaderboardEntry): UserSearchResult {
  return { id: entry.userId, username: entry.username, fullName: entry.name, pointsBalance: null }
}

const PointsAdjustmentModalContent: React.FC<ContentProps> = ({ onClose, targetEntry, onAdjusted }) => {
  const [member, setMember] = useState<UserSearchResult | null>(
    targetEntry ? fromEntry(targetEntry) : null
  )
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<'grant' | 'deduct'>('grant')
  const [amount, setAmount] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Idempotency key: reused only while the exact same adjustment is retried.
  const requestRef = useRef<{ signature: string; id: string } | null>(null)

  // The leaderboard shows points earned, not the spendable balance: read the live balance.
  const memberId = member?.id
  useEffect(() => {
    if (!memberId) return
    let ignore = false
    leaderboardService
      .getUserPointsSummary(memberId)
      .then((s) => {
        if (!ignore) {
          setBalance(s.balance)
          setBalanceError(null)
        }
      })
      .catch((err) => {
        if (!ignore) setBalanceError(err instanceof Error ? err.message : 'Could not load points')
      })
    return () => {
      ignore = true
    }
  }, [memberId])

  const handleSelectMember = (u: UserSearchResult | null) => {
    setBalance(null)
    setBalanceError(null)
    setMember(u)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!member) {
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
    if (note.trim().length < 3 || note.trim().length > 500) {
      setError('An audit justification note of 3 to 500 characters is required.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const signedAmount = adjustmentType === 'grant' ? Number(amount) : -Number(amount)
    const signature = `${member.id}|${signedAmount}|${note.trim()}`
    if (!requestRef.current || requestRef.current.signature !== signature) {
      requestRef.current = { signature, id: newRequestId() }
    }

    try {
      const result = await leaderboardService.adjustPoints({
        userId: member.id,
        amount: signedAmount,
        note: note.trim(),
        requestId: requestRef.current.id,
      })
      onAdjusted({
        userId: member.id,
        newBalance: result.newBalance,
        transaction: result.transaction,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust points')
    } finally {
      setIsSubmitting(false)
    }
  }

  const numericAmount = amount === '' ? 0 : Number(amount)

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
            <p className="text-xs text-muted-foreground">Admin ledger audit action</p>
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
              Member <span className="text-destructive">*</span>
            </label>
            <UserSearchPicker selected={member} onSelect={handleSelectMember} />
            {member && (
              <div className="text-[11px] text-muted-foreground mt-1.5 flex justify-between px-1">
                <span>Spendable points</span>
                <span>
                  {balanceError ? (
                    <span className="text-destructive">{balanceError}</span>
                  ) : balance === null ? (
                    'Loading...'
                  ) : (
                    <strong className="text-foreground font-mono">{balance.toLocaleString()} PTS</strong>
                  )}
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
              onChange={(e) => setAmount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
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
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Champion prize for Smash Open or Conduct penalty"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-y leading-relaxed"
            />
            <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-primary" />
              Required for compliance ledger auditing (3-500 characters).
            </span>
          </div>

          {/* Projected Points Card */}
          {balance !== null && numericAmount > 0 && (
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5 animate-in fade-in">
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                Projected Points
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-muted-foreground">{balance.toLocaleString()} PTS</span>
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
                  {(balance + (adjustmentType === 'grant' ? numericAmount : -numericAmount)).toLocaleString()} PTS
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
            disabled={isSubmitting || !member}
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
  onAdjusted,
}) => {
  // POST /points/adjust is coordinator+; never render the form for a role the backend refuses.
  const canAdjust = useCan('points.adjust')

  return (
    <Modal isOpen={isOpen && canAdjust} onClose={onClose} className="max-w-md">
      <PointsAdjustmentModalContent
        key={targetEntry?.userId || 'default'}
        onClose={onClose}
        targetEntry={targetEntry}
        onAdjusted={onAdjusted}
      />
    </Modal>
  )
}

export default PointsAdjustmentModal
