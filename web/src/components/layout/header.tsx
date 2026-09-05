import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export const Header: React.FC = () => {
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const location = useLocation()

    const currentPath = location.pathname.replace('/', '').trim()
    const pageTitle = currentPath ? currentPath.toUpperCase() : 'DASHBOARD'

    const handleLogout = () => {
    logout()
    navigate('/login')
    }

    return (
    <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30">
        {/* Breadcrumbs (Plain Text) */}
        <div className="text-xs text-gray-500 font-medium">
        <span>Admin</span>
        <span className="mx-2">|</span>
        <span className="text-black font-bold">{pageTitle}</span>
        </div>

        {/* User Info & Plain Text Sign Out */}
        <div className="flex items-center gap-4">
        <div className="text-right">
            <div className="text-xs font-bold text-black">
            {user?.username ?? 'Admin User'}
            </div>
            <div className="text-[11px] text-gray-500 uppercase">
            {user?.role ?? 'Coordinator'}
            </div>
        </div>

        <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100 transition-colors cursor-pointer text-black"
        >
            Sign Out
        </button>
        </div>
    </header>
    )
}