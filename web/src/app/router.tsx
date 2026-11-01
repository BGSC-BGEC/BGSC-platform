import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AdminLayout } from '../components/layout/adminLayout'
import { Landing } from '../pages/Landing'
import { Login } from '../pages/Login'
import { AuthCallback } from '../pages/AuthCallback'
import { Dashboard } from '../pages/Dashboard'
import { Users } from '../pages/Users'
import { Events } from '../pages/Events'
import { Announcements } from '../pages/Announcements'
import { Tournaments } from '../pages/Tournaments'
import { Leaderboard } from '../pages/Leaderboard'
import { Auction } from '../pages/Auction'
import { Feedback } from '../pages/Feedback'
import { Media } from '../pages/Media'
import { Challenges } from '../pages/Challenges'
import { HallOfFame } from '../pages/HallOfFame'
import { NavbarDemo } from '../pages/NavbarDemo'

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/landing', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/navbar', element: <NavbarDemo /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'events', element: <Events /> },
      { path: 'announcements', element: <Announcements /> },
      { path: 'users', element: <Users /> },
      { path: 'tournaments', element: <Tournaments /> },
      { path: 'auction', element: <Auction /> },
      { path: 'media', element: <Media /> },
      { path: 'leaderboard', element: <Leaderboard /> },
      { path: 'feedback', element: <Feedback /> },
      { path: 'challenges', element: <Challenges /> },
      { path: 'hall-of-fame', element: <HallOfFame /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
