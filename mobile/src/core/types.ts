/**
 * Shared domain & state types for the MVVM layer.
 *
 * This file is mirrored (intentionally duplicated) in the web app — the two
 * clients follow one identical pattern. Keep the two copies in sync until a
 * shared package is introduced.
 */

/** Generic async state used by ViewModels to drive loading/success/error UI. */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data?: T;
  error?: string;
}

export function idle<T>(): AsyncState<T> {
  return { status: 'idle' };
}

/** Roles as defined by the backend RBAC (spec §7.1). */
export type UserRole = 'guest' | 'user' | 'member' | 'core' | 'coordinator' | 'founder';

export type UserStatus = 'active' | 'suspended' | 'pending_deletion';

/** Public/own user shape returned by the user-service. */
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  contact?: string | null;
  avatarUrl?: string | null;
  pointsBalance?: number;
  activeSponsorId?: string | null;
  createdAt?: string;
  lastActive?: string;
}

/** Response shape of POST /auth/login and /auth/register. */
export interface AuthResponse {
  user: User;
  accessToken: string;
  isNewUser?: boolean;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  acceptedTos: boolean;
  contact?: string;
}

export interface LoginInput {
  usernameOrEmail: string;
  password: string;
}

/** Event types from event-service (spec §4). */
export type EventType = 'LE' | 'DE' | 'ALL' | 'DLL';
export type EventStatus = 'upcoming' | 'ongoing' | 'past';
export type EventCategory = 'leagues' | 'bgec' | 'fitsoc' | 'general';

export type RegistrationStatus = 'open' | 'closed' | 'full' | 'registered' | 'results_out';

export interface CoordinatorContact {
  name: string;
  role: string;
  email?: string;
  whatsappMasked?: string;
}

export interface SponsorLeaderInfo {
  sponsorId: string;
  sponsorName: string;
}

export interface SponsorTop3Entry extends SponsorLeaderInfo {
  rank: number;
  fanCount?: number;
}

export interface RegisterPayload {
  role: 'captain' | 'member';
  displayName?: string;
  gameName?: string;
  teamName?: string;
  inviteCode?: string;
  basePrice?: number;
  teamStatus?: 'open' | 'invite_only' | 'closed';
}

/** Mirrors EventResponseDto from the event-service. category is derived client-side. */
export interface PlatformEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  category: EventCategory;
  status: EventStatus;
  startDate: string;
  endDate: string;
  registrationDeadline?: string;
  venue?: string;
  rulesPdfUrl?: string;
  coverImageUrl?: string;
  awardsList?: string[];
  coordinatorContacts?: CoordinatorContact[];
  registrationStatus?: RegistrationStatus;
  sponsorLeader?: SponsorLeaderInfo | null;
  userFanEarned?: number;
  maxParticipants?: number;
  needsLeaderboard: boolean;
  isTeamed?: boolean;
  teamSize?: number;
  maxTeams?: number;
  sponsorTop3?: SponsorTop3Entry[];
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors LeaderboardEntryDto from the event-service. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
  submittedAt: string;
}

/** Mirrors RegistrationResponseDto from the event-service. */
export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  status: 'confirmed' | 'cancelled';
  registeredAt: string;
}

// ─── Profile-extended types ───────────────────────────────────────────────────

export interface ProfileInterest {
  id: string;
  label: string;
  domain: 'sports' | 'esports' | 'gaming_industry' | 'game_dev';
}

export interface SocialLink {
  platform: 'discord' | 'instagram' | 'linkedin' | 'x' | 'twitch' | 'youtube';
  url: string;
  handle?: string;
}

/** Full profile returned by GET /users/me/profile — extends the base User. */
export interface UserProfile extends User {
  displayName?: string;
  bio?: string;
  interests: ProfileInterest[];
  customTags: string[];
  friendTags: string[];
  socialLinks: SocialLink[];
  newsletterSubscriptions: string[];
  coverImageUrl?: string | null;
  totalEvents?: number;
  totalWins?: number;
  totalFans?: number;
  rating?: number;
}

export interface SponsorStats {
  sponsorId: string;
  sponsorName: string;
  sponsorLogoUrl?: string | null;
  rank: number;
  totalAffiliates: number;
  fansContributed: number;
  eventsWon: number;
}

export interface EventSuggestion {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  startDate: string;
  status: EventStatus;
  registrationStatus: RegistrationStatus;
  category: EventCategory;
  isTeamed: boolean;
  userTeam?: { teamId: string; teamName: string; openSlots: number; inviteCode: string } | null;
}

export interface FriendSuggestion {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  mutualCount: number;
}

export interface EventHistoryItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventCoverUrl?: string | null;
  date: string;
  role: 'captain' | 'member' | 'solo';
  teamName?: string;
  result?: string;
  pointsEarned?: number;
  fansEarned?: number;
  sponsorName?: string;
}

export interface MatchHistoryItem {
  id: string;
  leagueName: string;
  round: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  result: 'win' | 'loss' | 'draw';
  date: string;
  venue?: string;
  matchId: string;
}

export interface ChallengeHistoryItem {
  id: string;
  challengeId: string;
  title: string;
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legend';
  completedAt: string;
  pointsAwarded: number;
}

export interface SponsorContributionItem {
  id: string;
  eventId: string;
  eventTitle: string;
  date: string;
  fansContributed: number;
  runningTotal: number;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  interests?: string[];
  customTags?: string[];
  socialLinks?: SocialLink[];
  newsletterSubscriptions?: string[];
  contact?: string;
}

// ─── Points ───────────────────────────────────────────────────────────────────

export interface PointsBalance {
  userId: string;
  balance: number;
}

export type TransactionType = 'earn' | 'spend' | 'refund';
export type PointsSource = 'event' | 'challenge' | 'store' | 'leaderboard';

export interface PointTransaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  source: PointsSource;
  referenceId?: string | null;
  createdAt: string;
}

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

export interface HallOfFameEventWinner {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  userId: string;
  score: number;
}

export interface HallOfFameSponsorChampion {
  rank: number;
  sponsorId: string;
  name: string;
  logoUrl?: string | null;
  totalFans: number;
  eventsWonCount: number;
  affiliatedUserCount: number;
}
