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
    { path: '/feedback', label: 'Feedback & Support', icon: MessageSquare },
]

export const Sidebar: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false)

    return (
    <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-60'
        }`}
    >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
            <span className="font-bold text-black tracking-tight text-sm">
            BGSC Admin
            </span>
        )}

        <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-gray-500 hover:text-black p-1 border border-gray-200 rounded cursor-pointer ml-auto">
            {collapsed ? '>' : 'X'}
        </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                } px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                    ? 'bg-gray-100 text-black font-bold border border-gray-300'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                }`
                }
            >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
            )
        })}
        </nav>
    </aside>
    )
}