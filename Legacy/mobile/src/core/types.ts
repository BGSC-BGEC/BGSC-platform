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

/** Full session response returned by login and verified registration. */
export interface AuthResponse {
  user: User;
  accessToken: string;
  isNewUser?: boolean;
}

export interface RegistrationPending {
  verificationToken: string;
  expiresIn: number;
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
  /**
   * Phase 2/3 display flags — not part of event-service's EventResponseDto
   * (Phase 1). Derived client-side (auction ⇐ type ALL) until the backend
   * ships them. TODO(events): drop the client-side defaults when the fields land.
   */
  isAuctionBased?: boolean;
  linkedToStrava?: boolean;
  isFeatured?: boolean;
  isSponsored?: boolean;
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

// ─── Challenges (Phase 2 — challenge-service, master §13.5) ───────────────────

export type ChallengeDomain = 'sports' | 'esports' | 'game_dev' | 'general';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'legend';
export type ChallengeStatus = 'active' | 'completed' | 'archived';
/**
 * Viewing user's state with a challenge — drives the detail ActionArea
 * (points spec §6.5) and the card badges (spec §9).
 */
export type ChallengeUserState = 'not_accepted' | 'accepted' | 'submitted' | 'approved' | 'rejected';
/**
 * Physical = time limit shown up front; digital = time limit revealed on
 * accept (points spec §5.7 / §7.1).
 */
export type ChallengeMode = 'physical' | 'digital';

export interface ChallengeResource {
  name: string;
  url: string;
}

/** Mirrors ChallengeSummaryDto from the challenge-service (Phase 2). */
export interface Challenge {
  id: string;
  title: string;
  description: string;
  domain: ChallengeDomain;
  difficulty: ChallengeDifficulty;
  mode: ChallengeMode;
  /** 1 = solo play. */
  teamLimit: number;
  /** Days allowed after accept; null = no deadline. Digital hides this pre-accept. */
  timeLimitDays: number | null;
  awardPoints: number;
  status: ChallengeStatus;
  /** Legend-tier only — completing enrolls the user in Hall of Fame "Challenge Legends". */
  hallOfFameEligible: boolean;
  userState: ChallengeUserState;
  /** acceptedAt + timeLimitDays, server-computed; null when not accepted or no time limit. */
  deadline: string | null;
  resources: ChallengeResource[];
}

export type ProofItemType = 'image' | 'video' | 'link';

export interface ProofItem {
  /** M-12: id is optional on client-created items — populated by the server after upload. */
  id?: string;
  type: ProofItemType;
  /** Local asset uri for image/video, or the URL for link items. */
  uri: string;
}

export type SubmissionStatus = 'in_progress' | 'under_review' | 'approved' | 'rejected';

/** Mirrors ChallengeSubmissionDto from the challenge-service (Phase 2). */
export interface ChallengeSubmission {
  challengeId: string;
  status: SubmissionStatus;
  proofItems: ProofItem[];
  notes: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  adminNote?: string | null;
  pointsAwarded?: number | null;
}

export interface SubmitProofDto {
  proofItems: ProofItem[];
  notes: string;
}

/** Transaction-history filter (points spec §4.4). */
export type TransactionFilter = 'all' | TransactionType;

// ─── Announcements ────────────────────────────────────────────────────────────

export type AnnouncementTag =
  | 'BGEC'
  | 'FitSoc'
  | 'Airball'
  | 'Offside'
  | 'PowerPlay'
  | 'Around The Net'
  | 'Deuce'
  | 'Highlight Events'
  | 'Teams';

export interface AnnouncementAuthor {
  id: string;
  name: string;
  role: string;
  avatarInitial: string;
  avatarColor?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tags: AnnouncementTag[];
  author: AnnouncementAuthor;
  createdAt: string;
}

// ─── Store (store-page.md — store-service, Phase 2) ──────────────────────────

export type StoreStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
/** Fulfilment lifecycle shown on order history (store spec §2.2). */
export type StoreOrderStatus = 'placed' | 'fulfilled' | 'cancelled';

/**
 * Mirrors the store-service item DTO (Phase 2). `imageUrl` null → emoji
 * placeholder in the card (no merch photography exists in the mock catalog).
 */
export interface StoreItem {
  id: string;
  title: string;
  description?: string;
  category: 'merch' | 'game';
  costPoints: number;
  stock: StoreStockStatus;
  imageUrl?: string | null;
}

export interface StoreOrderItem {
  itemId: string;
  title: string;
  quantity: number;
  costPoints: number;
}

export interface StoreOrder {
  id: string;
  items: StoreOrderItem[];
  totalPoints: number;
  status: StoreOrderStatus;
  createdAt: string;
}

/**
 * Body of the redemption mutation. The backend writes the order AND a
 * points-ledger `spend` row (type 'spend', source 'store' — master §13.3)
 * atomically; the frontend invalidates both caches on success.
 */
export interface RedemptionInput {
  items: { itemId: string; quantity: number }[];
}
