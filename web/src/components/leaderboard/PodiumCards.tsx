import React from 'react'
import { Trophy, Medal, Award } from 'lucide-react'
import type { LeaderboardEntry } from '../../types/leaderboard'

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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-4 pb-2">
      {/* 2nd Place (Silver) */}
      {second && (
        <div className="order-2 sm:order-1 bg-white rounded-lg border border-gray-300 p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-gray-200 text-gray-800 border border-gray-300">
                <Medal className="w-3.5 h-3.5" />
                #2 Silver
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700">
                {second.domain}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-black truncate">
                {second.name}
              </h3>
              <p className="text-xs text-gray-500 font-mono">@{second.username}</p>
            </div>

            <div>
              <div className="text-2xl font-black text-black">
                {second.points.toLocaleString()}
                <span className="text-xs font-semibold text-gray-500 ml-1">pts</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdjustPoints(second)}
            className="w-full mt-2 px-3 py-1.5 text-xs font-semibold border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
          >
            Adjust Points
          </button>
        </div>
      )}

      {/* 1st Place (Gold) - Elevated Height */}
      {first && (
        <div className="order-1 sm:order-2 bg-white rounded-lg border-2 border-black p-6 space-y-4 shadow-md relative sm:-translate-y-2 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider rounded bg-black text-white">
                <Trophy className="w-4 h-4 text-amber-400" />
                #1 Champion
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-black bg-black text-white">
                {first.domain}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-black truncate">
                {first.name}
              </h3>
              <p className="text-xs text-gray-600 font-mono">@{first.username}</p>
            </div>

            <div>
              <div className="text-3xl font-black text-black">
                {first.points.toLocaleString()}
                <span className="text-xs font-semibold text-gray-500 ml-1">pts</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdjustPoints(first)}
            className="w-full mt-2 px-3 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
          >
            Adjust Points
          </button>
        </div>
      )}

      {/* 3rd Place (Bronze) */}
      {third && (
        <div className="order-3 sm:order-3 bg-white rounded-lg border border-gray-300 p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-900 border border-amber-200">
                <Award className="w-3.5 h-3.5 text-amber-800" />
                #3 Bronze
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700">
                {third.domain}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-black truncate">
                {third.name}
              </h3>
              <p className="text-xs text-gray-500 font-mono">@{third.username}</p>
            </div>

            <div>
              <div className="text-2xl font-black text-black">
                {third.points.toLocaleString()}
                <span className="text-xs font-semibold text-gray-500 ml-1">pts</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdjustPoints(third)}
            className="w-full mt-2 px-3 py-1.5 text-xs font-semibold border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
          >
            Adjust Points
          </button>
        </div>
      )}
    </div>
  )
}

export default PodiumCards
