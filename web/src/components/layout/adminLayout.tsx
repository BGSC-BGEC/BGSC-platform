import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useSidebarStore } from '../../stores/sidebarStore'

export const AdminLayout: React.FC = () => {
  const { collapsed } = useSidebarStore()

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar (with responsive slide-out drawer on mobile) */}
      <Sidebar />

      {/* Main content wrapper */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out min-h-screen ${
          collapsed ? 'md:ml-[68px]' : 'md:ml-[240px]'
        }`}
      >
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-screen-2xl w-full mx-auto fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
