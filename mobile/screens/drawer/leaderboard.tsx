import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    name: s.display_name || s.username,
    subtitle: `@${s.username}`,
    avatarUrl: s.avatar_url,
    score: s.points,
    isMe: s.user_id === myId,
  };
}

export default function Leaderboard() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const { user } = useAuth();
  const listRef = useRef<FlatList<RankedRow>>(null);

  const [tab, setTab] = useState<Tab>('global');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [domain, setDomain] = useState<LeaderboardDomain>('all');

  const [standings, setStandings] = useState<GlobalStanding[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<GlobalStanding | null | undefined>(undefined);
  const requestId = useRef(0);

  const source = tab === 'challenges' ? 'challenge' : 'all';

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', nextPage = 1) => {
      if (tab === 'events') return;
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const res = await leaderboardRepository.global({ period, domain, source, page: nextPage, limit: 50 });
        if (id !== requestId.current) return;
        setStandings((prev) => (mode === 'more' ? [...prev, ...res.standings] : res.standings));
        setPage(res.page);
        setTotalPages(res.total_pages);
        setTotal(res.total);
        setError(null);
        if (mode !== 'more' && user) {
          const found = res.standings.find((s) => s.user_id === user.id);
          if (found) setMe(found);
          else {
            setMe(undefined);
            leaderboardRepository
              .findMyGlobalRank(user.id, { period, domain, source })
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
    [tab, period, domain, source, user],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

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
      void popup.info('Not ranked yet', 'Earn points from events and challenges to appear on this leaderboard.');
    }
  };

  const events = useAsyncResource(
    async () => {
      const res = await eventsRepository.list({ status: ['ongoing', 'past'], sort: 'date_desc', limit: 50 });
      return res.events.filter((e) => e.leaderboard);
    },
    [],
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

  if (tab === 'events') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Leaderboard" />
        <ScrollView
          contentContainerStyle={styles.content}
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
          ) : !events.data?.length ? (
            <Card variant="inner">
              <EmptyState icon="trophy" title="No event leaderboards yet" description="Standings appear once an event goes live." />
            </Card>
          ) : (
            events.data.map((event) => {
              const pill = eventStatusPill(event);
              return (
                <Card
                  key={event._id}
                  variant="solid"
                  onPress={() => navigation.navigate('EventLeaderboard', { eventRef: event.slug || event._id, title: event.title })}
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
                    <Button label="View standings" size="sm" variant="outline" onPress={() => navigation.navigate('EventLeaderboard', { eventRef: event.slug || event._id, title: event.title })} />
                  </Card.Footer>
                </Card>
              );
            })
          )}
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
              <Typography variant="displayHero">{me ? `#${me.rank}` : '—'}</Typography>
              <Typography variant="caption" color="textMuted">
                {me ? `${formatNumber(me.points)} total points` : 'Not ranked yet — earn points to join the board'}
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
        renderItem={({ item }) => <StandingRow row={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loadingMore && !loading && page < totalPages) void load('more', page + 1);
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
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 8 },
  footer: { paddingVertical: 16 },
});
