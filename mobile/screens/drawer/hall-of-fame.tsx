import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
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
import { useTheme } from '../../src/theme/ThemeProvider';
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

function subtitleFor(entry: HallOfFameEntry) {
  return [HOF_CATEGORY_LABELS[entry.category], entry.achievement.season ?? String(entry.achievement.year)].filter(Boolean).join(' · ');
}

export default function HallOfFame() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<View_>('list');

  const featured = useAsyncResource(() => hallOfFameRepository.featured(), []);
  const entries = useAsyncResource(
    () =>
      hallOfFameRepository.list({
        category: category === 'all' ? undefined : category,
        search: search || undefined,
        limit: 100,
      }),
    [category, search],
  );

  const byYear = useMemo(() => {
    const groups = new Map<number, HallOfFameEntry[]>();
    for (const entry of entries.data?.items ?? []) {
      const year = entry.achievement.year;
      groups.set(year, [...(groups.get(year) ?? []), entry]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [entries.data]);

  const open = (entry: HallOfFameEntry) => navigation.navigate('HallOfFameDetail', { ref: entry.slug || entry._id });

  const renderEntry = (entry: HallOfFameEntry) => (
    <Card key={entry._id} variant="solid" onPress={() => open(entry)} accessibilityLabel={`${entry.title}, ${entry.honoree.display_name}`}>
      <Card.Header
        title={entry.title}
        subtitle={subtitleFor(entry)}
        rightAction={<IconButton icon="share" size="sm" variant="ghost" onPress={() => shareHallOfFame(entry)} accessibilityLabel="Share" />}
      />
      <View style={styles.honoree}>
        <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={40} />
        <View style={styles.flex}>
          <Typography variant="h4">{entry.honoree.display_name}</Typography>
          {entry.source.title ? <Typography variant="caption" color="textMuted">{entry.source.title}</Typography> : null}
        </View>
        {entry.achievement.award_points ? <Badge label={`+${entry.achievement.award_points} pts`} variant="success" /> : null}
      </View>
      {entry.quote ? (
        <Typography variant="body" color="textMuted" numberOfLines={2} style={styles.quote}>
          “{entry.quote}”
        </Typography>
      ) : null}
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Hall of Fame" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={entries.refreshing}
            onRefresh={() => {
              void featured.reload();
              void entries.reload();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <Typography variant="body" color="textMuted">Celebrating the people who define BGSC.</Typography>

        {featured.loading ? (
          <Skeleton height={170} borderRadius={24} />
        ) : featured.data && featured.data.length > 0 ? (
          <>
            <SectionHeader title="Featured" />
            <FlatList
              horizontal
              data={featured.data}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              snapToInterval={292}
              decelerationRate="fast"
              contentContainerStyle={styles.carousel}
              renderItem={({ item }) => (
                <Card variant="accent" style={styles.featuredCard} onPress={() => open(item)}>
                  <Card.Header title={item.title} rightAction={<Badge label={String(item.achievement.year)} variant="primary" />} />
                  <Card.Body>
                    <View style={styles.honoree}>
                      <Avatar name={item.honoree.display_name} uri={item.honoree.avatar_url} size={48} />
                      <Typography variant="h2" style={styles.flex} numberOfLines={2}>
                        {item.honoree.display_name}
                      </Typography>
                    </View>
                    <Typography variant="body" color="textMuted" numberOfLines={2}>
                      {item.quote ? `“${item.quote}”` : item.description ?? HOF_CATEGORY_LABELS[item.category]}
                    </Typography>
                  </Card.Body>
                </Card>
              )}
            />
          </>
        ) : null}

        <SearchInput value={search} onSearch={(text) => setSearch(text.trim())} placeholder="Search by name or title" />
        <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />
        <SegmentedTabs
          tabs={[
            { label: 'List', value: 'list' },
            { label: 'Timeline', value: 'timeline' },
          ]}
          value={mode}
          onChange={setMode}
        />

        {entries.loading ? (
          <>
            <Skeleton.Card />
            <Skeleton.Card />
            <Skeleton.Card />
          </>
        ) : entries.error ? (
          <ErrorState title="Could not load the Hall of Fame" message={entries.error} onRetry={() => void entries.reload()} />
        ) : !entries.data?.items.length ? (
          <Card variant="inner">
            <EmptyState
              icon="trophy"
              title={search ? 'No matches' : 'No honours yet'}
              description={search ? 'Try another name or category.' : 'Champions will be inducted here after each season.'}
            />
          </Card>
        ) : mode === 'list' ? (
          <>
            <SectionHeader title={category === 'all' ? 'All honours' : HOF_CATEGORY_LABELS[category]} badge={entries.data.total} />
            {entries.data.items.map(renderEntry)}
          </>
        ) : (
          byYear.map(([year, group]) => (
            <View key={year} style={styles.yearBlock}>
              <View style={styles.yearHeader}>
                <View style={[styles.node, { backgroundColor: colors.accent }]} />
                <Typography variant="h2" color="accent">{year}</Typography>
              </View>
              <View style={[styles.timelineBody, { borderLeftColor: colors.border }]}>
                {group.map((entry) => (
                  <Card key={entry._id} variant="inner" onPress={() => open(entry)}>
                    <Typography variant="h4">{entry.title}</Typography>
                    <View style={styles.honoree}>
                      <Avatar name={entry.honoree.display_name} uri={entry.honoree.avatar_url} size={28} />
                      <Typography variant="body" color="textMuted" style={styles.flex}>
                        {entry.honoree.display_name}
                      </Typography>
                      <Badge label={HOF_CATEGORY_LABELS[entry.category]} size="sm" variant="muted" />
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  flex: { flex: 1 },
  carousel: { gap: 12, paddingVertical: 4, paddingRight: 4 },
  featuredCard: { width: 280 },
  honoree: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quote: { fontStyle: 'italic' },
  yearBlock: { gap: 8 },
  yearHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  node: { width: 12, height: 12, borderRadius: 6 },
  timelineBody: { borderLeftWidth: 2, marginLeft: 5, paddingLeft: 16, gap: 12, paddingBottom: 4 },
});
