import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  ChevronDown,
  ShieldCheck,
  History,
  LogOut,
  Megaphone,
  CalendarPlus,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';
import { useAuthStore } from '../../core/stores/authStore';

const PATH_LABELS: Record<string, string> = {
  '/events': 'Events',
  '/announcements': 'Announcements',
  '/users': 'Users',
  '/broadcasts': 'Broadcast Engine',
  '/bracket': 'Tournaments & Brackets',
  '/captains': 'Captain Requests',
  '/auctions': 'Auction Controllers',
  '/scoring': 'Scoring Engine',
  '/investments': 'Points & Investments',
  '/tickets': 'Feedback Tickets',
  '/moderation': 'Moderation Queue',
  '/settings': 'System Settings',
};

export const Header: React.FC = () => {
  const {
    sidebarCollapsed,
    setCommandPaletteOpen,
    setNotificationDrawerOpen,
    setAuditDrawerOpen,
    notifications,
    userRole,
    autosaveStatus,
  } = useAdmin();

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);

  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const createDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;
  const pageLabel = PATH_LABELS[pathname] ?? 'Admin';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
        setCreateDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await useAuthStore.getState().logout();
    navigate('/login', { replace: true });
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-4 lg:px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-60'
      }`}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <nav className="flex items-center space-x-1.5 text-xs text-slate-400">
          <button onClick={() => navigate('/events')} className="hover:text-teal-400 transition-colors">
            Admin
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-slate-100 font-semibold">{pageLabel}</span>
        </nav>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 text-xs transition-colors group shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-400 transition-colors" />
            <span>Search actions, users, events...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-600">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Autosave */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-400">
          {autosaveStatus === 'saved' ? (
            <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span>Synced</span></>
          ) : (
            <><RefreshCw className="w-3 h-3 text-teal-400 animate-spin" /><span>Saving...</span></>
          )}
        </div>

        {/* Live pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-[11px] font-mono font-semibold text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Admin</span>
        </div>

        {/* Create dropdown */}
        <div className="relative" ref={createDropdownRef}>
          <button
            onClick={() => setCreateDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {createDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => { navigate('/announcements'); setCreateDropdownOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700 transition-colors text-left"
              >
                <Megaphone className="w-4 h-4 text-teal-400" />
                <div>
                  <div className="font-medium">New Announcement</div>
                  <div className="text-[10px] text-slate-400">Post to all users</div>
                </div>
              </button>
              <button
                onClick={() => { navigate('/broadcasts'); setCreateDropdownOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700 transition-colors text-left"
              >
                <CalendarPlus className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-medium">New Broadcast</div>
                  <div className="text-[10px] text-slate-400">Push notification</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          onClick={() => setNotificationDrawerOpen(true)}
          title="System Notifications"
          className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-teal-500 text-slate-900 font-mono font-extrabold text-[10px] flex items-center justify-center ring-2 ring-slate-900">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-md bg-teal-700 flex items-center justify-center text-white text-xs font-bold border border-slate-600">
              {user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-100 leading-tight">{user?.username ?? '—'}</span>
              <span className="text-[10px] font-mono text-teal-400 font-medium">[{userRole}]</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2">
              <div className="p-2 border-b border-slate-700/80">
                <div className="text-xs font-semibold text-slate-100">{user?.username}</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Role:</span>
                  <span className="px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-300 font-mono text-[10px] font-bold border border-teal-600/40">
                    {userRole}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-700/80 pt-1 space-y-0.5">
                <button
                  onClick={() => { setAuditDrawerOpen(true); setProfileDropdownOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-sky-400" />
                  <span>Audit Log</span>
                </button>
                <button
                  onClick={() => void handleLogout()}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

