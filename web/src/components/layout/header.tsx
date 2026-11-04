import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import { useSidebarStore } from '../../stores/sidebarStore'
import {
  LogOut,
  Sun,
  Moon,
  User,
  Bell,
  Menu,
  Search,
  ChevronDown,
  Shield,
  Layers,
  Calendar,
  Trophy,
  Megaphone,
  Gavel,
  Users as UsersIcon,
  Sparkles,
  Command,
} from 'lucide-react'

const PAGE_META: Record<string, { title: string; category: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard:    { title: 'Dashboard',             category: 'Overview',   icon: Layers },
  events:       { title: 'Events & Tournaments', category: 'Competition',icon: Calendar },
  announcements:{ title: 'Announcements',         category: 'Broadcasts', icon: Megaphone },
  users:        { title: 'Users Directory',       category: 'Community',  icon: UsersIcon },
  tournaments:  { title: 'Tournaments & Brackets',category: 'Competition',icon: Trophy },
  auction:      { title: 'Auctions Console',      category: 'Marketplace',icon: Gavel },
  media:        { title: 'Media Library',         category: 'Assets',     icon: Layers },
  leaderboard:  { title: 'Leaderboards & Points', category: 'Rankings',   icon: Trophy },
  challenges:   { title: 'Challenges',            category: 'Activities', icon: Sparkles },
  'hall-of-fame':{ title: 'Hall of Fame',         category: 'Heritage',   icon: Trophy },
  feedback:     { title: 'Feedback & Support',    category: 'System',     icon: Layers },
}

const NOTIFICATIONS = [
  { id: '1', title: 'New registration in Valorant Invitational', time: '5m ago', unread: true },
  { id: '2', title: 'Player lot bid updated: Kabir Sen (54,000 pts)', time: '22m ago', unread: true },
  { id: '3', title: 'Inclement weather notice published to feed', time: '1h ago', unread: false },
]

