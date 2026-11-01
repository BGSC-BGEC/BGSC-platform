import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Trophy,
  Gavel,
  Award,
  Megaphone,
  Image,
  MessageSquare,
  Target,
  Crown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/events', label: 'Events', icon: Calendar },
  { path: '/announcements', label: 'Announcements', icon: Megaphone },
  { path: '/users', label: 'Users Directory', icon: Users },
  { path: '/tournaments', label: 'Tournaments', icon: Trophy },
  { path: '/auction', label: 'Auctions', icon: Gavel },
  { path: '/media', label: 'Media Library', icon: Image },
  { path: '/leaderboard', label: 'Leaderboards', icon: Award },
  { path: '/challenges', label: 'Challenges', icon: Target },
  { path: '/hall-of-fame', label: 'Hall of Fame', icon: Crown },
  { path: '/feedback', label: 'Feedback & Support', icon: MessageSquare },
]

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-white/80 backdrop-blur-xl border-r border-slate-200/80 transition-all duration-300 flex flex-col shadow-[4px_0_24px_-8px_rgba(0,0,0,0.04)] ${
        collapsed ? 'w-20' : 'w-60'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/70">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 tracking-tight text-sm">
              BGSC
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest ml-1">
              Admin
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-slate-700 p-1.5 border border-slate-200/80 bg-white/70 hover:bg-slate-100 rounded-lg transition-all cursor-pointer ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center ${
                  collapsed ? 'justify-center' : 'gap-3'
                } px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/15 via-orange-500/10 to-transparent text-orange-600 font-bold border border-orange-500/30 shadow-[0_2px_12px_-3px_rgba(249,115,22,0.25),inset_0_1px_1px_rgba(255,255,255,0.7)]'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
