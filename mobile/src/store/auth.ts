import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../src/api/client';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  googleSignIn: () => Promise<{ success: boolean; requiresProfileCompletion?: boolean }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Restore session on app boot
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token) {
          // Verify token or fetch current user details
          const { data } = await apiClient.get('/users/me');
          setUser(data);
        }
      } catch (e) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    };
    checkSession();
  }, []);

  const login = async (emailOrUsername: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', {
        emailOrUsername,
        password,
      });

      const { accessToken, refreshToken, user: userData } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      setUser(userData);
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? 'Network error. Ensure your NestJS backend is running.'
          : 'Login failed. Please check your credentials.');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Placeholder for Google OAuth execution
      return { success: true, requiresProfileCompletion: false };
    } catch (err: any) {
      setError('Google Sign-In failed.');
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
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
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};