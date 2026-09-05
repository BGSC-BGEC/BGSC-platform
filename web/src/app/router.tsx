import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AdminLayout } from '../components/layout/adminLayout'
import { Login } from '../pages/Login'
import { Dashboard } from '../pages/Dashboard'

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
        {
        path: 'users',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Users Directory Module
            </div>
        ),
        },
        {
        path: 'tournaments',
        element: (
            <div className="p-6 rounded border border-gray-200 bg-white text-gray-700 text-sm">
            Tournament Brackets Module
            </div>
        ),
        },
    ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
])