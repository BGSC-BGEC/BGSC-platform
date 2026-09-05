import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { UserRepository } from '../core/repositories/UserRepository'

const ROLE_STYLES: Record<string, string> = {
  founder: 'bg-purple-900/50 text-purple-300 border-purple-700/40',
  coordinator: 'bg-teal-900/50 text-teal-300 border-teal-700/40',
  core: 'bg-sky-900/50 text-sky-300 border-sky-700/40',
  member: 'bg-slate-700/50 text-slate-300 border-slate-600/40',
  user: 'bg-slate-800/50 text-slate-400 border-slate-700/40',
  guest: 'bg-slate-800/50 text-slate-500 border-slate-700/40',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'text-emerald-400',
  suspended: 'text-red-400',
  pending_deletion: 'text-amber-400',
}

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: () =>
      UserRepository.listUsers({
        page: 1,
        limit: 50,
        search: search || undefined,
        role: roleFilter || undefined,
        summary: true,
      }),
    staleTime: 30_000,
  })

  const users = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Users</h1>
        <p className="text-sm text-slate-400 mt-1">
          {meta?.summary
            ? `${meta.summary.total} total · ${meta.summary.activeThisWeek} active this week · ${meta.summary.newThisMonth} new this month`
            : 'Live data from user service'}
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
            placeholder="Search username or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-teal-500"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {['guest', 'user', 'member', 'core', 'coordinator', 'founder'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {isPending && <p className="text-slate-400 text-sm">Loading…</p>}
      {isError && <p className="text-red-400 text-sm">Failed to load: {(error as Error).message}</p>}

      {!isPending && !isError && (
        <div className="overflow-hidden rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="bg-slate-900 hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">{u.username}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${ROLE_STYLES[u.role] ?? ROLE_STYLES['user']}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${STATUS_STYLES[u.status] ?? 'text-slate-400'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {u.pointsBalance?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
