import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { PointsRepository } from '@/core/repositories/PointsRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { PointTransaction, PointsSource, TransactionType } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

type TxFilter = 'all' | TransactionType;

const TX_FILTERS: { key: TxFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'earn', label: 'Earned' },
  { key: 'spend', label: 'Spent' },
  { key: 'refund', label: 'Refunded' },
];

const SOURCE_ICONS: Record<string, string> = {
  event: '📅',
  challenge: '⚡',
  store: '🛍️',
  leaderboard: '📊',
};

const SOURCE_LABELS: Record<string, string> = {
  event: 'Event Participation',
  challenge: 'Challenge Completed',
  store: 'Store Redemption',
  leaderboard: 'Leaderboard Investment',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#f97316',
  legend: '#8b5cf6',
};

function fmtBalance(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PointsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const [activeTab, setActiveTab] = useState<'points' | 'challenges'>('points');

  if (status !== 'authenticated') {
    return (
      <View style={[s.gate, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[s.gateTitle, { color: colors.text }]}>Sign in to view your points</Text>
        <Pressable
          onPress={() => router.push('/login')}
          style={[s.gateBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[s.gateBtnText, { color: colors.primaryText }]}>Login / Register</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['points', 'challenges'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              style={[s.tab, isActive && [s.tabActive, { borderBottomColor: colors.accent }]]}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[s.tabLabel, { color: isActive ? colors.accent : colors.textMuted }]}>
                {tab === 'points' ? '🪙 Points' : '⚡ Challenges'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'points' ? (
        <PointsTab colors={colors} />
      ) : (
        <ChallengesTab colors={colors} />
      )}
    </View>
  );
}

// ─── Points Tab ───────────────────────────────────────────────────────────────

function PointsTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const status = useAuthStore((s) => s.status);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');

  const { data: balance, isLoading: balanceLoading, error: balanceError, refetch: refetchBalance } = useQuery({
    queryKey: ['points', 'balance'],
    queryFn: PointsRepository.getBalance,
    enabled: status === 'authenticated',
  });

  const {
    data: txPages,
    isLoading: txLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: txError,
    refetch: refetchTx,
  } = useInfiniteQuery({
    queryKey: ['points', 'transactions'],
    queryFn: ({ pageParam }) => PointsRepository.getTransactions(pageParam as number, 30),
    initialPageParam: 1,
    getNextPageParam: (last: PointTransaction[], all) =>
      last.length < 30 ? undefined : (all.length + 1),
    enabled: status === 'authenticated',
  });

  const allTx = txPages?.pages.flat() ?? [];
  const filteredTx: PointTransaction[] = txFilter === 'all'
    ? allTx
    : allTx.filter((t) => t.type === txFilter);

  return (
    <FlatList
      data={filteredTx}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.4}
      onRefresh={() => { refetchBalance(); refetchTx(); }}
      refreshing={false}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListHeaderComponent={
        <View>
          {/* ── Balance Card ─────────────────────────────── */}
          <View style={[s.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.balanceLabel, { color: colors.textMuted }]}>YOUR POINTS</Text>
            {balanceLoading ? (
              <SkeletonBox width={160} height={52} borderRadius={8} style={{ marginVertical: 8 }} />
            ) : balanceError ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
                <Text style={{ color: colors.danger, fontSize: 14 }}>Could not load balance</Text>
                <Pressable onPress={() => refetchBalance()}>
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[s.balanceValue, { color: colors.accent }]}>
                {fmtBalance(balance?.balance ?? 0)} pts
              </Text>
            )}
            <View style={s.balanceBtns}>
              <Pressable
                style={[s.outlineBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={() => {}}
              >
                <Text style={[s.outlineBtnText, { color: colors.text }]}>Earn more ↓</Text>
              </Pressable>
              <Pressable
                style={[s.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => router.push('/(drawer)/store')}
              >
                <Text style={[s.primaryBtnText, { color: colors.primaryText }]}>Go to Store →</Text>
              </Pressable>
            </View>
          </View>

          {/* ── How to Earn ───────────────────────────────── */}
          <View style={s.tilesSection}>
            <Text style={[s.tilesSectionTitle, { color: colors.text }]}>How to Earn</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tilesRow}>
              {([
                { icon: '📅', title: 'Events', sub: 'Join & complete events' },
                { icon: '⚡', title: 'Challenges', sub: 'Submit & get approved' },
                { icon: '👥', title: 'Engagement', sub: 'Posts, invites, opens' },
                { icon: '🏆', title: 'Sponsor Bonus', sub: 'Win as affiliate' },
              ]).map((tile) => (
                <View key={tile.title} style={[s.infoTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={s.infoTileIcon}>{tile.icon}</Text>
                  <Text style={[s.infoTileTitle, { color: colors.text }]}>{tile.title}</Text>
                  <Text style={[s.infoTileSub, { color: colors.textMuted }]}>{tile.sub}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── How to Spend ──────────────────────────────── */}
          <View style={s.tilesSection}>
            <Text style={[s.tilesSectionTitle, { color: colors.text }]}>How to Spend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tilesRow}>
              {([
                { icon: '🛍️', title: 'Store', sub: 'Merch & indie games', onPress: () => router.push('/(drawer)/store') },
                { icon: '📊', title: 'Leaderboard', sub: 'Boost your rank', onPress: () => router.push('/(drawer)/leaderboards') },
              ]).map((tile) => (
                <Pressable key={tile.title} onPress={tile.onPress} style={[s.infoTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={s.infoTileIcon}>{tile.icon}</Text>
                  <Text style={[s.infoTileTitle, { color: colors.text }]}>{tile.title}</Text>
                  <Text style={[s.infoTileSub, { color: colors.textMuted }]}>{tile.sub}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* ── Transaction header + filter chips ────────── */}
          <View style={s.txHeader}>
            <Text style={[s.txSectionTitle, { color: colors.text }]}>Transaction History</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {TX_FILTERS.map((f) => {
              const isActive = txFilter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setTxFilter(isActive && f.key !== 'all' ? 'all' : f.key)}
                  style={[
                    s.filterChip,
                    isActive
                      ? { backgroundColor: colors.accent + '22', borderColor: colors.accent }
                      : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  ]}
                >
                  <Text style={[s.filterChipText, { color: isActive ? colors.accent : colors.textMuted }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Loading skeletons */}
          {txLoading && (
            <View style={{ padding: 16, gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.txRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <SkeletonBox width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <SkeletonBox width="60%" height={14} />
                    <SkeletonBox width="40%" height={12} />
                  </View>
                  <SkeletonBox width={60} height={14} />
                </View>
              ))}
            </View>
          )}

          {/* Error */}
          {!txLoading && txError && (
            <View style={s.stateBox}>
              <Text style={[s.stateText, { color: colors.textMuted }]}>Failed to load transactions</Text>
              <Pressable onPress={() => refetchTx()}>
                <Text style={[s.retryText, { color: colors.accent }]}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Empty */}
          {!txLoading && !txError && filteredTx.length === 0 && (
            <View style={s.stateBox}>
              <Text style={[s.stateText, { color: colors.textMuted }]}>
                {txFilter === 'all'
                  ? 'No transactions yet — earn points by joining events or completing challenges.'
                  : `No ${txFilter === 'earn' ? 'earned' : txFilter === 'spend' ? 'spent' : 'refunded'} transactions yet.`}
              </Text>
            </View>
          )}
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage
          ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} />
          : null
      }
      renderItem={({ item }) => <TxRow item={item} colors={colors} />}
    />
  );
}

function TxRow({ item, colors }: { item: PointTransaction; colors: ReturnType<typeof useColors> }) {
  const isEarn = item.type === 'earn' || item.type === 'refund';
  return (
    <View style={[s.txRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[s.txIconBox, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={s.txIcon}>{SOURCE_ICONS[item.source] ?? '💎'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.txDesc, { color: colors.text }]}>
          {SOURCE_LABELS[item.source] ?? 'Points Transaction'}
        </Text>
        <Text style={[s.txDate, { color: colors.textMuted }]}>{fmtDate(item.createdAt)}</Text>
      </View>
      <Text style={[s.txAmount, { color: isEarn ? colors.success : colors.danger }]}>
        {isEarn ? '+' : '−'}{item.amount} pts
      </Text>
    </View>
  );
}

// ─── Challenges Tab ───────────────────────────────────────────────────────────

function ChallengesTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [domain, setDomain] = useState('all');
  const [difficulties, setDifficulties] = useState(['easy', 'medium', 'hard', 'legend']);

  const DOMAINS = [
    { key: 'all', label: 'All' },
    { key: 'sports', label: 'Sports' },
    { key: 'esports', label: 'Esports' },
    { key: 'game_dev', label: 'Game Dev' },
    { key: 'general', label: 'General' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
        style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
      >
        {DOMAINS.map((d) => {
          const isActive = domain === d.key;
          return (
            <Pressable
              key={d.key}
              onPress={() => setDomain(isActive && d.key !== 'all' ? 'all' : d.key)}
              style={[
                s.filterChip,
                isActive
                  ? { backgroundColor: colors.accent + '22', borderColor: colors.accent }
                  : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <Text style={[s.filterChipText, { color: isActive ? colors.accent : colors.textMuted }]}>
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterRow}
        style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
      >
        {(['easy', 'medium', 'hard', 'legend'] as const).map((diff) => {
          const isActive = difficulties.includes(diff);
          const dc = DIFFICULTY_COLORS[diff];
          return (
            <Pressable
              key={diff}
              onPress={() =>
                setDifficulties((prev) => {
                  if (prev.includes(diff)) {
                    return prev.length === 1 ? prev : prev.filter((d) => d !== diff);
                  }
                  return [...prev, diff];
                })
              }
              style={[
                s.filterChip,
                isActive
                  ? { backgroundColor: dc + '22', borderColor: dc }
                  : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <Text style={[s.filterChipText, { color: isActive ? dc : colors.textMuted }]}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.stubBox}>
        <Text style={s.stubEmoji}>⚡</Text>
        <Text style={[s.stubTitle, { color: colors.text }]}>Challenges Coming Soon</Text>
        <Text style={[s.stubBody, { color: colors.textMuted }]}>
          Community challenges with prizes, Hall of Fame entries, and co-op team play are in development.
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  gateTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  gateBtn: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13 },
  gateBtnText: { fontSize: 15, fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabLabel: { fontSize: 14, fontWeight: '600' },

  balanceCard: { margin: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 20, gap: 4 },
  balanceLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  balanceValue: { fontSize: 44, fontWeight: '800', letterSpacing: -1, marginVertical: 4 },
  balanceBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  outlineBtn: { borderWidth: 1, borderRadius: 999, height: 44, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontSize: 13, fontWeight: '600' },
  primaryBtn: { borderRadius: 999, height: 44, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontSize: 13, fontWeight: '600' },

  tilesSection: { marginBottom: 8 },
  tilesSectionTitle: { fontSize: 16, fontWeight: '700', marginHorizontal: 16, marginBottom: 10 },
  tilesRow: { paddingHorizontal: 16, gap: 10 },
  infoTile: { width: 110, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 4, alignItems: 'center' },
  infoTileIcon: { fontSize: 26, marginBottom: 2 },
  infoTileTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  infoTileSub: { fontSize: 10, textAlign: 'center', lineHeight: 14 },

  txHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  txSectionTitle: { fontSize: 16, fontWeight: '700' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  txIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txIcon: { fontSize: 18 },
  txDesc: { fontSize: 13, fontWeight: '500' },
  txDate: { fontSize: 11 },
  txAmount: { fontSize: 14, fontWeight: '700', flexShrink: 0 },

  stateBox: { padding: 24, alignItems: 'center', gap: 8 },
  stateText: { fontSize: 13, textAlign: 'center' },
  retryText: { fontSize: 13, fontWeight: '600' },

  stubBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  stubEmoji: { fontSize: 48 },
  stubTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  stubBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
