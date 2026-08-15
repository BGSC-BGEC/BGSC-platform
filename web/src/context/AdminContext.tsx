import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  UserRole,
  NavigationTab,
  MatchNode,
  BracketRules,
  CaptainApplication,
  AuctionPlayer,
  CaptainWallet,
  AuctionBidEvent,
  GlobalMultipliers,
  EventScoringCategory,
  InvestmentEvent,
  Ticket,
  ModerationItem,
  Broadcast,
  AuditLogEntry,
  AdminNotification,
  ToastMessage,
  SanctionType,
} from '../types/admin';
import {
  INITIAL_MATCHES,
  INITIAL_BRACKET_RULES,
  INITIAL_CAPTAINS,
  INITIAL_AUCTION_PLAYERS,
  INITIAL_CAPTAIN_WALLETS,
  INITIAL_GLOBAL_MULTIPLIERS,
  INITIAL_SCORING_CATEGORIES,
  INITIAL_INVESTMENTS,
  INITIAL_TICKETS,
  INITIAL_MODERATION,
  INITIAL_BROADCASTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS,
} from '../data/initialData';
import { soundFx } from '../utils/audio';
import { useAuthStore } from '../core/stores/authStore';

interface AdminContextType {
  // Navigation & Shell
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  sessionDuration: string;

  // Drawers & Modals
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  notificationDrawerOpen: boolean;
  setNotificationDrawerOpen: (open: boolean) => void;
  auditDrawerOpen: boolean;
  setAuditDrawerOpen: (open: boolean) => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;

  // Notifications
  notifications: AdminNotification[];
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;

