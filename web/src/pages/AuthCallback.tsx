import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../core/stores/authStore'

function parseHash(): { token: string | null; isNewUser: boolean } {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return {
    token: params.get('access_token'),
    isNewUser: params.get('is_new_user') === 'true',
  }
}

/**
 * Handles the Google OAuth2 redirect. The auth-service redirects here with the
 * access token in the URL fragment: `/auth/callback#access_token=...&is_new_user=...`
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const adoptToken = useAuthStore((s) => s.adoptToken)
  // Parse the fragment once during render (no setState-in-effect).
  const [{ token, isNewUser }] = useState(parseHash)
  const [error, setError] = useState<string | null>(
    token ? null : 'No access token found in the callback URL.',
  )
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !token) return
    ran.current = true

    adoptToken(token)
      .then(() => {
        navigate(isNewUser ? '/events?welcome=1' : '/events', { replace: true })
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Sign-in failed.'),
      )
  }, [adoptToken, navigate, token, isNewUser])

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center dark:bg-slate-950">
      {error ? (
        <div>
          <p className="mb-3 text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white"
          >
            Back to login
          </button>
        </div>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">Signing you in…</p>
      )}
    </div>
  )
}
