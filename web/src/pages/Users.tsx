import React, { useState, useMemo, useEffect } from 'react'
import { Download } from 'lucide-react'
import type { User } from '../types/user'
import { userService } from '../services/userService'
import { UserTable } from '../components/users/UserTable'
import { UserDetailModal } from '../components/users/UserDetailModal'

export const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

useEffect(() => {
    let ignore = false

    userService
        .getUsers()
        .then((data) => {
        if (!ignore) {
            setUsers(data)
            setIsLoading(false)
        }
        })
        .catch((err) => {
        if (!ignore) {
            setError(err instanceof Error ? err.message : 'Failed to load users')
            setIsLoading(false)
        }
        })

    return () => {
        ignore = true
    }
    }, [])

    // 4. Retry Handler (Safe to call setState synchronously in click events)
    const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    userService
        .getUsers()
        .then((data) => {
        setUsers(data)
        })
        .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load users')
        })
        .finally(() => {
        setIsLoading(false)
        })
    }

    const filteredUsers = useMemo(() => {
    return users.filter((user) => {
        const term = searchTerm.toLowerCase().trim()
        const matchesSearch =
        term === '' ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.username.toLowerCase().includes(term)

        const matchesRole =
        roleFilter === 'all' || user.role.toLowerCase() === roleFilter.toLowerCase()

        const matchesStatus =
        statusFilter === 'all' || user.status.toLowerCase() === statusFilter.toLowerCase()

        return matchesSearch && matchesRole && matchesStatus
    })
    }, [users, searchTerm, roleFilter, statusFilter])

    // 5. Action Handlers
    const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setIsModalOpen(true)
    }

    const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedUser(null)
    }

    const handleReset = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setStatusFilter('all')
    }

    const handleExportCSV = () => {
        
        const headers = [
          'ID',
          'Name',
          'Username',
          'Email',
          'Phone',
          'Role',
          'Status',
          'Points Balance',
          'Join Date',
        ]

        const escapeCSV = (value: unknown): string => {
          const str = value === null || value === undefined ? '' : String(value)
          return `"${str.replace(/"/g, '""')}"`
        }

        const rows = filteredUsers.map((user) => [
          escapeCSV(user.id),
          escapeCSV(user.name),
          escapeCSV(user.username),
          escapeCSV(user.email),
          escapeCSV(user.phone),
          escapeCSV(user.role),
          escapeCSV(user.status),
          escapeCSV(user.pointsBalance),
          escapeCSV(user.joinDate),
        ])

        const csvContent = [
          headers.map(escapeCSV).join(','),
          ...rows.map((row) => row.join(',')),
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        const dateStr = new Date().toISOString().split('T')[0]

        link.href = url
        link.setAttribute('download', `users-export-${dateStr}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    return (
    <div className="space-y-6">
        {/* Top Banner / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-
200">
        <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Users Directory
            </h1>
            <p className="text-sm text-gray-600 mt-1">
            Manage club athletes, coordinators, and member access permissions.
            </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-3">
            <span className="text-sm font-bold text-black">
                Total Members: {users.length}
            </span>
            <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredUsers.length === 0}
                className="border border-black text-black bg-white hover:bg-black hover:text-white transition-colors px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
                <Download className="w-3.5 h-3.5" />
                Export CSV
            </button>
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
        <input
            type="text"
            placeholder="Search name, email, or handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none
focus:border-black flex-1 min-w-55"
        />

        <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none
focus:border-black"
        >
            <option value="all">All Roles</option>
            <option value="founder">Founder</option>
            <option value="coordinator">Coordinator</option>
            <option value="core">Core</option>
            <option value="member">Member</option>
        </select>

        <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none
focus:border-black"
        >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
        </select>
        
        <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-black text-black bg-white hover:bg-black hover:text-white
rounded transition-colors"
        >
            Reset
        </button>
        </div>
        {isLoading && (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
            Loading members directory...
        </div>
        )}

        {!isLoading && error && (
        <div className="p-4 border border-black text-black bg-white rounded flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors"
            >
            Retry
            </button>
        </div>
        )}

        {!isLoading && !error && (
        <UserTable users={filteredUsers} onViewUser={handleViewUser} />
        )}

        <UserDetailModal
        isOpen={isModalOpen}
        user={selectedUser}
        onClose={handleCloseModal}
        />
    </div>
    )
}