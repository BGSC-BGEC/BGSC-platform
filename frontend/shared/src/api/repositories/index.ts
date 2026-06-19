/**
 * Hall of Fame Repository
 * Handles all hall of fame-related API calls
 */

import { BaseRepository } from './base.repository';
import { HallOfFameEntry, SponsorChampion, PaginatedResponse } from '../../types';
import ApiClient from '../client';

export class HallOfFameRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/hall-of-fame');
  }

  async getEventWinners(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<HallOfFameEntry>> {
    return this.getPaginated('/event-winners', page, limit);
  }

  async getSponsorChampions(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<SponsorChampion>> {
    return this.getPaginated('/sponsor-champions', page, limit);
  }

  async getUserWins(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<HallOfFameEntry>> {
    return this.getPaginated(`/users/${userId}/wins`, page, limit);
  }

  async generatePlayerCard(
    userId: string
  ): Promise<{
    name: string;
    avatar: string;
    sponsor: string;
    totalWins: number;
    totalPoints: number;
    favoriteEvents: string[];
  }> {
    return this.get(`/player-card/${userId}`);
  }
}

// Export all repositories
export { BaseRepository } from './base.repository';
export { AuthRepository } from './auth.repository';
export { UserRepository } from './user.repository';
export { EventRepository } from './event.repository';
export { SponsorRepository } from './sponsor.repository';
export { PointsRepository } from './points.repository';
export { AnnouncementRepository } from './announcement.repository';
