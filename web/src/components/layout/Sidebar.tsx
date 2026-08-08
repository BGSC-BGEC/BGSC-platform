import React from 'react';
import {
  LayoutDashboard,
  Trophy,
  Users,
  Gavel,
  Sliders,
  TrendingUp,
  TicketCheck,
  ShieldAlert,
  Radio,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  Clock,
  Command,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { NavigationTab } from '../../types/admin';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isLive?: boolean;
  badge?: number;
  badgeColor?: string;
  isGated?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    sidebarCollapsed,
    toggleSidebar,
    sessionDuration,
    tickets,
    moderationItems,
    userRole,
  } = useAdmin();

  const openTicketsCount = tickets.filter((t) => t.status === 'Submitted' || t.status === 'Under Review').length;
  const pendingModerationCount = moderationItems.filter((m) => m.status === 'pending').length;

  const navGroups: NavGroup[] = [
    {
      title: 'SYSTEM OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'COMPETITIONS & LEAGUES',
      items: [
        { id: 'tournaments', label: 'Tournaments & Brackets', icon: Trophy },
        { id: 'captains', label: 'Captain Requests', icon: Users },
        { id: 'auctions', label: 'Auction Controllers', icon: Gavel, isLive: true },
      ],
    },
    {
      title: 'ECONOMY & SCORING',
      items: [
        { id: 'scoring', label: 'Scoring Engine', icon: Sliders },
        { id: 'investments', label: 'Points & Investments', icon: TrendingUp },
      ],
    },
    {
      title: 'COMMUNITY & GOVERNANCE',
      items: [
        {
          id: 'tickets',
          label: 'Feedback Tickets',
          icon: TicketCheck,
          badge: openTicketsCount > 0 ? openTicketsCount : undefined,
          badgeColor: 'bg-teal-600 text-teal-100',
        },
        {
          id: 'moderation',
          label: 'Moderation Queue',
          icon: ShieldAlert,
          badge: pendingModerationCount > 0 ? pendingModerationCount : undefined,
          badgeColor: 'bg-amber-500/30 text-amber-300 border border-amber-500/40',
        },
        { id: 'broadcasts', label: 'Broadcast Engine', icon: Radio },
        {
          id: 'settings',
          label: 'System Settings',
          icon: Settings,
          isGated: userRole === 'Core',
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-slate-800 border-r border-slate-700 transition-all duration-300 select-none ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Sidebar Header */}
      <div
        className={`h-16 flex items-center border-b border-slate-700 px-3 ${
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!sidebarCollapsed && (
          <div
            onClick={() => setCurrentTab('dashboard')}
            className="flex flex-col min-w-0 cursor-pointer overflow-hidden group select-none"
          >
            <span className="font-bold text-slate-100 text-sm tracking-tight truncate group-hover:text-teal-300 transition-colors">
              BGSC Admin
            </span>
            <span className="text-[10px] text-teal-400/80 font-mono uppercase tracking-widest truncate">
              Console Hub
            </span>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand Sidebar (⌘B)' : 'Collapse Sidebar (⌘B)'}
          className="w-8 h-8 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Group Items */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400/80 uppercase tracking-wider font-mono">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentTab === item.id || (item.id === 'tournaments' && currentTab === 'bracket');

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 relative group ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />

                  {!sidebarCollapsed && (
                    <div className="flex-1 flex items-center justify-between min-w-0 text-left">
                      <span className="truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
                        {item.isLive && (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        {item.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.isGated && (
                          <span title="Gated to Founder/Coordinator role" className="text-slate-500">
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {sidebarCollapsed && item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-slate-800" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/80">
        {!sidebarCollapsed ? (
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Session
              </span>
              <span className="font-mono text-[11px] text-slate-200 font-semibold">{sessionDuration}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>v2.4.0-admin</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Command className="w-3 h-3" /> B
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-[10px] text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>
    </aside>
  );
};