  // Audit Logs
  auditLogs: AuditLogEntry[];
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'actorId' | 'actorName' | 'actorRole'> & { reason?: string }) => void;

  // Bracket Engine
  matches: MatchNode[];
  bracketRules: BracketRules;
  updateMatchScore: (matchId: string, team1Score: number, team2Score: number, reason?: string) => void;
  setBracketRules: React.Dispatch<React.SetStateAction<BracketRules>>;
  saveBracketState: () => void;

  // Captains
  captains: CaptainApplication[];
  selectedCaptainId: string | null;
  setSelectedCaptainId: (id: string | null) => void;
  approveCaptain: (id: string, reason?: string) => void;
  rejectCaptain: (id: string, reason?: string) => void;

  // Live Auction Controller
  auctionPlayers: AuctionPlayer[];
  activePlayerIndex: number;
  captainWallets: CaptainWallet[];
  bidHistory: AuctionBidEvent[];
  auctionCountdown: number;
  auctionStatus: 'idle' | 'live' | 'paused' | 'sold' | 'unsold';
  webSocketLatency: number;
  startAuctionCountdown: () => void;
  pauseAuctionCountdown: () => void;
  toggleAuctionPause: () => void;
  placeBid: (captainId: string, amount: number, isManual?: boolean) => void;
  sellCurrentPlayer: () => void;
  passCurrentPlayer: () => void;
  nextAuctionPlayer: () => void;
  prevAuctionPlayer: () => void;

  // Scoring Engine
  globalMultipliers: GlobalMultipliers;
  setGlobalMultipliers: React.Dispatch<React.SetStateAction<GlobalMultipliers>>;
  scoringCategories: EventScoringCategory[];
  setScoringCategories: React.Dispatch<React.SetStateAction<EventScoringCategory[]>>;
  scoringDirty: boolean;
  saveScoringRules: () => void;

  // Points Investments
  investments: InvestmentEvent[];
  updateInvestment: (id: string, updates: Partial<InvestmentEvent>) => void;

  // Tickets
  tickets: Ticket[];
  selectedTicketId: string | null;
  setSelectedTicketId: (id: string | null) => void;
  addTicketMessage: (ticketId: string, content: string, type: 'public' | 'internal') => void;
  updateTicketStatus: (ticketId: string, status: Ticket['status'], assignedTo?: string) => void;

  // Moderation
  moderationItems: ModerationItem[];
  dismissModeration: (id: string) => void;
  removeModerationContent: (id: string) => void;
  sanctionUser: (id: string, sanction: SanctionType, note: string) => void;

  // Broadcasts
  broadcasts: Broadcast[];
  publishBroadcast: (broadcast: Omit<Broadcast, 'id' | 'sendDate' | 'openRate' | 'targetReach' | 'status'> & { scheduleTime?: string }) => void;
  saveBroadcastDraft: (broadcast: Omit<Broadcast, 'id' | 'sendDate' | 'openRate' | 'targetReach' | 'status'>) => void;

  // Autosave Status
  autosaveStatus: 'saved' | 'saving';
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Shell
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const authUser = useAuthStore((s) => s.user);
  const jwtRole = authUser?.role;
  const mappedRole: UserRole = jwtRole === 'founder' ? 'Founder' : jwtRole === 'coordinator' ? 'Coordinator' : 'Core';
  const [userRole, setUserRole] = useState<UserRole>(mappedRole);
  useEffect(() => { setUserRole(mappedRole); }, [mappedRole]);
  const [sessionSeconds, setSessionSeconds] = useState<number>(864); // ~14 mins initial session

  // Drawers
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<AdminNotification[]>(INITIAL_NOTIFICATIONS);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Data Stores
  const [matches, setMatches] = useState<MatchNode[]>(INITIAL_MATCHES);
  const [bracketRules, setBracketRules] = useState<BracketRules>(INITIAL_BRACKET_RULES);
  const [captains, setCaptains] = useState<CaptainApplication[]>(INITIAL_CAPTAINS);
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(null);

  // Auction State
  const [auctionPlayers, setAuctionPlayers] = useState<AuctionPlayer[]>(INITIAL_AUCTION_PLAYERS);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const [captainWallets, setCaptainWallets] = useState<CaptainWallet[]>(INITIAL_CAPTAIN_WALLETS);
  const [bidHistory, setBidHistory] = useState<AuctionBidEvent[]>([
    {
      id: 'bid-1',
      timestamp: '02:18:04',
      captainId: 'CAPT-DELTA',
      captainName: 'Sarah Jenkins',
      teamName: 'Team Delta',
      amount: 850,
    },
    {
      id: 'bid-2',
      timestamp: '02:18:08',
      captainId: 'CAPT-ALPHA',
      captainName: 'Johnathan Miller',
      teamName: 'Team Alpha',
      amount: 900,
    },
    {
      id: 'bid-3',
      timestamp: '02:18:12',
      captainId: 'CAPT-DELTA',
      captainName: 'Sarah Jenkins',
      teamName: 'Team Delta',
      amount: 950,
    },
  ]);
  const [auctionCountdown, setAuctionCountdown] = useState<number>(4.2);
  const [auctionStatus, setAuctionStatus] = useState<'idle' | 'live' | 'paused' | 'sold' | 'unsold'>('live');
  const [webSocketLatency, setWebSocketLatency] = useState<number>(24);

  // Scoring
  const [globalMultipliers, setGlobalMultipliers] = useState<GlobalMultipliers>(INITIAL_GLOBAL_MULTIPLIERS);
  const [scoringCategories, setScoringCategories] = useState<EventScoringCategory[]>(INITIAL_SCORING_CATEGORIES);
  const [scoringDirty, setScoringDirty] = useState<boolean>(false);

  // Investments
  const [investments, setInvestments] = useState<InvestmentEvent[]>(INITIAL_INVESTMENTS);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Moderation
  const [moderationItems, setModerationItems] = useState<ModerationItem[]>(INITIAL_MODERATION);

  // Broadcasts
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(INITIAL_BROADCASTS);

  // Autosave
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving'>('saved');

  // Timer Ref for Auction
  const auctionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Session duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSessionDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  // Toast Dispatcher
  const addToast = useCallback((toast: Omit<ToastMessage, 'id' | 'timestamp'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { ...toast, id, timestamp: Date.now() }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Notifications
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    addToast({ title: 'Notifications cleared', type: 'info' });
  }, [addToast]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  }, []);

  // Add Immutable Audit Log
  const addAuditLog = useCallback(
    (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'actorId' | 'actorName' | 'actorRole'> & { reason?: string }) => {
      const now = new Date();
      const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const newEntry: AuditLogEntry = {
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestamp,
        actorId: `USR-${userRole.toUpperCase()}-1`,
        actorName: userRole === 'Core' ? 'Alex Thorne' : userRole === 'Coordinator' ? 'Sarah Jenkins' : 'Founder Console',
        actorRole: userRole,
        ...entry,
      };
      setAuditLogs((prev) => [newEntry, ...prev]);
    },
    [userRole]
  );

  // Autosave Background Loop (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setAutosaveStatus('saving');
      setTimeout(() => {
        setAutosaveStatus('saved');
      }, 800);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Simulated WebSocket jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setWebSocketLatency(Math.floor(18 + Math.random() * 14));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Bracket Match Score Update with propagation to next rounds
  const updateMatchScore = useCallback(
    (matchId: string, team1Score: number, team2Score: number, reason?: string) => {
      setMatches((prev) => {
        const nextMatches = [...prev];
        const matchIdx = nextMatches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return prev;

        const current = nextMatches[matchIdx];
        const prevScores = `${current.team1.score ?? 0} - ${current.team2.score ?? 0}`;
        const newScores = `${team1Score} - ${team2Score}`;

        const isT1Winner = team1Score > team2Score;
        const isT2Winner = team2Score > team1Score;
        const isCompleted = team1Score !== team2Score && (team1Score >= 1 || team2Score >= 1);

        const updatedMatch: MatchNode = {
          ...current,
          status: isCompleted ? 'Completed' : 'Live',
          team1: { ...current.team1, score: team1Score, isWinner: isT1Winner },
          team2: { ...current.team2, score: team2Score, isWinner: isT2Winner },
        };

        nextMatches[matchIdx] = updatedMatch;

        // Propagate winner to next match in bracket
        if (isCompleted && updatedMatch.nextMatchId) {
          const nextIdx = nextMatches.findIndex((m) => m.id === updatedMatch.nextMatchId);
          if (nextIdx !== -1) {
            const nextMatch = { ...nextMatches[nextIdx] };
            const winner = isT1Winner ? updatedMatch.team1 : updatedMatch.team2;
            if (updatedMatch.nextMatchSlot === 1) {
              nextMatch.team1 = { ...winner, score: undefined, isWinner: undefined };
            } else {
              nextMatch.team2 = { ...winner, score: undefined, isWinner: undefined };
            }
            nextMatches[nextIdx] = nextMatch;
          }
        }

        // Audit Log
        addAuditLog({
          actionType: 'bracket_score_override',
          entityId: matchId,
          details: `Score updated for ${matchId}: ${updatedMatch.team1.name} (${team1Score}) vs ${updatedMatch.team2.name} (${team2Score})`,
          previousValue: prevScores,
          newValue: newScores,
          reason: reason || 'Live referee match score recording.',
        });

        return nextMatches;
      });

      addToast({
        title: `Match ${matchId} updated`,
        description: `New score: ${team1Score} - ${team2Score}`,
        type: 'success',
      });
    },
    [addAuditLog, addToast]
  );

  const saveBracketState = useCallback(() => {
    addAuditLog({
      actionType: 'rule_adjustment',
      entityId: 'BRACKET_OFFSIDE_S3',
      details: 'Bracket layout state and seed topology saved successfully.',
    });
    addToast({
      title: 'Bracket State Saved',
      description: 'All 7 matches and progression links synced to live cluster.',
      type: 'success',
    });
  }, [addAuditLog, addToast]);

  // Captain Approval/Rejection
  const approveCaptain = useCallback(
    (id: string, reason?: string) => {
      setCaptains((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Approved' } : c))
      );
      const cap = captains.find((c) => c.id === id);
      addAuditLog({
        actionType: 'captain_status',
        entityId: id,
        details: `Approved captain application for ${cap?.applicantName || id}`,
        previousValue: 'Pending',
        newValue: 'Approved',
        reason: reason || 'Application verified with valid roster credentials.',
      });
      addToast({
        title: 'Captain Approved',
        description: `${cap?.applicantName} is now certified captain for ${cap?.league}`,
        type: 'success',
      });
      setSelectedCaptainId(null);
    },
    [captains, addAuditLog, addToast]
  );

  const rejectCaptain = useCallback(
    (id: string, reason?: string) => {
      setCaptains((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'Rejected' } : c))
      );
      const cap = captains.find((c) => c.id === id);
      addAuditLog({
        actionType: 'captain_status',
        entityId: id,
        details: `Rejected captain application for ${cap?.applicantName || id}`,
        previousValue: 'Pending',
        newValue: 'Rejected',
        reason: reason || 'Base price deviation exceeds threshold without justification.',
      });
      addToast({
        title: 'Captain Rejected',
        description: `Application for ${cap?.applicantName} has been declined.`,
        type: 'warning',
      });
      setSelectedCaptainId(null);
    },
    [captains, addAuditLog, addToast]
  );

  // Live Auction Bidding Logic
  const placeBid = useCallback(
    (captainId: string, amount: number, isManual = false) => {
      const captain = captainWallets.find((c) => c.id === captainId);
      if (!captain) return;

      if (captain.walletBalance < amount) {
        addToast({
          title: 'Insufficient Purse',
          description: `${captain.teamName} has only ${captain.walletBalance} pts remaining.`,
          type: 'error',
        });
        return;
      }

      const activePlayer = auctionPlayers[activePlayerIndex];
      if (!activePlayer) return;

      if (amount <= activePlayer.currentBid) {
        addToast({
          title: 'Invalid Bid Amount',
          description: `Bid must be strictly greater than current highest bid (${activePlayer.currentBid} pts).`,
          type: 'error',
        });
        return;
      }

      // Play bid chime
      soundFx.playBidSound();

      // Reset 5s countdown clock on every valid bid
      setAuctionCountdown(5.0);
      setAuctionStatus('live');

      // Update active player's high bid
      setAuctionPlayers((prev) =>
        prev.map((p, idx) =>
          idx === activePlayerIndex
            ? {
                ...p,
                currentBid: amount,
                highBidderCaptainId: captain.id,
                highBidderCaptainName: `${captain.teamName} (${captain.name.split(' ')[0]})`,
              }
            : p
        )
      );

      // Add to live bid history
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const newBid: AuctionBidEvent = {
        id: `bid-${Date.now()}`,
        timestamp: timeStr,
        captainId: captain.id,
        captainName: captain.name,
        teamName: captain.teamName,
        amount,
        isManualOverride: isManual,
      };

      setBidHistory((prev) => [newBid, ...prev.slice(0, 19)]);
    },
    [captainWallets, auctionPlayers, activePlayerIndex, addToast]
  );

  // Sell Player to Highest Bidder
  const sellCurrentPlayer = useCallback(() => {
    const activePlayer = auctionPlayers[activePlayerIndex];
    if (!activePlayer) return;

    if (!activePlayer.highBidderCaptainId) {
      addToast({
        title: 'No Active Bids',
        description: 'Cannot sell player with no bids. Use Unsold / Pass instead.',
        type: 'warning',
      });
      return;
    }

    const captain = captainWallets.find((c) => c.id === activePlayer.highBidderCaptainId);
    if (!captain) return;

    // Victory audio + Confetti explosion
    soundFx.playSoldSound();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0D9488', '#10B981', '#F59E0B', '#38BDF8'],
    });

    setAuctionStatus('sold');

    // Deduct wallet and add player to roster
    setCaptainWallets((prev) =>
      prev.map((c) => {
        if (c.id === captain.id) {
          return {
            ...c,
            walletBalance: c.walletBalance - activePlayer.currentBid,
            rosterCount: c.rosterCount + 1,
            acquiredPlayers: [
              ...c.acquiredPlayers,
              {
                id: `acq-${activePlayer.id}`,
                name: activePlayer.name,
                role: activePlayer.role,
                price: activePlayer.currentBid,
                avatar: '⭐',
              },
            ],
          };
        }
        return c;
      })
    );

    // Mark player as sold
    setAuctionPlayers((prev) =>
      prev.map((p, idx) =>
        idx === activePlayerIndex
          ? {
              ...p,
              status: 'sold',
              soldTo: captain.teamName,
              soldPrice: activePlayer.currentBid,
            }
          : p
      )
    );

    addAuditLog({
      actionType: 'auction_sold',
      entityId: activePlayer.id,
      details: `Player ${activePlayer.name} SOLD to ${captain.teamName} for ${activePlayer.currentBid} pts`,
      newValue: `${captain.teamName} @ ${activePlayer.currentBid} pts`,
    });

    addToast({
      title: '🔨 SOLD!',
      description: `${activePlayer.name} acquired by ${captain.teamName} for ${activePlayer.currentBid} pts!`,
      type: 'success',
    });
  }, [auctionPlayers, activePlayerIndex, captainWallets, addAuditLog, addToast]);

  // Pass / Unsold Player
  const passCurrentPlayer = useCallback(() => {
    const activePlayer = auctionPlayers[activePlayerIndex];
    if (!activePlayer) return;

    soundFx.playPassSound();
    setAuctionStatus('unsold');

    setAuctionPlayers((prev) =>
      prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, status: 'unsold' } : p))
    );

    addAuditLog({
      actionType: 'auction_unsold',
      entityId: activePlayer.id,
      details: `Player ${activePlayer.name} passed with 0 bids. Marked UNSOLD.`,
    });

    addToast({
      title: 'Player Unsold',
      description: `${activePlayer.name} passed without sale. Moving to next block.`,
      type: 'warning',
    });
  }, [auctionPlayers, activePlayerIndex, addAuditLog, addToast]);

  const nextAuctionPlayer = useCallback(() => {
    if (activePlayerIndex < auctionPlayers.length - 1) {
      setActivePlayerIndex((prev) => prev + 1);
      setAuctionCountdown(5.0);
      setAuctionStatus('live');
      setAuctionPlayers((prev) =>
        prev.map((p, idx) => (idx === activePlayerIndex + 1 ? { ...p, status: 'on_block' } : p))
      );
    }
  }, [activePlayerIndex, auctionPlayers.length]);

  const prevAuctionPlayer = useCallback(() => {
    if (activePlayerIndex > 0) {
      setActivePlayerIndex((prev) => prev - 1);
      setAuctionCountdown(5.0);
      setAuctionStatus('live');
    }
  }, [activePlayerIndex]);

  const startAuctionCountdown = useCallback(() => {
    setAuctionStatus('live');
  }, []);

  const pauseAuctionCountdown = useCallback(() => {
    setAuctionStatus('paused');
  }, []);

  const toggleAuctionPause = useCallback(() => {
    setAuctionStatus((prev) => (prev === 'live' ? 'paused' : 'live'));
  }, []);

  // Real-time Auction 5s Countdown Loop
  useEffect(() => {
    if (auctionStatus !== 'live') {
      if (auctionTimerRef.current) clearInterval(auctionTimerRef.current);
      return;
    }

    auctionTimerRef.current = setInterval(() => {
      setAuctionCountdown((prev) => {
        const nextTime = Math.max(0, +(prev - 0.1).toFixed(1));

        // Audio ticks
        if (nextTime <= 2.0 && nextTime > 0 && Math.round(nextTime * 10) % 10 === 0) {
          soundFx.playUrgentTick();
        } else if (Math.round(nextTime * 10) % 10 === 0 && nextTime > 0) {
          soundFx.playTick();
        }

        // Auto-hammer when reaching 0
        if (nextTime === 0) {
          sellCurrentPlayer();
        }
        return nextTime;
      });
    }, 100);

    return () => {
      if (auctionTimerRef.current) clearInterval(auctionTimerRef.current);
    };
  }, [auctionStatus, sellCurrentPlayer]);



  // Scoring Rule Multiplier Updates
  const saveScoringRules = useCallback(() => {
    addAuditLog({
      actionType: 'rule_adjustment',
      entityId: 'SCORING_ENGINE_CORE',
      details: 'Updated global multipliers and category base scoring matrix.',
    });
    setScoringDirty(false);
    addToast({
      title: 'Scoring Rules Saved',
      description: 'Platform multiplier matrix applied across all tournament calculation engines.',
      type: 'success',
    });
  }, [addAuditLog, addToast]);

  // Points Investments
  const updateInvestment = useCallback(
    (id: string, updates: Partial<InvestmentEvent>) => {
      setInvestments((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))
      );
      addAuditLog({
        actionType: 'investment_updated',
        entityId: id,
        details: `Investment parameters updated for event ${id}`,
      });
      addToast({
        title: 'Investment Updated',
        description: 'Event investment limits successfully updated.',
        type: 'success',
      });
    },
    [addAuditLog, addToast]
  );

  // Tickets
  const addTicketMessage = useCallback(
    (ticketId: string, content: string, type: 'public' | 'internal') => {
      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: userRole === 'Core' ? 'Alex Thorne (Admin)' : 'Sarah (Coordinator)',
        senderRole: 'admin' as const,
        type,
        timestamp: 'Just now',
        content,
      };

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                thread: [...t.thread, newMessage],
              }
            : t
        )
      );

      addAuditLog({
        actionType: 'ticket_resolution',
        entityId: ticketId,
        details: `Added ${type} note to ticket ${ticketId}`,
      });

      addToast({
        title: type === 'public' ? 'Public Reply Sent' : 'Internal Note Saved',
        description: `Ticket ${ticketId} updated.`,
        type: 'success',
      });
    },
    [userRole, addAuditLog, addToast]
  );

  const updateTicketStatus = useCallback(
    (ticketId: string, status: Ticket['status'], assignedTo?: string) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                status,
                assignedTo: assignedTo || t.assignedTo,
              }
            : t
        )
      );

      addAuditLog({
        actionType: 'ticket_resolution',
        entityId: ticketId,
        details: `Ticket ${ticketId} status changed to ${status}`,
        newValue: status,
      });

      addToast({
        title: 'Ticket Status Updated',
        description: `${ticketId} is now set to ${status}`,
        type: 'info',
      });
    },
    [addAuditLog, addToast]
  );

  // Moderation
  const dismissModeration = useCallback(
    (id: string) => {
      setModerationItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'dismissed' } : m))
      );
      addAuditLog({
        actionType: 'moderation_action',
        entityId: id,
        details: `Dismissed moderation report ${id}`,
        newValue: 'Dismissed',
      });
      addToast({
        title: 'Report Dismissed',
        description: `Report ${id} has been dismissed.`,
        type: 'info',
      });
    },
    [addAuditLog, addToast]
  );

  const removeModerationContent = useCallback(
    (id: string) => {
      setModerationItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'removed' } : m))
      );
      addAuditLog({
        actionType: 'moderation_action',
        entityId: id,
        details: `Removed flagged content for report ${id}`,
        newValue: 'Removed',
      });
      addToast({
        title: 'Content Removed',
        description: `Reported asset removed from community feeds.`,
        type: 'warning',
      });
    },
    [addAuditLog, addToast]
  );

  const sanctionUser = useCallback(
    (id: string, sanction: SanctionType, note: string) => {
      setModerationItems((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'sanctioned', sanctionNote: note } : m))
      );
      const mod = moderationItems.find((m) => m.id === id);
      addAuditLog({
        actionType: 'moderation_action',
        entityId: id,
        details: `Sanctioned user ${mod?.offender.handle} with ${sanction}`,
        newValue: sanction,
        reason: note,
      });
      addToast({
        title: `Sanction Issued: ${sanction}`,
        description: `${mod?.offender.handle} has received disciplinary action.`,
        type: 'error',
      });
    },
    [moderationItems, addAuditLog, addToast]
  );

  // Broadcasts
  const publishBroadcast = useCallback(
    (data: Omit<Broadcast, 'id' | 'sendDate' | 'openRate' | 'targetReach' | 'status'> & { scheduleTime?: string }) => {
      const isScheduled = !!data.scheduleTime;
      const newBroadcast: Broadcast = {
        id: `BC-${Date.now().toString().slice(-4)}`,
        title: data.title,
        category: data.category,
        audience: data.audience,
        content: data.content,
        bannerUrl: data.bannerUrl,
        sendInstantPush: data.sendInstantPush,
        scheduledFor: data.scheduleTime,
        sendDate: isScheduled ? `Scheduled (${data.scheduleTime})` : 'Just now',
        openRate: '0.0%',
        targetReach: data.category === 'All' ? 2450 : data.category === 'Leagues' ? 450 : 820,
        status: isScheduled ? 'Scheduled' : 'Published',
      };

      setBroadcasts((prev) => [newBroadcast, ...prev]);

      addAuditLog({
        actionType: 'broadcast_publish',
        entityId: newBroadcast.id,
        details: `Broadcast "${data.title}" ${isScheduled ? 'scheduled' : 'published'} to ${data.audience}`,
      });

      addToast({
        title: isScheduled ? 'Broadcast Scheduled' : 'Broadcast Published!',
        description: `Delivered across notifications & feed channels.`,
        type: 'success',
      });
    },
    [addAuditLog, addToast]
  );

  const saveBroadcastDraft = useCallback(
    (data: Omit<Broadcast, 'id' | 'sendDate' | 'openRate' | 'targetReach' | 'status'>) => {
      const newDraft: Broadcast = {
        id: `BC-${Date.now().toString().slice(-4)}`,
        title: data.title || 'Untitled Draft',
        category: data.category,
        audience: data.audience,
        content: data.content,
        bannerUrl: data.bannerUrl,
        sendInstantPush: data.sendInstantPush,
        sendDate: 'Draft (Unsent)',
        openRate: '—',
        targetReach: 0,
        status: 'Draft',
      };

      setBroadcasts((prev) => [newDraft, ...prev]);

      addToast({
        title: 'Draft Saved',
        description: 'Broadcast draft saved to local workspace.',
        type: 'info',
      });
    },
    [addToast]
  );

  // Global Keyboard Listeners (⌘K, ⌘B, Space, Enter, Esc, ⌘S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // ⌘K / Ctrl+K: Command Palette
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }

      // ⌘B / Ctrl+B: Toggle Sidebar
      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }

      // ⌘S / Ctrl+S: Save current state
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (window.location.pathname === '/bracket') {
          saveBracketState();
        } else if (window.location.pathname === '/scoring') {
          saveScoringRules();
        } else {
          addToast({ title: 'Workspace Autosaved', type: 'info' });
        }
      }

      // Esc: Close open modals/drawers
      if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        if (notificationDrawerOpen) setNotificationDrawerOpen(false);
        if (auditDrawerOpen) setAuditDrawerOpen(false);
        if (selectedCaptainId) setSelectedCaptainId(null);
        if (selectedTicketId) setSelectedTicketId(null);
      }

      // Auction keyboard shortcuts when on auction console tab
      if (window.location.pathname === '/auctions') {
        if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          toggleAuctionPause();
        }
        if (e.code === 'Enter' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          sellCurrentPlayer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    notificationDrawerOpen,
    auditDrawerOpen,
    selectedCaptainId,
    selectedTicketId,
    currentTab,
    saveBracketState,
    saveScoringRules,
    toggleAuctionPause,
    sellCurrentPlayer,
    addToast,
  ]);

  return (
    <AdminContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        userRole,
        setUserRole,
        sessionDuration: formatSessionDuration(sessionSeconds),

        commandPaletteOpen,
        setCommandPaletteOpen,
        notificationDrawerOpen,
        setNotificationDrawerOpen,
        auditDrawerOpen,
        setAuditDrawerOpen,

        toasts,
        addToast,
        removeToast,

        notifications,
        markAllNotificationsRead,
        markNotificationRead,

        auditLogs,
        addAuditLog,

        matches,
        bracketRules,
        updateMatchScore,
        setBracketRules,
        saveBracketState,

        captains,
        selectedCaptainId,
        setSelectedCaptainId,
        approveCaptain,
        rejectCaptain,

        auctionPlayers,
        activePlayerIndex,
        captainWallets,
        bidHistory,
        auctionCountdown,
        auctionStatus,
        webSocketLatency,
        startAuctionCountdown,
        pauseAuctionCountdown,
        toggleAuctionPause,
        placeBid,
        sellCurrentPlayer,
        passCurrentPlayer,
        nextAuctionPlayer,
        prevAuctionPlayer,

        globalMultipliers,
        setGlobalMultipliers: (val) => {
          setGlobalMultipliers(val);
          setScoringDirty(true);
        },
        scoringCategories,
        setScoringCategories: (val) => {
          setScoringCategories(val);
          setScoringDirty(true);
        },
        scoringDirty,
        saveScoringRules,

        investments,
        updateInvestment,

        tickets,
        selectedTicketId,
        setSelectedTicketId,
        addTicketMessage,
        updateTicketStatus,

        moderationItems,
        dismissModeration,
        removeModerationContent,
        sanctionUser,

        broadcasts,
        publishBroadcast,
        saveBroadcastDraft,

        autosaveStatus,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
