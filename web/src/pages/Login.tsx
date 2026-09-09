import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import type { UserRole } from '../types/admin'

interface LoginProps {
    title?: string
    subtitle?: string
    availableRoles?: UserRole[]
}

const DEFAULT_ROLES: UserRole[] = ['coordinator', 'founder', 'core']

export const Login: React.FC<LoginProps> = ({
    title = 'BGSC Admin Console',
    subtitle = 'Coordinators & Founders Access',
    availableRoles = DEFAULT_ROLES,
}) => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<UserRole>(availableRoles[0] || 'coordinator')
    const [loading, setLoading] = useState(false)

    const { login } = useAuthStore()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    setLoading(true)
    try {
        await login(username, role)
        navigate('/dashboard', { replace: true })
    } finally {
        setLoading(false)
    }
    }

    return (
    <div className="min-h-screen grid place-items-center bg-gray-50 px-4 text-black">
        <div className="w-full max-w-sm rounded-lg border border-gray-300 bg-white p-8">
        <h1 className="text-center text-xl font-bold text-black">
            {title}
        </h1>
        <p className="text-center text-xs text-gray-500 mt-1 mb-6">
            {subtitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Username</label>
            <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-black focus:outline-none focus:border-black placeholder:text-gray-400"
            />
            </div>

            <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
            <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-sm text-black focus:outline-none focus:border-black placeholder:text-gray-400"
            />
            </div>

            <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Role Mode</label>
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
            </div>

            <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-black text-white font-bold text-sm rounded hover:bg-gray-800 transition-colors cursor-pointer mt-2 disabled:opacity-50"
            >
            {loading ? 'Authenticating...' : 'Sign In'}
            </button>
        </form>
        </div>
    </div>
    )
}