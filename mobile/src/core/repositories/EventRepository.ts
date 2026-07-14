import { apiClient } from '../api/ApiClient';
import type {
  EventCategory,
  EventStatus,
  EventType,
  LeaderboardEntry,
  PlatformEvent,
  RegisterPayload,
  Registration,
} from '../types';

function deriveCategory(type: EventType, tags: string[]): EventCategory {
  if (type === 'ALL' || type === 'DLL') return 'leagues';
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => ['bgec', 'esports', 'valorant', 'cs2', 'tekken', 'minecraft', 'gaming', 'esport'].includes(t)))
    return 'bgec';
  if (lower.some((t) => ['fitsoc', 'fitness', 'football', 'basketball', 'badminton', 'cricket', 'tt', 'yoga', 'run', 'sport'].includes(t)))
    return 'fitsoc';
  return 'general';
}

function toEvent(dto: any): PlatformEvent {
  return {
    ...dto,
    category: deriveCategory(dto.type, dto.tags ?? []),
    coverImageUrl: dto.cover_image_url ?? dto.coverImageUrl,
    awardsList: dto.award_list ?? dto.awardsList ?? [],
    coordinatorContacts: dto.coordinator_contacts ?? dto.coordinatorContacts ?? [],
    registrationStatus: dto.registration_status ?? dto.registrationStatus,
    sponsorLeader: dto.sponsor_leader ?? dto.sponsorLeader ?? null,
    sponsorTop3: dto.sponsor_top3 ?? dto.sponsorTop3 ?? null,
    userFanEarned: dto.user_fan_earned ?? dto.userFanEarned,
    isTeamed: dto.is_teamed ?? dto.isTeamed,
    teamSize: dto.team_size ?? dto.teamSize,
    maxTeams: dto.max_teams ?? dto.maxTeams,
  };
}

export const EventRepository = {
  async list(params?: { page?: number; limit?: number }): Promise<PlatformEvent[]> {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const query = qs.toString();
    const dtos = await apiClient.get<any[]>(`/events${query ? '?' + query : ''}`);
    return dtos.map(toEvent);
  },

  async getById(id: string): Promise<PlatformEvent> {
    const dto = await apiClient.get<any>(`/events/${id}`);
    return toEvent(dto);
  },

  async register(eventId: string, payload: RegisterPayload): Promise<Registration> {
    return apiClient.post<Registration>(`/events/${eventId}/register`, payload);
  },

  async withdrawRegistration(eventId: string, registrationId: string): Promise<void> {
    return apiClient.delete(`/events/${eventId}/registrations/${registrationId}`);
  },

  async applyForCaptain(eventId: string): Promise<{ status: 'pending' }> {
    return apiClient.post(`/events/${eventId}/captain-application`, {});
  },

  async getLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
    return apiClient.get<LeaderboardEntry[]>(`/events/${eventId}/leaderboard`);
  },

  async getMyRegistration(eventId: string): Promise<Registration | null> {
    return apiClient.get<Registration | null>(`/events/${eventId}/my-registration`);
  },
};
