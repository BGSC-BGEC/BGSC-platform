import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

interface NavItem {
    path: string
    label: string
}

const NAV_ITEMS: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/events', label: 'Events' },
    { path: '/announcements', label: 'Announcements' },
    { path: '/users', label: 'Users Directory' },
    { path: '/tournaments', label: 'Tournaments' },
]

export const Sidebar: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false)

    return (
    <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-60'
        }`}
    >
        {/* Brand Header & Toggle */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
            <span className="font-bold text-black tracking-tight text-sm">
            BGSC Admin
            </span>
        )}

        <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-gray-500 hover:text-black p-1 border border-gray-200 rounded cursor-pointer mx-auto"
        >
            {collapsed ? 'Menu' : 'Collapse'}
        </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
            <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm transition-colors ${
                isActive
                    ? 'bg-gray-100 text-black font-bold border border-gray-300'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                }`
            }
            >
            <span className="truncate">{collapsed ? item.label.slice(0, 3) : item.label}</span>
            </NavLink>
        ))}
        </nav>
    </aside>
    )
}