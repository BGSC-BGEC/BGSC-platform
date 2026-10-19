import React, { useState, useEffect } from 'react'
import type { DashboardViewProps, StatItem } from '../types/dashboard'
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

export const Dashboard: React.FC<DashboardViewProps> = ({
  stats: initialStats,
}) => {
  const [metrics, setMetrics] = useState<StatItem[]>(
    initialStats || PLACEHOLDER_STATS
  )
  const [loading, setLoading] = useState<boolean>(!initialStats)

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
      const leaderboard =
        leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : []

      const activeEventsCount = events.filter(
        (e) => e.status !== 'draft' && e.status !== 'cancelled'
      ).length

      const tournamentsCount = events.filter(
        (e) =>
          e.category === 'leagues' ||
          (e.category as string) === 'tournament' ||
          Boolean(e.isTeamed)
      ).length

      const pointsIssuedSum = leaderboard.reduce(
        (sum, item) => sum + (item.points || 0),
        0
      )

      setMetrics([
        {
          id: 'stat-members',
          label: 'Total Members',
          value: users.length.toLocaleString(),
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
      setLoading(false)
    })

    return () => {
      ignore = true
    }
  }, [initialStats])

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-lg bg-gray-50 border border-gray-200">
        <h1 className="text-2xl font-bold text-black">
          Welcome to Admin Operations
        </h1>
        <p className="text-sm text-gray-600 mt-1 max-w-xl">
          Coordinate tournaments, publish tagged announcements, manage
          registrations, and award activity points.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((item) => (
          <div
            key={item.id}
            className={`p-5 rounded-lg bg-white border border-gray-200 transition-all ${
              loading ? 'animate-pulse' : ''
            }`}
          >
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {item.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-black font-mono">
              {loading ? '...' : item.value}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {item.change}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard