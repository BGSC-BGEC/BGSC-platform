import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiquidNavbar, NimbusIcons, type LiquidNavItem } from '@/components/ui/liquid-navbar'
import { ArrowLeft, Volume2, VolumeX, Sun, Moon } from 'lucide-react'

export const NavbarDemo: React.FC = () => {
  const navigate = useNavigate()
  const [tone, setTone] = useState<'light' | 'dark'>('light')
  const [sound, setSound] = useState(true)
  const [activeDemoTab, setActiveDemoTab] = useState(2) // Default to "Status" like in the screenshot!
  const [activePlatformTab, setActivePlatformTab] = useState(0)

  // 1:1 Matching the reference screenshot
  const screenshotItems: LiquidNavItem[] = [
    { label: 'Home', icon: NimbusIcons.home, fx: 'glow' },
    { label: 'Flights', icon: NimbusIcons.flights, fx: 'plane' },
    { label: 'Status', icon: NimbusIcons.status, fx: 'drop' },
    { label: 'Profile', icon: NimbusIcons.profile, fx: 'wave' },
  ]

  // Platform items
  const platformItems: LiquidNavItem[] = [
    { label: 'Home', icon: NimbusIcons.home, fx: 'glow' },
    { label: 'Events', icon: NimbusIcons.events, fx: 'pop' },
    { label: 'Auction', icon: NimbusIcons.auction, fx: 'drop' },
    { label: 'Trophy', icon: NimbusIcons.trophy, fx: 'spin' },
    { label: 'Profile', icon: NimbusIcons.profile, fx: 'wave' },
  ]

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors duration-500 ${
        tone === 'light' ? 'bg-[#dcebf5] text-slate-800' : 'bg-[#060b17] text-slate-100'
      }`}
    >
      {/* Top Header Controls */}
      <header className="p-6 flex items-center justify-between max-w-5xl w-full mx-auto">
        <button
          type="button"
          onClick={() => navigate('/')}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border transition-all cursor-pointer ${
            tone === 'light'
              ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white shadow-sm'
              : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSound(!sound)}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full border transition-all cursor-pointer ${
              tone === 'light'
                ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
            }`}
          >
            {sound ? <Volume2 className="w-4 h-4 text-orange-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>Sound {sound ? 'On' : 'Off'}</span>
          </button>

          {/* Tone Toggle */}
          <button
            type="button"
            onClick={() => setTone(tone === 'light' ? 'dark' : 'light')}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full border transition-all cursor-pointer ${
              tone === 'light'
                ? 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white shadow-sm'
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
            }`}
          >
            {tone === 'light' ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span>{tone === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-12">
        <div>
          <span className="inline-block text-xs uppercase tracking-widest font-bold px-3 py-1 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 mb-3">
            Liquid Navbar · Waterline
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Orange Liquid Accent & Vertical Compact Layout
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Fluid drop stretches, breaks into droplets, and ripples upon landing. Notice how the active tab has a rich orange capsule with crisp white icon and text!
          </p>
        </div>

        {/* Section 1: Screenshot Replica (Default selected "Status" with orange drop) */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            Screenshot Layout (Compact 4-Tab)
          </p>
          <div className="p-4 flex items-center justify-center">
            <LiquidNavbar
              tone={tone}
              items={screenshotItems}
              active={activeDemoTab}
              sound={sound}
              onChange={(idx) => setActiveDemoTab(idx)}
            />
          </div>
          <p className="text-xs text-slate-400">
            Selected Tab: <strong className="text-orange-500">{screenshotItems[activeDemoTab]?.label}</strong>
          </p>
        </div>

        {/* Section 2: Platform 5-Tab Bar */}
        <div className="space-y-4 pt-6 border-t border-slate-200/50 dark:border-white/10 w-full">
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
            BGSC Platform Layout (5-Tab)
          </p>
          <div className="p-4 flex items-center justify-center">
            <LiquidNavbar
              tone={tone}
              items={platformItems}
              active={activePlatformTab}
              sound={sound}
              onChange={(idx) => setActivePlatformTab(idx)}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-400">
        BGSC Waterline Liquid Navbar with WebGL caustics & fluid physics
      </footer>
    </div>
  )
}

export default NavbarDemo
