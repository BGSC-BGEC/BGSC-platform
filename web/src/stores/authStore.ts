import { create } from 'zustand'
import type { AdminUser, UserRole } from '../types/admin'
import { apiClient } from '../services/apiClient'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

interface LoginResponse {
  user: AdminUser & {
    points_balance?: number
  }
  tokens: {
    access_token: string
    refresh_token: string
  }
}

interface AuthState {
  user: AdminUser | null
  status: 'authenticated' | 'unauthenticated' | 'loading'
  login: (
    usernameOrEmail: string,
    password?: string,
    role?: UserRole
  ) => Promise<void>
  logout: () => Promise<void>
}

const getInitialUser = (): AdminUser | null => {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const initialUser = getInitialUser()

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  status: initialUser ? 'authenticated' : 'unauthenticated',

  login: async (
    usernameOrEmail: string,
    password = '',
    role: UserRole = 'coordinator'
  ) => {
    set({ status: 'loading' })

    // 1. Mock Mode
    if (isMock) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      const mockUser: AdminUser = {
        id: 'usr-dev-01',
        username: usernameOrEmail,
        email: `${usernameOrEmail}@bgsc.in`,
        role,
        pointsBalance: 1250,
      }
      localStorage.setItem('auth_user', JSON.stringify(mockUser))
      set({ status: 'authenticated', user: mockUser })
      return
    }

    try {
      const result = await apiClient.post<LoginResponse>('/auth/login', {
        login: usernameOrEmail,
        password,
      })

      if (result && result.tokens) {
        localStorage.setItem('auth_token', result.tokens.access_token)
        localStorage.setItem('refresh_token', result.tokens.refresh_token)
      }

      if (result && result.user) {
        const mappedUser: AdminUser = {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
          role: result.user.role,
          pointsBalance:
            result.user.points_balance ?? result.user.pointsBalance ?? 0,
        }

        localStorage.setItem('auth_user', JSON.stringify(mappedUser))
        set({ status: 'authenticated', user: mappedUser })
      }
    } catch (err) {
      set({ status: 'unauthenticated', user: null })
      throw err
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken })
      } catch (err) {
        console.warn(
          '[authStore] Server-side logout failed (proceeding with local cleanup):',
          err
        )
      }
    }
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    set({ user: null, status: 'unauthenticated' })
  },
}))

export default useAuthStore