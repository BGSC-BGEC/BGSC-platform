import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardViewProps } from '../types/dashboard'
import { userService } from '../services/userService'
import { eventService } from '../services/eventService'
import { leaderboardService } from '../services/leaderboardService'
import type { ClubEvent } from '../types/event'
import type { LeaderboardEntry } from '../types/leaderboard'
import { DeltaBadge } from '../components/dashboard/DeltaBadge'
import { ShareBarList, type ShareBarItem } from '../components/dashboard/ShareBarList'
import { ActivityAreaChart, type MonthData } from '../components/dashboard/ActivityAreaChart'
import { ArrowRight, Trophy, Users, Zap, Radio, ShieldCheck } from 'lucide-react'

// BGSC 12-Month Athletic & Esports Participation Trend
const PARTICIPATION_TREND: MonthData[] = [
  { month: 'January', shortMonth: 'Jan', value: 620 },
  { month: 'February', shortMonth: 'Feb', value: 940 },
  { month: 'March', shortMonth: 'Mar', value: 810 },
  { month: 'April', shortMonth: 'Apr', value: 890 },
  { month: 'May', shortMonth: 'May', value: 1050 },
  { month: 'June', shortMonth: 'Jun', value: 1180 },
  { month: 'July', shortMonth: 'Jul', value: 760 },
  { month: 'August', shortMonth: 'Aug', value: 1240 },
  { month: 'September', shortMonth: 'Sep', value: 980 },
  { month: 'October', shortMonth: 'Oct', value: 1190 },
  { month: 'November', shortMonth: 'Nov', value: 1540 },
  { month: 'December', shortMonth: 'Dec', value: 680 },
]

const TOTAL_PARTICIPATION = PARTICIPATION_TREND.reduce((sum, row) => sum + row.value, 0)

// Fallback BGSC Tournaments (Used if API is initializing)
const FALLBACK_TOURNAMENTS = [
  { id: 'evt-001', title: 'BGEC Valorant Campus Invitational', category: 'BGEC', participants: 16, max: 16, delta: 14.2 },
  { id: 'evt-002', title: 'Badminton Smash Open — Season 3', category: 'LEAGUES', participants: 24, max: 32, delta: 8.5 },
  { id: 'evt-003', title: 'FitSoc Autumn 5K Run & Obstacle', category: 'FITSOC', participants: 72, max: 100, delta: 22.0 },
  { id: 'evt-004', title: 'Campus Futsal Championship', category: 'OFFSIDE', participants: 32, max: 32, delta: 18.4 },
  { id: 'evt-005', title: 'Table Tennis Doubles Flash Cup', category: 'LEAGUES', participants: 12, max: 16, delta: 5.1 },
]

// Fallback Leaderboard
const FALLBACK_LEADERBOARD = [
  { rank: 1, name: 'Aarav Sharma', domain: 'Sports / Striker', points: 3450, deltaRank: 1 },
  { rank: 2, name: 'Ananya Roy', domain: 'BGEC / Valorant', points: 3120, deltaRank: 0 },
  { rank: 3, name: 'Vikram Malhotra', domain: 'FitSoc / Athletics', points: 2980, deltaRank: -1 },
  { rank: 4, name: 'Priya Sharma', domain: 'FitSoc / 5K Run', points: 2750, deltaRank: 2 },
  { rank: 5, name: 'Kabir Sen', domain: 'BGEC / Duelist', points: 2540, deltaRank: 0 },
]

// Sports & Esports Disciplines
const DISCIPLINE_MIX: ShareBarItem[] = [
  { label: 'BGEC Esports', value: '42%', percentage: 42, color: '#f97316' },
  { label: 'Campus Football / Futsal', value: '28%', percentage: 28, color: '#f97316' },
  { label: 'Basketball & Hoops', value: '16%', percentage: 16, color: '#f97316' },
  { label: 'Badminton & Rackets', value: '9%', percentage: 9, color: '#f97316' },
  { label: 'FitSoc Endurance', value: '5%', percentage: 5, color: '#f97316' },
]

