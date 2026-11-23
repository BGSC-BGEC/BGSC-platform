import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
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
import { FONT_FAMILIES } from '../../src/theme/typography';

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
      contentContainerStyle={[styles.content, { paddingHorizontal: Math.max(gutter, 16), paddingTop: 16, paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.stack}>
        <Typography color="textMuted">Build your skills. Earn your place.</Typography>
        <SegmentedTabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Active' }, { value: 'available', label: 'Available' }, { value: 'completed', label: 'Completed' }]} />
        {tab === 'available' && <FilterChips options={filters} value={filter} onChange={setFilter} />}
        {error && <ErrorState message={error} onRetry={() => void load(true)} />}
        {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />}
      ListEmptyComponent={!loading && !error ? <EmptyState icon="target" title={tab === 'available' ? 'No challenges here yet' : tab === 'active' ? 'A fresh start awaits' : 'Your journey is just beginning'} description={tab === 'available' ? 'Try another category or check back for new challenges.' : 'Accept a challenge to start building your record.'} /> : undefined}
      renderItem={({ item }) => {
        const c = 'challenge' in item ? item.challenge : null;
        const p = 'participation' in item ? item.participation : null;
        const title = c?.title ?? p!.challenge_snapshot.title;
        const difficulty = c?.difficulty ?? p!.challenge_snapshot.difficulty;
        const tone = difficulty === 'easy' ? colors.success : difficulty === 'medium' ? colors.info : difficulty === 'hard' ? colors.warning : colors.primary;
        const when = p?.deadline_at ? `Due ${new Date(p.deadline_at).toLocaleString()}` : c?.window.closes_at ? `Closes ${new Date(c.window.closes_at).toLocaleDateString()}` : c?.window.time_limit_minutes ? `${c.window.time_limit_minutes} min after accepting` : p ? `${p.progress.percent}% complete` : 'Open challenge';
        const meta = [difficulty[0]!.toUpperCase() + difficulty.slice(1), c?.kind ? c.kind[0]!.toUpperCase() + c.kind.slice(1) : null, when].filter(Boolean).join(' · ');
        return <Pressable onPress={() => navigation.navigate('ChallengeDetail', { key: c?.slug ?? p!.challenge_id, participationId: p?._id })} accessibilityRole="button" accessibilityLabel={`Open ${title}`} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <View style={styles.itemHead}>
            <View style={styles.flex}>
              <Typography color="text" style={styles.title} numberOfLines={2}>{title}</Typography>
              <View style={styles.metaRow}>
                {/* Difficulty reads as a coloured mark, not a pill */}
                <View style={[styles.diffDot, { backgroundColor: tone }]} />
                <Typography color="textMuted" style={styles.meta} numberOfLines={1}>{meta}</Typography>
              </View>
            </View>
            <View style={styles.rewardCol}>
              <Typography color="text" style={styles.reward}>+{c?.award_points ?? p!.challenge_snapshot.award_points}</Typography>
              <Typography color="textMuted" style={styles.rewardUnit}>PTS</Typography>
            </View>
          </View>
          {c && <Typography color="textMuted" style={styles.desc} numberOfLines={2}>{c.description ?? 'The full brief unlocks when you accept.'}</Typography>}
          {/* Participation status keeps its pill; progress is a thin bar */}
          {p && <View style={styles.progressRow}>
            <Badge size="sm" label={p.status.replaceAll('_', ' ')} />
            <View style={[styles.track, { backgroundColor: colors.surfaceInner }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: p.progress.percent }}><View style={{ width: `${p.progress.percent}%`, height: 3, backgroundColor: tone }} /></View>
          </View>}
          {c?.grants_hall_of_fame && <Typography color="primary" style={styles.meta}>Hall of Fame honour on approval</Typography>}
        </Pressable>;
      }}
      ListFooterComponent={<View style={styles.footer}>{tab === 'available' && cursor && !loading ? <Button label="Load more challenges" variant="ghost" loading={more} onPress={() => void loadMore()} /> : null}<Button label="Connect Strava" variant="ghost" onPress={() => navigation.navigate('StravaConnect')} /></View>}
    />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  stack: { gap: 14, marginBottom: 6 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  item: { paddingVertical: 16, gap: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 16, lineHeight: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  diffDot: { width: 7, height: 7, borderRadius: 4 },
  meta: { fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
  desc: { fontSize: 14, lineHeight: 20 },
  rewardCol: { alignItems: 'flex-end' },
  reward: { fontFamily: FONT_FAMILIES.hero, fontSize: 20, lineHeight: 24 },
  rewardUnit: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9, lineHeight: 11, letterSpacing: 0.8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  footer: { paddingTop: 20, gap: 12 },
});
