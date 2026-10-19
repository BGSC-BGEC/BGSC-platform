import React from 'react'
import { Clock, Shield, CheckCircle2 } from 'lucide-react'
import type { AuctionLot, AuctionStatus } from '../../types/auction'

export interface CurrentLotCardProps {
  lot: AuctionLot | null
  auctionStatus: AuctionStatus
  timerSeconds: number
}

function getPlayerInitials(name: string): string {
  if (!name) return 'PL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const CurrentLotCard: React.FC<CurrentLotCardProps> = ({
  lot,
  auctionStatus,
  timerSeconds,
}) => {
  if (!lot) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-2">
        <Clock className="w-8 h-8 text-gray-400 mx-auto" />
        <h3 className="text-base font-bold text-black">
          No lot currently on the block
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          The auction is finished or waiting for the tournament director to call up the next lot.
        </p>
      </div>
    )
  }

  const isUrgent = timerSeconds <= 10 && auctionStatus === 'live'
  const formattedSeconds = String(Math.max(0, timerSeconds)).padStart(2, '0')

  return (
    <div className="bg-white rounded-lg border-2 border-black p-5 sm:p-6 space-y-5 shadow-xs">
      {/* 1. Header Row: Order, Status Badge & Countdown Clock */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black text-white">
            LOT #{lot.order}
          </span>

          {auctionStatus === 'paused' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              PAUSED
            </span>
          ) : lot.status === 'on_block' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
              LIVE ON BLOCK
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-300 bg-gray-50 text-gray-700">
              {lot.status}
            </span>
          )}
        </div>

        {/* Digital Countdown Timer */}
        <div
          className={`font-mono text-xl sm:text-2xl font-black px-3 py-1 rounded border tracking-wider flex items-center gap-1.5 ${
            isUrgent
              ? 'border-red-600 bg-red-50 text-red-600 animate-pulse'
              : 'border-gray-200 bg-gray-50 text-black'
          }`}
        >
          <Clock className={`w-4 h-4 ${isUrgent ? 'text-red-600' : 'text-gray-500'}`} />
          <span>00:{formattedSeconds}s</span>
        </div>
      </div>

      {/* 2. Player Spotlight Details */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-lg bg-black text-white font-black text-lg flex items-center justify-center flex-shrink-0 tracking-wider">
          {getPlayerInitials(lot.player.display_name)}
        </div>

        <div className="space-y-1 truncate">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-black truncate">
              {lot.player.display_name}
            </h2>
            {lot.player.role_or_title && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-800">
                {lot.player.role_or_title}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-mono">@{lot.player.username}</p>
        </div>
      </div>

      {/* 3. Bidding Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Base Price */}
        <div className="p-3 border border-gray-200 bg-gray-50 rounded space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Base Price
          </span>
          <div className="font-mono text-base font-bold text-gray-700">
            {lot.base_price.toLocaleString()} pts
          </div>
        </div>

        {/* Current Highest Bid */}
        <div className="p-3 border border-black bg-white rounded space-y-1 sm:col-span-1 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black">
            Current Highest Bid
          </span>
          <div className="font-mono text-2xl font-black text-black">
            {lot.current_bid ? `${lot.current_bid.toLocaleString()} pts` : 'No bids yet'}
          </div>
        </div>

        {/* Leading Franchise */}
        <div className="p-3 border border-gray-200 bg-gray-50 rounded space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Leading Franchise
          </span>
          <div className="flex items-center gap-1.5 pt-0.5">
            {lot.current_bidder ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm font-bold text-black truncate">
                  {lot.current_bidder.team_name}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-400">
                Awaiting opening bid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Recent Bids Ticker */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <span>Live Bids Stream ({lot.recent_bids.length} Bids Placed)</span>
          <span>Version #{lot.version}</span>
        </div>

        {lot.recent_bids.length === 0 ? (
          <p className="text-xs text-gray-400 italic">
            No bids recorded for this lot yet.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {lot.recent_bids.slice(0, 4).map((bid, idx) => {
              const isTop = idx === 0
              return (
                <div
                  key={bid.bid_id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
                    isTop
                      ? 'bg-black text-white font-bold'
                      : 'bg-gray-50 text-gray-700 border border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Shield className={`w-3 h-3 ${isTop ? 'text-white' : 'text-gray-400'}`} />
                    <span className="truncate">{bid.team_name}</span>
                  </div>
                  <span className="font-mono">
                    +{bid.amount.toLocaleString()} pts
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default CurrentLotCard
