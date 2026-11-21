export type EventCategory = 'leagues' | 'bgec' | 'fitsoc' | 'general'
export type EventDomain = 'sports' | 'esports' | 'fitness' | 'general'
export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'past' | 'cancelled'
export type EventType = 'LE' | 'DE' | 'ALL' | 'DLL'
export type LeaderboardFormat = 'round_robin' | 'single_elim' | 'double_elim' | 'elim_after_n' | 'points_table'
export type AuctionStatus = 'not_started' | 'live' | 'paused' | 'finished'

/**
 * What each event type IS and what it switches on (spec §4 Event.type, §5.5, §5.15, glossary).
 * The backend enforces the same invariants: leaderboard != null <=> type != 'DE',
 * auction != null <=> type == 'ALL'. Every type-dependent form section, tab and button reads this
 * table instead of re-deciding per component.
 */
export interface EventTypeRules {
  label: string
  description: string
  /** Has a leaderboard / bracket (everything except DE). */
  hasLeaderboard: boolean
  /** A league: team-based, captain request flow (spec §5.5 League-Specific Registration). */
  isLeague: boolean
  /** Auction-drafted rosters (spec §5.15.4). */
  isAuction: boolean
  /** Teams cannot be switched off. */
  forcesTeams: boolean
}

export const EVENT_TYPE_RULES: Record<EventType, EventTypeRules> = {
  DE: {
    label: 'DE — Direct Event',
    description: 'Register and play. No leaderboard or bracket; results are published directly.',
    hasLeaderboard: false,
    isLeague: false,
    isAuction: false,
    forcesTeams: false,
  },
  LE: {
    label: 'LE — Leaderboard Event',
    description: 'Participants are ranked on a leaderboard built from submitted scores.',
    hasLeaderboard: true,
    isLeague: false,
    isAuction: false,
    forcesTeams: false,
  },
  DLL: {
    label: 'DLL — Direct Leaderboard League',
    description: 'League with a bracket. Teamed by default; captains build their own squads.',
    hasLeaderboard: true,
    isLeague: true,
    isAuction: false,
    forcesTeams: false,
  },
  ALL: {
    label: 'ALL — Auction Leaderboard League',
    description: 'Team league whose rosters are drafted in a live auction by approved captains.',
    hasLeaderboard: true,
    isLeague: true,
    isAuction: true,
    forcesTeams: true,
  },
}

export const LEADERBOARD_FORMAT_LABELS: Record<LeaderboardFormat, string> = {
  points_table: 'Points table',
  round_robin: 'Round robin',
  single_elim: 'Single elimination',
  double_elim: 'Double elimination (upper / lower)',
  elim_after_n: 'Elimination after N losses',
}

export function rulesFor(type: EventType | undefined): EventTypeRules {
  return EVENT_TYPE_RULES[type ?? 'LE']
}

/**
 * Backend invariant (event-model §6): an event may leave draft without a registration form only
 * when it is a non-teamed, uncapped DE. Everything else is published after its form is linked.
 */
export function canPublishWithoutForm(type: EventType, isTeamed: boolean, maxParticipants: number | null): boolean {
  return type === 'DE' && !isTeamed && maxParticipants === null
}

export interface EventLeaderboardConfig {
  format: LeaderboardFormat
  elimAfterN: number | null
  minParticipants: number
}

export interface EventTeamingConfig {
  teamSizeMin: number | null
  teamSizeMax: number | null
  maxTeams: number | null
  captainApplicationRequired: boolean
}

export interface EventAuctionConfig {
  kMultiplier: number
  minBidIncrement: number
  bidTimerSeconds: number
  pursePerTeam: number | null
  status: AuctionStatus
  captainUserIds: string[]
}

export interface ClubEvent {
  id: string
  title: string
  slug: string
  description: string
  category: EventCategory
  type?: EventType
  domain: EventDomain
  status: EventStatus
  startAt: string
  endAt: string
  /** ISO timestamp; registration must close before the event starts. */
  registrationClosesAt?: string | null
  venue: string | null
  maxParticipants: number | null
  currentParticipants: number
  isTeamed: boolean
  bannerUrl: string | null
  registrationFormId?: string | null
  waitlistEnabled?: boolean
  requiresApproval?: boolean
  teaming?: EventTeamingConfig
  leaderboard?: EventLeaderboardConfig | null
  auction?: EventAuctionConfig | null
  coverMediaUrl?: string | null
  logoUrl?: string | null
  pointsPool?: EventPointsPool
}

/** Per-event points settings (event.points_pool). Backend defaults: 10, [3, 2, 1.5], 0, off, none. */
export interface EventPointsPool {
  participation: number
  podiumMultipliers: number[]
  sponsorBonus: number
  investmentEnabled: boolean
  investmentCap: number | null
}

export const DEFAULT_POINTS_POOL: EventPointsPool = {
  participation: 10,
  podiumMultipliers: [3, 2, 1.5],
  sponsorBonus: 0,
  investmentEnabled: false,
  investmentCap: null,
}

/**
 * Formats the create form offers. The bracket service only generates round robin and single
 * elimination (bracket-service generate.ts); double elimination and "eliminated after N" are
 * accepted by the event model but can never produce a bracket, so they are not offered.
 */
export const SELECTABLE_LEADERBOARD_FORMATS: LeaderboardFormat[] = ['points_table', 'round_robin', 'single_elim']
