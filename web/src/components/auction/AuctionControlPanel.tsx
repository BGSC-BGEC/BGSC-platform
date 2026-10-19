import React, { useState } from 'react'
import { Gavel, Pause, Play, RotateCcw, Plus } from 'lucide-react'
import type { AuctionLot, AuctionStatus, TeamPurse } from '../../types/auction'

export interface AuctionControlPanelProps {
  activeLot: AuctionLot | null
  teams: TeamPurse[]
  status: AuctionStatus
  isSubmitting: boolean
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

    setBiddingError(null)
    setIsBidding(true)

    try {
      await onPlaceBid(selectedTeamId, nextBidAmount)
    } catch (err) {
      setBiddingError(err instanceof Error ? err.message : 'Failed to place bid')
    } finally {
      setIsBidding(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
      {/* 1. Director Primary Action Bar */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-black">
          Auction Director Controls
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Hammer / Settle Button */}
          <button
            type="button"
            onClick={onAdvance}
            disabled={!activeLot || isSubmitting}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
              hasBid
                ? 'border border-black bg-black text-white hover:bg-gray-800'
                : 'border border-gray-300 text-gray-700 hover:border-red-600 hover:text-red-600'
            }`}
          >
            <Gavel className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {hasBid
                ? `Hammer Down (Sell for ${activeLot!.current_bid!.toLocaleString()} pts to ${activeLot!.current_bidder!.team_name})`
                : 'Pass Lot (Mark Unsold)'}
            </span>
          </button>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={onTogglePause}
            disabled={isSubmitting || status === 'finished'}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              status === 'paused'
                ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {status === 'paused' ? (
              <>
                <Play className="w-4 h-4" />
                <span>Resume Auction</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause Timer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Quick Bid Simulator (For Demo & Admin Testing) */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black">
            Bidding Simulator (Admin Testing)
          </span>
          {activeLot && (
            <span className="font-mono text-xs text-gray-500">
              Next Bid: <strong>{nextBidAmount.toLocaleString()} pts</strong>
            </span>
          )}
        </div>

        {biddingError && (
          <div className="p-2.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
            {biddingError}
          </div>
        )}

        <form
          onSubmit={handleQuickBid}
          className="flex flex-col sm:flex-row sm:items-center gap-3"
        >
          {/* Team Dropdown */}
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            disabled={!activeLot || isBidding}
            className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black truncate"
          >
            {teams.map((team) => (
              <option key={team.team_id} value={team.team_id}>
                {team.name} (Purse: {team.purse_remaining.toLocaleString()} pts)
              </option>
            ))}
          </select>

          {/* Increment Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {[1000, 2500, 5000].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => setIncrement(inc)}
                className={`px-2.5 py-1.5 text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
                  increment === inc
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                }`}
              >
                +{inc.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Submit Bid Button */}
          <button
            type="submit"
            disabled={!activeLot || isBidding || status === 'paused' || status === 'finished'}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isBidding ? 'Placing...' : `Bid ${nextBidAmount.toLocaleString()} pts`}</span>
          </button>
        </form>
      </div>

      {/* 3. Optional Reset Action */}
      {onReset && (
        <div className="border-t border-gray-100 pt-3 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-black transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo State</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default AuctionControlPanel
