import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AdminLayout } from '../components/layout/adminLayout'
import { Login } from '../pages/Login'
import { Dashboard } from '../pages/Dashboard'
import { Users } from '../pages/Users'

export const router = createBrowserRouter([
    { path: '/login', element: <Login /> },
    {
    path: '/',
    element: (
        <RequireAuth>
        <AdminLayout />
        </RequireAuth>
    ),
    children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <Dashboard /> },
        {
        path: 'events',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Events Management Module
            </div>
        ),
        },
        {
        path: 'announcements',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Announcements Module
            </div>
        ),
        },

        {path: 'users', element: <Users />},
        
        {
        path: 'tournaments',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Tournament Brackets Module
            </div>
        ),
        },
        {
        path: 'auction',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Auctions page
            </div>
        ),
        },
        {
        path: 'media',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Media Library page
            </div>
        ),
        },
        {
        path: 'leaderboard',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Leaderboards page
            </div>
        ),
        },
        {
        path: 'feedback',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Feedback and Support page
            </div>
        ),
        },
    ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
])