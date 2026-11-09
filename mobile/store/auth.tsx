import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  AccountDeactivatedError,
  authRepository,
  type AuthResponse,
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
  /** Signed in but still on the post-sign-up step (interests). */
  onboarding: OnboardingStep | null;
  setOnboarding: (step: OnboardingStep | null) => void;
  /** Set when login hit a soft-deleted account that can still be restored. */
  restoreCandidate: RestoreCandidate | null;
  login: (emailOrUsername: string, password?: string) => Promise<boolean>;
  /** Starts sign-up; on success the emailed code is checked by completeRegistration. */
  register: (dto: RegisterDto) => Promise<{ success: boolean; email?: string; expiresIn?: number }>;
  /** Verifies the sign-up code, creates the account and signs in. Throws (SignUpAgainError when expired). */
  completeRegistration: (email: string, otp: string, contact?: string) => Promise<void>;
  restoreAccount: () => Promise<boolean>;
  cancelRestore: () => void;
  googleSignIn: () => Promise<{ success: boolean; cancelled?: boolean; requiresProfileCompletion?: boolean }>;
  /** Deep-link fallback for the Google redirect; a no-op when no sign-in is pending. */
  completeGoogleCallback: (url: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  devLogin: () => void;
}

export type OnboardingStep = 'interests';

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
        if (!(await authRepository.hasStoredSession())) {
          if (__DEV__) {
            await tokenStorage.set('mock-jwt-access-token', 'mock-jwt-refresh-token');
          } else {
            return;
          }
        }
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

  const register = async (dto: RegisterDto) => {
    let pending: Awaited<ReturnType<typeof authRepository.register>> | undefined;
    const ok = await run(async () => {
      // No account yet: the Register screen moves on to Verify email.
      pending = await authRepository.register(dto);
    });
    return { success: ok, email: pending?.email, expiresIn: pending?.expiresIn };
  };

  const completeRegistration = async (email: string, otp: string, contact?: string) => {
    const res = await authRepository.completeRegistration(email, otp);
    try {
      const updated = await authRepository.setPhoneNumber(contact);
      if (updated) res.user = updated;
    } catch {
      // Non-blocking: the member can add their number later from Edit profile.
    }
    setAuthToken(res.token);
    setUser(res.user);
    // Sign-up lands on the interests step before the main app.
    setOnboarding('interests');
    setIsLoggedIn(true);
    void refreshUser();
  };

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

  const signInWith = (res: AuthResponse) => {
    setAuthToken(res.token);
    setUser(res.user);
    setIsLoggedIn(true);
    void refreshUser();
  };

  const googleSignIn = async () => {
    let cancelled = false;
    const ok = await run(async () => {
      const res = await authRepository.googleSignIn();
      // Browser closed: not an error. 'handled': the deep-link fallback is signing in.
      if (res === 'cancelled') cancelled = true;
      if (typeof res === 'string') return;
      signInWith(res);
    });
    return { success: ok && !cancelled, cancelled, requiresProfileCompletion: false };
  };

  const completeGoogleCallback = async (url: string) => {
    try {
      const res = await authRepository.completeGoogleSignIn(url);
      if (res) signInWith(res);
    } catch (err) {
      setError(getErrorMessage(err));
    }
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

  
  const devLogin = () => {
    setUser({
      id: 'dev-user-001',
      username: 'zenodev',
      email: 'zeno@goa.bits-pilani.ac.in',
      fullName: 'Zeno Developer',
      role: 'member',
      isEmailVerified: true,
      pointsBalance: 1250,
    });
    setAuthToken('dev-mock-token');
    setOnboarding(null);
    setIsLoggedIn(true);
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
        completeRegistration,
        restoreAccount,
        cancelRestore,
        googleSignIn,
        completeGoogleCallback,
        forgotPassword,
        refreshUser,
        logout,
        clearError,
        devLogin,
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
