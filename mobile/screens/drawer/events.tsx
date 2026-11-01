import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { EventCard, eventCardData } from '../../src/components/EventCard';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { SearchInput } from '../../src/forms/SearchInput';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { SkeletonEventCard } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha } from '../../src/theme/colors';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { auctionRepository } from '../../src/repositories/AuctionRepository';
import { getErrorMessage } from '../../src/api/client';
import type { ApiEvent, AuctionLiveState, EventCategory, EventStatus } from '../../src/api/types';
import { EVENT_CATEGORY_LABELS, eventStatusPill, formatNumber } from '../../src/utils/format';

type CategoryFilter = 'all' | EventCategory;
type TimeFilter = 'upcoming' | 'ongoing' | 'past';

const CATEGORIES: Array<{ label: string; value: CategoryFilter }> = [
  { label: 'All', value: 'all' },
  ...(Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]).map((value) => ({ label: EVENT_CATEGORY_LABELS[value], value })),
];
const TIME_TABS: Array<{ label: string; value: TimeFilter }> = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Past', value: 'past' },
];
const STATUS_FOR: Record<TimeFilter, EventStatus[]> = { upcoming: ['upcoming'], ongoing: ['ongoing'], past: ['past'] };
const WEEK_MS = 7 * 24 * 3600 * 1000;

type Row =
  | { kind: 'section'; title: string }
  | { kind: 'card'; event: ApiEvent }
  | { kind: 'rows'; events: ApiEvent[] };

/**
 * Date carousel switcher, search filter bar, boarding-pass cards,
 * and flight-schedule style compact list rows.
 */
