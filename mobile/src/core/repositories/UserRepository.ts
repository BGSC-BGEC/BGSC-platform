import { apiClient } from '../api/ApiClient';
import type {
  ChallengeHistoryItem,
  EventHistoryItem,
  EventSuggestion,
  FriendSuggestion,
  MatchHistoryItem,
  ProfileInterest,
  SponsorContributionItem,
  SponsorStats,
  UpdateProfileInput,
  User,
  UserProfile,
} from '../types';

/** Model-layer gateway to the user-service and event-service (via the API gateway). */
export const UserRepository = {
  getMe(): Promise<User> {
    return apiClient.get<User>('/users/me');
  },

  updateMe(patch: Omit<Partial<User>, 'id' | 'role'>): Promise<User> {
    // M-09: strip privileged fields that clients must never be able to set.
    return apiClient.patch<User>('/users/me', patch);
  },

  // ─── Profile ──────────────────────────────────────────────────────────────────

  getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/me/profile');
  },

  updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/me/profile', input);
  },

  // ─── Interests catalog (M1.3) ────────────────────────────────────────────────

  getInterests(): Promise<ProfileInterest[]> {
    return apiClient.get<ProfileInterest[]>('/users/interests');
  },

  updateInterests(interestIds: string[]): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/me/interests', { interests: interestIds });
  },

  // ─── Player card (M1.3) ──────────────────────────────────────────────────────

  getPlayerCard(): Promise<{
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    role: string;
    activeSponsorId?: string | null;
    sponsorName?: string | null;
    sponsorLogoUrl?: string | null;
    interests: string[];
    customTags: string[];
    totalEvents: number;
    totalWins: number;
    totalFans: number;
    rating?: number | null;
  }> {
    return apiClient.get('/users/me/player-card');
  },

  // ─── Sponsor stats ────────────────────────────────────────────────────────────

  getSponsorStats(): Promise<SponsorStats | null> {
    return apiClient.get<SponsorStats | null>('/users/me/sponsor-stats');
  },

  // ─── Suggestions ─────────────────────────────────────────────────────────────

  getEventSuggestions(): Promise<EventSuggestion[]> {
    return apiClient.get<EventSuggestion[]>('/users/me/event-suggestions');
  },

  getFriendSuggestions(): Promise<FriendSuggestion[]> {
    return apiClient.get<FriendSuggestion[]>('/users/me/friend-suggestions');
  },

  // ─── History (event history calls event-service directly, others are stubs) ───

  /** Calls event-service GET /events/me/registrations (JWT-protected). */
  getEventHistory(page = 1): Promise<EventHistoryItem[]> {
    return apiClient.get<EventHistoryItem[]>(`/events/me/registrations?page=${page}&limit=20`);
  },

  /** Phase 3 stub — match history from team service. */
  getMatchHistory(_page = 1): Promise<MatchHistoryItem[]> {
    return Promise.resolve([]);
  },

  /** Phase 2 stub — challenge history from challenge service. */
  getChallengeHistory(_page = 1): Promise<ChallengeHistoryItem[]> {
    return Promise.resolve([]);
  },

  /** Phase 2 stub — needs sponsor_fan_transactions table. */
  getSponsorHistory(_page = 1): Promise<SponsorContributionItem[]> {
    return Promise.resolve([]);
  },

  sendFriendRequest(recipientId: string): Promise<void> {
    return apiClient.post<void>('/friendships', { recipientId });
  },

  // ─── Coordinator: User management (users-page.md §13) ────────────────────────

  listUsers(params: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
    sort?: string;
    summary?: boolean;
  }): Promise<{
    data: Array<{
      id: string;
      displayName?: string;
      username: string;
      email: string;
      phone?: string | null;
      role: string;
      status: string;
      sponsorName?: string | null;
      pointsBalance: number;
      createdAt: string;
      lastSeen?: string | null;
      avatarUrl?: string | null;
    }>;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      summary?: { total: number; activeThisWeek: number; newThisMonth: number };
    };
  }> {
    const q = new URLSearchParams();
    // M-05: use `!= null` instead of truthy check so page=0 is not dropped.
    if (params.page != null) q.set('page', String(params.page));
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.role) q.set('role', params.role);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    if (params.sort) q.set('sort', params.sort);
    if (params.summary) q.set('summary', 'true');
    return apiClient.get(`/users?${q.toString()}`);
  },

  updateUserRole(userId: string, role: string): Promise<void> {
    return apiClient.patch(`/users/${userId}`, { role });
  },

  disableAccount(userId: string): Promise<void> {
    return apiClient.patch('/account/disable', { userId });
  },
};
