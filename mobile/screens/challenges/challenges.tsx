import React, { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge, type BadgeVariant } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FilterChips } from '../../src/components/FilterChips';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { SkeletonCard } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { challengesRepository, type Challenge, type Participation } from '../../src/repositories/ChallengesRepository';
import { getErrorMessage } from '../../src/api/client';
import { participationGroup } from '../../services/challengeLogic';
import { Icon } from '../../src/icons/Icon';

const difficulties: Record<Challenge['difficulty'], BadgeVariant> = { easy: 'success', medium: 'info', hard: 'warning', legend: 'primary' };
const filters = [{ label: 'All', value: 'all' }, { label: 'Physical', value: 'physical' }, { label: 'Digital', value: 'digital' }, { label: 'Sports', value: 'sports' }, { label: 'Esports', value: 'esports' }, { label: 'Development', value: 'dev' }];
type Row = { challenge: Challenge } | { participation: Participation };

export default function Challenges() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [tab, setTab] = useState<'active' | 'available' | 'completed'>(route.params?.tab ?? 'active');
  const [filter, setFilter] = useState('all');
  const [catalog, setCatalog] = useState<Challenge[]>([]);
  const [parts, setParts] = useState<Participation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const query = useCallback((next?: string) => challengesRepository.list({ cursor: next, ...(filter === 'physical' || filter === 'digital' ? { kind: filter } : filter !== 'all' ? { domain: filter } : {}) }), [filter]);
  const load = useCallback(async (refresh = false) => {
    const request = ++version.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [page, first] = await Promise.all([query(), challengesRepository.mine()]);
      const mine = [...first.participations];
      let next = first.next_cursor;
      // The catalogue has no exclude-participated filter; collect own IDs to keep Available accurate.
      while (next && request === version.current) {
        const page = await challengesRepository.mine(next);
        mine.push(...page.participations);
        next = page.next_cursor;
      }
      if (request !== version.current) return;
      setCatalog(page.challenges); setCursor(page.next_cursor); setParts(mine);
    } catch (err) { if (request === version.current) setError(getErrorMessage(err)); }
    finally { if (request === version.current) { setLoading(false); setRefreshing(false); } }
  }, [query]);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current += 1; }; }, [load]));
  const loadMore = async () => {
    if (!cursor || more) return;
    const request = version.current;
    setMore(true); setError(null);
    try {
      const page = await query(cursor);
      if (request === version.current) { setCatalog(rows => [...rows, ...page.challenges.filter(c => !rows.some(r => r._id === c._id))]); setCursor(page.next_cursor); }
    } catch (err) { if (request === version.current) setError(getErrorMessage(err)); }
    finally { setMore(false); }
  };
  const myIds = new Set(parts.map(p => p.challenge_id));
  const rows: Row[] = tab === 'available'
    ? catalog.filter(c => !myIds.has(c._id)).map(challenge => ({ challenge }))
    : parts.filter(p => participationGroup(p.status) === tab).map(participation => ({ participation }));
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="Challenges" />
    <FlatList<Row>
      data={loading ? [] : rows}
      keyExtractor={row => 'challenge' in row ? row.challenge._id : row.participation._id}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter, paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.stack}>
        <Typography variant="h1">Challenges</Typography>
        <Typography color="textMuted">Build your skills. Earn your place.</Typography>
        <SegmentedTabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Active' }, { value: 'available', label: 'Available' }, { value: 'completed', label: 'Completed' }]} />
        {tab === 'available' && <FilterChips options={filters} value={filter} onChange={setFilter} />}
        {error && <ErrorState message={error} onRetry={() => void load(true)} />}
        {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListEmptyComponent={!loading && !error ? <EmptyState icon="target" title={tab === 'available' ? 'No challenges here yet' : tab === 'active' ? 'A fresh start awaits' : 'Your journey is just beginning'} description={tab === 'available' ? 'Try another category or check back for new challenges.' : 'Accept a challenge to start building your record.'} /> : undefined}
      renderItem={({ item }) => {
        const c = 'challenge' in item ? item.challenge : null;
        const p = 'participation' in item ? item.participation : null;
        const title = c?.title ?? p!.challenge_snapshot.title;
        const difficulty = c?.difficulty ?? p!.challenge_snapshot.difficulty;
        const tone = difficulty === 'easy' ? colors.success : difficulty === 'medium' ? colors.info : difficulty === 'hard' ? colors.warning : colors.primary;
        return <Card onPress={() => navigation.navigate('ChallengeDetail', { key: c?.slug ?? p!.challenge_id, participationId: p?._id })} accessibilityLabel={`Open ${title}`} style={{ borderTopWidth: 4, borderTopColor: tone }}>
          <View style={styles.row}>
            <Badge label={difficulty} variant={difficulties[difficulty]} />
            <Badge label={c?.kind ?? p!.status.replaceAll('_', ' ')} />
            <Typography variant="mono" color="warning" style={styles.reward}>+{c?.award_points ?? p!.challenge_snapshot.award_points}</Typography>
          </View>
          <Typography variant="h4">{title}</Typography>
          {c && <Typography color="textMuted">{c.description ?? 'The full brief unlocks when you accept.'}</Typography>}
          {p && <View style={[styles.track, { backgroundColor: colors.surfaceInner }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: p.progress.percent }}><View style={{ width: `${p.progress.percent}%`, height: 6, backgroundColor: tone }} /></View>}
          <View style={styles.row}><Icon name="clock" size={16} color="textMuted" /><Typography variant="caption" color="textMuted" style={styles.flex}>{p?.deadline_at ? `Due ${new Date(p.deadline_at).toLocaleString()}` : c?.window.closes_at ? `Closes ${new Date(c.window.closes_at).toLocaleDateString()}` : c?.window.time_limit_minutes ? `${c.window.time_limit_minutes} minutes after acceptance` : p ? `${p.progress.percent}% complete` : 'Open challenge'}</Typography></View>
          {c?.grants_hall_of_fame && <Typography variant="caption" color="primary">Hall of Fame honour on approval</Typography>}
        </Card>;
      }}
      ListFooterComponent={<View style={styles.footer}>{tab === 'available' && cursor && !loading ? <Button label="Load more challenges" variant="outline" loading={more} onPress={() => void loadMore()} /> : null}<Button label="Connect Strava" variant="ghost" onPress={() => navigation.navigate('StravaConnect')} /></View>}
    />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20 }, stack: { gap: 16, marginBottom: 16 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, flex: { flex: 1 }, reward: { marginLeft: 'auto' }, track: { height: 6, borderRadius: 3, overflow: 'hidden' }, footer: { paddingTop: 20, gap: 12 } });
