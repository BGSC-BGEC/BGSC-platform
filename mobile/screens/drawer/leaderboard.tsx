import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { AppHeader } from '../../src/components/AppHeader';
import { Podium, StandingRow, type RankedRow } from '../../src/components/LeaderboardParts';
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
  const { gutter, isCompactPhone } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const { user } = useAuth();
  const listRef = useRef<FlatList<RankedRow>>(null);

  const [tab, setTab] = useState<Tab>('global');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [domain, setDomain] = useState<LeaderboardDomain>('all');
  const [eventCursor, setEventCursor] = useState<string | null>(null);

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
      paddingHorizontal: gutter,
      paddingTop: gutter,
      paddingBottom: Math.max(32, insets.bottom + 24),
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
          <Typography variant="body" color="textMuted">Standings for live and completed events.</Typography>
          {events.loading ? (
            <>
              <Skeleton.Card />
              <Skeleton.Card />
            </>
          ) : events.error ? (
            <ErrorState message={events.error} onRetry={() => void events.reload()} />
          ) : !events.data?.events.some(event => event.leaderboard) ? (
            <Card variant="inner">
              <EmptyState icon="trophy" title="No event leaderboards yet" description="Standings appear once an event goes live." />
            </Card>
          ) : (
            events.data.events.filter(event => event.leaderboard).map((event) => {
              const pill = eventStatusPill(event);
              return (
                <Card
                  key={event._id}
                  variant="solid"
                  onPress={() => navigation.navigate('EventStandings', { ref: event.slug || event._id })}
                  accessibilityLabel={`${event.title} standings`}
                >
                  <Card.Header
                    title={event.title}
                    subtitle={`${EVENT_TYPE_LABELS[event.type]} · ${formatDate(event.start_at)}`}
                    rightAction={<Badge label={pill.label} variant={pill.variant} />}
                  />
                  <Card.Footer>
                    <Typography variant="caption" color="textMuted">
                      {event.counts?.registrations_confirmed ?? 0} participants
                    </Typography>
                    <Button label="View standings" size="sm" variant="outline" onPress={() => navigation.navigate('EventStandings', { ref: event.slug || event._id })} />
                  </Card.Footer>
                </Card>
              );
            })
          )}
          {events.data?.next_cursor && <Button label="More events" variant="outline" onPress={() => setEventCursor(events.data!.next_cursor)} />}
          {eventCursor && <Button label="Back to latest events" variant="ghost" onPress={() => setEventCursor(null)} />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const header = (
    <View style={styles.header}>
      {tabs}
      <Typography variant="body" color="textMuted">
        {tab === 'challenges' ? 'Points earned from challenges.' : 'Season rankings across all activities.'}
      </Typography>
      <FilterChips options={PERIODS} value={period} onChange={setPeriod} />
      {tab === 'global' ? <FilterChips options={DOMAINS} value={domain} onChange={setDomain} /> : null}

      <Card variant="accent">
        <Card.Header
          title="Your position"
          rightAction={
            me && total > 0 ? (
              <Badge label={`Top ${Math.max(1, Math.ceil((me.rank / total) * 100))}%`} variant="success" />
            ) : undefined
          }
        />
        <Card.Body>
          {me === undefined && !loading ? (
            <Spinner />
          ) : (
            <>
              <Typography variant={isCompactPhone ? 'displayTitle' : 'displayHero'} numberOfLines={1}>
                {me ? `#${me.rank}` : '—'}
              </Typography>
              <Typography variant="caption" color="textMuted">
                {me ? `${formatNumber(me.points)} total points` : 'Your rank is not loaded yet. Explore the board or earn points to climb it.'}
              </Typography>
            </>
          )}
        </Card.Body>
        <Card.Footer>
          <Button label="Scroll to my position" size="sm" variant="outline" leftIcon="locate-outline" onPress={scrollToMe} />
        </Card.Footer>
      </Card>

      {loading ? (
        <>
          <Skeleton height={150} borderRadius={20} />
          <Skeleton.Card />
        </>
      ) : error ? (
        <ErrorState title="Could not load the leaderboard" message={error} onRetry={() => void load('initial')} />
      ) : rows.length === 0 ? (
        <Card variant="inner">
          <EmptyState icon="trophy" title="No rankings yet" description="Nobody has earned points in this period yet." />
        </Card>
      ) : (
        <>
          <Podium rows={podium} />
          {rest.length > 0 ? <SectionHeader title="Rankings" badge={total} /> : null}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Leaderboard" />
      <FlatList
        ref={listRef}
        data={loading || error ? [] : rest}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <StandingRow row={item} onPress={() => navigation.navigate('Profile', { ref: item.key })} />}
        ListHeaderComponent={header}
        contentContainerStyle={contentStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loadingMore && !loading && !refreshing && !error && page < totalPages) void load('more', page + 1);
        }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
        }}
        ListFooterComponent={loadingMore ? <Spinner style={styles.footer} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: 16, marginBottom: 8 },
  footer: { paddingVertical: 16 },
});
