import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../core/stores/authStore'
import { AuthRepository } from '../core/repositories/AuthRepository'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

type Mode = 'login' | 'register'

/**
 * Login / Register page. The "View" — it reads/writes the auth store (the
 * shared ViewModel-equivalent for global auth state).
 */
export function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const [mode, setMode] = useState<Mode>('login')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTos, setAcceptedTos] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ usernameOrEmail, password })
      } else {
        await register({ username, email, password, acceptedTos })
      }
      navigate('/events', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Coordinator / Founder console access.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'login' ? (
            <Field
              label="Username or email"
              value={usernameOrEmail}
              onChange={setUsernameOrEmail}
              autoComplete="username"
            />
          ) : (
            <>
              <Field
                label="Username"
                value={username}
                onChange={setUsername}
                autoComplete="username"
              />
              <Field
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
            </>
          )}

          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mode === 'register' && (
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={acceptedTos}
                onChange={(e) => setAcceptedTos(e.target.checked)}
                className="mt-0.5"
              />
              I accept the Terms of Service and Privacy Policy.
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || (mode === 'register' && !acceptedTos)}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>

          <a
            href={AuthRepository.googleAuthUrl()}
            className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Continue with Google
          </a>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
          className="mt-4 w-full text-center text-sm text-violet-600 hover:underline dark:text-violet-400"
        >
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  )
}
