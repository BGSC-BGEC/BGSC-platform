import React from "react"
import type { User } from '../../types/user'


export interface UserTableProps {
    users: User[]
    onViewUser: (user: User) => void
}

export const UserTable: React.FC<UserTableProps> = ({ users, onViewUser }) => {
    return (
    <table className="w-full text-left border-collapse">
        <thead>
        <tr>
            <th className="p-4">Member</th>
            <th className="p-4">Role</th>
            <th className="p-4">Status</th>
            <th className="p-4">Points</th>
            <th className="p-4">Joined Date</th>
            <th className="p-4">Actions</th>
        </tr>
        </thead>
        <tbody>
        {users.length === 0 ? (
            <tr>
            <td colSpan={6} className="p-4 text-center">No members found matching your criteria.</td>
            </tr>
        ) : (
            users.map((user) => (
            <tr key={user.id}>
                <td className="p-4">
                <div>{user.name}</div>
                <div>@{user.username} - {user.email}</div>
                </td>
                <td className="p-4">{user.role}</td>
                <td className="p-4">{user.status}</td>
                <td className="p-4">{user.pointsBalance}</td>
                <td className="p-4">{user.joinDate}</td>
                <td className="p-4">
                <button type="button" onClick={() => onViewUser(user)}>
                    View
                </button>
                </td>
            </tr>
            ))
        )}
        </tbody>
    </table>
    )
}