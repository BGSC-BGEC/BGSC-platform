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
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2 text-foreground shadow-xs">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
        <h3 className="text-base font-bold text-foreground">
          No lot currently on the block
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          The auction is finished or waiting for the tournament director to call up the next lot.
        </p>
      </div>
    )
  }

  const isUrgent = timerSeconds <= 10 && auctionStatus === 'live'
  const formattedSeconds = String(Math.max(0, timerSeconds)).padStart(2, '0')

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 text-foreground shadow-xs">
      {/* 1. Header Row: Order, Status Badge & Countdown Clock */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-primary text-primary-foreground shadow-xs">
            LOT #{lot.order}
          </span>

          {auctionStatus === 'paused' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              PAUSED
            </span>
          ) : lot.status === 'on_block' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE ON BLOCK
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-muted/40 text-muted-foreground">
              {lot.status}
            </span>
          )}
        </div>

        {/* Digital Countdown Timer */}
        <div
          className={`font-mono text-xl sm:text-2xl font-black px-3.5 py-1 rounded-xl border tracking-wider flex items-center gap-2 ${
            isUrgent
              ? 'border-destructive/50 bg-destructive/15 text-destructive animate-pulse'
              : 'border-border bg-muted/40 text-foreground'
          }`}
        >
          <Clock className={`w-4 h-4 ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span>00:{formattedSeconds}s</span>
        </div>
      </div>

      {/* 2. Player Spotlight Details */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center flex-shrink-0 tracking-wider shadow-xs">
          {getPlayerInitials(lot.player.display_name)}
        </div>

        <div className="space-y-1 truncate">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-foreground truncate">
              {lot.player.display_name}
            </h2>
            {lot.player.role_or_title && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-muted/50 text-muted-foreground">
                {lot.player.role_or_title}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">@{lot.player.username}</p>
        </div>
      </div>

      {/* 3. Bidding Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Base Price */}
        <div className="p-3 border border-border bg-muted/20 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Base Price
          </span>
          <div className="font-mono text-base font-bold text-foreground">
            {lot.base_price.toLocaleString()} pts
          </div>
        </div>

        {/* Current Highest Bid */}
        <div className="p-3 border border-primary/40 bg-primary/5 rounded-xl space-y-1 sm:col-span-1 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Current Highest Bid
          </span>
          <div className="font-mono text-2xl font-black text-foreground">
            {lot.current_bid ? `${lot.current_bid.toLocaleString()} pts` : 'No bids yet'}
          </div>
        </div>

        {/* Leading Franchise */}
        <div className="p-3 border border-border bg-muted/20 rounded-xl space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Leading Franchise
          </span>
          <div className="flex items-center gap-1.5 pt-0.5">
            {lot.current_bidder ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-sm font-bold text-foreground truncate">
                  {lot.current_bidder.team_name}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                Awaiting opening bid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Recent Bids Ticker */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Live Bids Stream ({lot.recent_bids.length} Bids Placed)</span>
          <span>Version #{lot.version}</span>
        </div>

        {lot.recent_bids.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No bids recorded for this lot yet.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {lot.recent_bids.slice(0, 4).map((bid, idx) => {
              const isTop = idx === 0
              return (
                <div
                  key={bid.bid_id}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isTop
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-muted/30 text-foreground border border-border/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Shield className={`w-3.5 h-3.5 ${isTop ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
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
