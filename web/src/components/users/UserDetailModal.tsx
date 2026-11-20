import React, { useState, useEffect, useCallback } from 'react'
import type { User, UserAuditEntry } from '../../types/user'
import type { UserRole } from '../../types/admin'
import { userService } from '../../services/userService'
import { assignableRoles, can, rankOf } from '../../services/permissions'
import { useAuthStore } from '../../stores/authStore'

export interface UserDetailModalProps {
    user: User | null
    isOpen: boolean
    onClose: () => void
    onUserUpdated?: (updatedUser: User) => void
}

type Tab = 'profile' | 'access' | 'activity'

const INPUT =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black'

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
        setActionError(null)
        setNotice(null)
        setNewRole('')
        setRoleReason('')
        setStatusReason('')
        setAudit([])
        setAuditError(null)
        onClose()
    }, [onClose])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose()
        }
        if (isOpen) window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, handleClose])

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

    if (!isOpen || !user) {
        return null
    }

    // Mirrors the backend: you may act only on someone you strictly outrank, and never on yourself.
    const canManage =
        can(me?.role, 'users.manage') && me?.id !== user.id && rankOf(me?.role) > rankOf(user.role)
    const roleOptions = assignableRoles(me?.role).filter((r) => r !== user.role)
    const targetStatus: 'active' | 'suspended' = user.status === 'suspended' ? 'active' : 'suspended'

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

    const handleStatusChange = async () => {
        if (!statusReason.trim()) return
        setIsUpdating(true)
        setActionError(null)
        setNotice(null)
        try {
            const updated = await userService.updateUserStatus(user.id, targetStatus, statusReason.trim())
            onUserUpdated?.(updated)
            setNotice(targetStatus === 'suspended' ? 'Account suspended.' : 'Account activated.')
            setStatusReason('')
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Failed to update status')
        } finally {
            setIsUpdating(false)
        }
    }

    const tabButton = (id: Tab, label: string) => (
        <button
            type="button"
            onClick={() => openTab(id)}
            className={`px-3 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
                tab === id ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'
            }`}
        >
            {label}
        </button>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
            <div
                className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-black">MEMBER PROFILE DETAILS</h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
                    >
                        X
                    </button>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-black">{user.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        @{user.username} - Role: {user.role} - Status: {user.status}
                    </p>
                </div>

                <div className="flex border-b border-gray-200 gap-1">
                    {tabButton('profile', 'Profile')}
                    {canManage && tabButton('access', 'Role & Access')}
                    {can(me?.role, 'users.view') && tabButton('activity', 'Activity Log')}
                </div>

                {actionError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">{actionError}</div>
                )}
                {notice && <div className="text-xs text-black bg-gray-50 p-2 rounded border border-gray-200">{notice}</div>}

                {tab === 'profile' && (
                    <>
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-black mb-2">CONTACT INFORMATION:</h4>
                            <div className="text-sm space-y-1 text-black">
                                <div>Email: {user.email}</div>
                                <div>Phone: {user.phone}</div>
                                <div>User ID: {user.id}</div>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-black mb-2">CLUB & ACTIVITY STATS:</h4>
                            <div className="text-sm space-y-1 text-black">
                                <div>Total Activity Points: {user.pointsBalance.toLocaleString()} pts</div>
                                <div>Member Since: {user.joinDate}</div>
                                <div>
                                    Last Active: {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : '—'}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {tab === 'access' && canManage && (
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-black">Change Role</h4>
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as UserRole | '')}
                                className={INPUT}
                            >
                                <option value="">Select new role…</option>
                                {roleOptions.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
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
                                <button
                                    type="button"
                                    onClick={handleRoleChange}
                                    disabled={isUpdating || !newRole || !roleReason.trim()}
                                    className="px-3 py-1.5 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {isUpdating ? 'Updating...' : 'Change Role'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-gray-200">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-black">
                                {targetStatus === 'suspended' ? 'Suspend Account' : 'Activate Account'}
                            </h4>
                            <textarea
                                rows={2}
                                maxLength={500}
                                placeholder="Reason (required, stored in the audit log)"
                                value={statusReason}
                                onChange={(e) => setStatusReason(e.target.value)}
                                className={INPUT}
                            />
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleStatusChange}
                                    disabled={isUpdating || !statusReason.trim()}
                                    className={`px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer disabled:opacity-50 ${
                                        targetStatus === 'suspended'
                                            ? 'border border-red-600 bg-red-600 text-white hover:bg-red-700'
                                            : 'border border-black bg-black text-white hover:bg-gray-800'
                                    }`}
                                >
                                    {isUpdating ? 'Updating...' : targetStatus === 'suspended' ? 'Suspend' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'activity' && (
                    <div className="space-y-2">
                        {auditLoading ? (
                            <p className="text-xs text-gray-500">Loading activity…</p>
                        ) : auditError ? (
                            <p className="text-xs text-red-600">{auditError}</p>
                        ) : audit.length === 0 ? (
                            <p className="text-xs text-gray-500">No recorded admin actions for this member.</p>
                        ) : (
                            <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
                                {audit.map((a) => (
                                    <li key={a.id} className="p-2.5 text-xs space-y-0.5">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-black">{a.action}</span>
                                            <span className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className="text-gray-700">
                                            {describe(a.previousValue)} → {describe(a.newValue)}
                                        </div>
                                        {a.reason && <div className="text-gray-500">Reason: {a.reason}</div>}
                                        <div className="text-gray-400 font-mono">by {a.actorId ?? 'system'}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                <div className="flex justify-end pt-3 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-1.5 text-xs border border-black text-black hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
