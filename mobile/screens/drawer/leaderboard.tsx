import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Icon } from '../../src/icons/Icon';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { withAlpha } from '../../src/theme/colors';
import { Button } from '../../src/components/Button';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { AppHeader } from '../../src/components/AppHeader';
import { Podium, MyPositionPill, type RankedRow } from '../../src/components/LeaderboardParts';
import { Avatar } from '../../src/components/Avatar';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Spinner } from '../../src/feedback/Spinner';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { usePopup } from '../../src/popups/PopupProvider';
import { useAuth } from '../../store/auth';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { leaderboardRepository } from '../../src/repositories/LeaderboardRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { getErrorMessage } from '../../src/api/client';
import type { GlobalStanding, LeaderboardDomain, LeaderboardPeriod } from '../../src/api/types';
import { eventStatusPill, EVENT_TYPE_LABELS, formatDate, formatNumber } from '../../src/utils/format';

type Tab = 'global' | 'events' | 'challenges';

const PERIODS: Array<{ label: string; value: LeaderboardPeriod }> = [
  { label: 'All time', value: 'all' },
  { label: 'Semester', value: 'semester' },
  { label: 'This month', value: 'month' },
  { label: 'This week', value: 'week' },
];

const DOMAINS: Array<{ label: string; value: LeaderboardDomain }> = [
  { label: 'All', value: 'all' },
  { label: 'Sports', value: 'sports' },
  { label: 'Esports', value: 'esports' },
  { label: 'Fitness', value: 'fitness' },
  { label: 'Dev', value: 'dev' },
  { label: 'General', value: 'general' },
];

function toRow(s: GlobalStanding, myId?: string): RankedRow {
  return {
    key: s.user_id,
    rank: s.rank,
    name: s.display_name || s.username || 'Deleted member',
    subtitle: s.username ? `@${s.username}` : undefined,
    avatarUrl: s.avatar_url,
    score: s.points,
    isMe: s.user_id === myId,
  };
}

