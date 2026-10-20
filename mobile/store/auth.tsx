import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  AccountDeactivatedError,
  authRepository,
  type RegisterDto,
  type User,
} from '../src/repositories/AuthRepository';
import { ApiError, getErrorMessage, setSessionExpiredHandler } from '../src/api/client';
import { tokenStorage } from '../src/api/tokenStorage';

interface AuthContextType {
  isLoggedIn: boolean;
  /** True while a stored session is being restored on app start */
  isBootstrapping: boolean;
  user: User | null;
  authToken: string | null;
  isLoading: boolean;
  error: string | null;
  /** Signed in but still on the post-sign-up steps (verify email → interests). */
  onboarding: OnboardingStep | null;
  setOnboarding: (step: OnboardingStep | null) => void;
  /** Set when login hit a soft-deleted account that can still be restored. */
  restoreCandidate: RestoreCandidate | null;
  login: (emailOrUsername: string, password?: string) => Promise<boolean>;
  register: (dto: RegisterDto) => Promise<boolean>;
  restoreAccount: () => Promise<boolean>;
  cancelRestore: () => void;
  googleSignIn: () => Promise<{ success: boolean; requiresProfileCompletion?: boolean }>;
  forgotPassword: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export type OnboardingStep = 'verify' | 'interests';

export interface RestoreCandidate {
  login: string;
  password: string;
  daysRemaining: number | null;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStep | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<RestoreCandidate | null>(null);

  const dropSession = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    setOnboarding(null);
    setIsLoggedIn(false);
  }, []);

  useEffect(() => {
    // Refresh token rejected by the server → send the member back to login.
    setSessionExpiredHandler(dropSession);
    return () => setSessionExpiredHandler(null);
  }, [dropSession]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!(await authRepository.hasStoredSession())) return;
        // /users/me transparently refreshes an expired access token.
        const me = await authRepository.me();
        const { accessToken } = await tokenStorage.get();
        setUser(me);
        setAuthToken(accessToken);
        setIsLoggedIn(true);
      } catch (err) {
        console.warn('Could not restore session:', err);
        // Only a rejected session is dropped; offline at launch keeps the tokens for the next start.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) await tokenStorage.clear();
        dropSession();
      } finally {
        setIsBootstrapping(false);
      }
    };
    void bootstrap();
  }, [dropSession]);

  const run = async (task: () => Promise<void>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const login = (emailOrUsername: string, password?: string) =>
    run(async () => {
      try {
        const res = await authRepository.login({ emailOrUsername, password });
        setAuthToken(res.token);
        setUser(res.user);
        setIsLoggedIn(true);
        // The auth payload is a slim user; pull the full profile (points, rank) in the background.
        void refreshUser();
      } catch (err) {
        // Not an error for the form: the login screen moves on to Restore account.
        if (err instanceof AccountDeactivatedError) {
          setRestoreCandidate({ login: emailOrUsername, password: password ?? '', daysRemaining: err.daysRemaining });
          return;
        }
        throw err;
      }
    });

  const register = (dto: RegisterDto) =>
    run(async () => {
      const res = await authRepository.register(dto);
      setAuthToken(res.token);
      setUser(res.user);
      // Sign-up lands on the onboarding steps before the main app.
      setOnboarding(res.user.isEmailVerified ? 'interests' : 'verify');
      setIsLoggedIn(true);
    });

  const restoreAccount = () =>
    run(async () => {
      if (!restoreCandidate) throw new Error('Log in again to restore your account.');
      let res;
      try {
        res = await authRepository.reactivate({
          emailOrUsername: restoreCandidate.login,
          password: restoreCandidate.password,
        });
      } catch (err) {
        // Held credentials no longer work (password changed, window lapsed): start over from Login.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          throw new Error('We couldn’t restore this account. Go back and log in again.');
        }
        throw err;
      }
      setRestoreCandidate(null);
      setAuthToken(res.token);
      setUser(res.user);
      setIsLoggedIn(true);
      void refreshUser();
    });

  const cancelRestore = () => setRestoreCandidate(null);

  const googleSignIn = async () => {
    const ok = await run(async () => {
      await authRepository.googleSignIn();
    });
    return { success: ok, requiresProfileCompletion: false };
  };

  const forgotPassword = (email: string) =>
    run(async () => {
      await authRepository.forgotPassword(email);
    });

  const refreshUser = async () => {
    try {
      const me = await authRepository.me();
      // Logged out while this was in flight: don't resurrect the user.
      if (!(await tokenStorage.get()).accessToken) return;
      setUser(me);
    } catch (err) {
      console.warn('Could not refresh user:', err);
    }
  };

  const logout = async () => {
    await authRepository.logout();
    dropSession();
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isBootstrapping,
        user,
        authToken,
        isLoading,
        error,
        onboarding,
        setOnboarding,
        restoreCandidate,
        login,
        register,
        restoreAccount,
        cancelRestore,
        googleSignIn,
        forgotPassword,
        refreshUser,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
