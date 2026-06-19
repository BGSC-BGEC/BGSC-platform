/**
 * API Client Instance (Web)
 * Singleton API client for the web application
 */

import { ApiClient } from '@bgsc/shared';
import { useAuthStore } from '../stores/auth.store';

const apiClient = new ApiClient({
  // FIX 1: Changed from process.env.REACT_APP_API_URL to import.meta.env.VITE_API_URL
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  onTokenRefresh: async () => {
    // Implement token refresh logic here
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // Call refresh endpoint
      // FIX 2: Changed from process.env.REACT_APP_API_URL to import.meta.env.VITE_API_URL
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
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
    window.location.href = '/login';
  },
});

export default apiClient;