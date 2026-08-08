export type UserRole = 'Core' | 'Coordinator' | 'Founder';

export type NavigationTab = 
  | 'dashboard'
  | 'tournaments'
  | 'bracket'
  | 'captains'
  | 'auctions'
  | 'scoring'
  | 'investments'
  | 'tickets'
  | 'moderation'
  | 'broadcasts'
  | 'settings';

export type BracketFormat = 
  | 'Single Elimination'
  | 'Double Elimination'
  | 'Round Robin'
  | 'Elimination after N Fails';

export type MatchStatus = 'Pending' | 'Live' | 'Completed' | 'Bye';

export interface Competitor {
  seed: number;
  name: string;
  logo: string;
  score?: number;
  isWinner?: boolean;
}

export interface MatchNode {
  id: string; // e.g. '#M101'
  round: number;
  matchIndex: number;
  pitch: string;
  scheduledTime: string;
  status: MatchStatus;
  team1: Competitor;
  team2: Competitor;
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
}

export interface BracketRules {
  format: BracketFormat;
  seedPositions: 'Standard Seeded' | 'Randomized' | 'Manual Placement';
  byeAwards: 'Highest Seed First' | 'Random Allocation' | 'None';
  scoreScaleMin: number;
  scoreScaleMax: number;
  extraTimeDurationMins: number;
  goldenGoalEnabled: boolean;
  tieBreakerRule: 'Penalties' | 'Fair Play Points' | 'Coin Toss';
}

export type DeviationLevel = 'neutral' | 'warning' | 'critical';

export interface CaptainApplication {
  id: string;
  applicantName: string;
  handle: string;
  avatar: string;
  league: string;
  leagueType: 'ALL (Auction)' | 'DLL (Draft)';
  basePrice: number;
  marketBase: number;
  deviationPercent: number;
  deviationLevel: DeviationLevel;
  rosterCount: number;
  rosterMax: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  appliedAt: string;
  historicalRecord: {
    tournamentsPlayed: number;
    tournamentsWon: number;
    winRate: string;
    captaincyExperienceYears: number;
  };
  proposedTeam: {
    name: string;
    crestUrl: string;
    motto: string;
  };
  rosterMembers: Array<{
    name: string;
    handle: string;
    role: string;
    rating: number;
  }>;
  selfEvaluationNotes: string;
}

export interface AuctionPlayer {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  role: string;
  tier: 'Tier S' | 'Tier A' | 'Tier B';
  basePrice: number;
  currentBid: number;
  highBidderCaptainId?: string;
  highBidderCaptainName?: string;
  status: 'upcoming' | 'on_block' | 'sold' | 'unsold';
  soldTo?: string;
  soldPrice?: number;
}

export interface AcquiredPlayer {
  id: string;
  name: string;
  role: string;
  price: number;
  avatar: string;
}

export interface CaptainWallet {
  id: string;
  name: string;
  handle: string;
  teamName: string;
  captainAvatar: string;
  walletBalance: number;
  totalBudget: number;
  rosterCount: number;
  rosterMax: number;
  acquiredPlayers: AcquiredPlayer[];
}

export interface AuctionBidEvent {
  id: string;
  timestamp: string;
  captainId: string;
  captainName: string;
  teamName: string;
  amount: number;
  isManualOverride?: boolean;
}

export interface GlobalMultipliers {
  sponsorWin: number;
  dailyStreak: number;
  challengeLegendFlatBonus: number;
  referralAward: number;
  tieBreakerFairPlayBonus: number;
  podiumStreak: number;
}

export interface EventScoringCategory {
  id: string;
  categoryName: string;
  participation: number;
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  decayFormula: string;
  customSportVars: {
    goals: number;
    kills: number;
    assists: number;
  };
  tieBreakerRule: string;
}

export interface InvestmentEvent {
  id: string;
  eventName: string;
  status: 'Active' | 'Upcoming' | 'Completed';
  allowInvestment: boolean;
  minInvest: number;
  maxInvest: number;
  step: 25 | 50 | 100;
  poolInvested: number;
}

export type TicketCategory = 'Bug Report' | 'Account Issue' | 'Feature Request' | 'Technical';
export type TicketSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export type TicketStatus = 'Submitted' | 'Under Review' | 'Resolved' | 'Closed';

export interface TicketMessage {
  id: string;
  sender: string;
  senderRole: 'user' | 'admin';
  type: 'public' | 'internal';
  timestamp: string;
  content: string;
}

export interface Ticket {
  id: string; // e.g. '#TICK-10492'
  category: TicketCategory;
  userHandle: string;
  userName: string;
  userAvatar: string;
  severity: TicketSeverity;
  status: TicketStatus;
  assignedTo: string;
  submittedAt: string;
  description: string;
  attachedMedia?: string;
  thread: TicketMessage[];
}

export type ModerationContentType = 'Posts' | 'Comments' | 'Chat Messages' | 'Media Uploads';
export type ModerationReason = 'Harassment' | 'Spam' | 'Inappropriate Content' | 'Cheating';
export type SanctionType = 'Warning' | '1h Mute' | '24h Mute' | '7d Mute' | 'Shadowban' | 'Hard Ban';

export interface ModerationItem {
  id: string; // e.g. '#MOD-8821'
  contentType: ModerationContentType;
  reason: ModerationReason;
  timestamp: string;
  reporterHandle: string;
  reportedContent: {
    text?: string;
    mediaUrl?: string;
    location: string;
  };
  offender: {
    name: string;
    handle: string;
    avatar: string;
    accountAge: string;
    priorFlags: number;
    priorWarnings: number;
  };
  status: 'pending' | 'dismissed' | 'removed' | 'sanctioned';
  sanctionNote?: string;
}

export type BroadcastCategory = 'BGEC' | 'FitSoc' | 'General' | 'Leagues' | 'All';
export type BroadcastStatus = 'Published' | 'Draft' | 'Scheduled';

export interface Broadcast {
  id: string;
  title: string;
  category: BroadcastCategory;
  audience: string;
  content: string;
  bannerUrl?: string;
  sendInstantPush: boolean;
  scheduledFor?: string;
  sendDate: string;
  openRate: string;
  targetReach: number;
  status: BroadcastStatus;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  actionType: 
    | 'bracket_score_override'
    | 'rule_adjustment'
    | 'captain_status'
    | 'auction_sold'
    | 'auction_unsold'
    | 'auction_bid_override'
    | 'investment_updated'
    | 'moderation_action'
    | 'ticket_resolution'
    | 'broadcast_publish';
  entityId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
  type: 'urgent' | 'info' | 'success' | 'warning';
  linkTab?: NavigationTab;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
}