const QUICK_LINKS = [
  { label: 'Dashboard', path: '/dashboard', icon: Layers },
  { label: 'Tournaments', path: '/tournaments', icon: Trophy },
  { label: 'Announcements', path: '/announcements', icon: Megaphone },
  { label: 'Users Directory', path: '/users', icon: UsersIcon },
  { label: 'Live Auction', path: '/auction', icon: Gavel },
  { label: 'Leaderboard', path: '/leaderboard', icon: Trophy },
]

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { toggleMobileOpen } = useSidebarStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState(NOTIFICATIONS)

  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const segment = location.pathname.replace('/', '').trim()
  const meta = PAGE_META[segment] ?? { title: 'Admin Console', category: 'Platform', icon: Layers }
  const PageIcon = meta.icon

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false)
        setIsProfileOpen(false)
        setIsNotifOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus search input when modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 50)
    } else {
      setSearchQuery('')
    }
  }, [isSearchOpen])

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setIsProfileOpen(false)
    await logout()
    navigate('/login')
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  const unreadCount = notifications.filter((n) => n.unread).length

  const filteredQuickLinks = QUICK_LINKS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
  )

  const roleName = user?.role ?? 'coordinator'
  const isFounder = roleName === 'founder'
  const isCore = roleName === 'core'

  return (
    <>
      <header className="sticky top-0 z-30 h-14 md:h-[60px] w-full border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 transition-colors">
        <div className="flex h-full items-center justify-between px-3.5 sm:px-6 gap-3">
          {/* ── Left: Breadcrumb Navigation & Mobile Toggle ────────── */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={toggleMobileOpen}
              aria-label="Open sidebar drawer"
              className="flex md:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/30 transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumb path */}
            <div className="flex items-center gap-1.5 text-xs select-none min-w-0">
              <span className="hidden sm:inline font-mono font-medium text-muted-foreground/80 hover:text-foreground transition-colors cursor-default">
                BGSC
              </span>
              <span className="hidden sm:inline text-muted-foreground/40 font-mono">/</span>
              <span className="hidden lg:inline text-muted-foreground/80 font-medium">
                {meta.category}
              </span>
              <span className="hidden lg:inline text-muted-foreground/40 font-mono">/</span>

              {/* Active Page Pill */}
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/80 text-foreground font-semibold text-xs tracking-tight truncate shadow-2xs">
                <PageIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="truncate">{meta.title}</span>
              </div>
            </div>
          </div>

          {/* ── Center: Search / Command Bar Trigger ───────────────── */}
          <div className="flex-1 max-w-md mx-auto hidden md:flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 text-xs text-muted-foreground bg-muted/35 hover:bg-muted/60 border border-border/80 hover:border-border rounded-lg transition-all duration-150 cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                <span className="truncate">Search platform or jump to...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 shadow-2xs group-hover:border-foreground/30">
                <Command className="w-2.5 h-2.5" /> K
              </kbd>
            </button>
          </div>

          {/* ── Right: Telemetry, Theme, Notifications & Profile ──── */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live Gateway Pill (Large Screens) */}
            <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/80 bg-muted/20 text-[11px] font-mono text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>Gateway 14ms</span>
            </div>

            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open search"
              className="flex md:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/30 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-foreground transition-transform duration-200 rotate-0 hover:-rotate-12" />
              )}
            </button>

            {/* Notifications Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer relative shadow-2xs"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-background animate-pulse" />
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-xl border border-border bg-card dark:bg-[#0d0d0d] shadow-xl p-0 z-50 overflow-hidden fade-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] font-mono font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <ul className="divide-y divide-border/60 max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        className={`p-3 text-xs flex items-start gap-2.5 transition-colors hover:bg-muted/30 ${
                          n.unread ? 'bg-orange-500/[0.04]' : ''
                        }`}
                      >
                        <span
                          className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                            n.unread ? 'bg-orange-500' : 'bg-muted-foreground/40'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground font-medium leading-relaxed truncate">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {n.time}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="p-2 border-t border-border bg-muted/10 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotifOpen(false)
                        navigate('/announcements')
                      }}
                      className="text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
                    >
                      View All Announcements →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="w-px h-5 mx-0.5 sm:mx-1 bg-border" />

            {/* Profile Menu Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl border border-border/80 hover:border-border bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer shadow-2xs group"
              >
                {/* User Avatar with gradient border */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono text-[11px] font-bold text-white shadow-xs ${
                    isFounder
                      ? 'bg-gradient-to-tr from-purple-600 to-indigo-500'
                      : isCore
                      ? 'bg-gradient-to-tr from-orange-500 to-amber-500'
                      : 'bg-gradient-to-tr from-sky-500 to-blue-600'
                  }`}
                >
                  {(user?.username || 'A')[0].toUpperCase()}
                </div>

                {/* User Info (Hidden on small screens) */}
                <div className="leading-tight hidden sm:block text-left">
                  <div className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                    {user?.username ?? 'Admin'}
                  </div>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    {roleName}
                  </div>
                </div>

                <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-transform duration-200 hidden sm:block" />
              </button>

              {/* Profile Popover Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card dark:bg-[#0d0d0d] shadow-xl p-1.5 z-50 fade-in">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-xs font-bold text-foreground truncate">
                      {user?.username ?? 'Admin Member'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {user?.email ?? 'admin@bgsc.campus'}
                    </p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border border-border bg-muted/50 text-foreground">
                      <Shield className="w-2.5 h-2.5 text-orange-500" />
                      <span>{roleName} permission</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false)
                      navigate('/users')
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer text-left"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>User Directory & Permissions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false)
                      toggleTheme()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                      <span>Theme Mode</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">
                      {theme}
                    </span>
                  </button>

                  <div className="my-1 border-t border-border" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out of Console</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Command Palette / Quick Search Modal (Ctrl+K) ──────────── */}
      {isSearchOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50 duration-150"
            onClick={() => setIsSearchOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-border bg-card dark:bg-[#0d0d0d] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input Bar */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-muted/15">
                <Search className="w-4 h-4 text-orange-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type a destination or search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <kbd className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>

              {/* Quick Navigation Results */}
              <div className="p-2 max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Navigation & Actions
                </div>
                <ul className="space-y-0.5">
                  {filteredQuickLinks.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(false)
                            navigate(item.path)
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer text-left group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                            <span className="font-medium text-foreground">{item.label}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground opacity-60 group-hover:opacity-100">
                            Jump →
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {filteredQuickLinks.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No matches found for "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Footer Shortcut Hints */}
              <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Navigation Shortcut</span>
                <div className="flex items-center gap-2">
                  <span>Navigate</span>
                  <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[10px]">↵</kbd>
                  <span>Close</span>
                  <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[10px]">esc</kbd>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export default Header
