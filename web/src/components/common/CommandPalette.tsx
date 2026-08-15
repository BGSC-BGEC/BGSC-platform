import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Trophy,
  Users,
  Gavel,
  Sliders,
  TrendingUp,
  TicketCheck,
  ShieldAlert,
  Radio,
  Settings,
  ArrowRight,
  User,
  Ticket as TicketIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { NavigationTab } from '../../types/admin';

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    matches,
    captains,
    tickets,
    auctionPlayers,
    setSelectedCaptainId,
    setSelectedTicketId,
    toggleSidebar,
    saveBracketState,
    saveScoringRules,
    toggleAuctionPause,
  } = useAdmin();

  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const q = query.toLowerCase().trim();

  // Filter items
  const pages: { id: NavigationTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard & Overview', icon: Trophy },
    { id: 'tournaments', label: 'Tournaments & Brackets', icon: Trophy },
    { id: 'bracket', label: 'Offside S3 — Championship Bracket', icon: Trophy },
    { id: 'captains', label: 'Captain Requests & Vetting Queue', icon: Users },
    { id: 'auctions', label: 'Live Auction Controller & Bid Stream', icon: Gavel },
    { id: 'scoring', label: 'Scoring Engine & Multipliers Configurator', icon: Sliders },
    { id: 'investments', label: 'Points Investment Manager', icon: TrendingUp },
    { id: 'tickets', label: 'Feedback Ticket Resolution Queue', icon: TicketCheck },
    { id: 'moderation', label: 'Community Safety & Moderation Queue', icon: ShieldAlert },
    { id: 'broadcasts', label: 'System Broadcast Engine', icon: Radio },
    { id: 'settings', label: 'System Settings & 3/7ths Policy', icon: Settings },
  ];

  const matchedPages = pages.filter((p) => p.label.toLowerCase().includes(q));

  const matchedTickets = tickets.filter(
    (t) =>
      t.id.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
  );

  const matchedCaptains = captains.filter(
    (c) =>
      c.applicantName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.league.toLowerCase().includes(q)
  );

  const matchedMatches = matches.filter(
    (m) =>
      m.id.toLowerCase().includes(q) ||
      m.team1.name.toLowerCase().includes(q) ||
      m.team2.name.toLowerCase().includes(q) ||
      m.pitch.toLowerCase().includes(q)
  );

  const matchedPlayers = auctionPlayers.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.handle.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex justify-center items-start">
      {/* Backdrop */}
      <div
        onClick={() => setCommandPaletteOpen(false)}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl transform divide-y divide-slate-700 overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150">
        <div className="relative flex items-center px-4 py-3 bg-slate-800/90">
          <Search className="w-5 h-5 text-teal-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tickets, matches, players, or navigate..."
            className="h-9 w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-hidden"
          />
          <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-600">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          {!q && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                Quick Shortcuts
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    toggleAuctionPause();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-teal-400" />
                    <span>Toggle Auction Live Countdown (Space)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => {
                    toggleSidebar();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-sky-400" />
                    <span>Toggle Collapsible Sidebar (⌘B)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
                <button
                  onClick={() => {
                    saveBracketState();
                    setCommandPaletteOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Save Bracket Topology State (⌘S)</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation Pages */}
          {matchedPages.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                Navigation
              </div>
              <div className="space-y-0.5">
                {matchedPages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.id}
                      onClick={() => {
                        navigate('/' + page.id);
                        setCommandPaletteOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-teal-300 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-teal-400" />
                        <span>{page.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Go to tab</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tickets */}
          {matchedTickets.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                Tickets ({matchedTickets.length})
              </div>
              <div className="space-y-0.5">
                {matchedTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      navigate('/tickets');
                      setSelectedTicketId(ticket.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <TicketIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-mono text-teal-400 font-semibold">{ticket.id}</span>
                      <span className="text-slate-300 truncate">{ticket.description}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 ml-2 shrink-0">
                      {ticket.severity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Captains */}
          {matchedCaptains.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                Captain Applicants ({matchedCaptains.length})
              </div>
              <div className="space-y-0.5">
                {matchedCaptains.map((captain) => (
                  <button
                    key={captain.id}
                    onClick={() => {
                      navigate('/captains');
                      setSelectedCaptainId(captain.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-sky-400" />
                      <span className="font-medium text-slate-200">{captain.applicantName}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{captain.handle}</span>
                    </div>
                    <span className="text-[10px] text-teal-400 font-mono">{captain.league}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matches */}
          {matchedMatches.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                Bracket Matches ({matchedMatches.length})
              </div>
              <div className="space-y-0.5">
                {matchedMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      navigate('/bracket');
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-teal-400 font-bold">{m.id}</span>
                      <span>
                        {m.team1.name} vs {m.team2.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {m.pitch} · {m.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auction Players */}
          {matchedPlayers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase text-slate-400 tracking-wider">
                Auction Roster ({matchedPlayers.length})
              </div>
              <div className="space-y-0.5">
                {matchedPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      navigate('/auctions');
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-medium">{p.name}</span>
                      <span className="text-slate-400 text-[11px] font-mono">{p.role}</span>
                    </div>
                    <span className="font-mono text-teal-400">{p.basePrice} pts</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-800/80 px-4 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">↓</kbd> to
              navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">↵</kbd> to
              select
            </span>
          </div>
          <span className="font-mono text-teal-400">BGSC Command Engine</span>
        </div>
      </div>
    </div>
  );
};
