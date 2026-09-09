import React from 'react'
import type { DashboardViewProps } from '../types/dashboard'
import { DEFAULT_DASHBOARD_STATS } from '../data/dashboardData'

export const Dashboard: React.FC<DashboardViewProps> = ({
    stats = DEFAULT_DASHBOARD_STATS,
}) => {
    return (
    <div className="space-y-6">
        {/* Top Banner */}
        <div className="p-6 rounded-lg bg-gray-50 border border-gray-200">
        <h1 className="text-2xl font-bold text-black">Welcome to Admin Operations</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-xl">
            Coordinate tournaments, publish tagged announcements, manage registrations, and award activity points.
        </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => (
            <div
            key={item.id}
            className="p-5 rounded-lg bg-white border border-gray-200"
            >
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {item.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-black">
                {item.value}
            </div>
            <div className="mt-1 text-xs text-gray-500">
                {item.change}
            </div>
            </div>
        ))}
        </div>
    </div>
    )
}