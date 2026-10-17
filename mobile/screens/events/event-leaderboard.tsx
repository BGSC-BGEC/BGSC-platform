import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Podium, StandingRow, type RankedRow } from '../../src/components/LeaderboardParts';
import { SearchInput } from '../../src/forms/SearchInput';
import { Alert } from '../../src/feedback/Alert';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { leaderboardRepository } from '../../src/repositories/LeaderboardRepository';
import type { LeaderboardEntry } from '../../src/api/types';
import { formatNumber } from '../../src/utils/format';

const FORMAT_LABELS: Record<string, string> = {
  round_robin: 'Round robin',
  single_elim: 'Single elimination',
  double_elim: 'Double elimination',
  elim_after_n: 'Elimination',
  points_table: 'Points table',
};

export default function EventLeaderboard() {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const eventRef: string = route.params?.eventRef;
  const [search, setSearch] = useState('');

  const { data, loading, refreshing, error, reload } = useAsyncResource(async () => {
    const [board, mine] = await Promise.all([
      leaderboardRepository.event(eventRef, { limit: 100, search: search || undefined }),
      leaderboardRepository.myEventEntry(eventRef).catch(() => null),
    ]);
    return { board, mine };
  }, [eventRef, search]);

  const rows = useMemo<RankedRow[]>(() => {
    if (!data) return [];
    const myId = data.mine?.participant.id;
    return data.board.standings.map((e: LeaderboardEntry) => ({
      key: e._id,
      rank: e.rank,
      previousRank: e.previous_rank,
      name: e.participant.display_name,
      avatarUrl: e.participant.avatar_url,
      score: Math.round(e.final_score),
      subtitle:
        e.stats?.played != null
          ? `P${e.stats.played} · W${e.stats.won ?? 0} · L${e.stats.lost ?? 0}${e.stats.eliminated ? ' · Out' : ''}`
          : e.invested_points
            ? `${formatNumber(e.invested_points)} invested`
            : undefined,
      isMe: e.participant.id === myId,
    }));
  }, [data]);

  const board = data?.board;
  const mine = data?.mine;
  const showPodium = !search && board?.threshold_met;
  const podium = showPodium ? rows.slice(0, 3) : [];
  const rest = showPodium ? rows.slice(3) : rows;

  const header = (
    <View style={styles.header}>
      <Typography variant="displayTitle">{board?.event_title ?? route.params?.title ?? 'Standings'}</Typography>
      {board ? (
        <View style={styles.badges}>
          <Badge label={FORMAT_LABELS[board.format] ?? board.format} variant="muted" />
          <Badge label={`${board.total} entries`} variant="muted" />
        </View>
      ) : null}

      {mine ? (
        <Card variant="accent">
          <Card.Header title={mine.participant.type === 'team' ? 'Your team' : 'Your position'} subtitle={mine.participant.display_name} />
          <Card.Body>
            <Typography variant="displayHero">{mine.rank != null ? `#${mine.rank}` : '—'}</Typography>
            <Typography variant="caption" color="textMuted">
              {formatNumber(Math.round(mine.final_score))} points
              {mine.invested_points ? ` · ${formatNumber(mine.invested_points)} invested` : ''}
            </Typography>
          </Card.Body>
        </Card>
      ) : null}

      {board && !board.threshold_met ? (
        <Alert
          variant="info"
          title="Ranks are not final yet"
          description={`Ranks unlock once ${board.min_participants} participants are scored.`}
        />
      ) : null}

      <SearchInput value={search} onSearch={(text) => setSearch(text.trim())} placeholder="Search participants" />

      {loading ? (
        <>
          <Skeleton height={150} borderRadius={20} />
          <Skeleton.Card />
        </>
      ) : error ? (
        <ErrorState title="Could not load standings" message={error} onRetry={() => void reload()} />
      ) : rows.length === 0 ? (
        <Card variant="inner">
          <EmptyState icon="trophy" title={search ? 'No matches' : 'No scores yet'} description={search ? 'Try another name.' : 'Standings appear once results are published.'} />
        </Card>
      ) : (
        <>
          <Podium rows={podium} />
          {rest.length > 0 ? <SectionHeader title="Standings" /> : null}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Event standings" showBackButton showMenuButton={false} />
      <FlatList
        data={loading || error ? [] : rest}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <StandingRow row={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.accent} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8 },
});
