import React, { useState, useEffect, useCallback } from 'react'
import type { User } from '../../types/user'
import { userService } from '../../services/userService'

export interface UserDetailModalProps {
    user: User | null
    isOpen: boolean
    onClose: () => void
    onUserUpdated?: (updatedUser: User) => void
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
    user,
    isOpen,
    onClose,
    onUserUpdated,
}) => {
    const [isUpdating, setIsUpdating] = useState(false)
    const [isConfirming, setIsConfirming] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const handleClose = useCallback(() => {
        setIsConfirming(false)
        setActionError(null)
        onClose()
    }, [onClose])

    useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
        handleClose()
        }
    }

    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
        window.removeEventListener('keydown', handleKeyDown)
    }
    }, [isOpen, handleClose])

    if (!isOpen || !user) {
    return null
    }

    const targetStatus: 'active' | 'suspended' =
        user.status === 'suspended' ? 'active' : 'suspended'

    const handleToggleStatus = async () => {
        setIsUpdating(true)
        setActionError(null)

        const updatedUser = await userService.updateUserStatus(user.id, targetStatus)
        if (updatedUser) {
            onUserUpdated?.(updatedUser)
            setIsConfirming(false)
        } else {
            setActionError('Failed to update member status')
        }
        setIsUpdating(false)
    }

    return (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={handleClose}
    >
        <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            MEMBER PROFILE DETAILS
            </h2>
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
        <div className="border-b border-gray-200" />

        <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-black mb-2">
            CONTACT INFORMATION:
            </h4>
            <div className="text-sm space-y-1 text-black">
            <div>Email: {user.email}</div>
            <div>Phone: {user.phone}</div>
            <div>User ID: {user.id}</div>
            </div>
        </div>

        <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-black mb-2">
            CLUB & ACTIVITY STATS:
            </h4>
            <div className="text-sm space-y-1 text-black">
            <div>
                Total Activity Points: {user.pointsBalance.toLocaleString()} pts
            </div>
            <div>Member Since: {user.joinDate}</div>
            </div>
        </div>
        <div className="pt-3 border-t border-gray-200 space-y-3">
            {actionError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                    {actionError}
                </div>
            )}

            {isConfirming ? (
                <div className="p-3 border border-gray-200 bg-gray-50 rounded space-y-2">
                    <p className="text-xs font-semibold text-black">
                        Are you sure you want to {targetStatus === 'suspended' ? 'suspend' : 'activate'} this account?
                    </p>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsConfirming(false)}
                            disabled={isUpdating}
                            className="px-3 py-1.5 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleStatus}
                            disabled={isUpdating}
                            className={`px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                                targetStatus === 'suspended'
                                    ? 'border border-red-600 bg-red-600 text-white hover:bg-red-700'
                                    : 'border border-black bg-black text-white hover:bg-gray-800'
                            } disabled:opacity-50`}
                        >
                            {isUpdating ? 'Updating...' : 'Yes, Confirm'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div>
                        {user.status === 'suspended' ? (
                            <button
                                type="button"
                                onClick={() => setIsConfirming(true)}
                                className="px-3 py-1.5 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
                            >
                                Activate Account
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsConfirming(true)}
                                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 text-red-600 hover:border-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            >
                                Suspend Account
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-1.5 text-xs border border-black text-black hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
        </div>
    </div>
    )
}