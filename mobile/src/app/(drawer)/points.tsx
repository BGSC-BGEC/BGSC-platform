import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthLocked } from '@/components/AuthLocked';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { DifficultyChipRow } from '@/components/challenges/DifficultyChipRow';
import { DomainChipRow } from '@/components/challenges/DomainChipRow';
import { ActiveChallengeStrip } from '@/components/points/ActiveChallengeStrip';
import { BalanceCard } from '@/components/points/BalanceCard';
import { EarnTile } from '@/components/points/EarnTile';
import { FilterChipRow } from '@/components/points/FilterChipRow';
import { SpendTile } from '@/components/points/SpendTile';
import { TransactionRow } from '@/components/points/TransactionRow';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import type {
  ChallengeDifficulty,
  ChallengeDomain,
  PointTransaction,
  TransactionFilter,
} from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { useActiveChallenges, useChallenges } from '@/hooks/use-challenges';
import { usePointsBalance, usePointTransactions } from '@/hooks/use-points';

const EARN_TILES = [
  { icon: 'calendar-outline' as const, name: 'Event Participation', subtitle: 'Awarded on registration & completion' },
  { icon: 'flash-outline' as const, name: 'Challenge Completion', subtitle: 'Awarded when submission is approved' },
  { icon: 'people-outline' as const, name: 'Platform Engagement', subtitle: 'Posts, invites, newsletter opens' },
  { icon: 'trophy-outline' as const, name: 'Sponsor Bonus', subtitle: 'Bonus for winning as an affiliate' },
];

const SPEND_TILES = [
  { icon: 'bag-outline' as const, name: 'Store Redemption', subtitle: 'Redeem for merch & indie games' },
  { icon: 'stats-chart-outline' as const, name: 'Leaderboard Investment', subtitle: 'Invest points to boost your rank' },
];

const ALL_DIFFICULTIES: ChallengeDifficulty[] = ['easy', 'medium', 'hard', 'legend'];

/**
 * Points & Challenges (master §9 / points spec §1-5). Auth required — guests
 * get the locked state. Tab 0: balance card, earn/spend tiles, active
 * challenges strip, paginated transaction history. Tab 1: challenge browser
 * with domain/difficulty filters.
 *
 * TODO(Phase 2): FCM `POINTS_UPDATED` handler lives in root _layout (master
 * §12.4) — invalidates ['points','balance'] + ['points','transactions'] and
 * the BalanceCard pops on change.
 */
export default function PointsScreen() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);
  const [tab, setTab] = useState<'Points' | 'Challenges'>('Points');

  if (status === 'unknown' || status === 'loading') return <PointsSkeleton />;
  if (status !== 'authenticated') {
    return (
      <View style={[styles.canvas, { backgroundColor: colors.background }]}>
        <AuthLocked subject="your points & challenges" />
      </View>
    );
  }

  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      <View style={[styles.tabBar, { paddingHorizontal: 16 }]}>
        <SegmentedToggle
          options={['Points', 'Challenges']}
          value={tab}
          onChange={(v) => setTab(v as 'Points' | 'Challenges')}
          accessibilityLabel="Points and challenges tabs"
        />
      </View>
      {tab === 'Points' ? <PointsTab /> : <ChallengesTab />}
    </View>
  );
}

// ─── Tab 0 — Points Dashboard ─────────────────────────────────────────────────

