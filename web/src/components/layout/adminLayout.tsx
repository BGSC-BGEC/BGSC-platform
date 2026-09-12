import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Header } from './header'

export const AdminLayout: React.FC = () => {
    return (
    <div className="min-h-screen bg-white text-black flex">
        {/* Fixed sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 flex flex-col pl-60 min-w-0">
        <Header />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
        </main>
        </div>
    </div>
    )
}