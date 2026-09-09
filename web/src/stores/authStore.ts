import { create } from 'zustand'
import type { AdminUser, UserRole } from '../types/admin'

interface AuthState {
    user: AdminUser | null;
    status: 'authenticated' | 'unauthenticated' | 'loading';
    login: (username: string, role?: UserRole) => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    status: 'unauthenticated',

    login: async (username: string, role: UserRole = 'coordinator') => {
    set({ status: 'loading' })
    // Instant frontend mock login for development
    await new Promise((resolve) => setTimeout(resolve, 250))
    set({
        status: 'authenticated',
        user: {
        id: 'usr-dev-01',
        username,
        email: `${username}@bgsc.in`,
        role,
        pointsBalance: 1250,
        },
    })
    },

    logout: () => {
    set({ user: null, status: 'unauthenticated' })
    },
}))