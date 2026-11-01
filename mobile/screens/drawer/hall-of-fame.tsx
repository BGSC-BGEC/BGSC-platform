import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { GlobePattern } from '../../src/components/GlobePattern';
import { SearchInput } from '../../src/forms/SearchInput';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { IconButton } from '../../src/icons/IconButton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha } from '../../src/theme/colors';
import { useResponsive } from '../../src/responsive/useResponsive';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { hallOfFameRepository } from '../../src/repositories/HallOfFameRepository';
import type { HallOfFameCategory, HallOfFameEntry } from '../../src/api/types';
import { HOF_CATEGORY_LABELS } from '../../src/utils/format';

type CategoryFilter = 'all' | HallOfFameCategory;
type View_ = 'list' | 'timeline';

const CATEGORIES: Array<{ label: string; value: CategoryFilter }> = [
  { label: 'All', value: 'all' },
  ...(Object.keys(HOF_CATEGORY_LABELS) as HallOfFameCategory[]).map((value) => ({ label: HOF_CATEGORY_LABELS[value], value })),
];

export function shareHallOfFame(entry: HallOfFameEntry) {
  const line = `${entry.honoree.display_name} — ${entry.title} (${entry.achievement.year})`;
  void Share.share({ message: `🏆 BGSC Hall of Fame\n${line}${entry.quote ? `\n“${entry.quote}”` : ''}` });
}

