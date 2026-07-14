import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { EventRepository } from '@/core/repositories/EventRepository';
import { useColors } from '@/hooks/use-colors';

// Mock types until Auction Service ships
interface BidEntry {
  captainName: string;
  amount: number;
  timestamp: string;
}

interface AuctionState {
  isLive: boolean;
  currentPlayer?: { name: string; basePrice: number; igName?: string };
  currentBid?: number;
  currentBidder?: string;
  bidLog: BidEntry[];
  timeRemaining: number; // seconds
}

const MOCK_OFFLINE: AuctionState = {
  isLive: false,
  bidLog: [],
  timeRemaining: 0,
};

export default function AuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ponytail: local timer display only — authoritative timer is server-side
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [auctionState, setAuctionState] = useState<AuctionState>(MOCK_OFFLINE);

  const { data: event, isPending, isError, refetch } = useQuery({
    queryKey: ['events', id],
    queryFn: () => EventRepository.getById(id),
    enabled: !!id,
  });

  // Count down display timer from server value
  useEffect(() => {
    setDisplaySeconds(auctionState.timeRemaining);
    if (auctionState.isLive && auctionState.timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setDisplaySeconds((s) => Math.max(0, s - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auctionState.isLive, auctionState.timeRemaining]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {isPending ? 'Auction' : `${event?.title ?? 'Event'} — Auction`}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}>

        {isPending ? (
          <View style={{ gap: 12 }}>
            <SkeletonBox width="100%" height={160} borderRadius={14} />
            <SkeletonBox width="100%" height={200} borderRadius={14} />
          </View>
        ) : isError || !event ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>⚠️</Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              Could not load auction
            </Text>
            <Pressable
              style={[styles.retryBtn, { borderColor: colors.border }]}
              onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : !auctionState.isLive ? (
          /* ── Auction offline ── */
          <View style={[styles.offlineBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.offlineEmoji}>🔨</Text>
            <Text style={[styles.offlineTitle, { color: colors.text }]}>Auction hasn't started</Text>
            <Text style={[styles.offlineSub, { color: colors.textMuted }]}>
              The live auction will appear here once coordinators open the room on the Web Console.
              Bidding is handled by captains on the web; this view is spectator-only.
            </Text>
            <Pressable
              style={[styles.retryBtn, { borderColor: colors.border }]}
              onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: colors.accent }]}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Player on the block ── */}
            <View
              style={[styles.playerBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ON THE BLOCK</Text>
              {auctionState.currentPlayer ? (
                <>
                  <Text style={[styles.playerName, { color: colors.text }]}>
                    {auctionState.currentPlayer.name}
                  </Text>
                  {auctionState.currentPlayer.igName ? (
                    <Text style={[styles.playerIgn, { color: colors.textMuted }]}>
                      {auctionState.currentPlayer.igName}
                    </Text>
                  ) : null}
                  <Text style={[styles.basePrice, { color: colors.textMuted }]}>
                    Base price: {auctionState.currentPlayer.basePrice} pts
                  </Text>
                </>
              ) : (
                <Text style={[styles.playerName, { color: colors.textMuted }]}>Waiting…</Text>
              )}

              {/* Timer */}
              <View
                style={[
                  styles.timerBox,
                  {
                    backgroundColor: displaySeconds <= 2 ? colors.danger + '22' : colors.accentMuted,
                    borderColor: displaySeconds <= 2 ? colors.danger : colors.accent,
                  },
                ]}>
                <Text
                  style={[
                    styles.timerText,
                    { color: displaySeconds <= 2 ? colors.danger : colors.accent },
                  ]}>
                  {displaySeconds}s
                </Text>
              </View>

              {/* Current bid */}
              {auctionState.currentBid != null ? (
                <View style={styles.currentBidRow}>
                  <Text style={[styles.currentBidLabel, { color: colors.textMuted }]}>
                    Current bid
                  </Text>
                  <Text style={[styles.currentBidAmount, { color: colors.success }]}>
                    {auctionState.currentBid} pts
                  </Text>
                  {auctionState.currentBidder ? (
                    <Text style={[styles.currentBidder, { color: colors.textMuted }]}>
                      by {auctionState.currentBidder}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* ── Live Bid Log ── */}
            <View
              style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>LIVE BID LOG</Text>
              {auctionState.bidLog.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No bids placed yet</Text>
              ) : (
                auctionState.bidLog.slice().reverse().map((b, i) => (
                  <View key={i} style={[styles.bidRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.bidCaptain, { color: colors.text }]}>{b.captainName}</Text>
                    <Text style={[styles.bidAmount, { color: colors.success }]}>{b.amount} pts</Text>
                  </View>
                ))
              )}
            </View>

            {/* ── Captain wallets & rosters ── */}
            <View
              style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CAPTAIN WALLETS</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Captain wallet data streams once auction room is live
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backIcon: { fontSize: 22, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  content: { padding: 16, gap: 14 },

  offlineBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  offlineEmoji: { fontSize: 48 },
  offlineTitle: { fontSize: 18, fontWeight: '700' },
  offlineSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  playerBlock: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  playerName: { fontSize: 22, fontWeight: '700' },
  playerIgn: { fontSize: 14 },
  basePrice: { fontSize: 13 },
  timerBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  timerText: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  currentBidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  currentBidLabel: { fontSize: 13 },
  currentBidAmount: { fontSize: 18, fontWeight: '700' },
  currentBidder: { fontSize: 13 },

  section: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bidCaptain: { fontSize: 14 },
  bidAmount: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14 },

  emptyEmoji: { fontSize: 40 },
  stateText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: '600' },
});
