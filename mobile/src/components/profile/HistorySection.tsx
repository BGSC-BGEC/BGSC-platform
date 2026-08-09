import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { DIFFICULTY_COLORS, DOMAIN_COLORS } from '@/core/theme/tokens';
import type {
  ChallengeHistoryItem,
  EventHistoryItem,
  MatchHistoryItem,
  SponsorContributionItem,
} from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import {
  useChallengeHistory,
  useEventHistory,
  useMatchHistory,
  useSponsorHistory,
} from '@/hooks/use-profile';
import { formatEventDate, formatFullDate } from '@/lib/dates';
import { formatCompact } from '@/components/profile/PlayerCard';

type HistoryTab = 'Events' | 'Matches' | 'Challenges' | 'Sponsor';
const TABS: HistoryTab[] = ['Events', 'Matches', 'Challenges', 'Sponsor'];

const EMPTY_MESSAGES: Record<HistoryTab, string> = {
  Events: 'No events participated yet',
  Matches: 'No match records yet',
  Challenges: 'No challenges completed yet',
  Sponsor: 'No sponsor contributions yet',
};

/**
 * History section (profile spec §7): four sticky tabs with per-tab skeleton,
 * empty and error states, pull-to-refresh via the page, and a "Load older"
 * button for the paginated events tab (spec §7.1 layout).
 *
 * Match/Challenge/Sponsor tabs are Phase 2/3 backend stubs — the repository
 * resolves [] so these render their empty states until the services ship.
 * TODO(Phase 2): swap "Load older" for true infinite scroll once the page
 * list is virtualized.
 */
export function HistorySection() {
  const colors = useColors();
  const [tab, setTab] = useState<HistoryTab>('Events');
  const [opacity] = useState(() => new Animated.Value(1));

  const eventHistory = useEventHistory();
  const matchHistory = useMatchHistory(tab === 'Matches');
  const challengeHistory = useChallengeHistory(tab === 'Challenges');
  const sponsorHistory = useSponsorHistory(tab === 'Sponsor');

  const changeTab = (next: HistoryTab) => {
    if (next === tab) return;
    setTab(next);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  };

  const events = eventHistory.data?.pages.flat() ?? [];

  return (
    <View style={styles.root}>
      <Text style={[styles.heading, { color: colors.text }]}>History</Text>
      <SegmentedToggle
        options={TABS}
        value={tab}
        onChange={(v) => changeTab(v as HistoryTab)}
        accessibilityLabel="History tabs"
      />

      <Animated.View style={{ opacity }}>
        {tab === 'Events' && (
          <EventTab
            items={events}
            loading={eventHistory.isPending}
            error={eventHistory.isError}
            hasNextPage={eventHistory.hasNextPage}
            isFetchingNextPage={eventHistory.isFetchingNextPage}
            onRetry={() => void eventHistory.refetch()}
            onLoadOlder={() => void eventHistory.fetchNextPage()}
          />
        )}
        {tab === 'Matches' && (
          <HistoryList
            items={matchHistory.data ?? []}
            loading={matchHistory.isPending}
            error={matchHistory.isError}
            onRetry={() => void matchHistory.refetch()}
            renderItem={(item) => <MatchCard item={item} />}
            emptyMessage={EMPTY_MESSAGES.Matches}
          />
        )}
        {tab === 'Challenges' && (
          <HistoryList
            items={challengeHistory.data ?? []}
            loading={challengeHistory.isPending}
            error={challengeHistory.isError}
            onRetry={() => void challengeHistory.refetch()}
            renderItem={(item) => <ChallengeCard item={item} />}
            emptyMessage={EMPTY_MESSAGES.Challenges}
          />
        )}
        {tab === 'Sponsor' && (
          <HistoryList
            items={sponsorHistory.data ?? []}
            loading={sponsorHistory.isPending}
            error={sponsorHistory.isError}
            onRetry={() => void sponsorHistory.refetch()}
            renderItem={(item) => <SponsorCard item={item} />}
            emptyMessage={EMPTY_MESSAGES.Sponsor}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Events tab (paginated) ───────────────────────────────────────────────────

function EventTab({
  items,
  loading,
  error,
  hasNextPage,
  isFetchingNextPage,
  onRetry,
  onLoadOlder,
}: {
  items: EventHistoryItem[];
  loading: boolean;
  error: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onRetry: () => void;
  onLoadOlder: () => void;
}) {
  const colors = useColors();

  if (loading && items.length === 0) return <HistorySkeletons />;
  if (error && items.length === 0) return <SectionError onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState message={EMPTY_MESSAGES.Events} />;

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <EventCard key={item.id} item={item} />
      ))}
      {hasNextPage ? (
        <Pressable
          onPress={onLoadOlder}
          disabled={isFetchingNextPage}
          accessibilityRole="button"
          accessibilityLabel="Load older events"
          style={({ pressed }) => [
            styles.loadOlder,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.loadOlderText, { color: colors.text }]}>
            {isFetchingNextPage ? 'Loading…' : 'Load older'}
          </Text>
        </Pressable>
      ) : (
        <Text style={[styles.endOfList, { color: colors.textMuted }]}>You're all caught up</Text>
      )}
    </View>
  );
}

