/**
 * Friends domain repository.
 *
 * The friends-service does not exist yet — every method is a local mock behind
 * the real repository surface. Phase 2 swaps the bodies for `apiClient` calls
 * without touching hooks or screens.
 *
 * TODO(Phase 2): wire to friends-service endpoints:
 *   GET  /friends              → listFriends
 *   GET  /friends/requests     → listRequests
 *   GET  /friends/activities   → listActivities
 *   GET  /friends/achievements → listAchievements
 *   POST /friends/requests/:id/accept  → acceptRequest
 *   POST /friends/requests/:id/decline → declineRequest
 *   POST /friends/requests     → sendRequest
 */

const PALETTE = [
  '#E8584A', '#E8A24A', '#4AE8A2', '#4A8AE8',
  '#A24AE8', '#E84AAA', '#4AE8E8', '#8AE84A',
];

function avatarColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  isOnline: boolean;
  mutualCount: number;
  sponsorName?: string;
}

export interface FriendRequest {
  id: string;
  direction: 'incoming' | 'outgoing';
  friend: Friend;
  sentAt: string;
}

export interface FriendActivity {
  id: string;
  friend: Friend;
  eventTitle: string;
  eventDate: string;
  venue: string;
  status: 'ongoing' | 'upcoming' | 'past';
}

