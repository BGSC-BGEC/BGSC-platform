import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardViewProps } from '../types/dashboard'
import {
  dashboardService,
  type DashboardData,
  type DashboardEvent,
  type DashboardUser,
} from '../services/dashboardService'
import { DeltaBadge } from '../components/dashboard/DeltaBadge'
import { ShareBarList, type ShareBarItem } from '../components/dashboard/ShareBarList'
import { ActivityAreaChart, type MonthData } from '../components/dashboard/ActivityAreaChart'
import { isNotFoundError } from '../lib/errors'
import { ArrowRight, Trophy, Users, Zap, Radio, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react'

const BAR_COLOR = '#f97316'
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const ACTIVE_NOW_WINDOW = 15 * MINUTE

const DOMAIN_LABELS: Record<string, string> = {
  sports: 'Sports',
  esports: 'Esports (BGEC)',
  fitness: 'Fitness (FitSoc)',
  general: 'General',
}

const TYPE_LABELS: Record<string, string> = {
  LE: 'League',
  DE: 'Direct Entry',
  ALL: 'Auction League',
  DLL: 'Dual League',
}

// Highest privilege first; unknown roles fall to the end in the order they appear.
const ROLE_LABELS: [string, string][] = [
  ['founder', 'Founders'],
  ['coordinator', 'Coordinators'],
  ['core', 'Core Team'],
  ['member', 'Members'],
  ['user', 'Registered Users'],
  ['guest', 'Guests'],
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Share bars from a tally, largest first, with real counts and their share of the total. */
function toShareBars(counts: Map<string, number>, labelOf: (key: string) => string): ShareBarItem[] {
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => {
      const pct = total ? Math.round((n / total) * 100) : 0
      return { label: labelOf(key), value: `${n} · ${pct}%`, percentage: pct, color: BAR_COLOR }
    })
}

function tally<T>(items: T[], keyOf: (item: T) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** New sign-ups per calendar month for the 12 months ending with the current one. */
function signupTrend(users: DashboardUser[], now: Date): MonthData[] {
  const months: MonthData[] = []
  const index = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    index.set(`${d.getFullYear()}-${d.getMonth()}`, months.length)
    const name = MONTH_NAMES[d.getMonth()]
    months.push({ month: `${name} ${d.getFullYear()}`, shortMonth: name.slice(0, 3), value: 0 })
  }
  for (const u of users) {
    if (!u.createdAt) continue
    const slot = index.get(`${u.createdAt.getFullYear()}-${u.createdAt.getMonth()}`)
    if (slot !== undefined) months[slot].value += 1
  }
  return months
}

/** % change of sign-ups in the last 30 days vs the 30 before; null when there is no baseline. */
function signupDelta(users: DashboardUser[], now: number): number | null {
  let recent = 0
  let prior = 0
  for (const u of users) {
    const t = u.createdAt?.getTime()
    if (t === undefined) continue
    if (t > now - 30 * DAY) recent += 1
    else if (t > now - 60 * DAY) prior += 1
  }
  if (prior === 0) return null
  return ((recent - prior) / prior) * 100
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

function formatEventDate(event: DashboardEvent): string {
  if (event.status === 'ongoing') return 'Live now'
  if (!event.startDate) return '—'
  return event.startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const CardMessage: React.FC<{ children: React.ReactNode; tone?: 'muted' | 'error' }> = ({
  children,
  tone = 'muted',
}) => (
  <p className={`px-6 py-4 text-xs ${tone === 'error' ? 'text-rose-500' : 'text-muted-foreground'}`}>
    {children}
  </p>
)

/** A card's load error; "not found" reads as an empty state rather than a red failure. */
const CardError: React.FC<{ error: string; prefix?: string }> = ({ error, prefix }) =>
  isNotFoundError(error) ? (
    <CardMessage>Nothing to show here yet.</CardMessage>
  ) : (
    <CardMessage tone="error">{prefix ? `${prefix}: ${error}` : error}</CardMessage>
  )

export const Dashboard: React.FC<DashboardViewProps> = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [refreshing, setRefreshing] = useState(true)

  const applyResult = useCallback((result: DashboardData) => {
    setData(result)
    setRefreshing(false)
  }, [])

  const load = useCallback(() => {
    setRefreshing(true)
    dashboardService.loadDashboard().then(applyResult)
  }, [applyResult])

  useEffect(() => {
    let cancelled = false
    dashboardService.loadDashboard().then((result) => {
      if (!cancelled) applyResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [applyResult])

  const loading = data === null

  const view = useMemo(() => {
    if (!data) return null
    const now = data.loadedAt.getTime()
    const users = data.users.ok ? data.users.data.items : []
    const events = data.events.ok ? data.events.data.items : []

    const trend = signupTrend(users, data.loadedAt)
    const activeWithin = (ms: number) =>
      users.filter((u) => u.lastActiveAt && u.lastActiveAt.getTime() > now - ms).length
    const total = users.length
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
    const presence: ShareBarItem[] = [
      ['Last 24 hours', activeWithin(DAY)],
      ['Last 7 days', activeWithin(7 * DAY)],
      ['Last 30 days', activeWithin(30 * DAY)],
    ].map(([label, n]) => ({
      label: label as string,
      value: `${n} · ${pct(n as number)}%`,
      percentage: pct(n as number),
      color: BAR_COLOR,
    }))

    const roleCounts = tally(users, (u) => u.role)
    const roleOrder = new Map(ROLE_LABELS.map(([key], i) => [key, i]))
    const roles = [...roleCounts.entries()]
      .sort((a, b) => (roleOrder.get(a[0]) ?? 99) - (roleOrder.get(b[0]) ?? 99))
      .map(([key, n]) => ({
        label: ROLE_LABELS.find(([k]) => k === key)?.[1] ?? key,
        value: `${n} · ${pct(n)}%`,
        percentage: pct(n),
        color: BAR_COLOR,
      }))

    const liveEvents = events
      .filter((e) => e.status === 'ongoing' || e.status === 'upcoming')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'ongoing' ? -1 : 1
        return (a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity)
      })

    return {
      users,
      events,
      trend,
      joinedThisYear: trend.reduce((s, m) => s + m.value, 0),
      delta: signupDelta(users, now),
      activeNow: activeWithin(ACTIVE_NOW_WINDOW),
      presence,
      roles,
      liveEvents,
      disciplines: toShareBars(tally(events, (e) => e.domain), (k) => DOMAIN_LABELS[k] ?? k),
      formats: toShareBars(tally(events, (e) => e.type), (k) => TYPE_LABELS[k] ?? k),
    }
  }, [data])

  const usersError = data && !data.users.ok ? data.users.error : null
  const eventsError = data && !data.events.ok ? data.events.error : null
  const usersTruncated = data?.users.ok && data.users.data.truncated
  const eventsTruncated = data?.events.ok && data.events.data.truncated
  const placeholder = loading ? '…' : '—'
  const leaderRows = data?.leaderboard.ok ? data.leaderboard.data : null
  const leaderError = data && !data.leaderboard.ok ? data.leaderboard.error : null
  const auctionRows = data?.auctionSales.ok ? data.auctionSales.data : null
  const auctionError = data && !data.auctionSales.ok ? data.auctionSales.error : null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* ── 1. Member growth chart ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-6 md:col-span-2 lg:col-span-3 dark:bg-transparent flex flex-col justify-between">
        <div className="flex flex-row items-start justify-between mb-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {view && !usersError ? view.users.length.toLocaleString() : placeholder}
              <span className="ml-2 text-sm font-medium text-muted-foreground">members</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {usersError
                ? `Could not load members: ${usersError}`
                : view
                  ? `${view.joinedThisYear.toLocaleString()} joined in the last 12 months — new sign-ups per month.${usersTruncated ? ' (Showing the first members only.)' : ''}`
                  : 'Loading member sign-ups…'}
            </p>
          </div>
          {view && view.delta !== null && (
            <DeltaBadge value={view.delta} variant="badge" label="sign-ups vs prior 30 days" />
          )}
        </div>

        <div className="pt-2">
          {view && !usersError ? (
            <ActivityAreaChart data={view.trend} height={240} color={BAR_COLOR} />
          ) : (
            <div className="h-[240px]" />
          )}
        </div>
      </div>

      {/* ── 2. Member activity ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 gap-0 pb-0 md:col-span-2 lg:col-span-1 dark:bg-transparent flex flex-col">
        <div className="flex flex-row items-start justify-between gap-3 border-b border-border p-6 pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {view && !usersError ? view.activeNow : placeholder}
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>members active now</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Seen in the last 15 minutes. Below: share of all members active per window.
            </p>
          </div>
        </div>

        <div className="p-3">
          {usersError ? (
            <CardError error={usersError} />
          ) : view ? (
            <ShareBarList items={view.presence} barColor={BAR_COLOR} />
          ) : (
            <CardMessage>Loading…</CardMessage>
          )}
        </div>
      </div>

      {/* ── 3. Live & upcoming events ──────────────────────────────────── */}
      <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden md:col-span-2 dark:bg-transparent">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
              Live & Upcoming Events
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              {view ? `${view.liveEvents.length} events` : placeholder}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Ongoing first, then by start date, with confirmed registrations against capacity.
          </p>
        </div>

        <div className="p-0 pb-12 overflow-x-auto">
          {eventsError ? (
            <CardError error={eventsError} prefix="Could not load events" />
          ) : !view ? (
            <CardMessage>Loading…</CardMessage>
          ) : view.liveEvents.length === 0 ? (
            <CardMessage>No ongoing or upcoming events. Drafts appear here once published.</CardMessage>
          ) : (
            <table className="w-full text-left border-collapse border-t border-border">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 pl-6" scope="col">Event</th>
                  <th className="py-2.5 text-end tabular-nums px-3" scope="col">Registered</th>
                  <th className="py-2.5 pr-6 text-end" scope="col">Starts</th>
                </tr>
              </thead>
              <tbody>
                {view.liveEvents.slice(0, 5).map((row) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="max-w-[220px] truncate py-3 pl-6 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-foreground shrink-0">
                          {row.category.toUpperCase()}
                        </span>
                        <span className="truncate text-xs text-foreground font-medium">{row.title}</span>
                      </div>
                    </td>
                    <td className="text-end text-muted-foreground text-xs tabular-nums px-3">
                      <span className="font-mono text-foreground">{row.currentParticipants}</span>
                      {row.maxParticipants ? (
                        <span className="text-[11px] opacity-70"> / {row.maxParticipants}</span>
                      ) : (
                        <span className="text-[11px] opacity-70"> / no cap</span>
                      )}
                    </td>
                    <td className="pr-6 text-end text-xs whitespace-nowrap">
                      <span
                        className={
                          row.status === 'ongoing'
                            ? 'font-medium text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }
                      >
                        {formatEventDate(row)}
                      </span>
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

      {/* ── 4. Leaderboard — top performers ────────────────────────────── */}
      <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden md:col-span-2 dark:bg-transparent">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
              Campus Leaderboard — Top Performers
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">Top 5 · all time</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Highest point totals across all domains.
          </p>
        </div>

        <div className="p-0 pb-12 overflow-x-auto">
          {leaderError ? (
            <CardError error={leaderError} prefix="Could not load leaderboard" />
          ) : !leaderRows ? (
            <CardMessage>Loading…</CardMessage>
          ) : leaderRows.length === 0 ? (
            <CardMessage>No points have been awarded yet.</CardMessage>
          ) : (
            <table className="w-full text-left border-collapse border-t border-border">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 pl-6" scope="col">Athlete</th>
                  <th className="py-2.5 text-end tabular-nums px-3" scope="col">Points</th>
                  <th className="py-2.5 pr-6 text-end" scope="col">Rank Shift</th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.slice(0, 5).map((row, idx) => (
                  <tr key={row.userId || row.username || idx} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="max-w-[220px] truncate py-3 pl-6 font-medium">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold font-mono flex items-center justify-center shrink-0">
                          {row.rank || idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{row.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate font-mono">
                            {(row.domain || '').toUpperCase()}
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
                        <span className="tabular-nums font-medium text-rose-500 font-mono">{row.change}</span>
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

      {/* ── 5. Events by domain ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 overflow-hidden dark:bg-transparent flex flex-col">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Event Domains
            </h3>
            <Trophy className="w-4 h-4 text-orange-500/80" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {view && !eventsError
              ? `All ${view.events.length} events by domain${eventsTruncated ? ' (first pages only)' : ''}.`
              : 'All events by domain.'}
          </p>
        </div>
        <div className="p-2.5 py-2">
          {eventsError ? (
            <CardError error={eventsError} />
          ) : !view ? (
            <CardMessage>Loading…</CardMessage>
          ) : view.disciplines.length === 0 ? (
            <CardMessage>No events yet.</CardMessage>
          ) : (
            <ShareBarList items={view.disciplines} barColor={BAR_COLOR} />
          )}
        </div>
      </div>

      {/* ── 6. Members by role ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 overflow-hidden dark:bg-transparent flex flex-col">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Community Roles
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              {view && !usersError ? view.users.length : placeholder}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Members by platform role.</p>
        </div>
        <div className="p-2.5 py-2">
          {usersError ? (
            <CardError error={usersError} />
          ) : !view ? (
            <CardMessage>Loading…</CardMessage>
          ) : view.roles.length === 0 ? (
            <CardMessage>No members yet.</CardMessage>
          ) : (
            <ShareBarList items={view.roles} barColor={BAR_COLOR} />
          )}
        </div>
      </div>

      {/* ── 7. Events by format ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 overflow-hidden dark:bg-transparent flex flex-col">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Event Formats
            </h3>
            <Zap className="w-4 h-4 text-orange-500/80" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">All events by entry format.</p>
        </div>
        <div className="p-2.5 py-2">
          {eventsError ? (
            <CardError error={eventsError} />
          ) : !view ? (
            <CardMessage>Loading…</CardMessage>
          ) : view.formats.length === 0 ? (
            <CardMessage>No events yet.</CardMessage>
          ) : (
            <ShareBarList items={view.formats} barColor={BAR_COLOR} />
          )}
        </div>
      </div>

      {/* ── 8. Auction highlights ──────────────────────────────────────── */}
      <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden dark:bg-transparent flex flex-col">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Auction Highlights
            </h3>
            <Radio className="w-4 h-4 text-orange-500/80" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Top sold players across recent auction leagues.
          </p>
        </div>

        <div className="p-0 pb-12 overflow-x-auto">
          {auctionError ? (
            <CardError error={auctionError} />
          ) : !auctionRows ? (
            <CardMessage>Loading…</CardMessage>
          ) : auctionRows.length === 0 ? (
            <CardMessage>No players sold at auction yet.</CardMessage>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="py-2.5 pl-4" scope="col">Athlete & Team</th>
                  <th className="py-2.5 pr-4 text-end tabular-nums" scope="col">Sold (pts)</th>
                </tr>
              </thead>
              <tbody>
                {auctionRows.map((sale) => (
                  <tr key={sale.lotId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="max-w-[140px] truncate py-2.5 pl-4">
                      <div className="text-xs font-medium text-foreground truncate">{sale.athlete}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{sale.team}</div>
                    </td>
                    <td className="pr-4 py-2.5 text-end">
                      <div className="font-mono font-bold text-xs text-orange-500 tabular-nums">
                        {sale.amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{sale.eventTitle}</div>
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
            onClick={() => navigate('/auction')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-orange-500 transition-colors cursor-pointer"
          >
            <span>View Auction Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 9. Platform health ─────────────────────────────────────────── */}
      <div className="md:col-span-2 lg:col-span-4 rounded-xl border border-border bg-card text-card-foreground shadow-xs dark:bg-transparent">
        <div className="border-b border-border p-6 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
              Platform Health
            </h3>
            <div className="flex items-center gap-4">
              {data &&
                (data.health.ok ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    API gateway online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                    <ShieldAlert className="w-4 h-4" />
                    API gateway unreachable
                  </span>
                ))}
              <button
                type="button"
                onClick={load}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-orange-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Measured from this browser
            {data ? ` at ${data.loadedAt.toLocaleTimeString()}` : ''}.
          </p>
        </div>

        <div className="p-6">
          <ul className="grid gap-6 sm:grid-cols-3">
            <li className="flex flex-col gap-1">
              <p className="font-medium text-sm text-foreground">API Round-trip</p>
              <p className="text-xs text-muted-foreground">Browser → gateway /health</p>
              <p className="font-mono font-bold text-2xl tabular-nums text-foreground mt-0.5">
                {data?.health.latencyMs != null ? `${data.health.latencyMs}ms` : placeholder}
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="font-medium text-sm text-foreground">Gateway Uptime</p>
              <p className="text-xs text-muted-foreground">Since the gateway process last started</p>
              <p className="font-mono font-bold text-2xl tabular-nums text-foreground mt-0.5">
                {data?.health.uptimeSeconds != null ? formatUptime(data.health.uptimeSeconds) : placeholder}
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="font-medium text-sm text-foreground">Data Sources</p>
              <p className="text-xs text-muted-foreground">Dashboard API calls that succeeded</p>
              <p className="font-mono font-bold text-2xl tabular-nums text-foreground mt-0.5">
                {data
                  ? `${[data.users, data.events, data.leaderboard, data.auctionSales].filter((r) => r.ok).length} / 4`
                  : placeholder}
              </p>
              {data?.health.env && (
                <p className="text-[11px] text-muted-foreground font-mono">env: {data.health.env}</p>
              )}
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