function EventCard({ item }: { item: EventHistoryItem }) {
  const colors = useColors();
  const metaBits = [
    item.role !== 'solo' ? `Role: ${item.role}` : null,
    item.teamName ? `Team: ${item.teamName}` : null,
  ].filter(Boolean);

  return (
    <GlassCard
      onPress={() => router.push(`/event/${item.eventId}`)}
      accessibilityLabel={`Open event ${item.eventTitle}`}
      style={styles.itemCard}
    >
      <View style={styles.eventRow}>
        {item.eventCoverUrl ? (
          <Image source={{ uri: item.eventCoverUrl }} style={styles.eventCover} contentFit="cover" />
        ) : (
          <View style={[styles.eventCover, styles.eventCoverFallback, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.eventCol}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.eventTitle}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
            {formatEventDate(item.date)}
          </Text>
          {metaBits.length > 0 ? (
            <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {metaBits.join(' · ')}
            </Text>
          ) : null}
          {item.result ? (
            <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {item.result}
              {item.pointsEarned ? ` · +${item.pointsEarned} pts` : ''}
            </Text>
          ) : null}
          {item.fansEarned ? (
            <Text style={[styles.cardMeta, { color: colors.accent }]} numberOfLines={1}>
              +{item.fansEarned} fans{item.sponsorName ? ` for ${item.sponsorName}` : ''}
            </Text>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}

// ─── Matches tab ──────────────────────────────────────────────────────────────

function MatchCard({ item }: { item: MatchHistoryItem }) {
  const colors = useColors();
  const resultColor =
    item.result === 'win' ? colors.success : item.result === 'loss' ? colors.danger : DIFFICULTY_COLORS.medium;
  const resultLabel = item.result === 'win' ? 'Win' : item.result === 'loss' ? 'Loss' : 'Draw';

  return (
    <GlassCard
      onPress={() => router.push(`/event/bracket/${item.matchId}`)}
      accessibilityLabel={`Open match ${item.teamAName} versus ${item.teamBName}`}
      style={styles.itemCard}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {item.leagueName} — {item.round}
      </Text>
      <Text style={[styles.matchScore, { color: colors.text }]}>
        {item.teamAName}  {item.scoreA} : {item.scoreB}  {item.teamBName}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
        {formatEventDate(item.date)}
        {item.venue ? ` · ${item.venue}` : ''}
      </Text>
      <View style={[styles.resultPill, { backgroundColor: resultColor }]}>
        <Text style={[styles.resultPillText, { color: colors.accentText }]}>{resultLabel}</Text>
      </View>
    </GlassCard>
  );
}

// ─── Challenges tab ───────────────────────────────────────────────────────────

function ChallengeCard({ item }: { item: ChallengeHistoryItem }) {
  const colors = useColors();
  const domainColor = DOMAIN_COLORS[item.domain] ?? colors.textMuted;

  return (
    <GlassCard
      onPress={() => router.push(`/challenge/${item.challengeId}`)}
      accessibilityLabel={`Open challenge ${item.title}`}
      style={styles.itemCard}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
        Domain: <Text style={{ color: domainColor }}>{item.domain}</Text> · Difficulty:{' '}
        <Text style={{ color: DIFFICULTY_COLORS[item.difficulty] }}>{item.difficulty}</Text>
      </Text>
      <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
        Completed: {formatFullDate(item.completedAt)}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.accent }]}>+{item.pointsAwarded} pts awarded</Text>
    </GlassCard>
  );
}

// ─── Sponsor tab ──────────────────────────────────────────────────────────────

function SponsorCard({ item }: { item: SponsorContributionItem }) {
  const colors = useColors();
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, { backgroundColor: colors.accent }]} />
      </View>
      <GlassCard style={[styles.itemCard, styles.timelineCard]}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.eventTitle}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{formatEventDate(item.date)}</Text>
        <Text style={[styles.cardMeta, { color: colors.accent }]}>
          Fans contributed: +{item.fansContributed}
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
          Running total: {formatCompact(item.runningTotal)} fans
        </Text>
      </GlassCard>
    </View>
  );
}

// ─── Shared list + states ─────────────────────────────────────────────────────

function HistoryList<T>({
  items,
  loading,
  error,
  onRetry,
  renderItem,
  emptyMessage,
}: {
  items: T[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  renderItem: (item: T) => ReactElement;
  emptyMessage: string;
}) {
  if (loading && items.length === 0) return <HistorySkeletons />;
  if (error && items.length === 0) return <SectionError onRetry={onRetry} />;
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return <View style={styles.list}>{items.map((item, i) => <View key={i}>{renderItem(item)}</View>)}</View>;
}

function HistorySkeletons() {
  return (
    <View style={styles.list}>
      {[1, 2, 3].map((i) => (
        <GlassCard key={i} accessibilityLabel="Loading history" style={styles.itemCard}>
          <SkeletonBlock width="80%" height={16} radius={4} />
          <SkeletonBlock width="55%" height={13} radius={4} />
          <SkeletonBlock width="65%" height={13} radius={4} />
        </GlassCard>
      ))}
    </View>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.state}>
      <Text style={[styles.stateText, { color: colors.textMuted }]}>Could not load this section</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading history"
        hitSlop={8}
        style={styles.stateRetry}
      >
        <Text style={[styles.stateRetryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={styles.state}>
      <Text style={[styles.stateText, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  list: {
    gap: 10,
  },
  itemCard: {
    padding: 12,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  eventCover: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  eventCoverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCol: {
    flex: 1,
    gap: 1,
  },
  cardTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
  },
  cardMeta: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  matchScore: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  resultPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginTop: 6,
  },
  resultPillText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 4,
  },
  timelineRail: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 18,
  },
  timelineCard: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  loadOlder: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadOlderText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  endOfList: {
    fontFamily: FONTS.body,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  state: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  stateText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  stateRetry: {
    minHeight: 44,
    justifyContent: 'center',
  },
  stateRetryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});
