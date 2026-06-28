import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type {
  ChallengeHistoryItem,
  EventHistoryItem,
  MatchHistoryItem,
  SponsorContributionItem,
} from '@/core/types';
import { useColors } from '@/hooks/use-colors';

type HistoryTab = 'events' | 'matches' | 'challenges' | 'sponsor';

const TABS: { key: HistoryTab; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'matches', label: 'Matches' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'sponsor', label: 'Sponsor' },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function HistorySection() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<HistoryTab>('events');

  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: colors.text }]}>📜 History</Text>

      {/* Tabs */}
      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setActiveTab(t.key)}
            style={[s.tab, activeTab === t.key && [s.tabActive, { borderBottomColor: colors.accent }]]}
          >
            <Text
              style={[
                s.tabLabel,
                { color: activeTab === t.key ? colors.accent : colors.textMuted },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'events' && <EventHistoryList colors={colors} />}
      {activeTab === 'matches' && <MatchHistoryList colors={colors} />}
      {activeTab === 'challenges' && <ChallengeHistoryList colors={colors} />}
      {activeTab === 'sponsor' && <SponsorHistoryList colors={colors} />}
    </View>
  );
}

// ─── Events ──────────────────────────────────────────────────────────────────

function EventHistoryList({ colors }: { colors: ReturnType<typeof useColors> }) {
  const status = useAuthStore((s) => s.status);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useInfiniteQuery({
      queryKey: ['history', 'events'],
      queryFn: ({ pageParam }) => UserRepository.getEventHistory(pageParam),
      initialPageParam: 1,
      getNextPageParam: (last, all) => (last.length < 20 ? undefined : all.length + 1),
      enabled: status === 'authenticated',
    });

  const items = data?.pages.flat() ?? [];

  if (isLoading) return <HistorySkeleton colors={colors} />;
  if (error) return <RetryState onRetry={refetch} colors={colors} />;
  if (items.length === 0) return <EmptyState text="No events participated yet" colors={colors} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      scrollEnabled={false}
      renderItem={({ item }) => <EventHistoryCard item={item} colors={colors} />}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} /> : null}
    />
  );
}

function EventHistoryCard({ item, colors }: { item: EventHistoryItem; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      style={[s.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/event/${item.eventId}`)}
    >
      <View style={[s.historyCardCover, { backgroundColor: colors.surfaceMuted }]} />
      <View style={s.historyCardBody}>
        <Text style={[s.historyCardTitle, { color: colors.text }]}>{item.eventTitle}</Text>
        <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>{fmtDate(item.date)}</Text>
        {item.teamName && (
          <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>
            {item.role === 'captain' ? 'Captain' : 'Member'} · {item.teamName}
          </Text>
        )}
        <View style={s.historyCardFooter}>
          {item.result && (
            <Text style={[s.historyResult, { color: colors.text }]}>{item.result}</Text>
          )}
          {item.pointsEarned != null && (
            <Text style={[s.historyPoints, { color: colors.success }]}>+{item.pointsEarned} pts</Text>
          )}
          {item.fansEarned != null && item.sponsorName && (
            <Text style={[s.historySponsor, { color: colors.accent }]}>
              +{item.fansEarned} fans for {item.sponsorName}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Matches ─────────────────────────────────────────────────────────────────

function MatchHistoryList({ colors }: { colors: ReturnType<typeof useColors> }) {
  const status = useAuthStore((s) => s.status);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useInfiniteQuery({
      queryKey: ['history', 'matches'],
      queryFn: ({ pageParam }) => UserRepository.getMatchHistory(pageParam),
      initialPageParam: 1,
      getNextPageParam: (last, all) => (last.length < 20 ? undefined : all.length + 1),
      enabled: status === 'authenticated',
    });

  const items = data?.pages.flat() ?? [];

  if (isLoading) return <HistorySkeleton colors={colors} />;
  if (error) return <RetryState onRetry={refetch} colors={colors} />;
  if (items.length === 0) return <EmptyState text="No match records yet" colors={colors} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      scrollEnabled={false}
      renderItem={({ item }) => <MatchHistoryCard item={item} colors={colors} />}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} /> : null}
    />
  );
}

function MatchHistoryCard({ item, colors }: { item: MatchHistoryItem; colors: ReturnType<typeof useColors> }) {
  const resultColor = item.result === 'win' ? colors.success : item.result === 'loss' ? colors.danger : '#f59e0b';
  const resultLabel = item.result === 'win' ? '✅ Win' : item.result === 'loss' ? '❌ Loss' : '🤝 Draw';

  return (
    <Pressable
      style={[s.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/event/bracket/${item.matchId}`)}
    >
      <View style={s.historyCardBody}>
        <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>{item.leagueName} — {item.round}</Text>
        <Text style={[s.matchScore, { color: colors.text }]}>
          {item.teamAName}  {item.scoreA} : {item.scoreB}  {item.teamBName}
        </Text>
        <View style={s.historyCardFooter}>
          <Text style={[s.historyResult, { color: resultColor }]}>{resultLabel}</Text>
          <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>{fmtDate(item.date)}</Text>
          {item.venue && <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>{item.venue}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Challenges ──────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#3b82f6',
  hard: '#e8662a',
  legend: '#8b5cf6',
};

function ChallengeHistoryList({ colors }: { colors: ReturnType<typeof useColors> }) {
  const status = useAuthStore((s) => s.status);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useInfiniteQuery({
      queryKey: ['history', 'challenges'],
      queryFn: ({ pageParam }) => UserRepository.getChallengeHistory(pageParam),
      initialPageParam: 1,
      getNextPageParam: (last, all) => (last.length < 20 ? undefined : all.length + 1),
      enabled: status === 'authenticated',
    });

  const items = data?.pages.flat() ?? [];

  if (isLoading) return <HistorySkeleton colors={colors} />;
  if (error) return <RetryState onRetry={refetch} colors={colors} />;
  if (items.length === 0) return <EmptyState text="No challenges completed yet" colors={colors} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      scrollEnabled={false}
      renderItem={({ item }) => <ChallengeCard item={item} colors={colors} />}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} /> : null}
    />
  );
}

