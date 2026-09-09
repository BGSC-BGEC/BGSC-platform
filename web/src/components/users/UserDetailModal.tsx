import React, { useEffect } from 'react'
import type { User } from '../../types/user'

export interface UserDetailModalProps {
    user: User | null
    isOpen: boolean
    onClose: () => void
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
    user,
    isOpen,
    onClose,
}) => {
    useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
        onClose()
        }
    }

    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
        window.removeEventListener('keydown', handleKeyDown)
    }
    }, [isOpen, onClose])

    if (!isOpen || !user) {
    return null
    }

    return (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
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
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-
white"
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
        <div className="flex justify-end pt-3 border-t border-gray-200">
            <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-black text-black hover:bg-black hover:text-white"
            >
            Close
            </button>
        </div>
        </div>
    </div>
    )
}