import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Users,
  Gavel,
  Sliders,
  TrendingUp,
  TicketCheck,
  ShieldAlert,
  Radio,
  Activity,
  AlertCircle,
  Clock,
  Play,
  Flame,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { formatNumber, formatPoints } from '../utils/formatters';
import { CaptainApplication, Ticket, ModerationItem, InvestmentEvent, AuditLogEntry } from '../types/admin';

export const DashboardPage: React.FC = () => {
  const {
    captains,
    tickets,
    moderationItems,
    investments,
    auctionPlayers,
    activePlayerIndex,
    auctionStatus,
    auctionCountdown,
    auditLogs,
    setSelectedCaptainId,
    setSelectedTicketId,
  } = useAdmin();

  const navigate = useNavigate();

  const activeAuctionPlayer = auctionPlayers[activePlayerIndex];
  const pendingCaptains = captains.filter((c: CaptainApplication) => c.status === 'Pending');
  const criticalTickets = tickets.filter((t: Ticket) => t.severity === 'Critical' && t.status !== 'Closed');
  const pendingModerations = moderationItems.filter((m: ModerationItem) => m.status === 'pending');
  const totalPool = investments.reduce((sum: number, inv: InvestmentEvent) => sum + inv.poolInvested, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-6 rounded-2xl bg-linear-to-r from-slate-800 via-slate-800/90 to-teal-950/40 border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-mono font-semibold uppercase tracking-wider">
              Control Hub v2.4.0
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> All Systems Nominal
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-50 tracking-tight">
            Master Event, League & Rule Engine
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Real-time control center for Offside S3 Championship, live player auctions, scoring rule matrices, and community governance.
          </p>
        </div>

        {/* Live Auction Quick Card */}
        <div
          onClick={() => navigate('/auctions')}
          className="z-10 flex items-center gap-4 p-3.5 rounded-xl bg-slate-900/80 border border-teal-500/40 shadow-lg hover:border-teal-400 transition-all cursor-pointer group shrink-0"
        >
          <div className="w-12 h-12 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
            <Gavel className="w-6 h-6 text-teal-400 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">Live Auction</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                {auctionStatus === 'live' ? `${auctionCountdown}s` : auctionStatus}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-200 truncate mt-0.5">
              {activeAuctionPlayer ? `${activeAuctionPlayer.name} (${activeAuctionPlayer.role})` : 'Auction Active'}
            </div>
            <div className="text-[11px] text-teal-400 font-mono font-medium">
              Current: {formatPoints(activeAuctionPlayer?.currentBid || 0)} ──▶
            </div>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Stat 1: Tournaments */}
        <div
          onClick={() => navigate('/bracket')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Tournaments</span>
            <Trophy className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-50 font-mono">3</span>
            <span className="text-[11px] text-emerald-400 font-medium">1 Live Match</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">Offside S3 in progress</div>
        </div>

        {/* Stat 2: Captains */}
        <div
          onClick={() => navigate('/captains')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Captain Apps</span>
            <Users className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-50 font-mono">{captains.length}</span>
            <span className="text-[11px] text-amber-400 font-medium">{pendingCaptains.length} Pending</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">1 High dev alert (+45%)</div>
        </div>

        {/* Stat 3: Live Auction */}
        <div
          onClick={() => navigate('/auctions')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Live Auction</span>
            <Gavel className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-50 font-mono">5</span>
            <span className="text-[11px] text-emerald-400 font-medium">Sub-100ms</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">Tier S Goalkeeper on block</div>
        </div>

        {/* Stat 4: Tickets */}
        <div
          onClick={() => navigate('/tickets')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Open Tickets</span>
            <TicketCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-50 font-mono">{tickets.length}</span>
            <span className="text-[11px] text-red-400 font-medium">{criticalTickets.length} Critical</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">Score dispute in #M102</div>
        </div>

        {/* Stat 5: Moderation */}
        <div
          onClick={() => navigate('/moderation')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Safety Queue</span>
            <ShieldAlert className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-50 font-mono">{moderationItems.length}</span>
            <span className="text-[11px] text-amber-400 font-medium">{pendingModerations.length} Pending</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">Chat harassment report</div>
        </div>

        {/* Stat 6: Investment Pool */}
        <div
          onClick={() => navigate('/investments')}
          className="p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-teal-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Invested Pool</span>
            <TrendingUp className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-50 font-mono">{formatNumber(totalPool)}</span>
            <span className="text-[10px] text-slate-400 font-mono">pts</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 truncate">+18.4% this week</div>
        </div>
      </div>

      {/* Main Grid: Operational Queue & Live Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Operational Action Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              <h2 className="text-base font-semibold text-slate-100">Operational Priority Queue</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">3 Actions Pending</span>
          </div>

          <div className="space-y-3">
            {/* Action 1: Critical Ticket */}
            <div className="p-4 rounded-xl bg-slate-800/90 border border-red-500/30 hover:border-red-500/50 transition-all shadow-md flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-red-500/20 text-red-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-red-400 font-bold text-xs">#TICK-10492</span>
                    <span className="px-1.5 py-0.2 rounded bg-red-950 text-red-300 font-mono text-[10px] font-bold border border-red-800">
                      CRITICAL
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1">
                    Match Score Discrepancy — Vikram Malhotra
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Match #M102 scorecard omitted 1 assist credit for Vikram in the second half.
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  navigate('/tickets');
                  setSelectedTicketId('#TICK-10492');
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shrink-0 transition-colors"
              >
                Resolve
              </button>
            </div>

            {/* Action 2: Captain Deviation Alert */}
            <div className="p-4 rounded-xl bg-slate-800/90 border border-amber-500/30 hover:border-amber-500/50 transition-all shadow-md flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-xs">Devansh Joshi (@dev_joshi)</span>
                    <span className="px-1.5 py-0.2 rounded bg-red-950 text-red-400 font-mono text-[10px] font-bold border border-red-800">
                      +45% High Dev!
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    Requested 900 pts base price (Market baseline: 620 pts).
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Airball S1 · 2 / 5 Roster members signed
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  navigate('/captains');
                  setSelectedCaptainId('CAP-003');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold shrink-0 transition-colors"
              >
                Review
              </button>
            </div>

            {/* Action 3: Live Match Scoring */}
            <div className="p-4 rounded-xl bg-slate-800/90 border border-teal-500/30 hover:border-teal-500/50 transition-all shadow-md flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400 shrink-0">
                  <Play className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-teal-400 font-bold text-xs">#M201 · Pitch A</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-800">
                      LIVE MATCH
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-100 mt-1">
                    Titans (1) vs Phantoms (1) — Semi-Finals
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Score currently tied in second half. Winner advances to #M301 Finals.
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/bracket')}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shrink-0 transition-colors"
              >
                Manage Bracket
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Activity & Immutable Audit Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-semibold text-slate-100">Live Activity Feed</h2>
            </div>
            <span className="text-xs text-teal-400 font-mono">Immutable Stream</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3.5 max-h-[380px] overflow-y-auto">
            {auditLogs.slice(0, 5).map((log: AuditLogEntry) => (
              <div key={log.id} className="text-xs border-b border-slate-700/60 pb-3 last:border-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-teal-400 font-semibold">{log.id}</span>
                    <span className="text-slate-400">· {log.actorName}</span>
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-700 text-slate-300">
                      [{log.actorRole}]
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{log.timestamp.split(' ')[1]}</span>
                </div>
                <div className="text-slate-200 font-medium">{log.details}</div>
                {log.reason && (
                  <div className="text-[10px] text-slate-400 italic">"{log.reason}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fast Navigation Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-400">
          Domain Management Consoles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/bracket')}
            className="p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-teal-500/40 text-left transition-all group"
          >
            <Trophy className="w-5 h-5 text-teal-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-teal-300">Bracket Manager</div>
            <div className="text-xs text-slate-400 mt-0.5">Vector progression lines & rules</div>
          </button>

          <button
            onClick={() => navigate('/auctions')}
            className="p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-teal-500/40 text-left transition-all group"
          >
            <Gavel className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-emerald-300">Live Auction Hub</div>
            <div className="text-xs text-slate-400 mt-0.5">Sub-100ms operator stream & timer</div>
          </button>

          <button
            onClick={() => navigate('/scoring')}
            className="p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-teal-500/40 text-left transition-all group"
          >
            <Sliders className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-amber-300">Scoring Engine</div>
            <div className="text-xs text-slate-400 mt-0.5">Multipliers & sport base formulas</div>
          </button>

          <button
            onClick={() => navigate('/broadcasts')}
            className="p-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-teal-500/40 text-left transition-all group"
          >
            <Radio className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-semibold text-slate-100 group-hover:text-sky-300">Broadcast Composer</div>
            <div className="text-xs text-slate-400 mt-0.5">16:9 uploader & push notifications</div>
          </button>
        </div>
      </div>
    </div>
  );
};
