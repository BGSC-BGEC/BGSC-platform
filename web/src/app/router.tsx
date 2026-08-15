import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AdminLayout } from '../components/layout/AdminLayout'
import { AdminProvider } from '../context/AdminContext'
import { Login } from '../pages/Login'
import { AuthCallback } from '../pages/AuthCallback'
import { Events } from '../pages/Events'
import { AnnouncementsPage } from '../pages/AnnouncementsPage'
import { UsersPage } from '../pages/UsersPage'
import { ComingSoon } from '../components/ComingSoon'

function AdminShell() {
  return (
    <AdminProvider>
      <AdminLayout />
    </AdminProvider>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      { path: 'events', element: <Events /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'broadcasts', element: <ComingSoon title="Broadcast Engine" /> },
      { path: 'bracket', element: <ComingSoon title="Bracket Manager" /> },
      { path: 'captains', element: <ComingSoon title="Captain Applications" /> },
      { path: 'auctions', element: <ComingSoon title="Auction Controller" /> },
      { path: 'scoring', element: <ComingSoon title="Scoring Engine" /> },
      { path: 'investments', element: <ComingSoon title="Points & Investments" /> },
      { path: 'tickets', element: <ComingSoon title="Feedback Tickets" /> },
      { path: 'moderation', element: <ComingSoon title="Moderation Queue" /> },
      { path: 'settings', element: <ComingSoon title="System Settings" /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
