import React, { useState } from 'react'
import { Gavel, Pause, Play, RotateCcw, Plus, AlertTriangle, Loader2 } from 'lucide-react'
import type { AuctionLot, AuctionStatus, TeamPurse } from '../../types/auction'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface AuctionControlPanelProps {
  activeLot: AuctionLot | null
  teams: TeamPurse[]
  status: AuctionStatus
  isSubmitting: boolean
  /** Live bid countdown still running: the backend refuses to settle early (409 timer_running). */
  timerRunning?: boolean
  onAdvance: () => void
  onTogglePause: () => void
  onPlaceBid: (teamId: string, amount: number) => Promise<void>
  onReset?: () => void
}

export const AuctionControlPanel: React.FC<AuctionControlPanelProps> = ({
  activeLot,
  teams,
  status,
  isSubmitting,
  timerRunning = false,
  onAdvance,
  onTogglePause,
  onPlaceBid,
  onReset,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    teams[0]?.team_id || ''
  )
  const [increment, setIncrement] = useState<number>(1000)
  const [biddingError, setBiddingError] = useState<string | null>(null)
  const [isBidding, setIsBidding] = useState(false)

  const hasBid = Boolean(activeLot?.current_bid && activeLot?.current_bidder)
  const nextBidAmount = activeLot?.current_bid
    ? activeLot.current_bid + increment
    : activeLot
    ? activeLot.base_price
    : 0

  const handleQuickBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeLot) return

    const teamToBid = selectedTeamId || teams[0]?.team_id || ''
    if (!teamToBid) {
      setBiddingError('Please select a franchise team.')
      return
    }

    setBiddingError(null)
    setIsBidding(true)

    try {
      await onPlaceBid(teamToBid, nextBidAmount)
    } catch (err) {
      setBiddingError(err instanceof Error ? err.message : 'Failed to place bid')
    } finally {
      setIsBidding(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 text-foreground shadow-xs">
      {/* 1. Director Primary Action Bar */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Gavel className="w-3.5 h-3.5 text-primary" />
          <span>Auction Director Controls</span>
        </div>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
          {/* Hammer / Settle Button */}
          <button
            type="button"
            onClick={onAdvance}
            disabled={!activeLot || isSubmitting || timerRunning}
            title={
              timerRunning
                ? 'The lot settles automatically when the timer reaches zero. Pause the auction to settle it now.'
                : undefined
            }
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 truncate',
              hasBid
                ? 'border border-primary bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs'
                : 'border border-border bg-card text-foreground hover:border-destructive hover:text-destructive hover:bg-destructive/10'
            )}
          >
            <Gavel className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {timerRunning
                ? hasBid
                  ? `Sells to ${activeLot!.current_bidder!.team_name}`
                  : 'Pass when timer ends'
                : hasBid
                ? `Hammer (${activeLot!.current_bidder!.team_name})`
                : 'Pass Lot (Unsold)'}
            </span>
          </button>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={onTogglePause}
            disabled={isSubmitting || status === 'finished'}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-50',
              status === 'paused'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                : 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
            )}
          >
            {status === 'paused' ? (
              <>
                <Play className="w-4 h-4 shrink-0" />
                <span>Resume Timer</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 shrink-0" />
                <span>Pause Timer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Quick Bid Simulator (For Demo & Admin Testing) */}
      <div className="border-t border-border pt-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Bidding Simulator (Admin Testing)
          </span>
          {activeLot && (
            <span className="font-mono text-xs text-muted-foreground">
              Next Bid: <strong className="text-foreground">{nextBidAmount.toLocaleString()} pts</strong>
            </span>
          )}
        </div>

        {biddingError && (
          <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{biddingError}</span>
          </div>
        )}

        <form onSubmit={handleQuickBid} className="space-y-3.5">
          {/* Team Dropdown: Full width row to comfortably fit team name and remaining purse */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Select Bidding Franchise
            </label>
            <select
              value={selectedTeamId || teams[0]?.team_id || ''}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              disabled={!activeLot || isBidding}
              className="w-full px-3.5 py-2 text-xs font-medium border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all truncate cursor-pointer"
            >
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.name} (Purse: {team.purse_remaining.toLocaleString()} pts)
                </option>
              ))}
            </select>
          </div>

          {/* Increment Pills: Full-width 3-column equal grid */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Bid Increment
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 2500, 5000].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setIncrement(inc)}
                  className={cn(
                    'w-full py-2 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer text-center',
                    increment === inc
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  +{inc.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Bid Button: Full width hero action, 100% contained */}
          <Button
            type="submit"
            disabled={!activeLot || isBidding || status === 'paused' || status === 'finished'}
            className="w-full h-10 text-xs font-bold gap-2 shadow-xs cursor-pointer"
          >
            {isBidding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Placing Bid...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Place Bid of {nextBidAmount.toLocaleString()} pts</span>
              </>
            )}
          </Button>
        </form>
      </div>

      {/* 3. Optional Reset Action */}
      {onReset && (
        <div className="border-t border-border pt-3 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo State</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default AuctionControlPanel
