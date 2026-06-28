import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { EventRepository } from '@/core/repositories/EventRepository';
import type {
  EventCategory,
  EventStatus,
  EventType,
  PlatformEvent,
  RegistrationStatus,
} from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const SCREEN_W = Dimensions.get('window').width;
const PAGE_SIZE = 20;

const CATEGORIES: { key: EventCategory; label: string; icon: string }[] = [
  { key: 'leagues', label: 'Leagues', icon: '🏆' },
  { key: 'bgec', label: 'BGEC', icon: '🎮' },
  { key: 'fitsoc', label: 'FitSoc', icon: '💪' },
  { key: 'general', label: 'General', icon: '🌟' },
];

const STATUS_FILTERS: EventStatus[] = ['upcoming', 'ongoing', 'past'];
const DEFAULT_FILTERS: EventStatus[] = ['upcoming', 'ongoing'];

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  LE: 'Leaderboard Event',
  DE: 'Direct Event',
  ALL: 'Auction League',
  DLL: 'Direct League',
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  leagues: 'Leagues',
  bgec: 'BGEC',
  fitsoc: 'FitSoc',
  general: 'General',
};

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  leagues: '🏆',
  bgec: '🎮',
  fitsoc: '💪',
  general: '🌟',
};

const REG_STATUS_LABEL: Record<RegistrationStatus, string> = {
  open: 'Registration open',
  closed: 'Registration closed',
  full: 'Full',
  registered: 'Registered ✓',
  results_out: 'Results out',
};

