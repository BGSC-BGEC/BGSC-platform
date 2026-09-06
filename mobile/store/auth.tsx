import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authRepository, type User } from '../src/repositories/AuthRepository';

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  authToken: string | null;
  isLoading: boolean;
  error: string | null;
  pendingEmail: string | null;
  setPendingEmail: (email: string | null) => void;
  login: (emailOrUsername: string, password?: string) => Promise<boolean>;
  register: (email: string, password?: string, contact?: string) => Promise<boolean>;
  verifyOtp: (email: string, code: string) => Promise<boolean>;
  completeProfile: (password?: string, contact?: string) => Promise<boolean>;
  googleSignIn: () => Promise<{ success: boolean; requiresProfileCompletion?: boolean }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'authToken';

const DEFAULT_USER: User = {
  id: '001',
  username: 'Jeet',
  email: 'jeet@example.com',
  role: 'user',
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [user, setUser] = useState<User | null>(DEFAULT_USER);
  const [authToken, setAuthToken] = useState<string | null>('mock_token_dev');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check persisted token on startup
    const bootstrap = async () => {
      try {
        let token: string | null = null;
        if (Platform.OS === 'web') {
          token = localStorage.getItem(TOKEN_KEY);
        } else {
          token = await SecureStore.getItemAsync(TOKEN_KEY);
        }
        if (token === 'logged_out') {
          setIsLoggedIn(false);
          setUser(null);
          setAuthToken(null);
        } else if (token) {
          setAuthToken(token);
          setUser(DEFAULT_USER);
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('Error bootstrapping auth:', err);
      }
    };
    void bootstrap();
  }, []);

  const saveToken = async (token: string) => {
    setAuthToken(token);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (e) {
      console.warn('Error saving token to secure store:', e);
    }
  };

  const removeToken = async () => {
    setAuthToken(null);
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Error removing token from secure store:', e);
    }
  };

  const login = async (emailOrUsername: string, password?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authRepository.login({ emailOrUsername, password });
      await saveToken(res.token);
      setUser(res.user);
      setIsLoggedIn(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password?: string, contact?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await authRepository.register({ email, password, contact });
      setPendingEmail(email);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, code: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authRepository.verifyOtp(email, code);
      await saveToken(res.token);
      setUser(res.user);
      setIsLoggedIn(true);
      setPendingEmail(null);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const completeProfile = async (password?: string, contact?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authRepository.completeProfile({ password, contact });
      await saveToken(res.token);
      setUser(res.user);
      setIsLoggedIn(true);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to complete profile.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async (): Promise<{ success: boolean; requiresProfileCompletion?: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authRepository.googleSignIn();
      if (res.requiresProfileCompletion) {
        setUser(res.user);
        return { success: true, requiresProfileCompletion: true };
      }
      await saveToken(res.token);
      setUser(res.user);
      setIsLoggedIn(true);
      return { success: true, requiresProfileCompletion: false };
    } catch (err: any) {
      setError(err?.message || 'Google sign-in was cancelled or failed.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await saveToken('logged_out');
    setUser(null);
    setIsLoggedIn(false);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
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
