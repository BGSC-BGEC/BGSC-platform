import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { DashboardViewProps, StatItem } from '../types/dashboard'
import type { ClubEvent } from '../types/event'
import { rulesFor } from '../types/event'
import type { LeaderboardEntry } from '../types/leaderboard'
import { userService } from '../services/userService'
import { eventService } from '../services/eventService'
import { leaderboardService } from '../services/leaderboardService'

const PLACEHOLDER_STATS: StatItem[] = [
  {
    id: 'stat-members',
    label: 'Total Members',
    value: '-',
    change: 'Real-time member registry',
  },
  {
    id: 'stat-active-events',
    label: 'Active Events',
    value: '-',
    change: 'Published & live fixtures',
  },
  {
    id: 'stat-tournaments',
    label: 'Tournaments',
    value: '-',
    change: 'Active tournament fixtures',
  },
  {
    id: 'stat-points-issued',
    label: 'Points Issued',
    value: '-',
    change: 'Global points circulating',
  },
]

const isActive = (status: string) => status === 'upcoming' || status === 'ongoing'

export const Dashboard: React.FC<DashboardViewProps> = ({ stats: initialStats }) => {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<StatItem[]>(initialStats || PLACEHOLDER_STATS)
  const [loading, setLoading] = useState<boolean>(!initialStats)
  const [activeEvents, setActiveEvents] = useState<ClubEvent[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (initialStats) {
      return
    }

    let ignore = false

    Promise.allSettled([
      userService.getUsers(),
      eventService.getEvents(),
      leaderboardService.getGlobalLeaderboard(),
    ]).then(([usersResult, eventsResult, leaderboardResult]) => {
      if (ignore) return

      const users = usersResult.status === 'fulfilled' ? usersResult.value : []
      const events = eventsResult.status === 'fulfilled' ? eventsResult.value : []
      const leaders =
        leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : []

      const activeEventsList = events.filter((e) => isActive(e.status))
      const activeEventsCount = activeEventsList.length

      // Tournaments = active events that have a leaderboard/bracket (every type except DE).
      const tournamentsCount = activeEventsList.filter((e) => rulesFor(e.type).hasLeaderboard)
        .length

      const pointsIssuedSum = leaders.reduce((sum, item) => sum + (item.points || 0), 0)

      setMetrics([
        {
          id: 'stat-members',
          label: 'Total Members',
          // The member list is coordinator-only; a Core admin's request is refused, so show "—"
          // rather than a misleading 0.
          value:
            usersResult.status === 'fulfilled' ? users.length.toLocaleString() : '—',
          change: 'Real-time member registry',
        },
        {
          id: 'stat-active-events',
          label: 'Active Events',
          value: activeEventsCount.toLocaleString(),
          change: 'Published & live fixtures',
        },
        {
          id: 'stat-tournaments',
          label: 'Tournaments',
          value: tournamentsCount.toLocaleString(),
          change: 'Active tournament fixtures',
        },
        {
          id: 'stat-points-issued',
          label: 'Points Issued',
          value: pointsIssuedSum.toLocaleString(),
          change: 'Global points circulating',
        },
      ])

      setActiveEvents(activeEventsList.slice(0, 5))
      setLeaderboard(leaders.slice(0, 5))
      setLoading(false)
    })

    return () => {
      ignore = true
    }
  }, [initialStats])

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs dark:bg-transparent"
          >
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </div>
            <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {loading ? '...' : item.value}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{item.change}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Active Tournaments & Fixtures */}
        <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden md:col-span-1 dark:bg-transparent">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
                Active Events & Fixtures
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground">
                {activeEvents.length} fixtures
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Upcoming and running events, with registration capacity.
            </p>
          </div>

          <div className="p-0 pb-12 overflow-x-auto">
            {activeEvents.length === 0 ? (
              <p className="border-t border-border px-6 py-6 text-xs text-muted-foreground">
                No active events.
              </p>
            ) : (
              <table className="w-full text-left border-collapse border-t border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 pl-6" scope="col">
                      Event
                    </th>
                    <th className="py-2.5 text-end tabular-nums px-3" scope="col">
                      Capacity
                    </th>
                    <th className="py-2.5 pr-6 text-end" scope="col">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeEvents.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      <td className="max-w-[220px] truncate py-3 pl-6 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-foreground shrink-0">
                            {row.type ?? '—'}
                          </span>
                          <span className="truncate text-xs text-foreground font-medium">
                            {row.title}
                          </span>
                        </div>
                      </td>
                      <td className="text-end text-muted-foreground text-xs tabular-nums px-3">
                        <span className="font-mono text-foreground">
                          {row.currentParticipants}
                        </span>
                        <span className="text-[11px] opacity-70">
                          {' / '}
                          {row.maxParticipants ?? '∞'}
                        </span>
                      </td>
                      <td className="pr-6 text-end text-muted-foreground text-xs capitalize">
                        {row.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-center bg-gradient-to-t from-background dark:from-[#0d0d0d] via-background/80 dark:via-[#0d0d0d]/80 to-transparent">
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-orange-500 transition-colors cursor-pointer"
            >
              <span>View All Events</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Global Leaderboard — Top Performers */}
        <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden md:col-span-1 dark:bg-transparent">
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
                Leaderboard — Top Performers
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground">Top 5 Rank</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Top members by global activity points.
            </p>
          </div>

          <div className="p-0 pb-12 overflow-x-auto">
            {leaderboard.length === 0 ? (
              <p className="border-t border-border px-6 py-6 text-xs text-muted-foreground">
                No leaderboard entries.
              </p>
            ) : (
              <table className="w-full text-left border-collapse border-t border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5 pl-6" scope="col">
                      Member
                    </th>
                    <th className="py-2.5 text-end tabular-nums px-3" scope="col">
                      Points
                    </th>
                    <th className="py-2.5 pr-6 text-end" scope="col">
                      Rank Shift
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.userId}
                      className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                    >
                      <td className="max-w-[220px] truncate py-3 pl-6 font-medium">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                            {row.rank}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">
                              {row.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate font-mono">
                              @{row.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-end text-muted-foreground text-xs tabular-nums px-3 font-mono font-medium">
                        {row.points.toLocaleString()} pts
                      </td>
                      <td className="pr-6 text-end text-muted-foreground text-xs">
                        {row.change > 0 ? (
                          <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                            +{row.change}
                          </span>
                        ) : row.change < 0 ? (
                          <span className="tabular-nums font-medium text-rose-500 font-mono">
                            {row.change}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px] font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-center bg-gradient-to-t from-background dark:from-[#0d0d0d] via-background/80 dark:via-[#0d0d0d]/80 to-transparent">
            <button
              type="button"
              onClick={() => navigate('/leaderboard')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-orange-500 transition-colors cursor-pointer"
            >
              <span>View Full Leaderboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