function formatDateRange(start: string, end: string, status: EventStatus): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (status === 'ongoing') return `Live now · Ends ${fmt(endDate)}`;
  if (status === 'past') return `Ended ${fmt(endDate)}`;

  const diffDays = Math.ceil((startDate.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Starts today';
  if (diffDays === 1) return 'Starts tomorrow';
  if (diffDays < 7) return `Starts in ${diffDays} days`;
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

function EventCard({ event }: { event: PlatformEvent }) {
  const colors = useColors();
  const [imgError, setImgError] = useState(false);
  const isLeague = event.type === 'ALL' || event.type === 'DLL';

  const statusColor =
    event.status === 'upcoming' ? colors.info
    : event.status === 'ongoing' ? colors.success
    : colors.textMuted;

  const regStatusColor =
    event.registrationStatus === 'registered' ? colors.accent
    : event.registrationStatus === 'open' ? colors.success
    : event.registrationStatus === 'full' || event.registrationStatus === 'closed' ? colors.danger
    : colors.info;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => router.push(`/event/${event.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${event.status}`}>

      {/* Cover thumbnail */}
      <View style={[styles.cardCover, { backgroundColor: colors.surfaceMuted }]}>
        {event.coverImageUrl && !imgError ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Text style={styles.coverEmoji}>{CATEGORY_EMOJI[event.category]}</Text>
        )}
        <View style={[styles.coverBadge, { backgroundColor: statusColor }]}>
          <Text style={[styles.coverBadgeText, { color: colors.primaryText }]}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Type pill + Category pill */}
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.pillText, { color: colors.textMuted }]}>
              {EVENT_TYPE_LABEL[event.type]}
            </Text>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.pillText, { color: colors.textMuted }]}>
              {CATEGORY_LABEL[event.category]}
            </Text>
          </View>
        </View>

        {/* Schedule + Venue */}
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          📅 {formatDateRange(event.startDate, event.endDate, event.status)}
        </Text>
        {event.venue ? (
          <Text style={[styles.meta, { color: colors.textMuted }]}>📍 {event.venue}</Text>
        ) : null}

        {/* Footer: sponsor leader chip + registration status */}
        {(event.registrationStatus || (event.status === 'ongoing' && event.sponsorLeader)) ? (
          <View style={styles.cardFooter}>
            {event.status === 'ongoing' && event.sponsorLeader ? (
              <View style={[styles.sponsorChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.sponsorChipText, { color: colors.textMuted }]}>
                  🏆 {event.sponsorLeader.sponsorName} leading
                </Text>
              </View>
            ) : <View />}
            {event.registrationStatus ? (
              <Text style={[styles.regStatusText, { color: regStatusColor }]}>
                {REG_STATUS_LABEL[event.registrationStatus]}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* League drill-in affordances — only show once event is live (bracket exists) */}
        {isLeague && event.status === 'ongoing' && (
          <View style={styles.leagueActions}>
            <Pressable
              hitSlop={8}
              onPress={() => router.push(`/event/bracket/${event.id}`)}>
              <Text style={[styles.leagueLink, { color: colors.accent }]}>View Bracket →</Text>
            </Pressable>
            {event.type === 'ALL' && (
              <Pressable
                hitSlop={8}
                onPress={() => router.push(`/event/auction/${event.id}`)}>
                <Text style={[styles.leagueLink, { color: colors.accent }]}>Auction →</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function EventCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardCover, { backgroundColor: colors.surfaceMuted }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHead}>
          <SkeletonBox width="58%" height={18} borderRadius={6} />
          <SkeletonBox width={72} height={22} borderRadius={999} />
        </View>
        <SkeletonBox width="38%" height={14} borderRadius={999} style={{ marginTop: 8 }} />
        <SkeletonBox width="72%" height={13} borderRadius={6} style={{ marginTop: 8 }} />
        <SkeletonBox width="52%" height={13} borderRadius={6} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const colors = useColors();
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [catFilters, setCatFilters] = useState<Record<EventCategory, EventStatus[]>>({
    leagues: [...DEFAULT_FILTERS],
    bgec: [...DEFAULT_FILTERS],
    fitsoc: [...DEFAULT_FILTERS],
    general: [...DEFAULT_FILTERS],
  });

  const catIdxRef = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['events'],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      EventRepository.list({ page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
    initialPageParam: 1,
  });

  const allEvents = data?.pages.flat() ?? [];

  const switchCategory = useCallback(
    (idx: number) => {
      const direction = idx > catIdxRef.current ? 1 : -1;
      catIdxRef.current = idx;
      slideAnim.setValue(direction * SCREEN_W);
      setActiveCatIdx(idx);
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    },
    [slideAnim],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dx, dy }) =>
          Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2,
        onPanResponderRelease: (_, { dx, vx }) => {
          const idx = catIdxRef.current;
          if ((dx < -60 || vx < -0.8) && idx < CATEGORIES.length - 1) switchCategory(idx + 1);
          else if ((dx > 60 || vx > 0.8) && idx > 0) switchCategory(idx - 1);
        },
      }),
    [switchCategory],
  );

  const activeCat = CATEGORIES[activeCatIdx];
  const activeFilters = catFilters[activeCat.key];

  const toggleFilter = useCallback(
    (status: EventStatus) => {
      setCatFilters((prev) => {
        const current = prev[activeCat.key];
        if (current.includes(status)) {
          if (current.length === 1) return prev;
          return { ...prev, [activeCat.key]: current.filter((s) => s !== status) };
        }
        return { ...prev, [activeCat.key]: [...current, status] };
      });
    },
    [activeCat.key],
  );

  const filteredEvents = useMemo(
    () => allEvents.filter((e) => e.category === activeCat.key && activeFilters.includes(e.status)),
    [allEvents, activeCat.key, activeFilters],
  );

  const statusColor = (s: EventStatus) =>
    s === 'upcoming' ? colors.info : s === 'ongoing' ? colors.success : colors.textMuted;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Category Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBarOuter, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}>
        {CATEGORIES.map((cat, i) => {
          const isActive = i === activeCatIdx;
          return (
            <Pressable
              key={cat.key}
              style={styles.tabItem}
              onPress={() => switchCategory(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <Text style={[styles.tabIcon, { color: isActive ? colors.accent : colors.textMuted }]}>
                {cat.icon}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.accent : colors.textMuted },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}>
                {cat.label}
              </Text>
              {isActive && (
                <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Status Filter Chips ── */}
      <View
        style={[
          styles.filterRow,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}>
        {STATUS_FILTERS.map((status) => {
          const isActive = activeFilters.includes(status);
          const sc = statusColor(status);
          return (
            <Pressable
              key={status}
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: sc + '22', borderColor: sc }
                  : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
              onPress={() => toggleFilter(status)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isActive }}>
              <Text
                style={[
                  styles.chipText,
                  { color: isActive ? sc : colors.textMuted },
                  isActive && { fontWeight: '600' },
                ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Content with swipe gesture ── */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX: slideAnim }] }]}
        {...panResponder.panHandlers}>
        {isPending ? (
          <View style={styles.list}>
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              Failed to load events
            </Text>
            <Pressable
              style={[styles.retryBtn, { borderColor: colors.border }]}
              onPress={() => refetch()}>
              <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredEvents.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>
              {`No ${activeFilters.join(' or ')} events in ${activeCat.label} yet`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching && !isFetchingNextPage}
                onRefresh={() => refetch()}
                tintColor={colors.accent}
              />
            }
            onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={styles.loadMoreSpinner}
                />
              ) : null
            }
            renderItem={({ item }) => <EventCard event={item} />}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabBarOuter: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabBarContent: { flexGrow: 1 },
  tabItem: {
    minWidth: SCREEN_W / CATEGORIES.length,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
    position: 'relative',
  },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  tabLabelActive: { fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
  },

  // ── Filter chips ──────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '500' },

  // ── List ──────────────────────────────────────────────────────────────────
  content: { flex: 1 },
  list: { padding: 16, gap: 12 },
  loadMoreSpinner: { paddingVertical: 16 },

  // ── Event card ────────────────────────────────────────────────────────────
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardCover: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  coverEmoji: { fontSize: 48 },
  coverBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  coverBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardContent: { padding: 14, gap: 8 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '500' },
  meta: { fontSize: 13 },

  // ── Card footer ───────────────────────────────────────────────────────────
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sponsorChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  sponsorChipText: { fontSize: 11, fontWeight: '500' },
  regStatusText: { fontSize: 12, fontWeight: '600' },

  // ── League affordances ────────────────────────────────────────────────────
  leagueActions: { flexDirection: 'row', gap: 16 },
  leagueLink: { fontSize: 13, fontWeight: '600' },

  // ── Empty / Error ─────────────────────────────────────────────────────────
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyIcon: { fontSize: 40 },
  stateText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: '600' },
});
