import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { StandingRow } from '../../src/components/LeaderboardParts';
import { SearchInput } from '../../src/forms/SearchInput';
import { Select } from '../../src/forms/Select';
import { Alert } from '../../src/feedback/Alert';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { leaderboardRepository } from '../../src/repositories/LeaderboardRepository';
import { bracketsRepository, type Match } from '../../src/repositories/BracketsRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../store/auth';
import { formatDate } from '../../src/utils/format';
import InvestmentSheet from './investment-sheet';

type ViewMode = 'table' | 'bracket' | 'matches';
const optionalMissing = <T,>(request: Promise<T>): Promise<T | null> => request.catch(err => {
  if (err instanceof ApiError && err.status === 404) return null;
  throw err;
});

export function MatchCard({ match }: { match: Match }) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  return <Card onPress={() => navigation.navigate('Match', { id: match._id })} style={{ borderWidth: 1, borderColor: match.status === 'ongoing' ? colors.danger : colors.border, borderRadius: 16, padding: 12 }}>
    <Typography variant="caption" color={match.status === 'ongoing' ? 'danger' : 'textMuted'}>{match.status === 'ongoing' ? 'LIVE' : match.status.toUpperCase()}</Typography>
    {(['a', 'b'] as const).map(side => <View key={side} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Typography variant="caption" color="textMuted">{match[side]?.seed ?? '—'}</Typography>
      <Typography variant="body" numberOfLines={1} style={{ flex: 1 }} color={match.winner === side ? 'accent' : 'text'}>{match[side]?.display_name ?? (match.status === 'bye' ? 'Bye' : 'To be decided')}</Typography>
      <Typography variant="mono">{match[side === 'a' ? 'score_a' : 'score_b'] ?? '—'}</Typography>
    </View>)}
    {match.scheduled_at && <Typography variant="caption" color="textMuted">{formatDate(match.scheduled_at)}</Typography>}
  </Card>;
}

