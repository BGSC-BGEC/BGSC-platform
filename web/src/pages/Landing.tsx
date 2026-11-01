import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Trophy,
  Sparkles,
  Gavel,
  Crown,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Layers,
  Radio,
  Timer,
} from 'lucide-react'
import {
  CosmicStarfield,
  Glass,
  SparkleStar,
} from '@/components/ui/space-login'
import { LiquidNavbar, NimbusIcons } from '@/components/ui/liquid-navbar'
import { DEFAULT_ASTRONAUT_IMAGE } from '@/assets/astronaut'
import { useAuthStore } from '@/stores/authStore'

export const Landing: React.FC = () => {
  const navigate = useNavigate()
  const { user, status } = useAuthStore()
  const isAuthenticated = status === 'authenticated' && !!user

  // Bottom navbar state
  const [activeNav, setActiveNav] = useState(0)

  const landingNavItems = [
    { label: 'Home', icon: NimbusIcons.home, fx: 'glow' as const },
    { label: 'Flights', icon: NimbusIcons.flights, fx: 'plane' as const },
    { label: 'Status', icon: NimbusIcons.status, fx: 'drop' as const },
    { label: 'Profile', icon: NimbusIcons.profile, fx: 'wave' as const },
  ]

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

        {/* Top Cosmic Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-transparent border border-amber-500/30 text-amber-300 text-xs font-semibold mb-6 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>The Official BGSC Campus Gaming & Sports Network</span>
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
            className="p-5 flex flex-col justify-between border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl hover:border-amber-500/40 transition-colors group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Gavel className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Live Player Auction</h3>
                    <p className="text-[10px] text-amber-300/80">Lot #14 &bull; Striker Draft</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  Live Bid
                </span>
              </div>

              {/* Player Profile & Bid pulse */}
              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-neutral-200">Aarav Sharma</span>
                  <span className="font-mono text-amber-400 font-bold text-sm">42,500 Pts</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Dept of Comp Science</span>
                  <span>Leading: Titans FC</span>
                </div>
              </div>

              {/* Countdown & Purse */}
              <div className="flex items-center justify-between text-xs text-neutral-300 p-2.5 rounded-lg bg-black/30 border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clock: <strong className="text-white font-mono">00:12s</strong></span>
                </div>
                <div>Purse: <strong className="text-emerald-400 font-mono">157,500 Pts</strong></div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Captains in Draft: <strong className="text-white">8/8</strong></span>
              <span className="text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Explore Auction <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Glass>

          {/* Mock Card 2: Tournament Bracket Finals */}
          <Glass
            variant="default"
            borderRadius={20}
            className="p-5 flex flex-col justify-between border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl hover:border-amber-500/40 transition-colors group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Championship Bracket</h3>
                    <p className="text-[10px] text-orange-300/80">Valorant Inter-Dept Finals</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  Match 3
                </span>
              </div>

              {/* Matchup scores */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-white">Titan Sparks (CS)</span>
                  </div>
                  <span className="font-mono font-black text-amber-400 text-sm">13</span>
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
                <span className="text-amber-300 font-semibold">Match Point Titan</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Double Elimination</span>
              <span className="text-orange-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                View Brackets <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Glass>

          {/* Mock Card 3: Leaderboard & Hall of Fame */}
          <Glass
            variant="default"
            borderRadius={20}
            className="p-5 flex flex-col justify-between border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl hover:border-amber-500/40 transition-colors group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Season Leaderboard</h3>
                    <p className="text-[10px] text-yellow-300/80">MVP Race & Standings</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  Top 3
                </span>
              </div>

              {/* Ranks list */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 font-black">#1</span>
                    <span className="font-semibold text-white">Rohan K. (ECE)</span>
                  </div>
                  <span className="font-mono text-yellow-300 font-bold">2,450 XP</span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 font-bold">#2</span>
                    <span className="text-neutral-200">Sneha P. (Civil)</span>
                  </div>
                  <span className="font-mono text-neutral-300 font-semibold">2,180 XP</span>
                </div>

                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-bold">#3</span>
                    <span className="text-neutral-200">Aditya N. (IT)</span>
                  </div>
                  <span className="font-mono text-neutral-300 font-semibold">1,940 XP</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Season 2026</span>
              <span className="text-yellow-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Hall of Fame <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Glass>
        </div>
      </section>

      {/* 6. Core Pillars Feature Grid */}
      <section id="features" className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Engineered for Campus Esports & Athletics
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-xl mx-auto">
            Everything your collegiate council needs to orchestrate seamless competitions, from squad draft day to grand final trophies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <Glass
            variant="subtle"
            borderRadius={20}
            className="p-6 flex flex-col border border-white/10 hover:border-amber-400/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <Gavel className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Live Player Auctions</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Run real-time bidding rooms where captains manage team purses, place instant counter-bids, and draft rosters under rapid countdown timers.
            </p>
          </Glass>

          {/* Feature 2 */}
          <Glass
            variant="subtle"
            borderRadius={20}
            className="p-6 flex flex-col border border-white/10 hover:border-amber-400/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Dynamic Tournament Brackets</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Automated single-elimination, double-elimination, and round-robin brackets with live match scoring and automatic winner advancement.
            </p>
          </Glass>

          {/* Feature 3 */}
          <Glass
            variant="subtle"
            borderRadius={20}
            className="p-6 flex flex-col border border-white/10 hover:border-amber-400/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 mb-4 group-hover:scale-110 transition-transform">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Real-Time Leaderboard</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Track department standings, individual athlete stats, and season points automatically updated following verified match results.
            </p>
          </Glass>

          {/* Feature 4 */}
          <Glass
            variant="subtle"
            borderRadius={20}
            className="p-6 flex flex-col border border-white/10 hover:border-amber-400/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Crown className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Hall of Fame Legacy</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Immortalize collegiate champions, record-breaking captains, and standout MVP athletes with permanent campus accolades and awards.
            </p>
          </Glass>

          {/* Feature 5 */}
          <Glass
            variant="subtle"
            borderRadius={20}
            className="p-6 flex flex-col border border-white/10 hover:border-amber-400/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Instant Campus Broadcasts</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Publish critical schedule alerts, emergency bracket revisions, match delay notices, and official announcements across all student channels.
            </p>
          </Glass>

          {/* Feature 6 */}
          <Glass
            variant="subtle"
            borderRadius={20}
            className="p-6 flex flex-col border border-white/10 hover:border-amber-400/30 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Role-Based Governance</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Granular permission levels for Coordinators, Core Council Organizers, and Founders ensuring integrity across points and brackets.
            </p>
          </Glass>
        </div>
      </section>

      {/* 7. Institutional Impact Counter */}
      <section className="relative z-10 py-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <Glass
          variant="default"
          borderRadius={24}
          className="p-8 border border-white/15 bg-black/50 backdrop-blur-2xl shadow-2xl"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">12+</div>
              <div className="text-xs text-neutral-300 font-medium mt-1">Tournaments Hosted</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-orange-400 font-mono">500+</div>
              <div className="text-xs text-neutral-300 font-medium mt-1">Athletes & Gamers</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono">₹250K+</div>
              <div className="text-xs text-neutral-300 font-medium mt-1">Auction Pts Drafted</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">99.9%</div>
              <div className="text-xs text-neutral-300 font-medium mt-1">Uptime Under Peak</div>
            </div>
          </div>
        </Glass>
      </section>

      {/* 8. Call to Action Banner */}
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        <Glass
          variant="bold"
          borderRadius={28}
          className="p-8 sm:p-12 border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-black/60 to-black/90 backdrop-blur-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)]"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Campus Season In Progress</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Ready to Coordinate Your Next Championship?
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 max-w-lg mx-auto leading-relaxed mb-8">
            Enter the BGSC Admin Console to supervise live registrations, run dynamic player draft auctions, and advance tournament brackets.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm tracking-wide shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Access Admin Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </Glass>
      </section>

      {/* 9. Cosmic Liquid Glass Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-xl py-10 px-4 sm:px-8 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white">BGSC Platform</span>
              <span className="text-neutral-500 ml-2">&copy; {new Date().getFullYear()} Campus Sports & Gaming</span>
            </div>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('showcase')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              Auctions & Brackets
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Systems Operational</span>
          </div>
        </div>
      </footer>

      {/* 10. Waterline Liquid Bottom Navbar (Compact with Orange Accent) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <LiquidNavbar
          tone="dark"
          items={landingNavItems}
          active={activeNav}
          sound={true}
          onChange={(index) => {
            setActiveNav(index)
            if (index === 0) window.scrollTo({ top: 0, behavior: 'smooth' })
            else if (index === 1) scrollToSection('features')
            else if (index === 2) scrollToSection('showcase')
            else if (index === 3) navigate('/login')
          }}
        />
      </div>
    </div>
  )
}

export default Landing
