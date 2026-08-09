import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ChipFilter } from '@/components/ChipFilter';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useToast } from '@/components/Toast';
import { EventBrowserCard } from '@/components/leaderboard/EventBrowserCard';
import { InvestPointsSheet } from '@/components/leaderboard/InvestPointsSheet';
import { SponsorBarChart, type SponsorBarRow } from '@/components/leaderboard/SponsorBarChart';
import { SponsorStandingCard } from '@/components/leaderboard/SponsorStandingCard';
import { StandingsPodium } from '@/components/leaderboard/StandingsPodium';
import { StandingsRow } from '@/components/leaderboard/StandingsRow';
import { BrowserSkeleton, SectionEmpty, SectionError, SponsorsSkeleton, StandingsSkeleton } from '@/components/leaderboard/states';
import { YourRankCard, type YourRankState } from '@/components/leaderboard/YourRankCard';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import type { EventStatus, EventType, LeaderboardEntry, PlatformEvent } from '@/core/types';
import { useColors } from '@/hooks/use-colors';
import { useEventLeaderboard, useEvents, useMyRegistration } from '@/hooks/use-events';
import { useInvestPoints, useLeaderboardPreviews, useMySponsorStats, useSponsorStandings, type SponsorSort, type SponsorTimeFilter } from '@/hooks/use-leaderboard';
import { usePointsBalance } from '@/hooks/use-points';

const TABS = ['Events', 'Standings', 'Sponsors'] as const;
type TabIndex = 0 | 1 | 2;

/**
 * Leaderboards (master §9 / leaderboard.md) — three segmented surfaces behind
 * a sticky toggle: Events browser → Live Standings (podium hero + investment)
 * → Sponsor leaderboard. Reads are public; the investment write is guest-gated
 * (useRequireAuth → /login with returnTo).
 *
 * TODO(Phase 2): LIVE NOW strip (§3.0), socket live updates + revision guard
 * (§10), AsyncStorage standings cache for offline (§10.2), bracket / score
 * breakdown / scoring accordions (§4.5), per-format stat columns (§4.2).
 */
