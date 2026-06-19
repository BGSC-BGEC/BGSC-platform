/**
 * API Client Instance (Mobile)
 * Singleton API client for the mobile application
 */

import ApiClient from '@bgsc/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/auth.store';

const apiClient = new ApiClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '10000'),
  onTokenRefresh: async () => {
    // Implement token refresh logic for mobile
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Call refresh endpoint
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }
      );

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const { setTokens } = useAuthStore.getState();
      setTokens(data.accessToken, data.refreshToken);

      return data.accessToken;
    } catch (error) {
      const { clearAuth } = useAuthStore.getState();
      clearAuth();
      throw error;
    }
  },
  onUnauthorized: () => {
    const { clearAuth } = useAuthStore.getState();
    clearAuth();
    // Navigation to login will be handled by the app's navigation listener
  },
});

export default apiClient;
