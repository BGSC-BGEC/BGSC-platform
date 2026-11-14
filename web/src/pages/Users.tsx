import React, { useState, useMemo, useEffect } from 'react'
import { Download, Search, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'
import type { User } from '../types/user'
import { userService } from '../services/userService'
import { UserTable } from '../components/users/UserTable'
import { UserDetailModal } from '../components/users/UserDetailModal'
import { Button } from '../components/ui/button'

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

  const handleViewUser = (user: User) => {
    setSelectedUser(user)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedUser(null)
  }

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)))
    setSelectedUser(updatedUser)
  }

  const handleReset = () => {
    setSearchTerm('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  const handleExportCSV = (userList: User[] = filteredUsers) => {
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

    const rows = userList.map((user) => [
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

  const isFiltered = searchTerm !== '' || roleFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            Users Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage club athletes, coordinators, and member access permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-muted-foreground px-2.5 py-1 rounded-md bg-muted border border-border">
            Total Members: <span className="font-bold text-foreground">{users.length}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV()}
            disabled={filteredUsers.length === 0}
            className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name, email, or handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
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
          aria-label="Filter by status"
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-12 text-center border border-border rounded-xl bg-card flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground font-medium">
            Loading members directory...
          </span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-4 border border-destructive/40 bg-destructive/10 text-foreground rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* TanStack Table UI */}
      {!isLoading && !error && (
        <UserTable
          users={filteredUsers}
          onViewUser={handleViewUser}
          onExportSelected={handleExportCSV}
        />
      )}

      {/* Modal */}
      <UserDetailModal
        key={selectedUser?.id}
        isOpen={isModalOpen}
        user={selectedUser}
        onClose={handleCloseModal}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  )
}
export default Users
