import { apiClient } from '../api/ApiClient';
import { API_BASE_URL } from '../env';
import type { AuthResponse, LoginInput, RegisterInput, RegistrationPending } from '../types';

/**
 * Model-layer gateway to the auth-service (via the API gateway).
 * Auth endpoints are public, so they bypass the access-token injection.
 */
export const AuthRepository = {
  register(input: RegisterInput): Promise<RegistrationPending> {
    return apiClient.post<RegistrationPending>('/auth/register', input, {
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

  verifyEmail(input: { verificationToken: string; code: string }): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/verify-email', input, { skipAuth: true });
  },

  resendOtp(input: { verificationToken: string }): Promise<void> {
    return apiClient.post('/auth/resend-otp', input, { skipAuth: true });
  },

  /** Finalizes a Google OAuth profile by adding password + contact. */
  completeGoogleProfile(input: { password: string; contact: string }): Promise<void> {
    return apiClient.post('/auth/complete-profile', input);
  },
};
