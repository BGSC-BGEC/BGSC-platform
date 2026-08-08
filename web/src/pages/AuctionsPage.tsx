import React, { useState } from 'react';
import {
  Gavel,
  Clock,
  Wifi,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Coins,
  Shield,
  User,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { formatPoints } from '../utils/formatters';
import { CaptainWallet, AuctionBidEvent, AuctionPlayer, AcquiredPlayer } from '../types/admin';

export const AuctionsPage: React.FC = () => {
  const {
    auctionPlayers,
    activePlayerIndex,
    captainWallets,
    bidHistory,
    auctionCountdown,
    auctionStatus,
    webSocketLatency,
    toggleAuctionPause,
    placeBid,
    sellCurrentPlayer,
    passCurrentPlayer,
    nextAuctionPlayer,
    prevAuctionPlayer,
  } = useAdmin();

  const [selectedCaptainForBid, setSelectedCaptainForBid] = useState<string>(
    captainWallets[0]?.id || ''
  );

  const activePlayer = auctionPlayers[activePlayerIndex];

  // Helper for quick bid steps
  const handleStepBid = (increment: number) => {
    if (!activePlayer || !selectedCaptainForBid) return;
    const targetBid = activePlayer.currentBid + increment;
    placeBid(selectedCaptainForBid, targetBid, true);
  };

  return (
    <div className="space-y-4">
      {/* Top Controller Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <Gavel className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100">Live Auction Hub & Controller</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live WebSocket
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Sub-100ms real-time auction bidding console with automated hammer clock, captain wallets, and sound synthesis.
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* WebSocket Latency */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Latency:</span>
            <span className="text-emerald-400 font-bold">{webSocketLatency}ms</span>
          </div>
        </div>
      </div>

      {/* Main Auction Floor Grid: Hero (5 cols), Live Bid Log (3 cols), Team Wallets (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Panel 1 (Left 5 cols): Active Player on Block & Operator Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Player Hero Card */}
          {activePlayer && (
            <div className="rounded-2xl bg-linear-to-b from-slate-800 to-slate-850 border border-slate-700 p-5 shadow-2xl space-y-4 relative overflow-hidden">
              {/* Header: Player Index Navigation */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Player {activePlayerIndex + 1} of {auctionPlayers.length} on Block
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevAuctionPlayer}
                    disabled={activePlayerIndex === 0}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextAuctionPlayer}
                    disabled={activePlayerIndex === auctionPlayers.length - 1}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Player Visual & Profile */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  <img
                    src={activePlayer.avatar}
                    alt={activePlayer.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-teal-500/50 shadow-xl"
                  />
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] shadow-md">
                    {activePlayer.tier}
                  </span>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-100 truncate">
                      {activePlayer.name}
                    </h2>
                    <span className="px-1.5 py-0.5 rounded bg-slate-700 text-teal-300 font-mono text-[11px] font-bold shrink-0">
                      {activePlayer.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    {activePlayer.handle} · Base: {formatPoints(activePlayer.basePrice)}
                  </div>

                  <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-[11px] font-mono text-slate-400">Status:</span>
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                      activePlayer.status === 'sold'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : activePlayer.status === 'on_block'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 animate-pulse'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {activePlayer.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5-Second Countdown Timer & Highest Bid Banner */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Left: Clock */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-mono font-black text-xl transition-all ${
                      auctionCountdown <= 2.0 && auctionStatus === 'live'
                        ? 'bg-red-950 text-red-400 border-red-500 animate-pulse'
                        : 'bg-teal-950/60 text-teal-300 border-teal-500/40'
                    }`}
                  >
                    <span>{auctionCountdown.toFixed(1)}</span>
                    <span className="text-[8px] text-slate-400 font-normal -mt-1">SEC</span>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Hammer Clock
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Resets on each bid
                    </div>
                  </div>
                </div>

                {/* Right: High Bidder */}
                <div className="p-2.5 rounded-lg bg-slate-850 border border-slate-700 text-right min-w-0">
                  <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">
                    Highest Bid
                  </div>
                  <div className="text-xl font-black font-mono text-teal-400">
                    {formatPoints(activePlayer.currentBid)}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate font-medium">
                    {activePlayer.highBidderCaptainName || 'No bids yet'}
                  </div>
                </div>
              </div>

              {/* Operator Action Buttons (Sold, Pass, Pause) */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Pause/Resume Toggle */}
                <button
                  onClick={toggleAuctionPause}
                  className="py-2 px-2 rounded-xl bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {auctionStatus === 'live' ? (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Resume</span>
                    </>
                  )}
                </button>

                {/* Pass / Unsold */}
                <button
                  onClick={passCurrentPlayer}
                  className="py-2 px-2 rounded-xl bg-slate-750 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <span>Pass / Unsold</span>
                </button>

                {/* SOLD! Confetti Gavel Strike */}
                <button
                  onClick={sellCurrentPlayer}
                  className="py-2 px-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold shadow-lg shadow-teal-900/40 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Gavel className="w-3.5 h-3.5" />
                  <span>SOLD!</span>
                </button>
              </div>
            </div>
          )}

          {/* Manual Bid Intervention Panel */}
          <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-teal-400" />
                <span>Manual Operator Dispatcher</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">Step increments</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              {/* Select Captain */}
              <div className="sm:col-span-5">
                <select
                  value={selectedCaptainForBid}
                  onChange={(e) => setSelectedCaptainForBid(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-teal-500 focus:outline-hidden font-medium"
                >
                  {captainWallets.map((c: CaptainWallet) => (
                    <option key={c.id} value={c.id}>
                      {c.teamName} ({formatPoints(c.walletBalance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Stepper Increments */}
              <div className="sm:col-span-7 flex items-center gap-1.5">
                {[10, 25, 50, 100].map((step) => (
                  <button
                    key={step}
                    onClick={() => handleStepBid(step)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-teal-300 font-mono text-xs font-bold border border-slate-600 transition-colors"
                  >
                    +{step}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2 (Center 3 cols): Live Bid Event Log */}
        <div className="lg:col-span-3 rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3 shadow-xl h-[520px] flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-400" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Live Bids
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Stream</span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {bidHistory.map((bid: AuctionBidEvent, idx: number) => (
              <div
                key={bid.id}
                className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  idx === 0
                    ? 'bg-teal-950/50 border-teal-500/60 shadow-inner'
                    : 'bg-slate-900/60 border-slate-700/60'
                }`}
              >
                <div className="min-w-0 pr-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-200 truncate text-[11px]">{bid.teamName}</span>
                    {bid.isManualOverride && (
                      <span className="px-1 py-0.2 rounded bg-sky-950 text-sky-300 font-mono text-[8px] border border-sky-800 shrink-0">
                        Manual
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                    {bid.captainName} · {bid.timestamp}
                  </div>
                </div>
                <span className="font-mono font-extrabold text-teal-400 text-xs shrink-0">
                  {formatPoints(bid.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 3 (Right 4 cols): Team Wallets & Rosters */}
        <div className="lg:col-span-4 rounded-2xl bg-slate-800 border border-slate-700 p-4 space-y-3 shadow-xl h-[520px] flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Team Wallets & Rosters
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {captainWallets.length} Teams
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {captainWallets.map((wallet: CaptainWallet) => (
              <div
                key={wallet.id}
                className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 truncate pr-2">{wallet.teamName}</span>
                  <span className="font-mono font-extrabold text-teal-300 shrink-0">
                    {formatPoints(wallet.walletBalance)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span className="truncate">Capt: {wallet.name}</span>
                  <span className="text-slate-300 shrink-0">
                    Roster: {wallet.rosterCount} / {wallet.rosterMax}
                  </span>
                </div>

                {/* Acquired Players Badges */}
                {wallet.acquiredPlayers.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {wallet.acquiredPlayers.map((p: AcquiredPlayer) => (
                      <span
                        key={p.id}
                        className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-mono"
                      >
                        {p.name} ({formatPoints(p.price)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
