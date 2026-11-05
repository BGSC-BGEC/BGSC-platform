import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Trophy,
  Gavel,
  Crown,
  ChevronRight,
  ArrowRight,
  Layers,
  Radio,
} from 'lucide-react'
import {
  CosmicStarfield,
  Glass,
  SparkleStar,
} from '@/components/ui/space-login'
import { DEFAULT_ASTRONAUT_IMAGE } from '@/assets/astronaut'
import { useAuthStore } from '@/stores/authStore'

export const Landing: React.FC = () => {
  const navigate = useNavigate()
  const { user, status } = useAuthStore()
  const isAuthenticated = status === 'authenticated' && !!user

  // Parallax tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX / innerWidth - 0.5) * 20;
    const y = (clientY / innerHeight - 0.5) * 20;
    setMousePos({ x, y });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen w-full bg-[#03060f] text-white overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200"
    >
      {/* 1. Dynamic Canvas Starfield Background */}
      <CosmicStarfield className="fixed inset-0" />

      {/* 2. Atmospheric Planetary Horizon Glow */}
      <div className="fixed -bottom-48 sm:-bottom-64 left-1/2 -translate-x-1/2 w-[160vw] max-w-[2000px] h-[550px] md:h-[650px] pointer-events-none z-0">
        <div
          className="w-full h-full rounded-[100%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 100%, rgba(249, 115, 22, 0.95) 0%, rgba(224, 102, 70, 0.75) 20%, rgba(67, 142, 145, 0.45) 45%, rgba(20, 48, 70, 0.2) 65%, transparent 80%)',
            filter: 'blur(36px)',
          }}
        />
        <div
          className="absolute inset-0 rounded-[100%] opacity-40 mix-blend-screen"
          style={{
            background:
              'radial-gradient(ellipse at 50% 100%, rgba(255, 180, 110, 0.65) 0%, rgba(94, 219, 210, 0.4) 30%, transparent 65%)',
            filter: 'blur(48px)',
          }}
        />
      </div>

      {/* 3. Floating Liquid Glass Navbar */}
      <header className="fixed top-4 sm:top-6 left-0 right-0 z-40 px-4 sm:px-8 max-w-6xl mx-auto">
        <Glass
          variant="subtle"
          borderRadius={24}
          className="w-full px-4 sm:px-6 py-3 border border-white/10 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
        >
          <div className="w-full flex items-center justify-between">
            {/* Logo */}
            <div
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 cursor-pointer group select-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-[0_0_18px_rgba(245,158,11,0.4)] group-hover:scale-105 transition-transform">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-white leading-none">
                  BGSC
                </span>
                <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-medium">
                  Campus Platform
                </span>
              </div>
            </div>

            {/* Nav Links (Desktop) */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-300">
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('tournaments')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Tournaments
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('auctions')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Live Auction
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('standings')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Leaderboard
              </button>
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Dashboard ({user.role})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-amber-400/50 text-white font-bold text-xs tracking-wide backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>Console Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                </button>
              )}
            </div>
          </div>
        </Glass>
      </header>

      {/* 4. Hero Section */}
      <section className="relative z-10 pt-36 sm:pt-44 pb-20 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col items-center text-center">
        {/* Floating Astronaut with Parallax and Pink Accent Star */}
        <motion.div
          animate={{
            x: mousePos.x * 1.6,
            y: mousePos.y * 1.6,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 60 }}
          className="hidden xl:block absolute right-2 top-28 pointer-events-none z-20"
        >
          <motion.div
            animate={{
              y: [-12, 14, -12],
              rotate: [-2, 3, -2],
            }}
            transition={{
              duration: 7.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="relative"
          >
            <img
              src={DEFAULT_ASTRONAUT_IMAGE}
              alt="Floating Astronaut"
              className="w-48 h-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)] filter contrast-125 select-none"
              draggable={false}
            />

            <motion.div
              animate={{
                scale: [0.85, 1.3, 0.85],
                opacity: [0.65, 1, 0.65],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute -right-2 top-1/2 -translate-y-1/2"
            >
              <SparkleStar className="w-6 h-6 text-[#ff4bb8] drop-shadow-[0_0_12px_#ff4bb8]" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Main Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.08] mb-6"
        >
          Every game on campus, <br />
          <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent drop-shadow-sm">
            in one universe.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-neutral-300 max-w-2xl font-medium leading-relaxed mb-9"
        >
          Register for collegiate championships, run live player auctions with real-time bidding, climb campus leaderboards, and carve your squad into the Hall of Fame.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-neutral-950 font-black text-sm tracking-wide shadow-[0_4px_30px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer group"
          >
            <span>Launch Admin Console</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('showcase')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 hover:text-white font-bold text-sm tracking-wide backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <span>Explore Live Previews</span>
          </button>
        </motion.div>

        {/* Quick Role Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-8 text-xs text-neutral-400 font-medium"
        >
          <span className="text-neutral-500">Fast Privileged Access:</span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
            Coordinators
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
            Founders
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
            Core Organizers
          </span>
        </motion.div>
      </section>

      {/* 5. Interactive Live Preview Cards Showcase */}
      <section id="showcase" className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Interactive Campus Ecosystem</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Designed for High-Stakes Competition
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-xl mx-auto">
            Experience the real-time systems powering inter-department sports, esports leagues, and live player draft auctions.
          </p>
        </div>

        {/* Grid of 3 Liquid Glass Interactive Mock Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Mock Card 1: Live Auction Room */}
          <Glass
            variant="default"
            borderRadius={20}
            className="p-5 flex flex-col justify-between border border-white/10 border-l-2 border-l-amber-500 !border-l-2 !border-l-amber-500 bg-black/40 backdrop-blur-xl shadow-xl transition-colors group"
            style={{ borderLeft: '2px solid #f59e0b' }}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Gavel className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Live Player Auction</h3>
                    <p className="text-[10px] text-amber-300/80">Lot #12 &bull; Striker Draft</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold tracking-wider uppercase">
                  SOLD
                </span>
              </div>

              {/* Player Profile & Sold Details */}
              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 mb-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-neutral-200">Aarav Sharma</span>
                  <span className="font-mono text-amber-400 font-bold text-sm">48,500 pts</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Dept of Comp Science</span>
                  <span className="text-emerald-400 font-medium">Sold to: Phoenix Strikers</span>
                </div>
              </div>

              {/* Team Purse & Squad context */}
              <div className="flex items-center justify-between text-xs text-neutral-300 p-2.5 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">Winning Team:</span>
                  <strong className="text-white font-semibold">Phoenix Strikers</strong>
                </div>
                <div>Purse: <strong className="text-emerald-400 font-mono">51,500 pts</strong></div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Next: <strong className="text-white">Lot #13 (Defender)</strong></span>
              <span className="text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Explore Auction <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Glass>

          {/* Mock Card 2: Tournament Bracket Finals */}
          <Glass
            variant="default"
            borderRadius={20}
            className="p-5 flex flex-col justify-between border border-white/10 border-l-2 border-l-cyan-500 !border-l-2 !border-l-cyan-500 bg-black/40 backdrop-blur-xl shadow-xl transition-colors group"
            style={{ borderLeft: '2px solid #06b6d4' }}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Championship Bracket</h3>
                    <p className="text-[10px] text-cyan-300/80">Valorant Inter-Dept Finals</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold tracking-wider">
                  GRAND FINALS
                </span>
              </div>

              {/* Matchup scores */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-cyan-500/30">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-cyan-500/30 text-cyan-300 font-bold text-[11px] flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-white">Titan Sparks (CS)</span>
                  </div>
                  <span className="font-mono font-black text-cyan-400 text-sm">13</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-white/10 text-neutral-400 font-bold text-[11px] flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-semibold text-neutral-300">Iron Vipers (Mech)</span>
                  </div>
                  <span className="font-mono font-bold text-neutral-400 text-sm">11</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>Map: Ascent (Decider)</span>
                <span className="text-cyan-300 font-semibold">Match Point Titan</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Double Elimination</span>
              <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View Brackets <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Glass>

          {/* Mock Card 3: Leaderboard & Hall of Fame */}
          <Glass
            variant="default"
            borderRadius={20}
            className="p-5 flex flex-col justify-between border border-white/10 border-l-2 border-l-violet-500 !border-l-2 !border-l-violet-500 bg-black/40 backdrop-blur-xl shadow-xl transition-colors group"
            style={{ borderLeft: '2px solid #8b5cf6' }}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Season Leaderboard</h3>
                    <p className="text-[10px] text-violet-300/80">MVP Race & Standings</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40 text-[10px] font-bold tracking-wider">
                  TOP 3
                </span>
              </div>

              {/* 3 Ranked Rows with names and scores */}
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.04] border border-violet-500/20">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded flex items-center justify-center bg-amber-400/20 text-amber-300 font-black text-[10px]">
                      #1
                    </span>
                    <span className="font-semibold text-white">Rohan K. (Comp Sci)</span>
                  </div>
                  <span className="font-mono text-white font-bold">2,450 pts</span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded flex items-center justify-center bg-slate-300/20 text-slate-300 font-black text-[10px]">
                      #2
                    </span>
                    <span className="text-neutral-200">Sneha P. (Mechanical)</span>
                  </div>
                  <span className="font-mono text-neutral-300 font-semibold">2,180 pts</span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded flex items-center justify-center bg-amber-700/20 text-amber-500 font-black text-[10px]">
                      #3
                    </span>
                    <span className="text-neutral-200">Aditya N. (Electronics)</span>
                  </div>
                  <span className="font-mono text-neutral-300 font-semibold">1,940 pts</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Season 2026 &bull; 48 Athletes</span>
              <span className="text-violet-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Hall of Fame <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Glass>
        </div>
      </section>

      {/* 6. Core Pillars Feature Grid */}
      <section id="features" className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Left-aligned, smaller heading and narrative */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              Engineered for Campus Esports & Athletics
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Everything your collegiate council needs to orchestrate seamless competitions, from squad draft day to grand final trophies.
            </p>
          </div>

          {/* Right Column: Tight 4-card 2x2 grid */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Feature 1: Auctions */}
            <Glass
              variant="subtle"
              borderRadius={16}
              className="p-5 flex flex-col border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3.5">
                <Gavel className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">Live Player Auctions</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Run real-time bidding rooms where captains manage team purses, place counter-bids, and draft rosters under rapid countdown timers.
              </p>
            </Glass>

            {/* Feature 2: Brackets */}
            <Glass
              variant="subtle"
              borderRadius={16}
              className="p-5 flex flex-col border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-3.5">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">Tournament Brackets</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Automated single-elimination, double-elimination, and round-robin brackets with live scoring and automatic advancement.
              </p>
            </Glass>

            {/* Feature 3: Leaderboards */}
            <Glass
              variant="subtle"
              borderRadius={16}
              className="p-5 flex flex-col border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 mb-3.5">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">Real-Time Leaderboard</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Track department standings, individual athlete stats, and season points automatically updated following verified match results.
              </p>
            </Glass>

            {/* Feature 4: Hall of Fame */}
            <Glass
              variant="subtle"
              borderRadius={16}
              className="p-5 flex flex-col border border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 mb-3.5">
                <Crown className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">Hall of Fame Legacy</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Immortalize collegiate champions, record-breaking captains, and standout MVP athletes with permanent campus accolades and awards.
              </p>
            </Glass>
          </div>
        </div>
      </section>

      {/* 7. Institutional Impact Counter */}
      <section className="relative z-10 py-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <Glass
          variant="default"
          borderRadius={24}
          className="p-8 border border-white/15 bg-black/50 backdrop-blur-2xl shadow-2xl"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 text-center">
            <div className="px-4 py-2 border-r border-white/10 border-b md:border-b-0 pb-4 md:pb-2">
              <div className="text-xs text-white/50 font-medium mb-1.5">Tournaments</div>
              <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">12+</div>
            </div>
            <div className="px-4 py-2 md:border-r md:border-white/10 border-b md:border-b-0 pb-4 md:pb-2">
              <div className="text-xs text-white/50 font-medium mb-1.5">Athletes</div>
              <div className="text-3xl sm:text-4xl font-black text-orange-400 font-mono">500+</div>
            </div>
            <div className="px-4 py-2 border-r border-white/10 pt-4 md:pt-2">
              <div className="text-xs text-white/50 font-medium mb-1.5">Draft Points</div>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono">₹250K+</div>
            </div>
            <div className="px-4 py-2 pt-4 md:pt-2">
              <div className="text-xs text-white/50 font-medium mb-1.5">Active Teams</div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">18</div>
            </div>
          </div>
        </Glass>
      </section>

      {/* 8. Call to Action Banner */}
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <Glass
          variant="bold"
          borderRadius={24}
          className="p-8 sm:p-10 border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-black/60 to-black/90 backdrop-blur-xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 text-left">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                Ready to Coordinate Your Next Championship?
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                Supervise registrations, run real-time player draft auctions, and advance tournament brackets.
              </p>
            </div>

            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-neutral-950 font-black text-sm tracking-wide shadow-[0_4px_30px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer group whitespace-nowrap"
              >
                <span>Launch Admin Console</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </Glass>
      </section>

      {/* 9. Cosmic Liquid Glass Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-xl pt-10 pb-8 px-4 sm:px-8 mt-12">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top row: Logo on left, links and status on right */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white tracking-tight">BGSC Platform</span>
                <span className="text-neutral-500 text-xs ml-2">Collegiate Sports & Esports OS</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-neutral-400 font-medium">
              <button
                type="button"
                onClick={() => scrollToSection('showcase')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Auctions & Brackets
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Admin Sign In
              </button>
              <div className="flex items-center gap-2 text-neutral-500 pl-2 border-l border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[11px]">Systems Operational</span>
              </div>
            </div>
          </div>

          {/* Bottom row: Hairline separator, copyright, and season info */}
          <div className="border-t border-white/8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
            <div>&copy; 2025 BGSC &bull; BGEC</div>
            <div>Season 2026</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
