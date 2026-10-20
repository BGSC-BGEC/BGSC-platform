import React from 'react'
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LeaderboardEntry } from '../../types/leaderboard'

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  onAdjustPoints: (entry: LeaderboardEntry) => void
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  entries,
  onAdjustPoints,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-black">
          <tr>
            <th className="px-4 py-3 text-center w-16">Rank</th>
            <th className="px-4 py-3">Athlete / Member</th>
            <th className="px-4 py-3">Domain</th>
            <th className="px-4 py-3 text-center">Movement</th>
            <th className="px-4 py-3 text-right">Points Balance</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => {
            const isTop1 = entry.rank === 1
            const isTop2 = entry.rank === 2
            const isTop3 = entry.rank === 3

            return (
              <tr
                key={entry.userId}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Rank */}
                <td className="px-4 py-3 text-center">
                  {isTop1 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black text-amber-400 font-bold text-xs mx-auto">
                      <Trophy className="w-3.5 h-3.5" />
                    </span>
                  ) : isTop2 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-800 font-bold text-xs mx-auto">
                      <Medal className="w-3.5 h-3.5" />
                    </span>
                  ) : isTop3 ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold text-xs mx-auto">
                      <Award className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-semibold text-gray-600">
                      #{entry.rank}
                    </span>
                  )}
                </td>

                {/* Athlete / Member */}
                <td className="px-4 py-3">
                  <div className="font-bold text-black text-xs sm:text-sm">
                    {entry.name}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono">
                    @{entry.username}
                  </div>
                </td>

                {/* Domain Badge */}
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700">
                    {entry.domain}
                  </span>
                </td>

                {/* Movement / Change */}
                <td className="px-4 py-3 text-center">
                  {entry.change > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                      <TrendingUp className="w-3 h-3" />
                      +{entry.change}
                    </span>
                  ) : entry.change < 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      <TrendingDown className="w-3 h-3" />
                      {entry.change}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-gray-400 text-xs">
                      <Minus className="w-3 h-3" />
                    </span>
                  )}
                </td>

                {/* Points Balance */}
                <td className="px-4 py-3 text-right">
                  <span className="font-mono font-bold text-black text-xs sm:text-sm">
                    {entry.points.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-gray-500 ml-1">pts</span>
                </td>

                {/* Action */}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onAdjustPoints(entry)}
                    className="px-3 py-1 text-xs font-semibold border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
                  >
                    Adjust
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default LeaderboardTable
