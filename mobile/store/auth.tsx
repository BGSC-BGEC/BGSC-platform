import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { authRepository, type RegisterDto, type User } from '../src/repositories/AuthRepository';
import { getErrorMessage, setSessionExpiredHandler } from '../src/api/client';
import { tokenStorage } from '../src/api/tokenStorage';

interface AuthContextType {
  isLoggedIn: boolean;
  /** True while a stored session is being restored on app start */
  isBootstrapping: boolean;
  user: User | null;
  authToken: string | null;
  isLoading: boolean;
  error: string | null;
  pendingEmail: string | null;
  setPendingEmail: (email: string | null) => void;
  login: (emailOrUsername: string, password?: string) => Promise<boolean>;
  register: (dto: RegisterDto) => Promise<boolean>;
  verifyOtp: (email: string, code: string) => Promise<boolean>;
  completeProfile: (password?: string, contact?: string) => Promise<boolean>;
  googleSignIn: () => Promise<{ success: boolean; requiresProfileCompletion?: boolean }>;
  forgotPassword: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const dropSession = useCallback(() => {
    setUser(null);
    setAuthToken(null);
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
        await tokenStorage.clear();
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
      const res = await authRepository.login({ emailOrUsername, password });
      setAuthToken(res.token);
      setUser(res.user);
      setIsLoggedIn(true);
    });

  const register = (dto: RegisterDto) =>
    run(async () => {
      const res = await authRepository.register(dto);
      setAuthToken(res.token);
      setUser(res.user);
      setPendingEmail(res.user.isEmailVerified ? null : res.user.email);
      setIsLoggedIn(true);
    });

  const verifyOtp = (email: string, code: string) =>
    run(async () => {
      const res = await authRepository.verifyOtp(email, code);
      setUser(res.user);
      setIsLoggedIn(true);
      setPendingEmail(null);
    });

  const completeProfile = (_password?: string, contact?: string) =>
    run(async () => {
      const res = await authRepository.completeProfile({ contact });
      setUser(res.user);
      setIsLoggedIn(true);
    });

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
      setUser(await authRepository.me());
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
        pendingEmail,
        setPendingEmail,
        login,
        register,
        verifyOtp,
        completeProfile,
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
