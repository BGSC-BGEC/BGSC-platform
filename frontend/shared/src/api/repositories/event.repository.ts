/**
 * Event Repository
 * Handles all event-related API calls
 */

import { BaseRepository } from './base.repository';
import {
  Event,
  EventDetails,
  EventRegistration,
  LeaderboardEntry,
  EventStatus,
  EventType,
  PaginatedResponse,
} from '../../types';
import ApiClient from '../client';

export interface EventListQuery {
  status?: EventStatus;
  type?: EventType;
  search?: string;
  sponsorId?: string;
}

export interface CreateEventRequest {
  title: string;
  description: string;
  type: EventType;
  startDate: string;
  endDate: string;
  location?: string;
  maxParticipants?: number;
  registrationDeadline: string;
}

export class EventRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/events');
  }

  async listEvents(
    query?: EventListQuery,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Event>> {
    return this.getPaginated('/list', page, limit, query);
  }

  async getEvent(eventId: string): Promise<EventDetails> {
    return this.get<EventDetails>(`/${eventId}`);
  }

  async createEvent(data: CreateEventRequest): Promise<Event> {
    return this.post<Event>('/', data);
  }

  async updateEvent(eventId: string, data: Partial<CreateEventRequest>): Promise<Event> {
    return this.patch<Event>(`/${eventId}`, data);
  }

  async deleteEvent(eventId: string): Promise<void> {
    return this.delete<void>(`/${eventId}`);
  }

  async registerForEvent(eventId: string): Promise<EventRegistration> {
    return this.post<EventRegistration>(`/${eventId}/register`);
  }

  async cancelRegistration(eventId: string): Promise<void> {
    return this.post<void>(`/${eventId}/cancel-registration`);
  }

  async getLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
    return this.get<LeaderboardEntry[]>(`/${eventId}/leaderboard`);
  }

  async submitScores(
    eventId: string,
    scores: Array<{ userId: string; score: number }>
  ): Promise<void> {
    return this.post<void>(`/${eventId}/scores`, { scores });
  }

  async completeEvent(eventId: string): Promise<Event> {
    return this.patch<Event>(`/${eventId}/complete`);
  }

  async getMyRegistrations(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<EventRegistration>> {
    return this.getPaginated('/me/registrations', page, limit);
  }
}
