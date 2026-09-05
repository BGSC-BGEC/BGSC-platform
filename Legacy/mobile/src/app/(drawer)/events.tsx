import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EventCard, EventCardSkeleton, LeagueCard } from '@/components/events/EventCard';
import { EventTabs, StatusFilterChips, type EventsTabKey } from '@/components/events/EventTabs';
import { EmptyState, ErrorState } from '@/components/events/SectionStates';
import { StravaSection } from '@/components/events/StravaSection';
import { Screen } from '@/components/screen';
import { SkeletonCard } from '@/components/SkeletonBlock';
import type { EventCategory, EventStatus, PlatformEvent } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { useEvents } from '@/hooks/use-events';

const STATUS_ORDER: Record<EventStatus, number> = { ongoing: 0, upcoming: 1, past: 2 };

const EMPTY_MESSAGES: Record<EventsTabKey, string> = {
  leagues: 'No leagues scheduled right now.',
  bgec: 'No BGEC events posted yet.',
  fitsoc: 'No FitSoc events posted yet.',
  general: 'No general events right now — check back soon.',
};

function sortEvents(list: PlatformEvent[]): PlatformEvent[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.startDate.localeCompare(b.startDate),
  );
}

/**
 * Events screen (events-page1.md). Fixed header architecture: title + tab bar
 * + filter row are pinned; only the tab content scrolls. Filters are
 * screen-level state and persist across tabs (§2.4). Bracket / auction
 * sub-routes are pushed from the event detail screen.
 */
export default function EventsScreen() {
  const colors = useColors();
  const { data: allEvents = [], isLoading, isError, refetch } = useEvents();
  const [tab, setTab] = useState<EventsTabKey>('leagues');
  const [statusFilter, setStatusFilter] = useState<Set<EventStatus>>(new Set());
  const listRef = useRef<ScrollView>(null);
  const stravaY = useRef(0);

  const toggleStatus = (s: EventStatus) =>
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const counts: Record<EventStatus, number> = { past: 0, upcoming: 0, ongoing: 0 };
  allEvents.forEach((e) => counts[e.status]++);

  const filtered = useMemo(
    () =>
      allEvents.filter((e) => statusFilter.size === 0 || statusFilter.has(e.status)),
    [allEvents, statusFilter],
  );

  const byCategory = (cat: EventCategory) => sortEvents(filtered.filter((e) => e.category === cat));
  const leagues = byCategory('leagues');
  const bgec = byCategory('bgec');
  const fitsoc = byCategory('fitsoc');
  const general = byCategory('general');
  const featured = general.find((e) => e.isFeatured);
  const gridGeneral = general.filter((e) => e !== featured);

  const hasActiveFilters = statusFilter.size > 0;
  const openEvent = (id: string) => router.push(`/event/${id}`);

  const renderList = () => {
    if (isLoading) return <ListSkeleton tab={tab} />;
    if (isError) return <ErrorState onRetry={() => void refetch()} />;

    const items =
      tab === 'leagues' ? leagues : tab === 'bgec' ? bgec : tab === 'fitsoc' ? fitsoc : general;

    if (items.length === 0) {
      return (
        <EmptyState
          message={hasActiveFilters ? 'No events match your current filters.' : EMPTY_MESSAGES[tab]}
          actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
          onAction={hasActiveFilters ? () => setStatusFilter(new Set()) : undefined}
        />
      );
    }

    if (tab === 'leagues') {
      return (
        <View style={styles.grid}>
          {leagues.map((e) => (
            <LeagueCard key={e.id} event={e} onPress={() => openEvent(e.id)} />
          ))}
        </View>
      );
    }

    if (tab === 'general') {
      return (
        <View style={styles.gap}>
          {featured ? (
            <EventCard event={featured} onPress={() => openEvent(featured.id)} />
          ) : null}
          <View style={styles.grid}>
            {gridGeneral.map((e) => (
              <LeagueCard key={e.id} event={e} onPress={() => openEvent(e.id)} />
            ))}
          </View>
        </View>
      );
    }

    // bgec / fitsoc — single-column list
    return (
      <View style={styles.gap}>
        {items.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            onPress={() => openEvent(e.id)}
            onStravaPress={() =>
              listRef.current?.scrollTo({ y: stravaY.current, animated: true })
            }
          />
        ))}
      </View>
    );
  };

  return (
    <Screen scroll={false}>
      <Text style={[styles.title, { color: colors.text }]}>Events</Text>
      <EventTabs value={tab} onChange={setTab} />
      <View style={styles.filterWrap}>
        <StatusFilterChips value={statusFilter} onChange={toggleStatus} counts={counts} />
      </View>
      <ScrollView
        ref={listRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {renderList()}
        {tab === 'fitsoc' ? (
          <StravaSection onLayout={(y) => (stravaY.current = y)} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ListSkeleton({ tab }: { tab: EventsTabKey }) {
  return tab === 'leagues' ? (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <EventCardSkeleton key={i} />
      ))}
    </View>
  ) : tab === 'general' ? (
    <View style={styles.gap}>
      <SkeletonCard lines={3} />
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <EventCardSkeleton key={i} />
        ))}
      </View>
    </View>
  ) : (
    <View style={styles.gap}>
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} lines={3} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: FONTS.hero,
    fontSize: 48,
    marginTop: 12,
    marginBottom: 12,
  },
  filterWrap: {
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  gap: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
