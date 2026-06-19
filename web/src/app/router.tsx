import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { RequireAuth } from '../components/RequireAuth'
import { Login } from '../pages/Login'
import { AuthCallback } from '../pages/AuthCallback'
import { Events } from '../pages/Events'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      { path: 'events', element: <Events /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