// Member Community Roles
const COMMUNITY_ROLES: ShareBarItem[] = [
  { label: 'Registered Athletes', value: '68%', percentage: 68, color: '#f97316' },
  { label: 'Team Captains', value: '18%', percentage: 18, color: '#f97316' },
  { label: 'Referees & Officials', value: '9%', percentage: 9, color: '#f97316' },
  { label: 'Campus Coordinators', value: '5%', percentage: 5, color: '#f97316' },
]

// Tournament Match Bracket Formats
const BRACKET_FORMATS: ShareBarItem[] = [
  { label: 'Single Elimination', value: '52%', percentage: 52, color: '#f97316' },
  { label: 'Swiss System', value: '24%', percentage: 24, color: '#f97316' },
  { label: 'Round Robin League', value: '16%', percentage: 16, color: '#f97316' },
  { label: 'Live Player Auction', value: '8%', percentage: 8, color: '#f97316' },
]

// Check-in Channels for Online Now
const CHECKIN_CHANNELS: ShareBarItem[] = [
  { label: 'Campus Mobile App', value: '65%', percentage: 65, color: '#f97316' },
  { label: 'Web Admin / Kiosk', value: '28%', percentage: 28, color: '#f97316' },
  { label: 'Discord Bot & QR Gate', value: '7%', percentage: 7, color: '#f97316' },
]

// Top Auction Draft Bids
const AUCTION_BIDS = [
  { athlete: 'Kabir Sen', team: 'Phoenix Squad', bid: 54000, role: 'Valorant Duelist' },
  { athlete: 'Aarav Sharma', team: 'Red Devils FC', bid: 48500, role: 'Futsal Striker' },
  { athlete: 'Ananya Roy', team: 'Shadow Ops', bid: 42000, role: 'BGMI IGL' },
  { athlete: 'Rohan Das', team: 'Smash Kings', bid: 36000, role: 'Badminton Singles' },
  { athlete: 'Priya Sharma', team: 'Thunderbolts', bid: 31500, role: 'Basketball Guard' },
]

// Platform Arena Infrastructure Telemetry
const PLATFORM_VITALS = [
  {
    label: 'API Gateway Latency',
    name: 'North-South Request Overhead',
    value: '14ms',
    delta: -4,
    deltaLabel: 'faster vs prior week',
    suffix: 'ms',
    reverseColor: true,
  },
  {
    label: 'Match Engine Uptime',
    name: 'Bracket & Tournament Coordinator',
    value: '99.98%',
    delta: 0.05,
    deltaLabel: 'SLA compliance',
    suffix: '%',
    reverseColor: false,
  },
  {
    label: 'Auction WebSocket Sync',
    name: 'Real-time Bid Propagation',
    value: '3.2ms',
    delta: -0.8,
    deltaLabel: 'sub-5ms live auction sync',
    suffix: 'ms',
    reverseColor: true,
  },
]

