import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { SearchInput } from '../../src/forms/SearchInput';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { IconButton } from '../../src/icons/IconButton';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
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

/** Width of a featured legend in the sideways row. */
const FEATURED_W = 220;

export function shareHallOfFame(entry: HallOfFameEntry) {
  const line = `${entry.honoree.display_name} — ${entry.title} (${entry.achievement.year})`;
  void Share.share({ message: `🏆 BGSC Hall of Fame\n${line}${entry.quote ? `\n“${entry.quote}”` : ''}` });
}

/**
 * Hall of Fame — one continuous surface: a plain title, featured legends running edge to edge, then
 * honours as hairline-divided rows (list) or grouped under year markers on a line (timeline).
 */
export default function HallOfFame() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
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
  const hairline = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border };

  // One honour as a plain row: avatar, class + category kicker, title, who, and the quote.
  const renderEntry = (entry: HallOfFameEntry, i: number, list: HallOfFameEntry[]) => (
    <Pressable
      key={entry._id}
      onPress={() => open(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.honoree.display_name}`}
      style={({ pressed }) => [styles.row, i < list.length - 1 && hairline, pressed && styles.pressed]}
    >
      <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={44} />
      <View style={styles.flex}>
        <Typography color="primary" style={styles.kicker} numberOfLines={1}>
          CLASS OF {entry.achievement.year} · {HOF_CATEGORY_LABELS[entry.category]?.toUpperCase()}
        </Typography>
        <Typography color="text" style={styles.rowTitle} numberOfLines={2}>
          {entry.title}
        </Typography>
        <Typography color="textMuted" style={styles.small} numberOfLines={1}>
          {entry.honoree.display_name}
          {entry.source.title ? ` · ${entry.source.title}` : ''}
          {entry.achievement.award_points ? ` · +${entry.achievement.award_points} pts` : ''}
        </Typography>
        {entry.quote ? (
          <Typography color="textMuted" style={styles.quote} numberOfLines={2}>
            “{entry.quote}”
          </Typography>
        ) : null}
      </View>
      <IconButton icon="share" size="sm" variant="ghost" onPress={() => shareHallOfFame(entry)} accessibilityLabel="Share" />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Hall of Fame" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: gutter,
            paddingTop: 10,
            paddingBottom: Math.max(110, insets.bottom + 90),
          },
        ]}
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
        <View style={styles.intro}>
          <Typography variant="displayTitle">Legends of BGSC.</Typography>
          <Typography variant="body" color="textMuted">Celebrating the champions who define our legacy.</Typography>
        </View>

        {featured.error ? <ErrorState title="Featured honours unavailable" message={featured.error} onRetry={() => void featured.reload()} /> : null}

        {featured.loading ? (
          <View style={styles.featuredSkeleton}>
            <Skeleton width={64} height={64} borderRadius={32} />
            <Skeleton height={14} width="50%" />
            <Skeleton height={12} width="70%" />
          </View>
        ) : featured.data && featured.data.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Featured legends" />
            {/* Runs to the screen edges; the first legend lines up with the text above */}
            <FlatList
              horizontal
              data={featured.data}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={FEATURED_W + 24}
              decelerationRate="fast"
              style={{ marginHorizontal: -gutter }}
              contentContainerStyle={[styles.carousel, { paddingHorizontal: gutter }]}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => open(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.honoree.display_name}, ${item.title}`}
                  style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
                >
                  <Avatar name={item.honoree.display_name} uri={item.honoree.avatar_url} size={64} ring />
                  <Typography color="primary" style={styles.kicker} numberOfLines={1}>
                    {item.achievement.year} · {HOF_CATEGORY_LABELS[item.category]?.toUpperCase()}
                  </Typography>
                  <Typography variant="h3" color="text" numberOfLines={1}>
                    {item.honoree.display_name}
                  </Typography>
                  <Typography color="text" style={styles.small} numberOfLines={1}>
                    {item.title}
                  </Typography>
                  <Typography color="textMuted" style={styles.quote} numberOfLines={2}>
                    {item.quote ? `“${item.quote}”` : item.description ?? HOF_CATEGORY_LABELS[item.category]}
                  </Typography>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        <View style={styles.controls}>
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
        </View>

        {entries.loading ? (
          <View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.row}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={[styles.flex, styles.skeletonText]}>
                  <Skeleton height={11} width="40%" />
                  <Skeleton height={15} width="80%" />
                  <Skeleton height={12} width="55%" />
                </View>
              </View>
            ))}
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
          <View style={styles.section}>
            <SectionHeader
              title={category === 'all' ? 'All honours' : HOF_CATEGORY_LABELS[category]}
              subtitle={`${entries.data.total} ${entries.data.total === 1 ? 'honour' : 'honours'}`}
            />
            <View>{entries.data.items.map(renderEntry)}</View>
          </View>
        ) : (
          byYear.map(([year, group]) => (
            <View key={year} style={styles.yearBlock}>
              <View style={styles.yearHeader}>
                <View style={[styles.node, { backgroundColor: colors.primary }]} />
                <Typography variant="h2" color="text">
                  {year}
                </Typography>
              </View>
              {/* The line down the left is the timeline itself; entries are plain rows beside it */}
              <View style={[styles.timelineBody, { borderLeftColor: colors.border }]}>
                {group.map((entry, i) => (
                  <Pressable
                    key={entry._id}
                    onPress={() => open(entry)}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.title}, ${entry.honoree.display_name}`}
                    style={({ pressed }) => [styles.timelineRow, i < group.length - 1 && hairline, pressed && styles.pressed]}
                  >
                    <Typography color="text" style={styles.rowTitle}>
                      {entry.title}
                    </Typography>
                    <View style={styles.honoree}>
                      <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={24} />
                      <Typography color="textMuted" style={[styles.small, styles.flex]} numberOfLines={1}>
                        {entry.honoree.display_name} · {HOF_CATEGORY_LABELS[entry.category]}
                      </Typography>
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
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 28 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  small: { fontSize: 13, lineHeight: 18 },
  intro: { gap: 6 },
  section: { gap: 10 },
  controls: { gap: 12 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.8 },
  carousel: { gap: 24 },
  featured: { width: FEATURED_W, gap: 4 },
  featuredSkeleton: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  rowTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 15.5, lineHeight: 21, marginTop: 2 },
  quote: { fontStyle: 'italic', fontSize: 13, lineHeight: 18, marginTop: 4 },
  skeletonText: { gap: 8 },
  honoree: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yearBlock: { gap: 6 },
  yearHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  node: { width: 10, height: 10, borderRadius: 5 },
  timelineBody: { borderLeftWidth: 2, marginLeft: 4, paddingLeft: 16 },
  timelineRow: { gap: 6, paddingVertical: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
