import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../core/stores/authStore'

export function EmailOtpPage() {
  const navigate = useNavigate()
  const pending = useAuthStore((s) => s.pendingRegistration)
  const verifyEmail = useAuthStore((s) => s.verifyEmail)
  const resend = useAuthStore((s) => s.resendRegistrationCode)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageIsError, setMessageIsError] = useState(false)

  if (!pending) {
    return <Shell message="Registration verification expired. Please sign up again." onBack={() => navigate('/login', { replace: true })} />
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return
    setBusy(true)
    setMessage(null)
    setMessageIsError(false)
    try {
      await verifyEmail(code)
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid verification code.')
      setMessageIsError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950">
      <section className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Verify your email</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Enter the 6-digit code sent to {pending.email}.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Email verification code"
            autoFocus
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.4em] text-slate-900 outline-none focus:border-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {message && (
            <p className={`text-sm ${messageIsError ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {message}
            </p>
          )}
          <button type="submit" disabled={busy || code.length !== 6} className={buttonClass}>
            {busy ? 'Verifying…' : 'Verify and continue'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => void resend()
            .then(() => { setMessageIsError(false); setMessage('A new code was sent.') })
            .catch((error) => { setMessageIsError(true); setMessage(error instanceof Error ? error.message : 'Could not resend code.') })}
          className="w-full text-sm text-violet-600 hover:underline dark:text-violet-400"
        >
          Resend code
        </button>
      </section>
    </main>
  )
}

const buttonClass = 'w-full rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50'

function Shell({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950">
      <section className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 dark:bg-slate-900">
        <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        <button type="button" onClick={onBack} className={buttonClass}>Back to sign up</button>
      </section>
    </main>
  )
}