function ChallengeCard({ item, colors }: { item: ChallengeHistoryItem; colors: ReturnType<typeof useColors> }) {
  const diffColor = DIFFICULTY_COLORS[item.difficulty] ?? colors.textMuted;
  return (
    <View style={[s.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.historyCardBody}>
        <Text style={[s.historyCardTitle, { color: colors.text }]}>🏆 {item.title}</Text>
        <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>
          {item.domain} · <Text style={{ color: diffColor }}>{item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}</Text>
        </Text>
        <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>Completed: {fmtDate(item.completedAt)}</Text>
        <Text style={[s.historyPoints, { color: colors.success }]}>+{item.pointsAwarded} pts awarded</Text>
      </View>
    </View>
  );
}

// ─── Sponsor Timeline ────────────────────────────────────────────────────────

function SponsorHistoryList({ colors }: { colors: ReturnType<typeof useColors> }) {
  const status = useAuthStore((s) => s.status);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error, refetch } =
    useInfiniteQuery({
      queryKey: ['history', 'sponsor'],
      queryFn: ({ pageParam }) => UserRepository.getSponsorHistory(pageParam),
      initialPageParam: 1,
      getNextPageParam: (last, all) => (last.length < 20 ? undefined : all.length + 1),
      enabled: status === 'authenticated',
    });

  const items = data?.pages.flat() ?? [];

  if (isLoading) return <HistorySkeleton colors={colors} />;
  if (error) return <RetryState onRetry={refetch} colors={colors} />;
  if (items.length === 0) return <EmptyState text="No sponsor contributions yet" colors={colors} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      scrollEnabled={false}
      renderItem={({ item, index }) => (
        <SponsorContribCard item={item} colors={colors} isLast={index === items.length - 1} />
      )}
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ margin: 16 }} /> : null}
    />
  );
}

function SponsorContribCard({
  item,
  colors,
  isLast,
}: {
  item: SponsorContributionItem;
  colors: ReturnType<typeof useColors>;
  isLast: boolean;
}) {
  return (
    <View style={s.timelineRow}>
      <View style={s.timelineLeft}>
        <View style={[s.timelineDot, { backgroundColor: colors.accent }]} />
        {!isLast && <View style={[s.timelineLine, { backgroundColor: colors.border }]} />}
      </View>
      <View style={[s.historyCard, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
        <View style={s.historyCardBody}>
          <Text style={[s.historyCardTitle, { color: colors.text }]}>● {item.eventTitle}</Text>
          <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>{fmtDate(item.date)}</Text>
          <Text style={[s.historyPoints, { color: colors.accent }]}>
            Fans contributed: +{item.fansContributed}
          </Text>
          <View style={[s.timelineDivider, { backgroundColor: colors.border }]} />
          <Text style={[s.historyCardMeta, { color: colors.textMuted }]}>
            Running total: {fmt(item.runningTotal)} fans
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Shared state components ─────────────────────────────────────────────────

function HistorySkeleton({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 10, padding: 16 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[s.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ padding: 14, gap: 8 }}>
            <SkeletonBox width="70%" height={14} />
            <SkeletonBox width="50%" height={12} />
            <SkeletonBox width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyState({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={s.stateBox}>
      <Text style={[s.stateText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

function RetryState({ onRetry, colors }: { onRetry: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={s.stateBox}>
      <Text style={[s.stateText, { color: colors.textMuted }]}>Something went wrong</Text>
      <Pressable onPress={onRetry}>
        <Text style={[s.retryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },

  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabLabel: { fontSize: 13, fontWeight: '600' },

  historyCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginBottom: 10, overflow: 'hidden', flexDirection: 'row' },
  historyCardCover: { width: 56, height: '100%', minHeight: 80 },
  historyCardBody: { flex: 1, padding: 12, gap: 4 },
  historyCardTitle: { fontSize: 14, fontWeight: '600' },
  historyCardMeta: { fontSize: 12 },
  historyCardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  historyResult: { fontSize: 12, fontWeight: '600' },
  historyPoints: { fontSize: 12, fontWeight: '600' },
  historySponsor: { fontSize: 12 },
  matchScore: { fontSize: 15, fontWeight: '700', marginVertical: 4 },

  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  timelineLeft: { width: 20, alignItems: 'center', paddingTop: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { flex: 1, width: 2, marginTop: 4 },
  timelineDivider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },

  stateBox: { padding: 16, gap: 6 },
  stateText: { fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: '600' },
});
