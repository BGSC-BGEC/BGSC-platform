import React from 'react'
import { Trophy, Medal, Award } from 'lucide-react'
import type { LeaderboardEntry } from '../../types/leaderboard'
import { Button } from '../ui/button'

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  /** Omit to hide the Action column (role below `points.adjust`). */
  onAdjustPoints?: (entry: LeaderboardEntry) => void
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  onAdjustPoints,
}) => {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-center w-16">Rank</th>
              <th className="px-4 py-3">Athlete / Member</th>
              <th className="px-4 py-3 text-right">Points Earned</th>
              {onAdjustPoints && <th className="px-4 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {entries.map((entry) => {
              const isTop1 = entry.rank === 1
              const isTop2 = entry.rank === 2
              const isTop3 = entry.rank === 3

              return (
                <tr
                  key={entry.userId}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {/* Rank */}
                  <td className="px-4 py-3 text-center">
                    {isTop1 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-xs mx-auto shadow-xs">
                        <Trophy className="w-3.5 h-3.5 text-amber-300" />
                      </span>
                    ) : isTop2 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs mx-auto">
                        <Medal className="w-3.5 h-3.5" />
                      </span>
                    ) : isTop3 ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs mx-auto">
                        <Award className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        #{entry.rank}
                      </span>
                    )}
                  </td>

                  {/* Athlete / Member */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground text-xs sm:text-sm">
                      {entry.name}
                    </div>
                    {entry.username && (
                      <div className="text-[11px] text-muted-foreground font-mono">
                        @{entry.username}
                      </div>
                    )}
                  </td>

                  {/* Points Earned */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-bold text-foreground text-xs sm:text-sm">
                      {entry.points.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1 font-sans">pts</span>
                  </td>

                  {/* Action */}
                  {onAdjustPoints && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          onAdjustPoints(entry)
                        }}
                        className="h-8 px-3 text-xs font-semibold"
                      >
                        Adjust
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LeaderboardTable
