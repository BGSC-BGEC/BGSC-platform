/**
 * Sponsor Repository
 * Handles all sponsor-related API calls
 */

import { BaseRepository } from './base.repository';
import { Sponsor, SponsorLeaderboardEntry } from '../../types';
import ApiClient from '../client';

export class SponsorRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/sponsors');
  }

  async listActiveSponsor(): Promise<Sponsor[]> {
    return this.get<Sponsor[]>('/active');
  }

  async getSponsor(sponsorId: string): Promise<Sponsor> {
    return this.get<Sponsor>(`/${sponsorId}`);
  }

  async getLeaderboard(limit: number = 50): Promise<SponsorLeaderboardEntry[]> {
    return this.get<SponsorLeaderboardEntry[]>('/leaderboard', { limit });
  }

  async createSponsor(data: {
    name: string;
    logo?: string;
    tenureStart: string;
    tenureEnd?: string;
    description?: string;
  }): Promise<Sponsor> {
    return this.post<Sponsor>('/', data);
  }

  async updateSponsor(
    sponsorId: string,
    data: Partial<{
      name: string;
      logo?: string;
      description?: string;
    }>
  ): Promise<Sponsor> {
    return this.patch<Sponsor>(`/${sponsorId}`, data);
  }

  async updateTenureEnd(sponsorId: string, tenureEnd: string): Promise<Sponsor> {
    return this.patch<Sponsor>(`/${sponsorId}/tenure-end`, { tenureEnd });
  }
}