export default function Events() {
  const { colors, shadow } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [time, setTime] = useState<TimeFilter>('upcoming');
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | null>(null);

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [live, setLive] = useState<AuctionLiveState | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'refreshing' | 'more'>('loading');
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', fromCursor: string | null = null) => {
      const id = ++requestId.current;
      setState(mode === 'initial' ? 'loading' : mode === 'refresh' ? 'refreshing' : 'more');
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
        if (id === requestId.current) setError(getErrorMessage(err));
      } finally {
        if (id === requestId.current) setState('ready');
      }
    },
    [category, time, query],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // A live auction anywhere gets the red banner on top, whatever the filters.
  useEffect(() => {
    let alive = true;
    eventsRepository
      .list({ status: ['upcoming', 'ongoing'], type: 'ALL', limit: 20 })
      .then((res) => res.events.find((e) => e.auction?.status === 'live'))
      .then((e) => (e ? auctionRepository.live(e.slug || e._id) : null))
      .then((s) => alive && setLive(s))
      .catch(() => alive && setLive(null));
    return () => {
      alive = false;
    };
  }, [liveTick]);

  const openEvent = (e: ApiEvent) => navigation.navigate('EventDetails', { eventId: e.slug || e._id });

  const openCount = events.filter((e) => eventStatusPill(e).registrationOpen).length;

  // Generate 7 upcoming date options
  const datePills = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getTime() + i * 24 * 3600 * 1000);
      list.push({
        offset: i,
        dayNum: d.getDate(),
        dayName: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateStr: d.toISOString().split('T')[0],
      });
    }
    return list;
  }, []);

  const filteredEvents = useMemo(() => {
    if (selectedDayOffset == null) return events;
    const targetDate = datePills[selectedDayOffset]?.dateStr;
    if (!targetDate) return events;
    return events.filter((e) => e.start_at.startsWith(targetDate));
  }, [events, selectedDayOffset, datePills]);

  const rows = useMemo<Row[]>(() => {
    if (time === 'ongoing') return filteredEvents.map((event) => ({ kind: 'card', event }));
    if (time === 'past') return filteredEvents.length ? [{ kind: 'rows', events: filteredEvents }] : [];
    // Upcoming: this week as full cards, everything after as compact rows.
    const cutoff = Date.now() + WEEK_MS;
    const soon = filteredEvents.filter((e) => Date.parse(e.start_at) < cutoff);
    const later = filteredEvents.filter((e) => Date.parse(e.start_at) >= cutoff);
    return [
      ...(soon.length ? [{ kind: 'section', title: 'This week' } as Row, ...soon.map((event) => ({ kind: 'card', event }) as Row)] : []),
      ...(later.length ? [{ kind: 'section', title: 'Later this month' } as Row, { kind: 'rows', events: later } as Row] : []),
    ];
  }, [filteredEvents, time]);

  const header = (
    <View style={styles.header}>
      <View>
        <Typography variant="displayHero" color="text" style={styles.title}>
          What’s on
        </Typography>
        {state !== 'loading' && !error ? (
          <Typography variant="bodySmall" color="textMuted">
            {filteredEvents.length} {time === 'past' ? 'past' : time} {filteredEvents.length === 1 ? 'tournament' : 'tournaments'}
            {time !== 'past' ? ` · ${openCount} open for entry` : ''}
          </Typography>
        ) : null}
      </View>

      <SearchInput value={search} onChangeText={setSearch} onSearch={(t) => setQuery(t.trim())} placeholder="Search tournaments, games or venues" />

      <View style={styles.dateCarouselWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateCarousel}>
          <Pressable
            onPress={() => setSelectedDayOffset(null)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedDayOffset == null }}
            style={[
              styles.datePill,
              { backgroundColor: selectedDayOffset == null ? colors.primary : colors.surface, borderColor: colors.border },
              shadow('flat'),
            ]}
          >
            <Typography variant="caption" style={{ color: selectedDayOffset == null ? colors.background : colors.textMuted, fontWeight: '700' }}>
              All
            </Typography>
            <Typography variant="bodySmall" style={{ color: selectedDayOffset == null ? colors.background : colors.text, fontWeight: '700' }}>
              Dates
            </Typography>
          </Pressable>

          {datePills.map((p) => {
            const active = selectedDayOffset === p.offset;
            return (
              <Pressable
                key={p.offset}
                onPress={() => setSelectedDayOffset(active ? null : p.offset)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.datePill,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                  shadow('flat'),
                ]}
              >
                <Typography variant="caption" style={{ color: active ? colors.background : colors.textMuted, fontSize: 10, fontWeight: '600' }}>
                  {p.dayName}
                </Typography>
                <Typography variant="body" style={{ color: active ? colors.background : colors.text, fontWeight: '700' }}>
                  {p.dayNum}
                </Typography>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <SegmentedTabs tabs={TIME_TABS} value={time} onChange={setTime} />
      <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />

      {live?.status === 'live' ? (
        <Pressable
          onPress={() => navigation.navigate('Auction', { eventRef: live.slug || live.event_id })}
          accessibilityRole="button"
          accessibilityLabel={`Live auction: ${live.title}`}
          style={({ pressed }) => [
            styles.live,
            { backgroundColor: colors.dangerMuted, borderColor: withAlpha(colors.danger, 0.4) },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.liveIcon, { backgroundColor: colors.danger }]}>
            <Icon name="gavel" size={20} color="white" />
          </View>
          <View style={styles.flex}>
            <View style={styles.liveKicker}>
              <View style={[styles.dot, { backgroundColor: colors.dangerText }]} />
              <Typography style={[styles.liveLabel, { color: colors.dangerText }]}>LIVE AUCTION</Typography>
            </View>
            <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
              {live.title}
            </Typography>
            {live.active_lot ? (
              <Typography variant="mono" color="textMuted" style={styles.mono} numberOfLines={1}>
                Lot {live.active_lot.order} · {live.active_lot.player.display_name} ·{' '}
                {formatNumber(live.active_lot.current_bid ?? live.active_lot.base_price)} cr
              </Typography>
            ) : null}
          </View>
          <Icon name="chevron-right" size={20} color="dangerText" />
        </Pressable>
      ) : null}

      {error && state !== 'loading' ? <ErrorState title="Couldn’t load events" message={error} onRetry={() => load('initial')} /> : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Events" />
      <FlatList
        data={state === 'loading' ? [] : rows}
        keyExtractor={(row, i) => (row.kind === 'card' ? row.event._id : `${row.kind}-${i}`)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item: row }) => {
          if (row.kind === 'section') return <SectionHeader title={row.title} />;
          if (row.kind === 'rows') return <CompactList events={row.events} onOpen={openEvent} />;
          const card = eventCardData(row.event);
          const ref = row.event.slug || row.event._id;
          const max = row.event.registration.max_participants;
          // Full but taking a waitlist: still open, so say what tapping actually does.
          const waitlist =
            card.registrationOpen && row.event.registration.waitlist_enabled && max != null && row.event.counts.registrations_confirmed >= max;
          return (
            <EventCard
              {...card}
              onPress={() => openEvent(row.event)}
              cta={
                waitlist
                  ? { label: 'Join waitlist', variant: 'outline', onPress: () => navigation.navigate('EventRegistration', { eventId: ref }) }
                  : card.registrationOpen
                    ? { label: 'Register', onPress: () => navigation.navigate('EventRegistration', { eventId: ref }) }
                    : { label: 'View Pass', variant: 'outline', onPress: () => openEvent(row.event) }
              }
            />
          );
        }}
        ListEmptyComponent={
          state === 'loading' ? (
            <View style={styles.gap}>
              <SkeletonEventCard />
              <SkeletonEventCard />
            </View>
          ) : error ? undefined : (
            <EmptyState
              icon="calendar"
              title={
                query
                  ? `No tournaments match “${query}”`
                  : category !== 'all'
                    ? `No ${time === 'past' ? 'past ' : ''}${EVENT_CATEGORY_LABELS[category]} tournaments`
                    : time === 'ongoing'
                      ? 'Nothing happening right now'
                      : 'No tournaments yet'
              }
              description={
                query || category !== 'all' ? 'Try another category or clear the filters.' : 'New events show up here as soon as they’re announced.'
              }
              actionLabel={query || category !== 'all' ? 'Clear filters' : undefined}
              onAction={
                query || category !== 'all'
                  ? () => {
                      setCategory('all');
                      setSearch('');
                      setQuery('');
                      setSelectedDayOffset(null);
                    }
                  : undefined
              }
            />
          )
        }
        ListFooterComponent={
          state === 'more' ? (
            <SkeletonEventCard />
          ) : state === 'ready' && !cursor && filteredEvents.length > 0 ? (
            <Typography variant="bodySmall" color="textMuted" align="center">
              That’s everything for now.
            </Typography>
          ) : undefined
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cursor && state === 'ready') void load('more', cursor);
        }}
        refreshControl={
          <RefreshControl
            refreshing={state === 'refreshing'}
            onRefresh={() => {
              setLiveTick((t) => t + 1);
              void load('refresh');
            }}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
}

