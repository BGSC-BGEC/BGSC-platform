import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const ALLOWED_ADMIN_ROLES = new Set(['core', 'coordinator', 'founder'])

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { status, user } = useAuthStore()
    const location = useLocation()

    if (status === 'loading') {
    return (
        <div className="min-h-screen grid place-items-center bg-slate-950 text-teal-400 font-mono">
        Authenticating...
        </div>
    )
    }

    if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
    }

    if (!ALLOWED_ADMIN_ROLES.has(user.role)) {
    return (
        <div className="min-h-screen grid place-items-center bg-slate-950 text-center px-4">
        <div>
            <h2 className="text-xl font-bold text-red-400">Access Restricted</h2>
            <p className="mt-2 text-sm text-slate-400">
            This console is restricted to Coordinators, Core members, and Founders.
            </p>
        </div>
        </div>
    )
    }

    return <>{children}</>
}