export const Dashboard: React.FC<DashboardViewProps> = ({ stats: initialStats }) => {
  const navigate = useNavigate()
  const [totalMembers, setTotalMembers] = useState<number>(1420)
  const [activeTournaments, setActiveTournaments] = useState<typeof FALLBACK_TOURNAMENTS>(FALLBACK_TOURNAMENTS)
  const [leaderboard, setLeaderboard] = useState<typeof FALLBACK_LEADERBOARD>(FALLBACK_LEADERBOARD)

  useEffect(() => {
    let ignore = false

    Promise.allSettled([
      userService.getUsers(),
      eventService.getEvents(),
      leaderboardService.getGlobalLeaderboard(),
    ]).then(([usersRes, eventsRes, leadersRes]) => {
      if (ignore) return

      if (usersRes.status === 'fulfilled' && usersRes.value.length > 0) {
        setTotalMembers(usersRes.value.length)
      }

      if (eventsRes.status === 'fulfilled' && eventsRes.value.length > 0) {
        const mapped = eventsRes.value.slice(0, 5).map((e: ClubEvent) => ({
          id: e.id,
          title: e.title,
          category: (e.category || 'LEAGUES').toUpperCase(),
          participants: e.currentParticipants || 16,
          max: e.maxParticipants || 32,
          delta: 8.5,
        }))
        setActiveTournaments(mapped)
      }

      if (leadersRes.status === 'fulfilled' && leadersRes.value.length > 0) {
        const mapped = leadersRes.value.slice(0, 5).map((l: LeaderboardEntry, idx: number) => ({
          rank: l.rank || idx + 1,
          name: l.name,
          domain: (l.domain || 'sports').toUpperCase(),
          points: l.points || 0,
          deltaRank: l.change || 0,
        }))
        setLeaderboard(mapped)
      }
    })

    return () => {
      ignore = true
    }
  }, [initialStats])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* ── 1. Hero Participation Chart (md:col-span-2 lg:col-span-3) ── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-6 md:col-span-2 lg:col-span-3 dark:bg-transparent flex flex-col justify-between">
        <div className="flex flex-row items-start justify-between mb-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {TOTAL_PARTICIPATION.toLocaleString()}
            </h2>
            <p className="text-xs text-muted-foreground">
              Total campus athlete registrations & tournament participations in the last 12 months.
            </p>
          </div>
          <DeltaBadge value={14.8} variant="badge" label="vs prior season" />
        </div>

        <div className="pt-2">
          <ActivityAreaChart data={PARTICIPATION_TREND} height={240} color="#f97316" />
        </div>
      </div>

      {/* ── 2. Live Presence (md:col-span-2 lg:col-span-1) ───────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 gap-0 pb-0 md:col-span-2 lg:col-span-1 dark:bg-transparent flex flex-col justify-between">
        <div className="flex flex-row items-start justify-between gap-3 border-b border-border p-6 pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
              128
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>athletes active now</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Live across tournament brackets & check-in gates.
            </p>
          </div>
          <DeltaBadge value={12.5} variant="badge" />
        </div>

        <div className="p-3">
          <ShareBarList items={CHECKIN_CHANNELS} barColor="#f97316" />
        </div>
      </div>

      {/* ── 3. Top Tournaments & Fixtures (md:col-span-2) ─────────────── */}
      <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden md:col-span-2 dark:bg-transparent">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
              Active Tournaments & Fixtures
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              {activeTournaments.length} fixtures
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Ranked by registered squad capacity and athlete enrollment.
          </p>
        </div>

        <div className="p-0 pb-12 overflow-x-auto">
          <table className="w-full text-left border-collapse border-t border-border">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 pl-6" scope="col">Tournament</th>
                <th className="py-2.5 text-end tabular-nums px-3" scope="col">Capacity</th>
                <th className="py-2.5 pr-6 text-end" scope="col">Trend</th>
              </tr>
            </thead>
            <tbody>
              {activeTournaments.map((row) => (
                <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="max-w-[220px] truncate py-3 pl-6 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-foreground shrink-0">
                        {row.category}
                      </span>
                      <span className="truncate text-xs text-foreground font-medium">
                        {row.title}
                      </span>
                    </div>
                  </td>
                  <td className="text-end text-muted-foreground text-xs tabular-nums px-3">
                    <span className="font-mono text-foreground">{row.participants}</span>
                    <span className="text-[11px] opacity-70"> / {row.max}</span>
                  </td>
                  <td className="pr-6 text-end text-muted-foreground text-xs">
                    <span className="tabular-nums font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      +{row.delta}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Efferd bottom mask overlay */}
        <div className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-center bg-gradient-to-t from-background dark:from-[#0d0d0d] via-background/80 dark:via-[#0d0d0d]/80 to-transparent">
          <button
            type="button"
            onClick={() => navigate('/tournaments')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-orange-500 transition-colors cursor-pointer"
          >
            <span>View All Tournaments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 4. Campus Leaderboard — Top Performers (md:col-span-2) ────── */}
      <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden md:col-span-2 dark:bg-transparent">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
              Campus Leaderboard — Top Performers
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              Top 5 Rank
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Top athletes & squad leads by seasonal circuit points.
          </p>
        </div>

        <div className="p-0 pb-12 overflow-x-auto">
          <table className="w-full text-left border-collapse border-t border-border">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 pl-6" scope="col">Athlete</th>
                <th className="py-2.5 text-end tabular-nums px-3" scope="col">Points</th>
                <th className="py-2.5 pr-6 text-end" scope="col">Rank Shift</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.name} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
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
                          {row.domain}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-end text-muted-foreground text-xs tabular-nums px-3 font-mono font-medium">
                    {row.points.toLocaleString()} pts
                  </td>
                  <td className="pr-6 text-end text-muted-foreground text-xs">
                    {row.deltaRank > 0 ? (
                      <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                        +{row.deltaRank}
                      </span>
                    ) : row.deltaRank < 0 ? (
                      <span className="tabular-nums font-medium text-rose-500 font-mono">
                        {row.deltaRank}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[11px] font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Efferd bottom mask overlay */}
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

      {/* ── 5. Athletic Disciplines (col-span-1) ─────────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 overflow-hidden dark:bg-transparent flex flex-col justify-between">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Athletic Disciplines
            </h3>
            <Trophy className="w-4 h-4 text-orange-500/80" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Session split by sports & esports divisions.
          </p>
        </div>
        <div className="p-2.5 py-2">
          <ShareBarList items={DISCIPLINE_MIX} barColor="#f97316" />
        </div>
      </div>

      {/* ── 6. Member Roles & Cohorts (col-span-1) ───────────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 overflow-hidden dark:bg-transparent flex flex-col justify-between">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Community Roles
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              {totalMembers}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Active campus member registry breakdown.
          </p>
        </div>
        <div className="p-2.5 py-2">
          <ShareBarList items={COMMUNITY_ROLES} barColor="#f97316" />
        </div>
      </div>

      {/* ── 7. Tournament Bracket Formats (col-span-1) ───────────────── */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs p-0 overflow-hidden dark:bg-transparent flex flex-col justify-between">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Tournament Formats
            </h3>
            <Zap className="w-4 h-4 text-orange-500/80" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Match bracket system distribution.
          </p>
        </div>
        <div className="p-2.5 py-2">
          <ShareBarList items={BRACKET_FORMATS} barColor="#f97316" />
        </div>
      </div>

      {/* ── 8. Live Auction Highlights (col-span-1) ──────────────────── */}
      <div className="relative rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden dark:bg-transparent flex flex-col justify-between">
        <div className="border-b border-border p-5 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm leading-none tracking-tight text-foreground">
              Live Auction Highlights
            </h3>
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Top valued athlete draft bids this season.
          </p>
        </div>

        <div className="p-0 pb-12 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2.5 pl-4" scope="col">Athlete & Squad</th>
                <th className="py-2.5 pr-4 text-end tabular-nums" scope="col">Bid (pts)</th>
              </tr>
            </thead>
            <tbody>
              {AUCTION_BIDS.map((bid) => (
                <tr key={bid.athlete} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="max-w-[140px] truncate py-2.5 pl-4">
                    <div className="text-xs font-medium text-foreground truncate">{bid.athlete}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{bid.team}</div>
                  </td>
                  <td className="pr-4 py-2.5 text-end">
                    <div className="font-mono font-bold text-xs text-orange-500 tabular-nums">
                      {bid.bid.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{bid.role}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Efferd bottom mask overlay */}
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

      {/* ── 9. Platform Arena Infrastructure Telemetry (4 columns) ──── */}
      <div className="md:col-span-2 lg:col-span-4 rounded-xl border border-border bg-card text-card-foreground shadow-xs dark:bg-transparent">
        <div className="border-b border-border p-6 pb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base leading-none tracking-tight text-foreground">
              Campus Platform Infrastructure
            </h3>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              All microservices operational
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time telemetry and API health measured across campus arena nodes.
          </p>
        </div>

        <div className="p-6">
          <ul className="grid gap-6 sm:grid-cols-3">
            {PLATFORM_VITALS.map((vital) => (
              <li className="flex flex-col gap-1" key={vital.label}>
                <p className="font-medium text-sm text-foreground">{vital.label}</p>
                <p className="text-xs text-muted-foreground">{vital.name}</p>
                <p className="font-mono font-bold text-2xl tabular-nums text-foreground mt-0.5">
                  {vital.value}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <DeltaBadge
                    value={vital.delta}
                    variant="inline"
                    suffix={vital.suffix}
                    precision={vital.suffix === '%' ? 2 : 0}
                    reverseColor={vital.reverseColor}
                  />
                  <span>{vital.deltaLabel}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
