import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Mail,
  Phone,
  Hash,
  Trophy,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react'
import type { User, UserStatus, UserAuditEntry } from '../../types/user'
import type { UserRole } from '../../types/admin'
import { userService } from '../../services/userService'
import { assignableRoles, can, rankOf } from '../../services/permissions'
import { useAuthStore } from '../../stores/authStore'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Modal } from '../ui/modal'
import { cn } from '../../lib/utils'

export interface UserDetailModalProps {
  user: User | null
  isOpen: boolean
  onClose: () => void
  onUserUpdated?: (updatedUser: User) => void
}

const ROLE_BADGES: Record<UserRole, { label: string; className: string }> = {
  founder: {
    label: 'Founder',
    className: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
  },
  coordinator: {
    label: 'Coordinator',
    className: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  },
  core: {
    label: 'Core',
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30',
  },
  member: {
    label: 'Member',
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  user: {
    label: 'User',
    className: 'bg-muted text-muted-foreground border-border',
  },
  guest: {
    label: 'Guest',
    className: 'bg-muted text-muted-foreground border-border',
  },
}

const STATUS_BADGES: Record<
  UserStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  active: {
    label: 'Active',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  suspended: {
    label: 'Suspended',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  deleted: {
    label: 'Deleted',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/15 text-muted-foreground border-border',
  },
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type Tab = 'profile' | 'access' | 'activity'

const INPUT =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

function describe(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(', ')
  }
  return String(value)
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const me = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>('profile')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [newRole, setNewRole] = useState<UserRole | ''>('')
  const [roleReason, setRoleReason] = useState('')
  const [statusReason, setStatusReason] = useState('')

  const [audit, setAudit] = useState<UserAuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setTab('profile')
    setIsConfirming(false)
    setActionError(null)
    setNotice(null)
    setNewRole('')
    setRoleReason('')
    setStatusReason('')
    setAudit([])
    setAuditError(null)
    onClose()
  }, [onClose])

  const loadAudit = useCallback(async (userId: string) => {
    setAuditLoading(true)
    setAuditError(null)
    try {
      setAudit(await userService.getUserAudit(userId))
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setTab('profile')
      setAudit([])
      setAuditError(null)
    }
  }, [isOpen])

  if (!user) {
    return null
  }

  // Mirrors the backend: you may act only on someone you strictly outrank, and never on yourself.
  const canManage =
    can(me?.role, 'users.manage') && me?.id !== user.id && rankOf(me?.role) > rankOf(user.role)
  const roleOptions = assignableRoles(me?.role).filter((r) => r !== user.role)
  const targetStatus: 'active' | 'suspended' =
    user.status === 'suspended' ? 'active' : 'suspended'

  const roleConfig = ROLE_BADGES[user.role] ?? {
    label: user.role,
    className: 'bg-muted text-muted-foreground border-border',
  }

  const statusConfig = STATUS_BADGES[user.status] ?? {
    label: user.status,
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/15 text-muted-foreground border-border',
  }

  const openTab = (next: Tab) => {
    setTab(next)
    setActionError(null)
    setNotice(null)
    if (next === 'activity') loadAudit(user.id)
  }

  const handleRoleChange = async () => {
    if (!newRole || !roleReason.trim()) return
    setIsUpdating(true)
    setActionError(null)
    setNotice(null)
    try {
      const updated = await userService.updateUserRole(user.id, newRole, roleReason.trim())
      onUserUpdated?.(updated)
      setNotice(`Role changed to ${updated.role}.`)
      setNewRole('')
      setRoleReason('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to change role')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!statusReason.trim()) return
    setIsUpdating(true)
    setActionError(null)
    setNotice(null)
    try {
      const updated = await userService.updateUserStatus(
        user.id,
        targetStatus,
        statusReason.trim()
      )
      onUserUpdated?.(updated)
      setNotice(targetStatus === 'suspended' ? 'Account suspended.' : 'Account activated.')
      setStatusReason('')
      setIsConfirming(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => openTab(id)}
      className={cn(
        'px-3 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer',
        tab === id
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-lg">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Member Profile Details
          </span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 border-b border-border bg-muted/10 shrink-0">
        {tabButton('profile', 'Profile')}
        {canManage && tabButton('access', 'Role & Access')}
        {can(me?.role, 'users.view') && tabButton('activity', 'Activity Log')}
      </div>

      {/* Scrollable Content Body */}
      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        {/* Member Identity Banner */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary ring-2 ring-primary/20 shadow-xs">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="modal-member-name"
              className="text-xl font-bold tracking-tight text-foreground truncate"
            >
              {user.name}
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
              @{user.username}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={roleConfig.className}>
                {roleConfig.label}
              </Badge>
              <Badge
                variant="outline"
                className={cn('inline-flex items-center gap-1.5', statusConfig.badgeClass)}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dotClass)} />
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Action alerts */}
        {notice && (
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {tab === 'profile' && (
          <div className="grid grid-cols-1 gap-3">
            {/* Contact Details Card */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Contact Information
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5 text-foreground">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{user.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-foreground">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{user.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-foreground font-mono text-[11px]">
                  <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="truncate">{user.id}</span>
                </div>
              </div>
            </div>

            {/* Activity & Membership Stats Card */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Club & Activity Stats
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Trophy className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-[11px]">Activity Points</span>
                  </div>
                  <p className="text-base font-bold font-mono text-foreground">
                    {user.pointsBalance !== undefined
                      ? `${user.pointsBalance.toLocaleString()} pts`
                      : '—'}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Member Since</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">{user.joinDate || '—'}</p>
                </div>

                <div className="space-y-1 col-span-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Last Active</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'access' && canManage && (
          <div className="space-y-4">
            {/* Role change */}
            <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Change Role
              </h3>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole | '')}
                className={INPUT}
              >
                <option value="">Select new role…</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_BADGES[r]?.label ?? r}
                  </option>
                ))}
              </select>
              <textarea
                rows={2}
                maxLength={500}
                placeholder="Justification (required, stored in the audit log)"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                className={INPUT}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleRoleChange}
                  disabled={isUpdating || !newRole || !roleReason.trim()}
                  className="text-xs font-semibold"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Updating...
                    </>
                  ) : (
                    'Change Role'
                  )}
                </Button>
              </div>
            </div>

            {/* Status control */}
            <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {targetStatus === 'suspended' ? 'Suspend Account' : 'Activate Account'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {user.status === 'suspended'
                    ? 'This account is currently blocked from club portal actions.'
                    : 'Active members can register for events, claim badges, and participate.'}
                </p>
              </div>

              <textarea
                rows={2}
                maxLength={500}
                placeholder="Reason (required, stored in the audit log)"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className={INPUT}
              />

              {isConfirming && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground">
                      <p className="font-semibold">
                        Are you sure you want to{' '}
                        {targetStatus === 'suspended' ? 'suspend' : 'reinstate'} this account?
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {targetStatus === 'suspended'
                          ? 'The user will be immediately logged out and prohibited from logging in.'
                          : 'The user will regain immediate access to the club portal and events.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirming(false)}
                      disabled={isUpdating}
                      className="text-xs h-7 px-2.5"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={targetStatus === 'suspended' ? 'destructive' : 'default'}
                      size="sm"
                      onClick={handleToggleStatus}
                      disabled={isUpdating || !statusReason.trim()}
                      className="text-xs h-7 px-3 font-semibold"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          Saving...
                        </>
                      ) : (
                        `Yes, ${targetStatus === 'suspended' ? 'Suspend' : 'Reinstate'}`
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-2">
            {auditLoading ? (
              <p className="text-xs text-muted-foreground">Loading activity…</p>
            ) : auditError ? (
              <p className="text-xs text-destructive">{auditError}</p>
            ) : audit.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No recorded admin actions for this member.
              </p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {audit.map((a) => (
                  <li key={a.id} className="p-2.5 text-xs space-y-0.5 bg-muted/10">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold text-foreground">{a.action}</span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-foreground/80">
                      {describe(a.previousValue)} → {describe(a.newValue)}
                    </div>
                    {a.reason && <div className="text-muted-foreground">Reason: {a.reason}</div>}
                    <div className="text-muted-foreground font-mono">by {a.actorId ?? 'system'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20 shrink-0">
        <div>
          {tab === 'access' &&
            canManage &&
            user.status !== 'deleted' &&
            !isConfirming && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirming(true)}
                disabled={isUpdating}
                className={cn(
                  'text-xs font-medium transition-all',
                  targetStatus === 'suspended'
                    ? 'text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive'
                    : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50'
                )}
              >
                {targetStatus === 'suspended' ? 'Suspend Account' : 'Reinstate Member'}
              </Button>
            )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClose}
          className="text-xs font-medium px-4"
        >
          Close
        </Button>
      </div>
    </Modal>
  )
}

export default UserDetailModal
