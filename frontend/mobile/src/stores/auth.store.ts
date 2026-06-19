/**
 * Auth Store (Zustand)
 * Global authentication state management
 */

import { create } from 'zustand';
import { User, AuthState, UserRole } from '@bgsc/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  setUser: (user) => {
    set({ user });
    // Persist user
    if (user) {
      AsyncStorage.setItem('user', JSON.stringify(user)).catch((err) =>
        console.error('Failed to save user:', err)
      );
    } else {
      AsyncStorage.removeItem('user').catch((err) =>
        console.error('Failed to clear user:', err)
      );
    }
  },

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken, isAuthenticated: !!accessToken });
    // Persist tokens
    AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
    ]).catch((err) => console.error('Failed to save tokens:', err));
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
    AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']).catch((err) =>
      console.error('Failed to clear auth data:', err)
    );
  },

  initialize: async () => {
    try {
      set({ loading: true });
      const [accessToken, refreshToken, userJson] = await AsyncStorage.multiGet([
        'accessToken',
        'refreshToken',
        'user',
      ]);

      if (accessToken[1] && refreshToken[1]) {
        const user = userJson[1] ? JSON.parse(userJson[1]) : null;
        set({
          accessToken: accessToken[1],
          refreshToken: refreshToken[1],
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
