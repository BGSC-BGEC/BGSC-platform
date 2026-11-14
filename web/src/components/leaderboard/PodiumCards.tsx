import React from 'react'
import { Trophy, Medal, Award } from 'lucide-react'
import type { LeaderboardEntry } from '../../types/leaderboard'
import { Button } from '../ui/button'

export interface PodiumCardsProps {
  topThree: LeaderboardEntry[]
  onAdjustPoints: (entry: LeaderboardEntry) => void
}

export const PodiumCards: React.FC<PodiumCardsProps> = ({
  topThree,
  onAdjustPoints,
}) => {
  const first = topThree.find((e) => e.rank === 1) || topThree[0]
  const second = topThree.find((e) => e.rank === 2) || topThree[1]
  const third = topThree.find((e) => e.rank === 3) || topThree[2]

  if (!first) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2 pb-2">
      {/* 2nd Place (Silver) */}
      {second && (
        <div className="order-2 sm:order-1 rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between text-foreground">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                <Medal className="w-3.5 h-3.5" />
                #2 Silver
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                {second.domain}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground truncate">
                {second.name}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">@{second.username}</p>
            </div>

            <div>
              <div className="text-2xl font-black text-foreground tabular-nums font-mono">
                {second.points.toLocaleString()}
                <span className="text-xs font-semibold text-muted-foreground ml-1 font-sans">pts</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAdjustPoints(second)
            }}
            className="w-full mt-2 text-xs font-semibold"
          >
            Adjust Points
          </Button>
        </div>
      )}

      {/* 1st Place (Gold) - Elevated */}
      {first && (
        <div className="order-1 sm:order-2 rounded-2xl border-2 border-primary/60 bg-card p-6 space-y-4 shadow-lg relative sm:-translate-y-2 flex flex-col justify-between text-foreground ring-2 ring-primary/20">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Trophy className="w-4 h-4 text-amber-300" />
                #1 Champion
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                {first.domain}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground truncate">
                {first.name}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">@{first.username}</p>
            </div>

            <div>
              <div className="text-3xl font-black text-foreground tabular-nums font-mono">
                {first.points.toLocaleString()}
                <span className="text-xs font-semibold text-muted-foreground ml-1 font-sans">pts</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAdjustPoints(first)
            }}
            className="w-full mt-2 text-xs font-bold"
          >
            Adjust Points
          </Button>
        </div>
      )}

      {/* 3rd Place (Bronze) */}
      {third && (
        <div className="order-3 sm:order-3 rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between text-foreground">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                #3 Bronze
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                {third.domain}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-foreground truncate">
                {third.name}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">@{third.username}</p>
            </div>

            <div>
              <div className="text-2xl font-black text-foreground tabular-nums font-mono">
                {third.points.toLocaleString()}
                <span className="text-xs font-semibold text-muted-foreground ml-1 font-sans">pts</span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAdjustPoints(third)
            }}
            className="w-full mt-2 text-xs font-semibold"
          >
            Adjust Points
          </Button>
        </div>
      )}
    </div>
  )
}

export default PodiumCards
