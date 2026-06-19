/**
 * Shared Types for BGSC Platform
 * Common interfaces used across mobile and web apps
 */

// ============ Auth Types ============
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ============ User Types ============
export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  MEMBER = 'member',
  CORE = 'core',
  COORDINATOR = 'coordinator',
  FOUNDER = 'founder',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  bio?: string;
  avatar?: string;
  interests?: string[];
  sponsorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  sponsorName?: string;
  totalPoints?: number;
  eventsParticipated?: number;
  eventsWon?: number;
}

// ============ Sponsor Types ============
export interface Sponsor {
  id: string;
  name: string;
  logo?: string;
  tenureStart: string;
  tenureEnd?: string;
  description?: string;
  createdAt: string;
}

export interface SponsorLeaderboardEntry {
  sponsorId: string;
  sponsorName: string;
  fanCount: number;
  logo?: string;
  rank: number;
}

// ============ Event Types ============
export enum EventStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  PAST = 'past',
  CANCELLED = 'cancelled',
}

export enum EventType {
  SPORTS = 'sports',
  ESPORTS = 'esports',
  CULTURAL = 'cultural',
  TECHNICAL = 'technical',
  OTHER = 'other',
}

export interface Event {
  id: string;
  title: string;
  description: string;
  type: EventType;
  status: EventStatus;
  startDate: string;
  endDate: string;
  location?: string;
  maxParticipants?: number;
  registrationDeadline: string;
  createdBy: string;
  createdAt: string;
}

export interface EventDetails extends Event {
  registeredCount: number;
  isRegistered: boolean;
  leaderboard?: LeaderboardEntry[];
}

export interface EventRegistration {
  id: string;
  userId: string;
  eventId: string;
  registeredAt: string;
  status: 'registered' | 'completed' | 'cancelled';
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  score: number;
  points: number;
}

// ============ Points Types ============
export interface PointsBalance {
  userId: string;
  totalPoints: number;
  balance: number;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'earn' | 'spend';
  reason: string;
  eventId?: string;
  createdAt: string;
}

// ============ Announcement Types ============
export interface Announcement {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============ Hall of Fame Types ============
export interface HallOfFameEntry {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  eventId: string;
  eventTitle: string;
  sponsorId: string;
  sponsorName: string;
  sponsorLogo?: string;
  prize?: string;
  position: number;
  date: string;
}

export interface SponsorChampion {
  sponsorId: string;
  sponsorName: string;
  sponsorLogo?: string;
  championCount: number;
  totalFans: number;
}

// ============ API Response Types ============
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ============ Authentication State ============
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

// ============ Session Types ============
export interface Session {
  id: string;
  userId: string;
  deviceName: string;
  lastActive: string;
  createdAt: string;
}

// ============ TOTP Types ============
export interface TOTPSetupResponse {
  qrCode: string;
  secret: string;
}

export interface TOTPVerifyRequest {
  code: string;
}

// ============ Notification Types ============
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}