export default function Leaderboard() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const { user } = useAuth();
  const listRef = useRef<FlatList<RankedRow>>(null);

  const [tab, setTab] = useState<Tab>('global');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [domain, setDomain] = useState<LeaderboardDomain>('all');
  const [eventCursor, setEventCursor] = useState<string | null>(null);
  // Filter sheet edits a draft; the board only reloads on "Show results".
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState<LeaderboardPeriod>('all');
  const [draftDomain, setDraftDomain] = useState<LeaderboardDomain>('all');

  const [standings, setStandings] = useState<GlobalStanding[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<GlobalStanding | null | undefined>(null);
  const requestId = useRef(0);

  const source = tab === 'challenges' ? 'challenge' : 'all';
  const activeDomain = tab === 'challenges' ? 'all' : domain;

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', nextPage = 1) => {
      if (tab === 'events') return;
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const res = await leaderboardRepository.global({ period, domain: activeDomain, source, page: nextPage, limit: 50 });
        if (id !== requestId.current) return;
        setStandings((prev) => (mode === 'more' ? [...prev, ...res.standings] : res.standings));
        setPage(res.page);
        setTotalPages(res.total_pages);
        setTotal(res.total);
        setError(null);
        if (user) {
          const found = res.standings.find((s) => s.user_id === user.id);
          if (found) setMe(found);
          else if (mode !== 'more') {
            setMe(null);
            leaderboardRepository
              .findMyGlobalRank(user.id, { period, domain: activeDomain, source })
              .then((r) => id === requestId.current && setMe(r))
              .catch(() => id === requestId.current && setMe(null));
          }
        }
      } catch (err) {
        if (id !== requestId.current) return;
        setError(getErrorMessage(err));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [tab, period, activeDomain, source, user],
  );

  useFocusEffect(useCallback(() => {
    void load('initial');
  }, [load]));

  const rows = useMemo(() => standings.map((s) => toRow(s, user?.id)), [standings, user?.id]);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const myRow = useMemo(() => {
    const found = rows.find((r) => r.isMe);
    if (found) return found;
    if (me) return toRow(me, user?.id);
    return null;
  }, [rows, me, user?.id]);

  const scrollToMe = () => {
    const index = rest.findIndex((r) => r.isMe);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
    } else if (podium.some((r) => r.isMe)) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else if (me) {
      void popup.info(`You are #${me.rank}`, `You have ${formatNumber(me.points)} points. Keep scrolling to load more of the board.`);
    } else {
      void popup.info('Position not loaded', 'Keep scrolling to load more rankings. Earn points from events and challenges to climb the board.');
    }
  };

  const events = useAsyncResource(
    async () => {
      return eventsRepository.list({ status: ['ongoing', 'past'], sort: 'date_desc', limit: 50, cursor: eventCursor });
    },
    [eventCursor],
    { enabled: tab === 'events' },
  );

  const tabs = (
    <SegmentedTabs
      tabs={[
        { label: 'Global', value: 'global' },
        { label: 'Events', value: 'events' },
        { label: 'Challenges', value: 'challenges' },
      ]}
      value={tab}
      onChange={setTab}
    />
  );

  const contentStyle = [
    styles.content,
    {
      paddingHorizontal: Math.max(gutter, 16),
      paddingTop: 12,
      paddingBottom: Math.max(90, insets.bottom + 80),
    },
  ];

  if (tab === 'events') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Leaderboard" />
        <ScrollView
          contentContainerStyle={contentStyle}
          refreshControl={<RefreshControl refreshing={events.refreshing} onRefresh={() => void events.reload()} tintColor={colors.accent} />}
        >
          {tabs}
          <SectionHeader title="Event standings" subtitle="Live and completed events" style={styles.sectionHeaderRow} />
          {events.loading ? (
            <>
              <Skeleton.Card />
              <Skeleton.Card />
            </>
          ) : events.error ? (
            <ErrorState message={events.error} onRetry={() => void events.reload()} />
          ) : !events.data?.events.some(event => event.leaderboard) ? (
            <EmptyState icon="trophy" title="No event leaderboards yet" description="Standings appear once an event goes live." style={styles.empty} />
          ) : (
            <View>
              {events.data.events.filter(event => event.leaderboard).map((event, i, list) => {
                const pill = eventStatusPill(event);
                return (
                  <Pressable
                    key={event._id}
                    onPress={() => navigation.navigate('EventStandings', { ref: event.slug || event._id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.title} standings`}
                    style={({ pressed }) => [
                      styles.eventRow,
                      i < list.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.flex}>
                      <Typography color="text" style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Typography>
                      <Typography color="textMuted" style={styles.eventMeta} numberOfLines={1}>
                        {EVENT_TYPE_LABELS[event.type]} · {formatDate(event.start_at)} · {event.counts?.registrations_confirmed ?? 0} participants
                      </Typography>
                    </View>
                    {/* Status keeps its pill: it is the one thing to read at a glance */}
                    <Badge label={pill.label} variant={pill.variant} />
                    <Icon name="chevron-right" size={18} color="textMuted" />
                  </Pressable>
                );
              })}
            </View>
          )}
          {events.data?.next_cursor && <Button label="More events" variant="ghost" onPress={() => setEventCursor(events.data!.next_cursor)} />}
          {eventCursor && <Button label="Back to latest events" variant="ghost" onPress={() => setEventCursor(null)} />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const showDomain = tab === 'global';
  const activeFilters = (period !== 'all' ? 1 : 0) + (showDomain && domain !== 'all' ? 1 : 0);
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? 'All time';
  const domainLabel = domain === 'all' ? 'All domains' : DOMAINS.find((d) => d.value === domain)?.label ?? domain;
  const filterSummary = showDomain ? `${periodLabel} · ${domainLabel}` : periodLabel;

  const openFilters = () => {
    setDraftPeriod(period);
    setDraftDomain(domain);
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    setPeriod(draftPeriod);
    setDomain(draftDomain);
    setFiltersOpen(false);
  };
  const clearFilters = () => {
    setPeriod('all');
    setDomain('all');
  };

  const header = (
    <View style={styles.header}>
      {tabs}

      {/* One filter button instead of two rows of pills; the summary says what is applied. */}
      <View style={styles.filterRow}>
        <Typography variant="caption" color="textMuted" numberOfLines={1} style={styles.filterSummary}>
          {filterSummary}
        </Typography>
        <Pressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel={activeFilters ? `Filters, ${activeFilters} applied` : 'Filters'}
          hitSlop={8}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <Icon name="filter" size={15} color="primary" />
          <Typography variant="body" color="primary" style={styles.filterLabel}>
            {activeFilters ? `Filter · ${activeFilters}` : 'Filter'}
          </Typography>
        </Pressable>
      </View>

      {loading && standings.length === 0 ? (
        <>
          <Skeleton height={180} borderRadius={20} />
          <Skeleton.Card />
        </>
      ) : error && standings.length === 0 ? (
        <ErrorState title="Could not load the leaderboard" message={error} onRetry={() => void load('initial')} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="trophy"
          title="No rankings yet"
          description="Nobody has earned points in this period yet."
          actionLabel={activeFilters ? 'Clear filters' : undefined}
          onAction={activeFilters ? clearFilters : undefined}
          style={styles.empty}
        />
      ) : (
        <>
          {/* 3D Stepped Podium */}
          <Podium
            rows={podium}
            onPressRow={(row) => navigation.navigate('Profile', { ref: row.key })}
          />

          {/* Section Divider */}
          {rest.length > 0 ? (
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Rankings" subtitle={`${formatNumber(total)} members ranked`} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  // Leaderboard is a drawer screen with no tab bar, so the pill only clears the home indicator.
  const bottomPillOffset = Math.max(insets.bottom, 12) + 8;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Leaderboard" />

      <FlatList
        ref={listRef}
        data={loading && standings.length === 0 ? [] : rest}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <RankRow
            row={item}
            last={index === rest.length - 1}
            onPress={() => navigation.navigate('Profile', { ref: item.key })}
          />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={[contentStyle, { paddingBottom: bottomPillOffset + 60 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loadingMore && !loading && !refreshing && !error && page < totalPages) void load('more', page + 1);
        }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
        }}
        ListFooterComponent={loadingMore ? <Spinner style={styles.footer} /> : undefined}
      />

      {/* Floating Sticky "You" Pill at Bottom */}
      <MyPositionPill me={myRow} onPress={scrollToMe} bottomOffset={bottomPillOffset} />

      <BottomSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <View style={styles.sheetHeader}>
          <Typography variant="h3" color="text">Filter rankings</Typography>
          <Pressable
            onPress={() => {
              setDraftPeriod('all');
              setDraftDomain('all');
            }}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Typography variant="body" color="primary" style={styles.filterLabel}>Reset</Typography>
          </Pressable>
        </View>
        <View style={styles.sheetSection}>
          <Typography variant="caption" color="textMuted" style={styles.sheetLabel}>PERIOD</Typography>
          <FilterChips options={PERIODS} value={draftPeriod} onChange={setDraftPeriod} />
        </View>
        {showDomain ? (
          <View style={styles.sheetSection}>
            <Typography variant="caption" color="textMuted" style={styles.sheetLabel}>DOMAIN</Typography>
            <FilterChips options={DOMAINS} value={draftDomain} onChange={setDraftDomain} />
          </View>
        ) : null}
        <Button label="Show results" onPress={applyFilters} fullWidth />
      </BottomSheet>
    </SafeAreaView>
  );
}

/**
 * One standing: rank, avatar, name and handle, points on the right. Plain row with a hairline
 * under it (Spotify-chart style); your own row reads in the brand colour.
 */
function RankRow({ row, last, onPress }: { row: RankedRow; last: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const delta = row.delta ?? (row.rank != null && row.previousRank != null ? row.previousRank - row.rank : null);
  const ink = row.isMe ? colors.primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Rank ${row.rank ?? 'unranked'}, ${row.name}, ${row.score} pts`}
      style={({ pressed }) => [
        styles.rankRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Typography style={[styles.rankNum, { color: row.isMe ? colors.primary : colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
        {row.rank ?? '—'}
      </Typography>
      <Avatar name={row.name} uri={row.avatarUrl} size={38} ring={false} />
      <View style={styles.flex}>
        <Typography style={[styles.rankName, { color: ink }]} numberOfLines={1}>
          {row.name}
          {row.isMe ? ' · You' : ''}
        </Typography>
        <View style={styles.rankSubRow}>
          {row.subtitle ? (
            <Typography color="textMuted" style={styles.rankSub} numberOfLines={1}>
              {row.subtitle}
            </Typography>
          ) : null}
          {delta != null && delta !== 0 ? (
            <Typography style={[styles.rankSub, styles.delta, { color: delta > 0 ? colors.success : colors.dangerText }]}>
              {delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}
            </Typography>
          ) : null}
        </View>
      </View>
      <View style={styles.scoreCol}>
        <Typography style={[styles.score, { color: ink }]} numberOfLines={1}>
          {formatNumber(row.score)}
        </Typography>
        <Typography color="textMuted" style={styles.scoreUnit}>
          PTS
        </Typography>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 13, gap: 8, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: 8, marginBottom: 4 },
  sectionHeaderRow: {
    marginTop: 4,
    marginBottom: 2,
  },
  footer: { paddingVertical: 16 },
  // Empty states sit straight on the background, no card around them.
  empty: { paddingTop: 40, paddingBottom: 24 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterSummary: { flex: 1 },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34 },
  filterLabel: { fontFamily: FONT_FAMILIES.bodySemiBold, includeFontPadding: false },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  eventTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 16, lineHeight: 22 },
  eventMeta: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rankNum: { width: 30, textAlign: 'center', fontFamily: FONT_FAMILIES.hero, fontSize: 17, lineHeight: 22 },
  rankName: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 15, lineHeight: 20 },
  rankSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankSub: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  delta: { fontFamily: FONT_FAMILIES.bodySemiBold, flexShrink: 0 },
  scoreCol: { alignItems: 'flex-end' },
  score: { fontFamily: FONT_FAMILIES.hero, fontSize: 18, lineHeight: 22 },
  scoreUnit: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9, lineHeight: 11, letterSpacing: 0.8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetSection: { gap: 8 },
  sheetLabel: { fontFamily: FONT_FAMILIES.bodySemiBold, letterSpacing: 0.8 },
});
