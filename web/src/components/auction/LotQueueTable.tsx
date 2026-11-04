import React, { useState, useMemo } from 'react'
import { CheckCircle2, CircleSlash, Radio, Clock } from 'lucide-react'
import type { AuctionLot } from '../../types/auction'

export interface LotQueueTableProps {
  lots: AuctionLot[]
  activeLotId?: string | null
}

type TabType = 'upcoming' | 'settled' | 'all'

function getPlayerInitials(name: string): string {
  if (!name) return 'PL'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const LotQueueTable: React.FC<LotQueueTableProps> = ({
  lots,
  activeLotId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')

  // Calculate tab counts
  const counts = useMemo(() => {
    return {
      upcoming: lots.filter((l) => l.status === 'queued').length,
      settled: lots.filter((l) => l.status === 'sold' || l.status === 'unsold').length,
      all: lots.length,
    }
  }, [lots])

  // Filter lots based on active tab
  const filteredLots = useMemo(() => {
    switch (activeTab) {
      case 'upcoming':
        return lots.filter((l) => l.status === 'queued')
      case 'settled':
        return lots.filter((l) => l.status === 'sold' || l.status === 'unsold')
      case 'all':
      default:
        return lots
    }
  }, [lots, activeTab])

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden space-y-0 text-foreground shadow-xs">
      {/* 1. Header & Filter Tabs */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <div className="space-y-0.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Auction Lot Queue & History
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Real-time track of queued players, active blocks, and closed sales.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Upcoming Queue ({counts.upcoming})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settled')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settled'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            Settled / History ({counts.settled})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            All Lots ({counts.all})
          </button>
        </div>
      </div>

      {/* 2. Table Display */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              <th className="py-2.5 px-4 w-16">Lot #</th>
              <th className="py-2.5 px-4">Player</th>
              <th className="py-2.5 px-4">Base Price</th>
              <th className="py-2.5 px-4">Sale / Current Bid</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Destination / Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-xs">
            {filteredLots.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground text-xs">
                  No lots in this category
                </td>
              </tr>
            ) : (
              filteredLots.map((lot) => {
                const isActive = lot.id === activeLotId || lot.status === 'on_block'

                return (
                  <tr
                    key={lot.id}
                    className={`transition-colors ${
                      isActive
                        ? 'bg-primary/10 font-medium'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Lot # */}
                    <td className="py-3 px-4 font-mono text-xs font-bold text-muted-foreground">
                      #{lot.order}
                    </td>

                    {/* Player */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground font-black text-[11px] flex items-center justify-center flex-shrink-0 tracking-wider shadow-xs">
                          {getPlayerInitials(lot.player.display_name)}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground text-xs truncate">
                              {lot.player.display_name}
                            </span>
                            {lot.player.role_or_title && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded border border-border bg-muted/50 text-muted-foreground flex-shrink-0">
                                {lot.player.role_or_title}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono block">
                            @{lot.player.username}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Base Price */}
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {lot.base_price.toLocaleString()} pts
                    </td>

                    {/* Sale / Current Bid */}
                    <td className="py-3 px-4 font-mono font-bold">
                      {lot.status === 'sold' && lot.sold_amount ? (
                        <span className="text-foreground">
                          {lot.sold_amount.toLocaleString()} pts
                        </span>
                      ) : lot.status === 'on_block' && lot.current_bid ? (
                        <span className="text-primary font-black">
                          {lot.current_bid.toLocaleString()} pts
                        </span>
                      ) : lot.status === 'unsold' ? (
                        <span className="text-muted-foreground font-normal">-</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">-</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4">
                      {lot.status === 'on_block' ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live on Block
                        </span>
                      ) : lot.status === 'sold' ? (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary text-primary-foreground shadow-xs">
                          Sold
                        </span>
                      ) : lot.status === 'unsold' ? (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-muted/40 text-muted-foreground">
                          Unsold
                        </span>
                      ) : lot.status === 'settling' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <Clock className="w-3 h-3 text-amber-500" />
                          Settling
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-muted/30 text-muted-foreground">
                          Queued
                        </span>
                      )}
                    </td>

                    {/* Destination / Result */}
                    <td className="py-3 px-4 text-right">
                      {lot.status === 'sold' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {lot.sold_to_team_name || 'Assigned'}
                        </span>
                      ) : lot.status === 'unsold' ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <CircleSlash className="w-3.5 h-3.5 text-muted-foreground" />
                          Passed
                        </span>
                      ) : lot.status === 'on_block' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                          <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                          Bidding Active
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">In Queue</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
