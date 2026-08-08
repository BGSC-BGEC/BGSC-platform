import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  ChevronDown,
  ShieldCheck,
  History,
  Smartphone,
  LogOut,
  Megaphone,
  CalendarPlus,
  Coins,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { NavigationTab, UserRole } from '../../types/admin';

export const Header: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    sidebarCollapsed,
    setCommandPaletteOpen,
    setNotificationDrawerOpen,
    setAuditDrawerOpen,
    notifications,
    userRole,
    setUserRole,
    autosaveStatus,
    addToast,
  } = useAdmin();

  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const createDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        createDropdownRef.current &&
        !createDropdownRef.current.contains(event.target as Node)
      ) {
        setCreateDropdownOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Breadcrumb Labels
  const getBreadcrumbs = (): { label: string; tab: NavigationTab }[] => {
    const crumbs: { label: string; tab: NavigationTab }[] = [{ label: 'Admin', tab: 'dashboard' }];
    if (currentTab === 'dashboard') {
      crumbs.push({ label: 'System Overview', tab: 'dashboard' });
    } else if (currentTab === 'tournaments' || currentTab === 'bracket') {
      crumbs.push({ label: 'Tournaments', tab: 'tournaments' });
      crumbs.push({ label: 'Offside Season 3 — Bracket', tab: 'bracket' });
    } else if (currentTab === 'captains') {
      crumbs.push({ label: 'Competitions', tab: 'captains' });
      crumbs.push({ label: 'Captain Applications', tab: 'captains' });
    } else if (currentTab === 'auctions') {
      crumbs.push({ label: 'Auctions', tab: 'auctions' });
      crumbs.push({ label: 'Offside S3 Live Hub', tab: 'auctions' });
    } else if (currentTab === 'scoring') {
      crumbs.push({ label: 'Economy', tab: 'scoring' });
      crumbs.push({ label: 'Scoring Engine & Rules', tab: 'scoring' });
    } else if (currentTab === 'investments') {
      crumbs.push({ label: 'Economy', tab: 'investments' });
      crumbs.push({ label: 'Points Investments', tab: 'investments' });
    } else if (currentTab === 'tickets') {
      crumbs.push({ label: 'Governance', tab: 'tickets' });
      crumbs.push({ label: 'Feedback Resolution Queue', tab: 'tickets' });
    } else if (currentTab === 'moderation') {
      crumbs.push({ label: 'Governance', tab: 'moderation' });
      crumbs.push({ label: 'Safety & Moderation', tab: 'moderation' });
    } else if (currentTab === 'broadcasts') {
      crumbs.push({ label: 'Broadcasts', tab: 'broadcasts' });
      crumbs.push({ label: 'Multichannel Engine', tab: 'broadcasts' });
    } else if (currentTab === 'settings') {
      crumbs.push({ label: 'System', tab: 'settings' });
      crumbs.push({ label: 'Configuration & RBAC', tab: 'settings' });
    }
    return crumbs;
  };

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-700 flex items-center justify-between px-4 lg:px-6 transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-60'
      }`}
    >
      {/* Left Slot: Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0">
        <nav className="flex items-center space-x-1.5 text-xs text-slate-400">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-600">/</span>}
              <button
                onClick={() => setCurrentTab(crumb.tab)}
                className={`hover:text-teal-400 transition-colors truncate ${
                  idx === arr.length - 1
                    ? 'text-slate-100 font-semibold cursor-default'
                    : 'text-slate-400'
                }`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Center-Left Slot: Command Palette Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 text-xs transition-colors group shadow-inner"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-400 transition-colors" />
            <span>Search actions, tickets, players...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-600">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-2.5">
        {/* Autosave Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-400">
          {autosaveStatus === 'saved' ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Autosaved</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3 text-teal-400 animate-spin" />
              <span>Saving...</span>
            </>
          )}
        </div>

        {/* Environment / Live Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-[11px] font-mono font-semibold text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Admin</span>
        </div>

        {/* Create Dropdown */}
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
                onClick={() => {
                  setCurrentTab('broadcasts');
                  setCreateDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700 transition-colors text-left"
              >
                <Megaphone className="w-4 h-4 text-teal-400" />
                <div>
                  <div className="font-medium">New Broadcast</div>
                  <div className="text-[10px] text-slate-400">Push notification announcement</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentTab('bracket');
                  setCreateDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700 transition-colors text-left"
              >
                <CalendarPlus className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-medium">New Bracket Tournament</div>
                  <div className="text-[10px] text-slate-400">Configure elimination rules</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setCurrentTab('investments');
                  setCreateDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-700 transition-colors text-left"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-medium">Adjust Point Bounds</div>
                  <div className="text-[10px] text-slate-400">Configure pool min/max</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Bell */}
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

        {/* Admin Profile & Role Switcher */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Admin Profile"
              className="w-7 h-7 rounded-md object-cover border border-slate-600"
            />
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-100 leading-tight">Alex Thorne</span>
              <span className="text-[10px] font-mono text-teal-400 font-medium">[{userRole}]</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2">
              <div className="p-2 border-b border-slate-700/80">
                <div className="text-xs font-semibold text-slate-100">Alex Thorne</div>
                <div className="text-[11px] text-slate-400 font-mono">alex.thorne@bgsc.internal</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Active Role:</span>
                  <span className="px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-300 font-mono text-[10px] font-bold border border-teal-600/40">
                    {userRole}
                  </span>
                </div>
              </div>

              {/* Role Switcher for RBAC Demo */}
              <div className="p-1 space-y-1">
                <div className="px-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                {(['Core', 'Coordinator', 'Founder'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setUserRole(role);
                      addToast({
                        title: `Role Switched to [${role}]`,
                        description: `Permissions and UI gating updated.`,
                        type: 'info',
                      });
                      setProfileDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      userRole === role
                        ? 'bg-teal-600/20 text-teal-300 font-semibold border border-teal-500/30'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>{role}</span>
                    {userRole === role && <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-700/80 pt-1 space-y-0.5">
                <button
                  onClick={() => {
                    setAuditDrawerOpen(true);
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-sky-400" />
                  <span>Immutable Audit Log</span>
                </button>
                <button
                  onClick={() => {
                    addToast({ title: 'Desktop View Active', description: 'Optimal breakpoint 1280px-1920px', type: 'info' });
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Toggle Responsive Preview</span>
                </button>
                <button
                  onClick={() => {
                    addToast({ title: 'Session Cleared', description: 'Admin console reset to baseline mock.', type: 'warning' });
                    setProfileDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Reset Session & Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
