import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { LogOut, User } from 'lucide-react'

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname.replace('/', '').trim()
  const pageTitle = currentPath ? currentPath.toUpperCase() : 'DASHBOARD'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.9)]">
      {/* Breadcrumbs with subtle glass badge */}
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="px-2 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/60 font-semibold text-slate-600">
          Admin
        </span>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-slate-900 tracking-tight">{pageTitle}</span>
      </div>

      {/* User Info & Liquid Crystal Sign Out */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 text-right">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 p-[1.5px] shadow-sm">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-orange-600">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {user?.username ?? 'Admin User'}
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              {user?.role ?? 'Coordinator'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 border border-slate-200/90 bg-white/90 hover:bg-orange-50 hover:border-orange-500/40 hover:text-orange-600 rounded-full transition-all cursor-pointer shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  )
}

export default Header