export default function HallOfFame() {
  const { colors, shadow } = useTheme();
  const { width, gutter } = useResponsive();
  const featuredWidth = Math.min(width - gutter * 2 - 24, 320);
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<View_>('list');

  const featured = useAsyncResource(() => hallOfFameRepository.featured(), []);
  const entries = useAsyncResource(
    () =>
      hallOfFameRepository.list({
        category: category === 'all' ? undefined : category,
        search: search || undefined,
        limit: 50,
        page,
      }),
    [category, search, page],
  );

  const totalPages = entries.data ? Math.ceil(entries.data.total / entries.data.limit) : 1;

  const byYear = useMemo(() => {
    const groups = new Map<number, HallOfFameEntry[]>();
    for (const entry of entries.data?.items ?? []) {
      const year = entry.achievement.year;
      groups.set(year, [...(groups.get(year) ?? []), entry]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [entries.data]);

  const open = (entry: HallOfFameEntry) => navigation.navigate('HallOfFameDetail', { slugOrId: entry.slug || entry._id });

  // Hall of Fame inductee card
  const renderEntry = (entry: HallOfFameEntry) => (
    <Pressable
      key={entry._id}
      onPress={() => open(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.honoree.display_name}`}
      style={({ pressed }) => [
        styles.passCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        shadow('raised'),
        pressed && styles.pressed,
      ]}
    >
      {/* Top Ribbon */}
      <View style={[styles.ribbon, { borderBottomColor: colors.border, backgroundColor: withAlpha(colors.primary, 0.1) }]}>
        <View style={styles.ribbonLeft}>
          <View style={[styles.goldDot, { backgroundColor: colors.primary }]} />
          <Typography variant="labelSmall" color="primary" style={styles.ribbonText}>
            CLASS OF {entry.achievement.year} · {HOF_CATEGORY_LABELS[entry.category]?.toUpperCase()}
          </Typography>
        </View>
        <IconButton icon="share" size="sm" variant="ghost" onPress={() => shareHallOfFame(entry)} accessibilityLabel="Share" />
      </View>

      {/* Body */}
      <View style={styles.passBody}>
        <Typography variant="h3" color="text" numberOfLines={1}>
          {entry.title}
        </Typography>

        <View style={styles.honoree}>
          <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={44} ring />
          <View style={styles.flex}>
            <Typography variant="h4" color="text">
              {entry.honoree.display_name}
            </Typography>
            {entry.source.title ? (
              <Typography variant="caption" color="textMuted">
                {entry.source.title}
              </Typography>
            ) : null}
          </View>
          {entry.achievement.award_points ? (
            <Badge label={`+${entry.achievement.award_points} pts`} variant="success" />
          ) : null}
        </View>

        {entry.quote ? (
          <Typography variant="body" color="textMuted" numberOfLines={2} style={styles.quote}>
            “{entry.quote}”
          </Typography>
        ) : null}

        {/* Perforation Line with notches */}
        <View style={styles.perforationWrapper}>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: colors.background, borderColor: colors.border }]} />
          <View style={[styles.dashedLine, { borderColor: colors.border }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: colors.background, borderColor: colors.border }]} />
        </View>

        {/* Bottom Honouree Tag */}
        <View style={styles.passFooter}>
          <Typography variant="mono" color="textMuted" style={styles.serial}>
            HONOUR #{entry._id.slice(-6).toUpperCase()}
          </Typography>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Hall of Fame" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: 10 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={entries.refreshing}
            onRefresh={() => {
              void featured.reload();
              void entries.reload();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.heroHeader, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('raised')]}>
          <GlobePattern height={130} />
          <Typography variant="displayTitle">Legends of BGSC.</Typography>
          <Typography variant="body" color="textMuted">Celebrating the champions who define our legacy.</Typography>
        </View>

        {featured.error ? <ErrorState title="Featured honours unavailable" message={featured.error} onRetry={() => void featured.reload()} /> : null}

        {featured.loading ? (
          <Skeleton height={170} borderRadius={24} />
        ) : featured.data && featured.data.length > 0 ? (
          <>
            <SectionHeader title="Featured Legends" />
            <FlatList
              horizontal
              data={featured.data}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={featuredWidth + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => open(item)}
                  style={({ pressed }) => [
                    styles.featuredCard,
                    { width: featuredWidth, backgroundColor: colors.surface, borderColor: colors.primary },
                    shadow('raised'),
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.featuredRibbon, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
                    <Typography variant="labelSmall" color="primary" style={styles.bold}>
                      FEATURED INDUCTEE
                    </Typography>
                    <Badge label={String(item.achievement.year)} variant="primary" />
                  </View>
                  <View style={styles.featuredBody}>
                    <View style={styles.honoree}>
                      <Avatar name={item.honoree.display_name} uri={item.honoree.avatar_url} size={44} ring />
                      <Typography variant="h3" color="text" style={styles.flex} numberOfLines={1}>
                        {item.honoree.display_name}
                      </Typography>
                    </View>
                    <Typography variant="caption" color="primary" numberOfLines={1}>
                      {item.title}
                    </Typography>
                    <Typography variant="bodySmall" color="textMuted" numberOfLines={2}>
                      {item.quote ? `“${item.quote}”` : item.description ?? HOF_CATEGORY_LABELS[item.category]}
                    </Typography>
                  </View>
                </Pressable>
              )}
            />
          </>
        ) : null}

        <SearchInput value={search} onSearch={(text) => { setSearch(text.trim()); setPage(1); }} placeholder="Search champions or titles" />
        <FilterChips options={CATEGORIES} value={category} onChange={(value) => { setCategory(value); setPage(1); }} />
        <SegmentedTabs
          tabs={[
            { label: 'List View', value: 'list' },
            { label: 'Timeline', value: 'timeline' },
          ]}
          value={mode}
          onChange={setMode}
        />

        {entries.loading ? (
          <View style={styles.gap}>
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
          </View>
        ) : entries.error ? (
          <ErrorState title="Could not load the Hall of Fame" message={entries.error} onRetry={() => void entries.reload()} />
        ) : !entries.data?.items?.length ? (
          <EmptyState
            icon="trophy"
            title={search ? 'No matches' : 'No honours yet'}
            description={search ? 'Try another name or category.' : 'Champions will be inducted here after each season.'}
          />
        ) : mode === 'list' ? (
          <>
            <SectionHeader title={category === 'all' ? 'All Honours' : HOF_CATEGORY_LABELS[category]} badge={entries.data.total} />
            {entries.data.items.map(renderEntry)}
          </>
        ) : (
          byYear.map(([year, group]) => (
            <View key={year} style={styles.yearBlock}>
              <View style={styles.yearHeader}>
                <View style={[styles.node, { backgroundColor: colors.primary }]} />
                <Typography variant="h2" color="primary">
                  {year}
                </Typography>
              </View>
              <View style={[styles.timelineBody, { borderLeftColor: colors.border }]}>
                {group.map((entry) => (
                  <Pressable
                    key={entry._id}
                    onPress={() => open(entry)}
                    style={({ pressed }) => [
                      styles.timelineCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      shadow('flat'),
                      pressed && styles.pressed,
                    ]}
                  >
                    <Typography variant="h4" color="text">
                      {entry.title}
                    </Typography>
                    <View style={styles.honoree}>
                      <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={28} />
                      <Typography variant="body" color="textMuted" style={styles.flex}>
                        {entry.honoree.display_name}
                      </Typography>
                      <Badge label={HOF_CATEGORY_LABELS[entry.category]} size="sm" variant="muted" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}

        {!entries.loading && !entries.error && totalPages > 1 ? (
          <View style={styles.pagination}>
            <Button label="Previous" variant="outline" disabled={page === 1} onPress={() => setPage(page - 1)} />
            <Typography variant="caption" color="textMuted">
              Page {page} of {totalPages}
            </Typography>
            <Button label="Next" variant="outline" disabled={page >= totalPages} onPress={() => setPage(page + 1)} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, gap: 16, paddingBottom: 40 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  gap: { gap: 12 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  heroHeader: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  carousel: { gap: 12, paddingVertical: 4, paddingRight: 4 },
  featuredCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featuredRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  featuredBody: {
    padding: 14,
    gap: 8,
  },
  featuredStub: {
    paddingTop: 4,
    alignItems: 'flex-start',
    opacity: 0.7,
  },
  passCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  ribbonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ribbonText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  passBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  honoree: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quote: { fontStyle: 'italic', fontSize: 13, lineHeight: 18 },
  perforationWrapper: {
    position: 'relative',
    height: 18,
    justifyContent: 'center',
    marginHorizontal: -16,
    marginVertical: -2,
  },
  dashedLine: {
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  notch: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  notchLeft: {
    left: -8,
  },
  notchRight: {
    right: -8,
  },
  passFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serial: {
    fontSize: 10,
    letterSpacing: 1,
  },
  yearBlock: { gap: 8 },
  yearHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  node: { width: 12, height: 12, borderRadius: 6 },
  timelineBody: { borderLeftWidth: 2, marginLeft: 5, paddingLeft: 16, gap: 10, paddingBottom: 4 },
  timelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
