/**
 * Backend payload shapes (after the { success, data } envelope is unwrapped).
 * Raw Mongo documents use `_id`; auth/user serializers and point transactions use `id`.
 */

export interface UserSnapshot {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  deleted?: boolean;
}

// ----------------------------------------------------------------- auth / users
export interface ApiUser {
  id: string;
  email: string;
  username: string;
  role: 'guest' | 'user' | 'member' | 'core' | 'coordinator' | 'founder';
  status: 'active' | 'suspended' | 'deleted';
  is_email_verified: boolean;
  is_phone_verified: boolean;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    phone_number: string | null;
    bio: string | null;
    interests: string[];
    social_links?: Record<string, string | null>;
  };
  points_balance?: number;
  player_card?: { card_tier: string; stats: Record<string, unknown> };
}

export interface AuthResult {
  user: ApiUser;
  tokens: { access_token: string; refresh_token: string };
}

// ----------------------------------------------------------------------- events
export type EventCategory = 'leagues' | 'bgec' | 'fitsoc' | 'general';
export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled';
export type EventType = 'LE' | 'DE' | 'ALL' | 'DLL';
export type EventDomain = 'sports' | 'esports' | 'fitness' | 'general';

export interface ApiEvent {
  _id: string;
  slug: string;
  title: string;
  description: string;
  cover_media_url: string | null;
  logo_url: string | null;
  category: EventCategory;
  type: EventType;
  domain: EventDomain;
  tags: string[];
  status: EventStatus;
  visibility: 'public' | 'unlisted';
  start_at: string;
  end_at: string;
  venue: string | null;
  timezone: string;
  registration: {
    opens_at: string | null;
    closes_at: string;
    roster_finalizes_at: string | null;
    form_id: string | null;
    max_participants: number | null;
    waitlist_enabled: boolean;
    requires_approval: boolean;
  };
  teaming: {
    is_teamed: boolean;
    team_size_min: number | null;
    team_size_max: number | null;
    max_teams: number | null;
    captain_application_required: boolean;
  };
  rules_pdf_url: string | null;
  rules_summary: string | null;
  awards: Array<{ place: number; title: string; description?: string }>;
  contacts: Array<{ user_id: string; display_name: string; role_label: string; contact: string; deleted?: boolean }>;
  leaderboard: null | { format: string; min_participants: number };
  auction: null | {
    k_multiplier: number;
    min_bid_increment: number;
    bid_timer_seconds: number;
    status: AuctionStatus;
    captain_user_ids: string[];
    purse_per_team: number | null;
  };
  counts: { registrations_confirmed: number };
  created_at: string;
  updated_at: string;
}

export interface EventListResponse {
  events: ApiEvent[];
  next_cursor: string | null;
  limit: number;
  total?: number;
  page?: number;
  total_pages?: number;
}

export type EligibilityReason =
  | 'already_registered'
  | 'event_cancelled'
  | 'event_past'
  | 'not_yet_open'
  | 'registration_closed'
  | 'capacity_full'
  | 'registration_form_unavailable'
  | null;

export interface EventEligibility {
  eligible: boolean;
  reason: EligibilityReason;
  capacity_status: 'open' | 'waitlist_only' | 'full';
  seats_remaining: number | null;
  form_id: string | null;
  waitlist_enabled: boolean;
  requires_approval: boolean;
  is_teamed: boolean;
  captain_application_required: boolean;
  existing_registration_id: string | null;
}

// ---------------------------------------------------------------- registrations
export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'user_ref';

export interface FormField {
  key: string;
  label: string;
  help_text: string | null;
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  options: Array<{ value: string; label: string }> | null;
  validation: {
    min: number | null;
    max: number | null;
    pattern: string | null;
    accept: string[] | null;
    max_size_bytes: number | null;
  } | null;
  visible_if: { field_key: string; op: 'eq' | 'neq' | 'in'; value: unknown } | null;
  admin_only: boolean;
  order: number;
}

export interface FormDefinition {
  _id: string;
  owner: { type: 'event' | 'challenge' | 'generic'; id: string | null };
  title: string;
  description: string | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  fields: FormField[];
  settings: { allow_edit_until: string; confirmation_message: string | null };
}

export type RegistrationRole = 'solo' | 'captain' | 'member';
export type RegistrationStatus = 'draft' | 'submitted' | 'confirmed' | 'waitlisted' | 'rejected' | 'cancelled';

