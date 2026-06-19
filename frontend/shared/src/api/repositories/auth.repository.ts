/**
 * Auth Repository
 * Handles all authentication-related API calls
 */

import { BaseRepository } from './base.repository';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GoogleAuthResponse,
  TOTPSetupResponse,
  TOTPVerifyRequest,
  Session,
} from '../../types';
import ApiClient from '../client';

export class AuthRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/auth');
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.post<AuthResponse>('/login', credentials);
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.post<AuthResponse>('/register', data);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return this.post<AuthResponse>('/refresh', { refreshToken });
  }

  async logout(): Promise<void> {
    return this.post<void>('/logout');
  }

  async googleAuth(accessToken: string): Promise<GoogleAuthResponse> {
    return this.post<GoogleAuthResponse>('/google', { accessToken });
  }

  async setupTotp(): Promise<TOTPSetupResponse> {
    return this.post<TOTPSetupResponse>('/totp/setup');
  }

  async verifyTotp(data: TOTPVerifyRequest): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/totp/verify', data);
  }

  async getSessions(): Promise<Session[]> {
    return this.get<Session[]>('/sessions');
  }

  async revokeSession(sessionId: string): Promise<void> {
    return this.delete<void>(`/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<void> {
    return this.delete<void>('/sessions/all');
  }
}
