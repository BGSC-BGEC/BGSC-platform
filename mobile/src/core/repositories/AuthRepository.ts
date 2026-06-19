import { apiClient } from '../api/ApiClient';
import { API_BASE_URL } from '../env';
import type { AuthResponse, LoginInput, RegisterInput } from '../types';

/**
 * Model-layer gateway to the auth-service (via the API gateway).
 * Auth endpoints are public, so they bypass the access-token injection.
 */
export const AuthRepository = {
  register(input: RegisterInput): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', input, {
      skipAuth: true,
    });
  },

  login(input: LoginInput): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', input, {
      skipAuth: true,
    });
  },

  /** Uses the httpOnly refresh cookie; returns a fresh access token. */
  refresh(): Promise<{ accessToken: string }> {
    return apiClient.post<{ accessToken: string }>('/auth/refresh', undefined, {
      skipAuth: true,
    });
  },

  logout(): Promise<void> {
    return apiClient.post<void>('/auth/logout');
  },

  /** Full URL to kick off the Google OAuth2 redirect flow. */
  googleAuthUrl(): string {
    return `${API_BASE_URL}/auth/google`;
  },
};
