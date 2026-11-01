import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Mail, X } from 'lucide-react'
import { SpaceLogin } from '@/components/ui/space-login'
import { useAuthStore } from '@/stores/authStore'
import type { UserRole } from '@/types/admin'

interface LoginProps {
  title?: string
  subtitle?: string
  availableRoles?: UserRole[]
}

const DEFAULT_ROLES: UserRole[] = ['coordinator', 'founder', 'core']
const isMock = import.meta.env.VITE_USE_MOCK === 'true'
const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000'
).replace(/\/+$/, '')

export const Login: React.FC<LoginProps> = ({
  title = 'BGSC Admin Console',
  subtitle = 'Coordinators, Core Organizers & Founders Access',
  availableRoles = DEFAULT_ROLES,
}) => {
  const [role, setRole] = useState<UserRole>(availableRoles[0] || 'coordinator')
  const [showAccessModal, setShowAccessModal] = useState(false)
  const location = useLocation()
  const routeState = location.state as
    | { from?: { pathname: string; search?: string }; oauthError?: string }
    | null
  const [errorMessage, setErrorMessage] = useState<string | null>(
    routeState?.oauthError ?? null
  )

  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleGoogle = () => {
    const from = routeState?.from
    const returnPath = from ? from.pathname + (from.search ?? '') : '/dashboard'
    window.location.assign(
      `${API_URL}/auth/google?state=${encodeURIComponent(returnPath)}`
    )
  }

  const handleSubmit = async (data: {
    email: string
    password: string
    rememberMe: boolean
    role?: UserRole
  }) => {
    setErrorMessage(null)
    const effectiveRole = data.role || role

    try {
      await login(data.email, data.password, effectiveRole)
      // Slight delay for celebratory feedback before navigation
      await new Promise((resolve) => setTimeout(resolve, 600))
      const from = routeState?.from
      const returnPath = from ? from.pathname + (from.search ?? '') : '/dashboard'
      navigate(returnPath, { replace: true })
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid credentials or backend unreachable'
      setErrorMessage(msg)
      throw err
    }
  }

  return (
    <>
      <SpaceLogin
        title={title}
        subtitle={subtitle}
        onSubmit={handleSubmit}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage(null)}
        onGoogleLogin={handleGoogle}
        onBackToLanding={() => navigate('/')}
        onSignUp={() => setShowAccessModal(true)}
        availableRoles={availableRoles}
        selectedRole={role}
        onRoleChange={setRole}
        isMockMode={isMock}
        showSocialButtons={true}
        glassVariant="default"
      />

      {/* Request Access Info Modal */}
      <AnimatePresence>
        {showAccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative w-full max-w-md p-6 sm:p-7 rounded-2xl bg-[#0a0f1d] border border-amber-500/30 text-white shadow-[0_0_50px_rgba(245,158,11,0.2)]"
            >
              <button
                type="button"
                onClick={() => setShowAccessModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Privileged Campus Access</h3>
                  <p className="text-xs text-amber-300/80">Coordinators & Staff Only</p>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-[13px] text-neutral-300 leading-relaxed mb-6">
                <p>
                  The <strong className="text-white">BGSC Admin Console</strong> is restricted to verified event coordinators, founding team members, and tournament managers.
                </p>
                <p>
                  If you are leading an upcoming collegiate esports tournament, sports cup, or live player auction, contact the campus founders committee with your department details to receive your access credentials.
                </p>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5 text-xs text-neutral-200">
                  <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>founders@bgsc.in &bull; Student Council Block #4</span>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAccessModal(false)}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Login