export interface FriendAchievement {
  id: string;
  friend: Friend;
  type: 'event_win' | 'challenge' | 'milestone';
  title: string;
  subtitle: string;
  pts: number;
  fans: number;
  createdAt: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const FRIENDS_MOCK: Friend[] = [
  {
    id: 'usr_a1b2c3',
    username: 'priya_k',
    displayName: 'Priya Khatri',
    avatarColor: avatarColor(0),
    isOnline: true,
    mutualCount: 5,
    sponsorName: 'RedBull Esports',
  },
  {
    id: 'usr_d4e5f6',
    username: 'jvaz',
    displayName: 'João Vaz',
    avatarColor: avatarColor(1),
    isOnline: false,
    mutualCount: 3,
  },
  {
    id: 'usr_g7h8i9',
    username: 'sara_w',
    displayName: 'Sara Williams',
    avatarColor: avatarColor(2),
    isOnline: true,
    mutualCount: 8,
    sponsorName: 'IntelGaming',
  },
  {
    id: 'usr_j1k2l3',
    username: 'devraj',
    displayName: 'Dev Raj',
    avatarColor: avatarColor(3),
    isOnline: false,
    mutualCount: 2,
  },
  {
    id: 'usr_m4n5o6',
    username: 'chloe_f',
    displayName: 'Chloe Ferreira',
    avatarColor: avatarColor(4),
    isOnline: true,
    mutualCount: 6,
  },
];

const REQUESTS_MOCK: FriendRequest[] = [
  {
    id: 'req_r1s2t3',
    direction: 'incoming',
    friend: {
      id: 'usr_p7q8r9',
      username: 'alex_ng',
      displayName: 'Alex Ng',
      avatarColor: avatarColor(5),
      isOnline: true,
      mutualCount: 4,
    },
    sentAt: '2026-08-08T14:22:00.000Z',
  },
  {
    id: 'req_u4v5w6',
    direction: 'incoming',
    friend: {
      id: 'usr_x1y2z3',
      username: 'mia_ross',
      displayName: 'Mia Ross',
      avatarColor: avatarColor(6),
      isOnline: false,
      mutualCount: 1,
    },
    sentAt: '2026-08-07T09:05:00.000Z',
  },
  {
    id: 'req_a7b8c9',
    direction: 'outgoing',
    friend: {
      id: 'usr_d0e1f2',
      username: 'taro_m',
      displayName: 'Taro Miyamoto',
      avatarColor: avatarColor(7),
      isOnline: false,
      mutualCount: 2,
    },
    sentAt: '2026-08-06T18:30:00.000Z',
  },
];

const ACTIVITIES_MOCK: FriendActivity[] = [
  {
    id: 'act_001',
    friend: FRIENDS_MOCK[0],
    eventTitle: 'BGSC Summer Showdown',
    eventDate: '2026-08-10T10:00:00.000Z',
    venue: 'Campus Arena',
    status: 'upcoming',
  },
  {
    id: 'act_002',
    friend: FRIENDS_MOCK[2],
    eventTitle: 'Esports Open Qualifier',
    eventDate: '2026-08-09T12:00:00.000Z',
    venue: 'Online',
    status: 'ongoing',
  },
  {
    id: 'act_003',
    friend: FRIENDS_MOCK[1],
    eventTitle: 'Campus Sports Relay',
    eventDate: '2026-07-28T08:00:00.000Z',
    venue: 'Main Track',
    status: 'past',
  },
  {
    id: 'act_004',
    friend: FRIENDS_MOCK[4],
    eventTitle: 'Game Dev Sprint',
    eventDate: '2026-08-12T09:00:00.000Z',
    venue: 'Innovation Hub',
    status: 'upcoming',
  },
];

const ACHIEVEMENTS_MOCK: FriendAchievement[] = [
  {
    id: 'ach_001',
    friend: FRIENDS_MOCK[0],
    type: 'event_win',
    title: '1st Place — Summer Showdown',
    subtitle: 'Esports — Bracket Champion',
    pts: 500,
    fans: 12,
    createdAt: '2026-08-08T16:00:00.000Z',
  },
  {
    id: 'ach_002',
    friend: FRIENDS_MOCK[2],
    type: 'challenge',
    title: 'Speed Coder Challenge',
    subtitle: 'Completed in 18 min',
    pts: 120,
    fans: 5,
    createdAt: '2026-08-07T11:30:00.000Z',
  },
  {
    id: 'ach_003',
    friend: FRIENDS_MOCK[3],
    type: 'milestone',
    title: '500 Points Milestone',
    subtitle: 'Reached the Bronze tier',
    pts: 0,
    fans: 3,
    createdAt: '2026-08-06T09:15:00.000Z',
  },
  {
    id: 'ach_004',
    friend: FRIENDS_MOCK[4],
    type: 'challenge',
    title: 'Photography Sprint',
    subtitle: 'Submission approved by judges',
    pts: 80,
    fans: 7,
    createdAt: '2026-08-05T14:00:00.000Z',
  },
];

// ─── Repository ───────────────────────────────────────────────────────────────

let requestsMutable = [...REQUESTS_MOCK];

export const FriendRepository = {
  /** TODO(Phase 2): `apiClient.get<Friend[]>('/friends')`. */
  async listFriends(): Promise<Friend[]> {
    await delay(400);
    return [...FRIENDS_MOCK];
  },

  /** TODO(Phase 2): `apiClient.get<FriendRequest[]>('/friends/requests')`. */
  async listRequests(): Promise<FriendRequest[]> {
    await delay(400);
    return [...requestsMutable];
  },

  /** TODO(Phase 2): `apiClient.get<FriendActivity[]>('/friends/activities')`. */
  async listActivities(): Promise<FriendActivity[]> {
    await delay(400);
    return [...ACTIVITIES_MOCK];
  },

  /** TODO(Phase 2): `apiClient.get<FriendAchievement[]>('/friends/achievements')`. */
  async listAchievements(): Promise<FriendAchievement[]> {
    await delay(400);
    return [...ACHIEVEMENTS_MOCK];
  },

  /** TODO(Phase 2): `apiClient.post('/friends/requests/:id/accept')`. */
  async acceptRequest(id: string): Promise<void> {
    await delay(400);
    requestsMutable = requestsMutable.filter((r) => r.id !== id);
  },

  /** TODO(Phase 2): `apiClient.post('/friends/requests/:id/decline')`. */
  async declineRequest(id: string): Promise<void> {
    await delay(400);
    requestsMutable = requestsMutable.filter((r) => r.id !== id);
  },

  /** TODO(Phase 2): `apiClient.post('/friends/requests', { userId })`. */
  async sendRequest(userId: string): Promise<void> {
    await delay(400);
    // Mock: noop — Phase 2 will write to the server.
    void userId;
  },
};
