import React, { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const ERROR_MESSAGES: Record<string, string> = {
  google_oauth_not_configured: "Google sign-in isn't set up on the server yet",
  google_email_unverified: 'Your Google email is not verified',
  account_deactivated: 'This account has been deactivated',
  invalid_oauth_state: 'Sign-in expired, try again',
}

const isSafePath = (p: string | null): p is string =>
  !!p && p.startsWith('/') && !p.startsWith('//') && !p.startsWith('/\\')

export const AuthCallback: React.FC = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithGoogleCode } = useAuthStore()
  // login_code is single-use; StrictMode runs effects twice in dev.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const fail = (code: string | null) =>
      navigate('/login', {
        replace: true,
        state: {
          oauthError:
            (code && ERROR_MESSAGES[code]) || 'Google sign-in failed. Please try again.',
        },
      })

    const loginCode = params.get('login_code')
    if (!loginCode) {
      fail(params.get('error'))
      return
    }

    const state = params.get('state')
    loginWithGoogleCode(loginCode)
      .then(() => navigate(isSafePath(state) ? state : '/dashboard', { replace: true }))
      .catch((err) => fail(err instanceof Error ? err.message : null))
  }, [params, navigate, loginWithGoogleCode])

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 text-sm text-gray-500">
      Signing you in...
    </div>
  )
}

export default AuthCallback