/** Event list item row. */
function CompactList({ events, onOpen }: { events: ApiEvent[]; onOpen: (e: ApiEvent) => void }) {
  const { colors, shadow } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('flat')]}>
      {events.map((e, i) => {
        const d = new Date(e.start_at);
        const pill = eventStatusPill(e);
        return (
          <Pressable
            key={e._id}
            onPress={() => onOpen(e)}
            accessibilityRole="button"
            accessibilityLabel={`${e.title}, ${pill.label}`}
            style={({ pressed }) => [
              styles.listRow,
              i < events.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            {/* Date Tile */}
            <View style={[styles.dateTile, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}>
              <Typography variant="mono" color="text" style={styles.day}>
                {String(d.getDate()).padStart(2, '0')}
              </Typography>
              <Typography color="primary" style={styles.month}>
                {d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase()}
              </Typography>
            </View>

            {/* Title & Route Meta */}
            <View style={styles.flex}>
              <View style={styles.rowRoute}>
                <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                  {e.title}
                </Typography>
              </View>
              <View style={styles.flightSubRow}>
                <Typography variant="caption" color="textMuted" numberOfLines={1}>
                  {[e.venue || 'BGSC Arena', EVENT_CATEGORY_LABELS[e.category]].join(' · ')}
                </Typography>
              </View>
            </View>

            {/* Status */}
            <View style={styles.rowEnd}>
              <Badge label={pill.label} variant={pill.variant} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gap: { gap: 16 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32, gap: 16 },
  header: { gap: 16, marginBottom: 4 },
  title: { fontSize: 32, lineHeight: 40 },
  dateCarouselWrap: {
    marginHorizontal: -16,
  },
  dateCarousel: {
    paddingHorizontal: 16,
    gap: 8,
  },
  datePill: {
    width: 52,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  live: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  liveIcon: { padding: 12, borderRadius: 12 },
  liveKicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  liveLabel: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
  mono: { fontSize: 11 },
  list: { borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dateTile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  day: { fontSize: 17, fontWeight: '700' },
  month: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 9, letterSpacing: 0.8 },
  rowRoute: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flightSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
});
