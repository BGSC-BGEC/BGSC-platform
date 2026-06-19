/**
 * Auth Store (Zustand) - Web
 * Global authentication state management for web app
 */

import { create } from 'zustand';
import { User, AuthState, UserRole } from '@bgsc/shared';

interface AuthStoreState extends AuthState {
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  initialize: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isCoordinator: () => boolean;
  isFounder: () => boolean;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  // Initial State
  isAuthenticated: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  loading: true,
  error: null,

  // Actions
  setUser: (user) => set({ user }),

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken, isAuthenticated: !!accessToken });
    // Persist tokens
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearAuth: () => {
    set({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    });
    // Clear persisted data
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  initialize: async () => {
    try {
      set({ loading: true });
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const userJson = localStorage.getItem('user');

      if (accessToken && refreshToken) {
        const user = userJson ? JSON.parse(userJson) : null;
        set({
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      set({ loading: false });
    }
  },

  hasRole: (role) => {
    const user = get().user;
    if (!user) return false;
    // Simple role hierarchy check
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.MEMBER]: 2,
      [UserRole.CORE]: 3,
      [UserRole.COORDINATOR]: 4,
      [UserRole.FOUNDER]: 5,
    };
    return roleHierarchy[user.role] >= roleHierarchy[role];
  },

  isCoordinator: () => {
    const user = get().user;
    return user?.role === UserRole.COORDINATOR || user?.role === UserRole.FOUNDER;
  },

  isFounder: () => {
    const user = get().user;
    return user?.role === UserRole.FOUNDER;
  },
}));
