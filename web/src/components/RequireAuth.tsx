import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../core/stores/authStore'

const ADMIN_ROLES = new Set(['core', 'coordinator', 'founder'])

/** Gate for protected admin routes — requires authentication AND an admin role. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (status === 'unknown' || status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!user || !ADMIN_ROLES.has(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-red-400">Access Denied</p>
          <p className="mt-2 text-sm text-slate-400">
            This console is restricted to coordinators and founders.
          </p>
          <button
            type="button"
            onClick={() => useAuthStore.getState().logout()}
            className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
