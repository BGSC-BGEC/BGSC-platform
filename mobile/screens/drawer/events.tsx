import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { AppHeader } from '../../src/components/AppHeader';
import { SearchInput } from '../../src/forms/SearchInput';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Spinner } from '../../src/feedback/Spinner';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { getErrorMessage } from '../../src/api/client';
import type { ApiEvent, EventCategory, EventStatus } from '../../src/api/types';
import { capacityLabel, eventStatusPill, EVENT_CATEGORY_LABELS, EVENT_TYPE_LABELS, formatDateTime } from '../../src/utils/format';

type CategoryFilter = 'all' | EventCategory;
type TimeFilter = 'active' | 'ongoing' | 'past';

const CATEGORIES: Array<{ label: string; value: CategoryFilter }> = [
  { label: 'All', value: 'all' },
  ...(Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]).map((value) => ({ label: EVENT_CATEGORY_LABELS[value], value })),
];

const TIME_FILTERS: Array<{ label: string; value: TimeFilter }> = [
  { label: 'Upcoming & live', value: 'active' },
  { label: 'Happening now', value: 'ongoing' },
  { label: 'Past events', value: 'past' },
];

const STATUS_FOR: Record<TimeFilter, EventStatus[]> = {
  active: ['upcoming', 'ongoing'],
  ongoing: ['ongoing'],
  past: ['past'],
};

export default function Events() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [time, setTime] = useState<TimeFilter>('active');

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', fromCursor: string | null = null) => {
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const res = await eventsRepository.list({
          category: category === 'all' ? undefined : [category],
          status: STATUS_FOR[time],
          search: query || undefined,
          sort: time === 'past' ? 'date_desc' : 'date_asc',
          cursor: fromCursor,
        });
        if (id !== requestId.current) return;
        setEvents((prev) => (mode === 'more' ? [...prev, ...res.events] : res.events));
        setCursor(res.next_cursor);
        setError(null);
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
    [category, time, query],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const openEvent = (event: ApiEvent) => navigation.navigate('EventDetails', { eventId: event.slug || event._id });

  const header = (
    <View style={styles.header}>
      <SearchInput value={search} onChangeText={setSearch} onSearch={(text) => setQuery(text.trim())} placeholder="Search events" />
      <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />
      <FilterChips options={TIME_FILTERS} value={time} onChange={setTime} />
      <SectionHeader
        title={time === 'past' ? 'Past events' : time === 'ongoing' ? 'Happening now' : 'Upcoming'}
        badge={loading ? undefined : events.length}
      />
    </View>
  );

  const renderEvent = ({ item: event }: { item: ApiEvent }) => {
    const pill = eventStatusPill(event);
    return (
      <Card variant="solid" onPress={() => openEvent(event)} accessibilityLabel={`Open ${event.title}`}>
        <Card.Header
          title={event.title}
          subtitle={`${formatDateTime(event.start_at)}${event.venue ? ` · ${event.venue}` : ''}`}
          rightAction={<Badge label={pill.label} variant={pill.variant} />}
        />
        <Card.Body>
          <Typography variant="body" color="textMuted">
            {EVENT_CATEGORY_LABELS[event.category]} · {EVENT_TYPE_LABELS[event.type]} · {capacityLabel(event)}
          </Typography>
        </Card.Body>
        <Card.Footer>
          <Button
            label={pill.registrationOpen ? 'Register' : event.auction?.status === 'live' ? 'Watch auction' : 'View details'}
            size="sm"
            variant={pill.registrationOpen ? 'primary' : 'outline'}
            onPress={() => openEvent(event)}
          />
          {event.auction?.status === 'live' ? <Badge label="Auction live" variant="primary" /> : null}
        </Card.Footer>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Events" />
      <FlatList
        data={loading || error ? [] : events}
        keyExtractor={(item) => item._id}
        renderItem={renderEvent}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cursor && !loadingMore && !loading) void load('more', cursor);
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <Skeleton.Card />
              <Skeleton.Card />
              <Skeleton.Card />
            </View>
          ) : error ? (
            <ErrorState title="Could not load events" message={error} onRetry={() => void load('initial')} />
          ) : (
            <Card variant="inner">
              <EmptyState
                icon="calendar"
                title="No events found"
                description={query ? 'Try another search or category.' : 'New events will appear here as soon as they are announced.'}
              />
            </Card>
          )
        }
        ListFooterComponent={loadingMore ? <Spinner style={styles.footer} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 16 },
  separator: { height: 16 },
  skeletons: { gap: 16 },
  footer: { paddingVertical: 16 },
});
