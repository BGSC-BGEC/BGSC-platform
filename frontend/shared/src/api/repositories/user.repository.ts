/**
 * User Repository
 * Handles all user-related API calls
 */

import { BaseRepository } from './base.repository';
import { User, UserProfile } from '../../types';
import ApiClient from '../client';

export interface UpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  bio?: string;
  interests?: string[];
}

export interface UserListQuery {
  role?: string;
  sponsorId?: string;
  search?: string;
}

export class UserRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/users');
  }

  async getProfile(userId: string): Promise<UserProfile> {
    return this.get<UserProfile>(`/${userId}`);
  }

  async getCurrentUser(): Promise<User> {
    return this.get<User>('/me');
  }

  async updateProfile(data: UpdateUserProfileRequest): Promise<User> {
    return this.patch<User>('/me', data);
  }

  async setSponsor(sponsorId: string): Promise<User> {
    return this.post<User>('/me/sponsor', { sponsorId });
  }

  async getSponsorStats(): Promise<{
    fanCount: number;
    eventsWon: number;
    eventsParticipated: number;
  }> {
    return this.get('/me/sponsor-stats');
  }

  async getInterests(): Promise<string[]> {
    return this.get<string[]>('/interests');
  }

  async updateInterests(interests: string[]): Promise<User> {
    return this.patch<User>('/me/interests', { interests });
  }

  async listUsers(query?: UserListQuery, page: number = 1, limit: number = 20) {
    return this.getPaginated('/list', page, limit, query);
  }

  async deleteAccount(password: string): Promise<void> {
    return this.post<void>('/me/delete', { password });
  }

  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    return this.post<void>('/me/change-password', {
      oldPassword,
      newPassword,
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    return this.post<void>('/password/forgot', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    return this.post<void>('/password/reset', { token, newPassword });
  }

  async disableAccount(): Promise<void> {
    return this.post<void>('/account/disable');
  }

  async enableAccount(): Promise<void> {
    return this.post<void>('/account/enable');
  }
}
