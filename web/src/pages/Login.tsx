import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/admin'

interface LoginProps {
  title?: string
  subtitle?: string
  availableRoles?: UserRole[]
}

const DEFAULT_ROLES: UserRole[] = ['coordinator', 'founder', 'core']
const isMock = import.meta.env.VITE_USE_MOCK === 'true'
const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000'
).replace(/\/+$/, '')

export const Login: React.FC<LoginProps> = ({
  title = 'BGSC Admin Console',
  subtitle = 'Coordinators & Founders Access',
  availableRoles = DEFAULT_ROLES,
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(availableRoles[0] || 'coordinator')
  const [loading, setLoading] = useState(false)
  const location = useLocation()
  const routeState = location.state as
    | { from?: { pathname: string; search?: string }; oauthError?: string }
    | null
  const [errorMessage, setErrorMessage] = useState<string | null>(
    routeState?.oauthError ?? null
  )

  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleGoogle = () => {
    const from = routeState?.from
    const returnPath = from ? from.pathname + (from.search ?? '') : '/dashboard'
    window.location.assign(
      `${API_URL}/auth/google?state=${encodeURIComponent(returnPath)}`
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setErrorMessage(null)
    setLoading(true)

    try {
      await login(username, password, role)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Invalid credentials or backend unreachable'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 px-4 text-black">
      <div className="w-full max-w-sm rounded-lg border border-gray-300 bg-white p-8 shadow-xs">
        <h1 className="text-center text-xl font-bold text-black">{title}</h1>
        <p className="text-center text-xs text-gray-500 mt-1 mb-6">
          {subtitle}
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Username or Email
            </label>
            <input
              type="text"
              placeholder="Enter username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-black focus:outline-none focus:border-black placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-black focus:outline-none focus:border-black placeholder:text-gray-400"
            />
          </div>

          {isMock && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Mock Role Mode
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-black focus:outline-none focus:border-black"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">
                Active in mock mode. Live logins use backend database roles.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-black text-white font-bold text-sm rounded hover:bg-gray-800 transition-colors cursor-pointer mt-2 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {!isMock && (
          <button
            type="button"
            onClick={handleGoogle}
            className="w-full py-2 mt-3 bg-white border border-gray-300 text-black font-bold text-sm rounded hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Continue with Google
          </button>
        )}
      </div>
    </div>
  )
}

export default Login