export default function LeaderboardsScreen() {
  const colors = useColors();
  const authStatus = useAuthStore((s) => s.status);
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView | null>(null);
  const [tab, setTab] = useState<TabIndex>(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  if (authStatus === 'unknown' || authStatus === 'loading') return <ScreenSkeleton />;

  const selectTab = (index: TabIndex) => {
    Haptics.selectionAsync();
    setTab(index);
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const openEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    selectTab(1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>LEADERBOARDS</Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          Track live standings across events and leagues.
        </Text>
      </View>

      <View style={styles.tabBar}>
        <SegmentedToggle
          options={[...TABS]}
          value={TABS[tab]}
          onChange={(v) => selectTab(TABS.indexOf(v as (typeof TABS)[number]) as TabIndex)}
          accessibilityLabel="Leaderboard views"
        />
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (index !== tab) setTab(index as TabIndex);
        }}
      >
        <View style={{ width }}>
          <EventsTab onOpenEvent={openEvent} />
        </View>
        <View style={{ width }}>
          <StandingsTab eventId={selectedEventId} onBrowse={() => selectTab(0)} />
        </View>
        <View style={{ width }}>
          <SponsorsTab />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Tab 0 — Leaderboard Event Browser ────────────────────────────────────────

type TypeFilter = 'all' | EventType;
type StatusFilter = 'all' | EventStatus;
type SortKey = 'live' | 'participants' | 'ending';

function EventsTab({ onOpenEvent }: { onOpenEvent: (id: string) => void }) {
  const colors = useColors();
  const userId = useAuthStore((s) => s.user?.id);
  const events = useEvents();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('live');

  // Debounced search (spec §3.2: 250 ms) against title + tags (team names are
  // unavailable client-side until the user-service join — TODO(Phase 2)).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const all = useMemo(() => (events.data ?? []).filter((e) => e.needsLeaderboard), [events.data]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return all
      .filter((e) => (type === 'all' ? true : e.type === type))
      .filter((e) => (status === 'all' ? true : e.status === status))
      .filter((e) =>
        q ? e.title.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)) : true,
      )
      .sort(bySort(sort));
  }, [all, type, status, debouncedQuery, sort]);

  // Top-3 preview per visible event (spec §3.3). ponytail: one leaderboard
  // fetch per card — switch to an `include=top3` param when the backend ships it.
  const previews = useLeaderboardPreviews(filtered.map((e) => e.id));

  const hasFilters = type !== 'all' || status !== 'all' || debouncedQuery.trim().length > 0;

  const chips = (
    <View style={styles.chipArea}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <ChipFilter<TypeFilter>
          options={[
            { label: 'All', value: 'all' },
            { label: 'LE', value: 'LE' },
            { label: 'ALL', value: 'ALL' },
            { label: 'DLL', value: 'DLL' },
          ]}
          value={type}
          onChange={(v) => setType(v ?? 'all')}
          accessibilityLabel="Event type filter"
        />
        <ChipFilter<StatusFilter>
          options={[
            { label: 'Live', value: 'ongoing' },
            { label: 'Upcoming', value: 'upcoming' },
            { label: 'Ended', value: 'past' },
          ]}
          value={status}
          onChange={(v) => setStatus(v ?? 'all')}
          accessibilityLabel="Event status filter"
        />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <ChipFilter<SortKey>
          options={[
            { label: 'Live First', value: 'live' },
            { label: 'Most Participants', value: 'participants' },
            { label: 'Ending Soon', value: 'ending' },
          ]}
          value={sort}
          onChange={(v) => setSort(v ?? 'live')}
          accessibilityLabel="Sort leaderboards"
        />
      </ScrollView>
    </View>
  );

  const searchBar = (
    <View style={[styles.searchWrap, { borderColor: colors.border }]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search leaderboards..."
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Search leaderboards"
        style={[styles.searchInput, { color: colors.text }]}
      />
      {query.length > 0 ? (
        <Pressable
          onPress={() => setQuery('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  const refresh = () => {
    void events.refetch();
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={events.isRefetching} onRefresh={refresh} tintColor={colors.textMuted} />
      }
    >
      {searchBar}
      {chips}

      {events.isLoading ? (
        <BrowserSkeleton />
      ) : events.isError ? (
        <SectionError message="Unable to load leaderboards." onRetry={() => void events.refetch()} />
      ) : all.length === 0 ? (
        <SectionEmpty
          icon="trophy-outline"
          message="No active leaderboards this term."
          actionLabel="Browse Events"
          onAction={() => router.push('/(drawer)/events')}
        />
      ) : filtered.length === 0 ? (
        <SectionEmpty
          icon="search-outline"
          message="No leaderboards match your filters."
          actionLabel={hasFilters ? 'Clear filters' : undefined}
          onAction={hasFilters ? () => { setType('all'); setStatus('all'); setQuery(''); } : undefined}
        />
      ) : (
        <View style={styles.cardList}>
          {filtered.map((event, i) => {
            const preview = previews[i]?.data;
            const previewLoading = previews[i]?.isPending;
            const myEntry = userId
              ? preview?.find((entry) => entry.userId === userId)
              : undefined;
            return (
              <EventBrowserCard
                key={event.id}
                event={event}
                preview={preview}
                previewLoading={!!previewLoading}
                myEntry={myEntry ?? null}
                onPress={() => onOpenEvent(event.id)}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function bySort(sort: SortKey) {
  const statusRank: Record<EventStatus, number> = { ongoing: 0, upcoming: 1, past: 2 };
  return (a: PlatformEvent, b: PlatformEvent): number => {
    switch (sort) {
      case 'live':
        return statusRank[a.status] - statusRank[b.status] || a.startDate.localeCompare(b.startDate);
      case 'participants':
        return (b.maxParticipants ?? 0) - (a.maxParticipants ?? 0);
      case 'ending':
        return a.endDate.localeCompare(b.endDate);
    }
  };
}

// ─── Tab 1 — Live Standings & Points Investment ───────────────────────────────

function StandingsTab({ eventId, onBrowse }: { eventId: string | null; onBrowse: () => void }) {
  const colors = useColors();
  const toast = useToast();
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();
  const user = useAuthStore((s) => s.user);

  const events = useEvents();
  const event = eventId ? (events.data ?? []).find((e) => e.id === eventId) : undefined;
  const standings = useEventLeaderboard(eventId ?? '');
  const entries = standings.data ?? [];
  const authed = user != null;
  const registration = useMyRegistration(eventId ?? '', authed);

  const [sheetVisible, setSheetVisible] = useState(false);
  const balance = usePointsBalance(user?.id ?? 'me');
  const invest = useInvestPoints(eventId ?? '');

  const myEntry = user ? entries.find((e) => e.userId === user.id) : undefined;
  const isParticipant =
    !!myEntry || registration.data?.status === 'confirmed' || false;
  const investable = event?.status === 'ongoing' && !!eventId;
  // TODO(Phase 2): `points_pool.investment_enabled` per event (leaderboard.md
  // §4.4) — defaults to enabled until the backend ships the config.

  const openSheet = () => {
    if (!requireAuth('Log in to invest points in this leaderboard.')) return;
    setSheetVisible(true);
  };

  const confirmInvest = (amount: number) => {
    invest.mutate(amount, {
      onSuccess: () => {
        setSheetVisible(false);
        const updated = qc.getQueryData<LeaderboardEntry[]>(['events', 'leaderboard', eventId]);
        const rank = updated?.find((e) => e.userId === user?.id)?.rank;
        toast.show(
          `Invested ${amount.toLocaleString()} pts · you are now #${rank ?? '—'}.`,
        );
      },
    });
  };

  if (!eventId || !event) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        <SectionEmpty
          icon="stats-chart-outline"
          message="Select a leaderboard to view standings."
          actionLabel="Browse Leaderboards"
          onAction={onBrowse}
        />
      </ScrollView>
    );
  }

  const yourRankState: YourRankState = event.status === 'past'
    ? { kind: 'ended' }
    : !authed
      ? { kind: 'guest' }
      : isParticipant && myEntry
        ? { kind: 'participant', rank: myEntry.rank, score: myEntry.score }
        : isParticipant
          ? { kind: 'registered' }
          : { kind: 'spectator' };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={standings.isRefetching}
          onRefresh={() => {
            void standings.refetch();
            void events.refetch();
          }}
          tintColor={colors.textMuted}
        />
      }
    >
      <View style={styles.standingsHeader}>
        <Pressable
          onPress={onBrowse}
          accessibilityRole="button"
          accessibilityLabel="Back to leaderboard browser"
          hitSlop={8}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.standingsTitleWrap}>
          <Text style={[styles.standingsTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.typeBadge, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.typeBadgeText, { color: colors.textMuted }]}>{event.type}</Text>
            </View>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {entries.length > 0 ? `${entries.length} participants` : event.status.toUpperCase()}
            </Text>
            {event.status === 'ongoing' ? (
              <Text style={[styles.liveText, { color: colors.success }]}>● LIVE</Text>
            ) : null}
          </View>
        </View>
      </View>

      {standings.isLoading ? (
        <StandingsSkeleton />
      ) : standings.isError ? (
        <SectionError message="Unable to load standings." onRetry={() => void standings.refetch()} />
      ) : entries.length === 0 ? (
        <SectionEmpty
          icon="podium-outline"
          message="No scores published yet for this event."
        />
      ) : (
        <>
          <StandingsPodium entries={entries} />
          <View style={styles.table}>
            {entries.slice(3).map((entry) => (
              <StandingsRow
                key={entry.userId}
                entry={entry}
                isSelf={entry.userId === user?.id}
              />
            ))}
          </View>
        </>
      )}

      <YourRankCard
        state={yourRankState}
        investable={investable}
        onInvest={openSheet}
        onLogin={() => requireAuth('Log in to participate in this leaderboard.')}
      />

      <InvestPointsSheet
        key={sheetVisible ? 'open' : 'closed'}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        eventId={eventId}
        balance={balance.data?.balance}
        entries={entries}
        ownScore={myEntry?.score ?? 0}
        onSubmit={confirmInvest}
        submitting={invest.isPending}
        onEarnPoints={() => {
          setSheetVisible(false);
          router.push('/(drawer)/points');
        }}
      />
    </ScrollView>
  );
}

// ─── Tab 2 — Sponsor Leaderboard ─────────────────────────────────────────────

function SponsorsTab() {
  const colors = useColors(); // ponytail: kept for refresh tint below
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [time, setTime] = useState<SponsorTimeFilter>('semester');
  const [sort, setSort] = useState<SponsorSort>('fans');

  const standings = useSponsorStandings(time);
  const mine = useMySponsorStats();

  const champions = useMemo(() => standings.data ?? [], [standings.data]);
  const sorted = useMemo(() => {
    const list = [...champions];
    switch (sort) {
      case 'wins':
        return list.sort((a, b) => (b.eventsWonCount ?? 0) - (a.eventsWonCount ?? 0));
      case 'users':
        return list.sort((a, b) => (b.affiliatedUserCount ?? 0) - (a.affiliatedUserCount ?? 0));
      default:
        return list.sort((a, b) => (b.totalFans ?? 0) - (a.totalFans ?? 0));
    }
  }, [champions, sort]);

  const mySponsorId = mine.data?.sponsorId ?? user?.activeSponsorId ?? null;

  const rows: SponsorBarRow[] = sorted.map((s, i) => ({
    id: s.sponsorId,
    name: s.name,
    value: s.totalFans ?? 0,
    rank: s.rank ?? i + 1,
    isMine: s.sponsorId === mySponsorId,
  }));

  const changeSponsor = () => {
    // TODO(Phase 2): sponsor-service endpoint for semester affiliation switch.
    // For now surface a toast so the interaction is not a dead button.
    toast.show('Sponsor switching opens next semester.', { actionLabel: 'OK' });
  };

  const refresh = () => {
    void standings.refetch();
    void mine.refetch();
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={standings.isRefetching} onRefresh={refresh} tintColor={colors.textMuted} />
      }
    >
      <View style={styles.chipRow}>
        <ChipFilter<SponsorTimeFilter>
          options={[
            { label: 'Semester', value: 'semester' },
            { label: 'Year', value: 'year' },
            { label: 'All Time', value: 'all' },
          ]}
          value={time}
          onChange={(v) => setTime(v ?? 'semester')}
          accessibilityLabel="Sponsor leaderboard time range"
        />
        <ChipFilter<SponsorSort>
          options={[
            { label: 'Most Fans', value: 'fans' },
            { label: 'Most Wins', value: 'wins' },
            { label: 'Most Users', value: 'users' },
          ]}
          value={sort}
          onChange={(v) => setSort(v ?? 'fans')}
          accessibilityLabel="Sort sponsors"
        />
      </View>

      {standings.isLoading ? (
        <SponsorsSkeleton />
      ) : standings.isError ? (
        <SectionError message="Unable to load sponsor standings." onRetry={() => void standings.refetch()} />
      ) : champions.length === 0 ? (
        <SectionEmpty icon="ribbon-outline" message="No sponsor standings yet this season." />
      ) : (
        <>
          <SponsorBarChart rows={rows} />
          <View style={styles.cardList}>
            {sorted.map((s) => (
              <SponsorStandingCard
                key={s.sponsorId}
                sponsor={s}
                mine={s.sponsorId === mySponsorId ? mine.data ?? null : null}
                onVisit={() => {
                  // TODO(Phase 2): open sponsor website once sponsor-service exposes it.
                }}
                onChangeSponsor={s.sponsorId === mySponsorId ? changeSponsor : undefined}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Full-screen skeleton (auth resolving, master §7.8) ───────────────────────

function ScreenSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <SkeletonBlock width="55%" height={40} radius={6} />
        <SkeletonBlock width="70%" height={14} radius={6} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.tabBar}>
        <SkeletonBlock height={44} radius={999} />
      </View>
      <View style={styles.tabContent}>
        <SkeletonBlock height={120} radius={16} style={{ marginBottom: 12 }} />
        <SkeletonBlock height={120} radius={16} style={{ marginBottom: 12 }} />
        <SkeletonBlock height={120} radius={16} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heroTitle: {
    fontFamily: FONTS.hero,
    fontSize: 40,
    letterSpacing: 1.5,
  },
  heroSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 4,
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  chipArea: {
    gap: 8,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    paddingVertical: 10,
  },
  cardList: {
    gap: 12,
  },
  standingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standingsTitleWrap: {
    flex: 1,
    gap: 4,
  },
  standingsTitle: {
    fontFamily: FONTS.heading,
    fontSize: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
  },
  metaText: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  liveText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  table: {
    gap: 8,
  },
});
