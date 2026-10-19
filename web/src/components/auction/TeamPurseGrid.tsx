import React from 'react'
import { Users, UserCheck } from 'lucide-react'
import type { TeamPurse } from '../../types/auction'

export interface TeamPurseGridProps {
  teams: TeamPurse[]
  leadingTeamId?: string | null
}

export const TeamPurseGrid: React.FC<TeamPurseGridProps> = ({
  teams,
  leadingTeamId,
}) => {
  return (
    <div className="space-y-3">
      {/* 1. Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-black">
          Franchise Squads & Purse Balances
        </h3>
        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
          {teams.length} Competing Teams
        </span>
      </div>

      {/* 2. Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {teams.map((team) => {
          const isLeading = leadingTeamId === team.team_id
          const isFull = team.members_count >= team.size_max
          const percentSpent = Math.min(
            100,
            Math.round((team.purse_spent / team.purse_total) * 100)
          )

          return (
            <div
              key={team.team_id}
              className={`bg-white rounded-lg border p-4 space-y-3.5 transition-all ${
                isLeading
                  ? 'border-2 border-black shadow-sm ring-1 ring-black/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-sm font-bold text-black truncate">
                    {team.name}
                  </h4>
                  {isLeading && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-black text-white flex-shrink-0">
                      Leading Bid
                    </span>
                  )}
                </div>
                {team.captain_name && (
                  <p className="text-[10px] text-gray-500 font-medium truncate">
                    C: {team.captain_name}
                  </p>
                )}
              </div>

              {/* Purse Balance */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-black text-black">
                    {team.purse_remaining.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">
                    pts left
                  </span>
                </div>

                <div className="text-[10px] text-gray-500 flex justify-between">
                  <span>Spent: {team.purse_spent.toLocaleString()} pts</span>
                  <span>{percentSpent}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="bg-black h-full transition-all duration-300"
                    style={{ width: `${percentSpent}%` }}
                  />
                </div>
              </div>

              {/* Squad Capacity Footer */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-gray-700">
                  {isFull ? (
                    <UserCheck className="w-3.5 h-3.5 text-black" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span className="font-semibold text-[11px]">
                    Roster: {team.members_count} / {team.size_max}
                  </span>
                </div>

                {isFull && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-700">
                    Full
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TeamPurseGrid