function PointsTab() {
  const colors = useColors();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) ?? 'me';
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const listRef = useRef<FlatList<PointTransaction> | null>(null);
  const earnY = useRef(0);

  const balance = usePointsBalance(userId);
  const transactions = usePointTransactions(userId, filter);
  const active = useActiveChallenges(userId);

  // TODO(Phase 2): filter client-side until the backend transactions endpoint
  // accepts a filter param (points-service.md documents no transactions route).
  const items = useMemo(() => {
    const all = transactions.data?.pages.flat() ?? [];
    return filter === 'all' ? all : all.filter((t) => t.type === filter);
  }, [transactions.data, filter]);

  const onRefresh = () => {
    qc.invalidateQueries({ queryKey: ['points'] });
    qc.invalidateQueries({ queryKey: ['challenges', 'active'] });
  };

  const header = (
    <View style={styles.header}>
      {balance.isPending ? (
        <SkeletonBlock height={120} radius={16} />
      ) : (
        <BalanceCard
          balance={balance.data?.balance ?? 0}
          error={balance.isError ? 'Could not load balance' : null}
          onRetry={() => balance.refetch()}
          onEarnMore={() =>
            listRef.current?.scrollToOffset({ offset: earnY.current, animated: true })
          }
          onGoToStore={() => router.push('/(drawer)/store')}
        />
      )}

      <View onLayout={(e) => (earnY.current = e.nativeEvent.layout.y)}>
        <SectionHeading>How to Earn</SectionHeading>
        {balance.isPending ? (
          <TileRowSkeleton count={4} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
            {EARN_TILES.map((t) => (
              <EarnTile key={t.name} {...t} />
            ))}
          </ScrollView>
        )}
      </View>

      <SectionHeading>How to Spend</SectionHeading>
      {balance.isPending ? (
        <TileRowSkeleton count={2} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
          {SPEND_TILES.map((t) => (
            <SpendTile
              key={t.name}
              {...t}
              onPress={() =>
                router.push(t.name === 'Store Redemption' ? '/(drawer)/store' : '/(drawer)/leaderboards')
              }
            />
          ))}
        </ScrollView>
      )}

      <ActiveChallengeStrip challenges={active.data} loading={active.isPending} />

      <SectionHeading>Transaction History</SectionHeading>
      <FilterChipRow value={filter} onChange={setFilter} />
    </View>
  );

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <View style={styles.txItem}>
          <TransactionRow
            tx={item}
            onPress={() => onTransactionPress(item.source, item.referenceId)}
          />
        </View>
      )}
      ListHeaderComponent={header}
      ListFooterComponent={
        transactions.isFetchingNextPage ? <SkeletonBlock height={56} radius={16} style={styles.txItem} /> : null
      }
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={balance.isRefetching || transactions.isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.textMuted}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (transactions.hasNextPage) void transactions.fetchNextPage();
      }}
      ListEmptyComponent={<TransactionsEmpty filter={filter} loading={transactions.isPending} error={transactions.isError ? 'Could not load transactions' : null} onRetry={() => transactions.refetch()} onClearFilter={() => setFilter('all')} />}
    />
  );
}

/** Row tap → related entity (points spec §4.4). */
function onTransactionPress(source: string, referenceId?: string | null) {
  if (source === 'challenge' && referenceId) {
    router.push(`/challenge/${referenceId}`);
    return;
  }
  if (source === 'event' && referenceId) {
    router.push(`/event/${referenceId}`);
    return;
  }
  if (source === 'store') {
    router.push('/(drawer)/store');
    return;
  }
  if (source === 'leaderboard') {
    router.push('/(drawer)/leaderboards');
  }
}

// ─── Tab 1 — Challenge Browser ────────────────────────────────────────────────