export default function EventLeaderboard() {
  const { colors } = useTheme();
  const { width, gutter } = useResponsive();
  const { user } = useAuth();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const eventRef: string = route.params?.ref ?? route.params?.eventRef;
  const [view, setView] = useState<ViewMode>(route.params?.view ?? 'table');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [investing, setInvesting] = useState(false);
  const [round, setRound] = useState(1);
  const [matchPage, setMatchPage] = useState(1);
  const bracketColWidth = Math.round(Math.max(188, Math.min(240, width * 0.56)));
  useEffect(() => { setView(route.params?.view ?? 'table'); setRound(1); setMatchPage(1); setPage(1); setSearchText(''); setSearch(''); }, [eventRef, route.params?.view]);
  const onSearch = useCallback((value: string) => { setSearch(value.trim().slice(0, 64)); setPage(1); }, []);
  const event = useAsyncResource(() => eventsRepository.getById(eventRef), [eventRef]);
  const table = useAsyncResource(async () => {
    const [board, mine] = await Promise.all([
      leaderboardRepository.event(eventRef, { limit: 50, search: search || undefined, page }),
      user ? optionalMissing(leaderboardRepository.myEventEntry(eventRef)) : Promise.resolve(null),
    ]);
    return { board, mine };
  }, [eventRef, search, page, user?.id]);
  const draw = useAsyncResource(async () => {
    const id = event.data!._id;
    const [bracket, standings] = await Promise.all([optionalMissing(bracketsRepository.get(id)), optionalMissing(bracketsRepository.standings(id))]);
    return { bracket, standings };
  }, [event.data?._id], { enabled: !!event.data?._id });
  const reload = useCallback(async () => { await Promise.all([event.reload(), table.reload(), ...(event.data ? [draw.reload()] : [])]); }, [event.reload, table.reload, draw.reload, event.data?._id]);
  useEffect(() => navigation.addListener('focus', () => { void reload(); }), [navigation, reload]);
  const mine = table.data?.mine;
  const board = table.data?.board;
  const bracket = draw.data?.bracket;
  const standings = draw.data?.standings;
  const matches = bracket?.matches ?? [];
  const roundMatches = matches.filter(match => match.round === round);
  const matchPages = Math.max(1, Math.ceil(roundMatches.length / 25));
  const canInvest = !!user && !!mine && !mine.stats?.eliminated && event.data?.status === 'ongoing' && event.data.points_pool?.investment_enabled;
  const pendingError = event.error ?? (view === 'table' ? table.error ?? draw.error : draw.error);
  const loading = event.loading || (view === 'table' ? table.loading || draw.loading : draw.loading);
  const filteredStandings = standings?.rows.filter(row => row.display_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
    <AppHeader title={view === 'bracket' ? 'Bracket' : 'Standings'} showBackButton showMenuButton={false} />
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={event.refreshing || table.refreshing || draw.refreshing} onRefresh={() => void reload()} tintColor={colors.accent} />}>
      <Typography variant="displayTitle">{event.data?.title ?? board?.event_title ?? 'Event standings'}</Typography>
      <View style={styles.row}>
        {board && <Badge label={board.format.replace(/_/g, ' ')} variant="muted" />}
        {event.data && <Badge label={event.data.status} variant={event.data.status === 'ongoing' ? 'success' : 'muted'} />}
      </View>
      <SegmentedTabs tabs={[{ label: 'Table', value: 'table' }, { label: 'Bracket', value: 'bracket' }, { label: 'Matches', value: 'matches' }]} value={view} onChange={setView} />
      {pendingError && <ErrorState message={pendingError} onRetry={() => void reload()} />}
      {loading ? <><Skeleton.Card /><Skeleton.Card /></> : view === 'table' ? <>
        {board && !board.threshold_met && <Alert variant="info" title="Ranks are not final yet" description={`Ranks unlock once ${board.min_participants} active participants are scored.`} />}
        {standings?.champion && <Alert variant="success" title="Tournament champion" description={standings.champion.display_name} />}
        {mine && <Card variant="accent">
          <Typography variant="caption" color="textMuted">{mine.participant.type === 'team' ? 'YOUR TEAM' : 'YOUR POSITION'}</Typography>
          <View style={styles.row}><Typography variant="displayTitle">{mine.rank ? `#${mine.rank}` : '—'}</Typography><View style={{ flex: 1 }}><Typography variant="h3">{mine.participant.display_name}</Typography><Typography variant="caption">{mine.final_score} points · {mine.invested_points} invested</Typography></View></View>
        </Card>}
        <SearchInput value={searchText} onChangeText={setSearchText} onSearch={onSearch} placeholder="Search participants" />
        {filteredStandings?.length ? <Card>
          <Typography variant="caption" color="textMuted">MATCH STANDINGS · PLAYED / WON / DRAWN / LOST</Typography>
          {filteredStandings.map((row, index) => <StandingRow key={row.id} row={{ key: row.id, rank: search ? null : index + 1, name: row.display_name, score: row.points, isMe: row.id === mine?.participant.id, subtitle: `${row.played} P · ${row.won} W · ${row.drawn} D · ${row.lost} L${row.eliminated ? ' · Eliminated' : ''}` }} />)}
        </Card> : null}
        {board?.standings.length ? <Card>
          <Typography variant="caption" color="textMuted">POINTS RANKING · INCLUDING INVESTMENTS</Typography>
          {board.standings.map(entry => <StandingRow key={entry._id} row={{ key: entry._id, rank: entry.rank, previousRank: entry.previous_rank, name: entry.participant.display_name, avatarUrl: entry.participant.avatar_url, score: entry.final_score, isMe: entry.participant.id === mine?.participant.id }} />)}
          {board.total_pages > 1 && <View style={styles.row}>
            <Button label="Previous" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} />
            <Typography variant="caption">{page} / {board.total_pages}</Typography>
            <Button label="Next" variant="outline" disabled={page >= board.total_pages} onPress={() => setPage(page + 1)} />
          </View>}
        </Card> : !pendingError && <EmptyState title={search ? 'No matching participants' : 'No scores yet'} description="Standings appear when results are published." icon="trophy" />}
        {canInvest && <Card><Typography variant="h3">Back your {mine?.participant.type === 'team' ? 'team' : 'entry'}</Typography><Typography variant="body" color="textMuted">Use your points to climb this event’s points ranking. Preview your position before confirming.</Typography><Button label="Invest points" onPress={() => setInvesting(true)} /></Card>}
      </> : !matches.length ? <EmptyState title="Draw not published" description="Fixtures will appear here once the tournament draw is ready." icon="trophy" /> : view === 'matches' || bracket?.bracket.format === 'round_robin' ? <>
        {standings?.champion && <Alert variant="success" title="Tournament champion" description={standings.champion.display_name} />}
        {view === 'bracket' && <Typography variant="body" color="textMuted">Round-robin fixtures are grouped by round.</Typography>}
        <Select label="Round" value={round} options={Array.from({ length: bracket!.bracket.rounds }, (_, i) => ({ label: `Round ${i + 1}`, value: i + 1 }))} onChange={value => { setRound(value as number); setMatchPage(1); }} />
        {roundMatches.slice((matchPage - 1) * 25, matchPage * 25).map(match => <View key={match._id} style={{ gap: 8 }}><Typography variant="caption" color="textMuted">Round {match.round} · Match {match.slot + 1}</Typography><MatchCard match={match} /></View>)}
        {matchPages > 1 && <View style={styles.row}><Button label="Previous" variant="outline" disabled={matchPage <= 1} onPress={() => setMatchPage(matchPage - 1)} /><Typography variant="caption">{matchPage} / {matchPages}</Typography><Button label="Next" variant="outline" disabled={matchPage >= matchPages} onPress={() => setMatchPage(matchPage + 1)} /></View>}
      </> : <>
        {standings?.champion && <Alert variant="success" title="Tournament champion" description={standings.champion.display_name} />}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 20, paddingBottom: 16 }}>
          {Array.from({ length: bracket!.bracket.rounds }, (_, i) => i + 1).map(round => <View key={round} style={{ width: bracketColWidth, gap: 12 }}>
            <Typography variant="labelSmall" color="textMuted">{bracket!.bracket.format === 'single_elim' && round === bracket!.bracket.rounds ? 'FINAL' : `ROUND ${round}`}</Typography>
            <View style={{ flex: 1, justifyContent: 'space-around', gap: 16 }}>{matches.filter(match => match.round === round).map(match => <MatchCard key={match._id} match={match} />)}</View>
          </View>)}
        </ScrollView>
        <Typography variant="caption" color="textMuted">Swipe to see more rounds · tap a match for details.</Typography>
      </>}
    </ScrollView>
    {user && mine && event.data && <InvestmentSheet visible={investing} onClose={() => setInvesting(false)} onInvested={() => void reload()} eventId={event.data._id} title={event.data.title} userId={user.id} invested={mine.invested_points} cap={event.data.points_pool?.investment_cap} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
});
