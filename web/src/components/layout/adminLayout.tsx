import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { LiquidNavbar, NimbusIcons, type LiquidNavItem } from '../ui/liquid-navbar'

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const adminNavItems: LiquidNavItem[] = [
    { label: 'Dashboard', icon: NimbusIcons.home, fx: 'glow', href: '/dashboard' },
    { label: 'Events', icon: NimbusIcons.events, fx: 'pop', href: '/events' },
    { label: 'Auctions', icon: NimbusIcons.auction, fx: 'drop', href: '/auction' },
    { label: 'Ranking', icon: NimbusIcons.trophy, fx: 'spin', href: '/leaderboard' },
    { label: 'Users', icon: NimbusIcons.profile, fx: 'wave', href: '/users' },
  ]

  const activeIndex = adminNavItems.findIndex((it) => it.href === location.pathname)
  const currentActive = activeIndex >= 0 ? activeIndex : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex relative pb-20 md:pb-0">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col pl-0 md:pl-60 min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating Bottom Liquid Navbar for Mobile / Quick Navigation */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto md:hidden">
        <LiquidNavbar
          tone="light"
          items={adminNavItems}
          active={currentActive}
          sound={true}
          onChange={(_idx, item) => {
            if (item.href) navigate(item.href)
          }}
        />
      </div>
    </div>
  )
}
