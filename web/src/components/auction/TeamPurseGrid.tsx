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
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Franchise Squads & Purse Balances
        </h3>
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
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
              className={`rounded-2xl border p-4 space-y-3.5 transition-all text-foreground ${
                isLeading
                  ? 'border-primary bg-card shadow-xs ring-1 ring-primary/40'
                  : 'border-border bg-card hover:border-border/80 shadow-xs'
              }`}
            >
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-sm font-bold text-foreground truncate">
                    {team.name}
                  </h4>
                  {isLeading && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary text-primary-foreground shadow-xs flex-shrink-0">
                      Leading Bid
                    </span>
                  )}
                </div>
                {team.captain_name && (
                  <p className="text-[10px] text-muted-foreground font-medium truncate">
                    C: {team.captain_name}
                  </p>
                )}
              </div>

              {/* Purse Balance */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-lg font-black text-foreground">
                    {team.purse_remaining.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    pts left
                  </span>
                </div>

                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>Spent: {team.purse_spent.toLocaleString()} pts</span>
                  <span>{percentSpent}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${percentSpent}%` }}
                  />
                </div>
              </div>

              {/* Squad Capacity Footer */}
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-foreground">
                  {isFull ? (
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className="font-semibold text-[11px]">
                    Roster: {team.members_count} / {team.size_max}
                  </span>
                </div>

                {isFull && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">
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
