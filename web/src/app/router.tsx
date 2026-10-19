import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AdminLayout } from '../components/layout/adminLayout'
import { Login } from '../pages/Login'
import { Dashboard } from '../pages/Dashboard'
import { Users } from '../pages/Users'
import { Events } from '../pages/Events'
import { Announcements } from '../pages/Announcements'
import { Tournaments } from '../pages/Tournaments'
import { Leaderboard } from '../pages/Leaderboard'
import { Auction } from '../pages/Auction'
import { Feedback } from '../pages/Feedback'
import { Media } from '../pages/Media'

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
            element: <Events />,
        },
        
        {
            path: 'announcements',
            element: <Announcements />,
        },

        {path: 'users', element: <Users />},
        
        {
            path: 'tournaments',
            element: <Tournaments />,
        },
        {
            path: 'auction',
            element: <Auction />,
        },
        {
            path: 'media',
            element: <Media />,
        },
        {
            path: 'leaderboard',
            element: <Leaderboard />,
        },
        {
            path: 'feedback',
            element: <Feedback />,
        },
    ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
])