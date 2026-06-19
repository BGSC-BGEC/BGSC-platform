/**
 * Announcement Repository
 * Handles all announcement-related API calls
 */

import { BaseRepository } from './base.repository';
import { Announcement, PaginatedResponse } from '../../types';
import ApiClient from '../client';

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  tags?: string[];
}

export class AnnouncementRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/announcements');
  }

  async listAnnouncements(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Announcement>> {
    return this.getPaginated('/', page, limit);
  }

  async getAnnouncement(announcementId: string): Promise<Announcement> {
    return this.get<Announcement>(`/${announcementId}`);
  }

  async createAnnouncement(data: CreateAnnouncementRequest): Promise<Announcement> {
    return this.post<Announcement>('/', data);
  }

  async updateAnnouncement(
    announcementId: string,
    data: Partial<CreateAnnouncementRequest>
  ): Promise<Announcement> {
    return this.patch<Announcement>(`/${announcementId}`, data);
  }

  async deleteAnnouncement(announcementId: string): Promise<void> {
    return this.delete<void>(`/${announcementId}`);
  }

  async getByTag(tag: string, page: number = 1, limit: number = 20) {
    return this.getPaginated('/', page, limit, { tag });
  }
}