function ChallengesTab() {
  const colors = useColors();
  const [domain, setDomain] = useState<ChallengeDomain | null>(null);
  const [difficulties, setDifficulties] = useState<ChallengeDifficulty[]>(ALL_DIFFICULTIES);

  const normalized = difficulties.length === ALL_DIFFICULTIES.length ? null : difficulties;
  const query = useChallenges({ domain, difficulties: normalized });
  const items = query.data?.pages.flat() ?? [];
  const filtered = domain !== null || normalized !== null;

  const filterBar = (
    <View style={[styles.filterBar, { backgroundColor: colors.background }]}>
      <DomainChipRow value={domain} onChange={setDomain} />
      <DifficultyChipRow value={difficulties} onChange={setDifficulties} />
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ChallengeCard challenge={item} />}
      ListHeaderComponent={filterBar}
      stickyHeaderIndices={[0]}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.textMuted} />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage) void query.fetchNextPage();
      }}
      ListEmptyComponent={
        query.isPending ? (
          <ChallengeSkeletons />
        ) : query.isError ? (
          <ErrorState
            message="Could not load challenges"
            onRetry={() => query.refetch()}
          />
        ) : filtered ? (
          <EmptyState
            emoji="🎯"
            title="No challenges match your filters"
            subtitle="Try a different domain or difficulty."
            actionLabel="Clear filters"
            onAction={() => {
              setDomain(null);
              setDifficulties(ALL_DIFFICULTIES);
            }}
          />
        ) : (
          <EmptyState
            emoji="🎮"
            title="No challenges available right now"
            subtitle="Check back soon."
          />
        )
      }
    />
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionHeading, { color: colors.text }]}>{children}</Text>;
}

function TileRowSkeleton({ count }: { count: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} width={112} height={132} radius={16} />
      ))}
    </ScrollView>
  );
}

function TransactionsEmpty({
  loading,
  error,
  filter,
  onRetry,
  onClearFilter,
}: {
  loading: boolean;
  error: string | null;
  filter: TransactionFilter;
  onRetry: () => void;
  onClearFilter: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.empty}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.txSkeleton}>
            <SkeletonBlock width={36} height={36} radius={18} />
            <View style={styles.txSkeletonCol}>
              <SkeletonBlock width="70%" height={14} radius={4} />
              <SkeletonBlock width="50%" height={12} radius={4} />
            </View>
            <SkeletonBlock width={48} height={14} radius={4} />
          </View>
        ))}
      </View>
    );
  }
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (filter === 'all') {
    return (
      <EmptyState
        emoji="💰"
        title="No transactions yet"
        subtitle="Earn points by joining events or completing challenges."
      />
    );
  }
  return (
    <EmptyState
      emoji="💰"
      title={`No ${filter === 'earn' ? 'Earned' : filter === 'spend' ? 'Spent' : 'Refunded'} transactions yet`}
      subtitle="Try another filter."
      actionLabel="Clear filter"
      onAction={onClearFilter}
    />
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        hitSlop={8}
        style={styles.retry}
      >
        <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={styles.retry}
        >
          <Text style={[styles.retryText, { color: colors.accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChallengeSkeletons() {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.cardSkeleton, { borderColor: colors.border }]}>
          <View style={styles.cardSkeletonPills}>
            <SkeletonBlock width={64} height={22} radius={20} />
            <SkeletonBlock width={56} height={22} radius={20} />
          </View>
          <SkeletonBlock width="80%" height={20} radius={4} />
          <SkeletonBlock width="65%" height={14} radius={4} />
          <SkeletonBlock width="100%" height={1} radius={0} />
          <SkeletonBlock width="90%" height={14} radius={4} />
        </View>
      ))}
    </View>
  );
}

/** Session-restore placeholder — skeletons only, never a spinner. */
function PointsSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.canvas, { backgroundColor: colors.background, padding: 16, gap: 12 }]}>
      <SkeletonBlock height={120} radius={16} />
      <SkeletonBlock width={180} height={20} radius={6} />
      <SkeletonBlock height={132} radius={16} />
      <SkeletonBlock width={180} height={20} radius={6} />
      <SkeletonBlock height={132} radius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  tabBar: {
    paddingVertical: 8,
  },
  header: {
    gap: 20,
  },
  sectionHeading: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  tileRow: {
    gap: 12,
    paddingRight: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  txItem: {
    marginBottom: 12,
  },
  filterBar: {
    gap: 8,
    paddingVertical: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  txSkeleton: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  txSkeletonCol: {
    flex: 1,
    gap: 6,
  },
  cardSkeleton: {
    gap: 8,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardSkeletonPills: {
    flexDirection: 'row',
    gap: 8,
  },
});
