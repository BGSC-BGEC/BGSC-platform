import React, { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSidebarStore } from '../../stores/sidebarStore'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',     label: 'Dashboard',         icon: LayoutDashboard },
  { path: '/events',        label: 'Events',             icon: Calendar },
  { path: '/announcements', label: 'Announcements',      icon: Megaphone },
  { path: '/users',         label: 'Users Directory',    icon: Users },
  { path: '/tournaments',   label: 'Tournaments',        icon: Trophy },
  { path: '/auction',       label: 'Auctions',           icon: Gavel },
  { path: '/media',         label: 'Media Library',      icon: Image },
  { path: '/leaderboard',   label: 'Leaderboards',       icon: Award },
  { path: '/challenges',    label: 'Challenges',         icon: Target },
  { path: '/hall-of-fame',  label: 'Hall of Fame',       icon: Crown },
  { path: '/feedback',      label: 'Feedback & Support', icon: MessageSquare },
]

export const Sidebar: React.FC = () => {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarStore()
  const location = useLocation()

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, setMobileOpen])

  return (
    <>
      {/* ── Mobile Backdrop ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar Container ─────────────────────────────────────── */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-border bg-card dark:bg-[#09090b] transition-all duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          width: collapsed ? 68 : 240,
        }}
      >
        {/* ── Header / Brand ──────────────────────────────────────── */}
        <div className="h-[60px] flex items-center justify-between px-3.5 border-b border-border shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 select-none min-w-0">
              <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Trophy className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-[13px] font-bold text-foreground tracking-tight truncate">
                  BGSC
                </div>
                <div className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase">
                  Admin Console
                </div>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center mx-auto shrink-0 shadow-xs">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex md:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Navigation Items ────────────────────────────────────── */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-xs font-medium transition-all duration-150 relative group ${
                    collapsed
                      ? 'justify-center w-10 h-10 mx-auto'
                      : 'gap-3 px-3 py-2.5 w-full'
                  } ${
                    isActive
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold border border-orange-500/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
                {!collapsed && (
                  <span className="truncate tracking-tight">{item.label}</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* ── Footer / Status ─────────────────────────────────────── */}
        <div className="border-t border-border p-3 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-1">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="truncate font-mono">Systems operational</span>
            </div>
          ) : (
            <div className="flex justify-center" title="All systems operational">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