export interface FormSubmission {
  _id: string;
  form_id: string;
  owner: { type: string; id: string | null };
  user: UserSnapshot;
  answers: Record<string, unknown>;
  context: {
    event?: {
      role: RegistrationRole;
      team_id: string | null;
      team_visibility: 'open' | 'invite_only' | 'closed';
      base_price: number | null;
      captain_application: { status: 'none' | 'pending' | 'approved' | 'declined'; note?: string | null };
      attended: boolean | null;
    };
  };
  status: RegistrationStatus;
  waitlist_position: number | null;
  submitted_at: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface Team {
  _id: string;
  owner: { type: string; id: string };
  name: string;
  logo_url: string | null;
  captain_user_id: string;
  members: Array<UserSnapshot & { joined_at: string }>;
  join_policy: 'open' | 'invite_only' | 'closed';
  size_min: number | null;
  size_max: number | null;
  status: 'forming' | 'complete' | 'locked' | 'disbanded';
}

// ---------------------------------------------------------------------- auction
export type AuctionStatus = 'not_started' | 'live' | 'paused' | 'finished';

export interface AuctionBid {
  bid_id: string;
  bidder_user_id: string;
  team_id: string;
  amount: number;
  placed_at: string;
}

export interface AuctionTeam {
  team_id: string;
  name: string;
  captain_user_id: string;
  logo_url: string | null;
  purse_total: number;
  purse_spent: number;
  purse_remaining: number;
  members_count: number;
  size_max: number | null;
}

export interface AuctionLiveState {
  event_id: string;
  slug: string;
  title: string;
  status: AuctionStatus;
  config: {
    k_multiplier: number;
    min_bid_increment: number;
    bid_timer_seconds: number;
    purse_per_team: number | null;
    captains_count: number;
  };
  active_lot: null | {
    lot_id: string;
    status: 'on_block' | 'settling';
    order: number;
    player: UserSnapshot;
    registration_id: string;
    base_price: number;
    oc_adjusted_price: number | null;
    current_bid: number | null;
    current_bidder: { user_id: string; team_id: string } | null;
    timer_ends_at: string | null;
    seconds_remaining: number | null;
    version: number;
    recent_bids: AuctionBid[];
  };
  teams: AuctionTeam[];
}

export type LotStatus = 'queued' | 'on_block' | 'settling' | 'sold' | 'unsold';

export interface AuctionLot {
  _id: string;
  event_id: string;
  player: UserSnapshot;
  registration_id: string;
  base_price: number;
  oc_adjusted_price: number | null;
  order: number;
  status: LotStatus;
  current_bid: number | null;
  current_bidder: { user_id: string; team_id: string } | null;
  bids: AuctionBid[];
  sold_to_team_id: string | null;
  sold_amount: number | null;
  closed_at: string | null;
  version: number;
}

// ------------------------------------------------------------------ leaderboards
export type LeaderboardPeriod = 'all' | 'semester' | 'month' | 'week';
export type LeaderboardDomain = 'all' | 'sports' | 'esports' | 'fitness' | 'dev' | 'general';
export type LeaderboardSource = 'all' | 'challenge' | 'event';

export interface GlobalStanding {
  rank: number;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  points: number;
}

export interface GlobalLeaderboard {
  period: LeaderboardPeriod;
  domain: LeaderboardDomain;
  source: LeaderboardSource;
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  standings: GlobalStanding[];
}

export interface LeaderboardEntry {
  _id: string;
  event_id: string;
  participant: { type: 'user' | 'team'; id: string; display_name: string; avatar_url: string | null; deleted?: boolean };
  raw_score: number;
  normalized_score: number;
  invested_points: number;
  final_score: number;
  stats: { played?: number; won?: number; lost?: number; drawn?: number; eliminated?: boolean };
  rank: number | null;
  previous_rank: number | null;
}

export interface EventLeaderboard {
  event_id: string;
  event_title: string;
  format: string;
  min_participants: number;
  threshold_met: boolean;
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  standings: LeaderboardEntry[];
}

// ------------------------------------------------------------------------ media
export type MediaCategory = 'event' | 'community' | 'memories' | 'sponsor' | 'hall_of_fame' | 'general';

export interface MediaItem {
  _id: string;
  uploader: UserSnapshot;
  url: string;
  thumbnail_url: string | null;
  original_filename: string;
  mime_type: string;
  media_type: 'image' | 'video';
  category: MediaCategory;
  event_id: string | null;
  album_id: string | null;
  caption: string | null;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  metadata: { width?: number; height?: number; duration_seconds?: number } | null;
  views_count: number;
  likes_count: number;
  created_at: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages?: number;
}

// ------------------------------------------------------------------ hall of fame
export type HallOfFameCategory = 'event_winner' | 'challenge_legend' | 'sponsor_champion' | 'custom';

export interface HallOfFameEntry {
  _id: string;
  slug: string;
  category: HallOfFameCategory;
  title: string;
  description: string | null;
  quote: string | null;
  honoree: { type: 'user' | 'team'; id: string; display_name: string; avatar_url: string | null; deleted?: boolean };
  members: UserSnapshot[];
  source: { type: 'event' | 'challenge' | 'manual'; id: string | null; title: string | null };
  achievement: { domain: string | null; season: string | null; year: number; difficulty: string | null; award_points: number | null };
  media_url: string | null;
  cover_url: string | null;
  tags: string[];
  featured: boolean;
  featured_order: number | null;
  created_at: string;
}
