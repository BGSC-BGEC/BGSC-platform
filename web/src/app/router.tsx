import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { AdminLayout } from '../components/layout/adminLayout'

const Landing = lazy(() => import('../pages/Landing'))
const Login = lazy(() => import('../pages/Login'))
const AuthCallback = lazy(() => import('../pages/AuthCallback'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Users = lazy(() => import('../pages/Users'))
const Events = lazy(() => import('../pages/Events'))
const Announcements = lazy(() => import('../pages/Announcements'))
const Tournaments = lazy(() => import('../pages/Tournaments'))
const Leaderboard = lazy(() => import('../pages/Leaderboard'))
const Auction = lazy(() => import('../pages/Auction'))
const Feedback = lazy(() => import('../pages/Feedback'))
const Media = lazy(() => import('../pages/Media'))
const Challenges = lazy(() => import('../pages/Challenges'))
const HallOfFame = lazy(() => import('../pages/HallOfFame'))

const PageLoader = () => (
  <div className="flex h-64 w-full items-center justify-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
)

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
)

export const router = createBrowserRouter([
  { path: '/', element: withSuspense(Landing) },
  { path: '/landing', element: withSuspense(Landing) },
  { path: '/login', element: withSuspense(Login) },
  { path: '/auth/callback', element: withSuspense(AuthCallback) },
  {
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { path: 'dashboard', element: withSuspense(Dashboard) },
      { path: 'events', element: withSuspense(Events) },
      { path: 'announcements', element: withSuspense(Announcements) },
      { path: 'users', element: withSuspense(Users) },
      { path: 'tournaments', element: withSuspense(Tournaments) },
      { path: 'auction', element: withSuspense(Auction) },
      { path: 'media', element: withSuspense(Media) },
      { path: 'leaderboard', element: withSuspense(Leaderboard) },
      { path: 'feedback', element: withSuspense(Feedback) },
      { path: 'challenges', element: withSuspense(Challenges) },
      { path: 'hall-of-fame', element: withSuspense(HallOfFame) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
