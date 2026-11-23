import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppHeader } from '../../src/components/AppHeader';
import { AnnouncementCard, announcementTags } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { FilterChips } from '../../src/components/FilterChips';
import { SearchInput } from '../../src/forms/SearchInput';
import { Skeleton } from '../../src/feedback/Skeleton';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { resolveMediaUrl } from '../../src/api/config';
import { getErrorMessage } from '../../src/api/client';
import { announcementsRepository } from '../../src/repositories/AnnouncementsRepository';
import type { Announcement, AnnouncementCategory } from '../../src/api/types';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY,
  isPinned,
  isToday,
  timeAgo,
} from '../../src/utils/format';
import MegaphoneWatermark from '../../assets/illustrations/megaphone-watermark.svg';

/** Horizontal page padding — matches the Events tab. */
const GUTTER = 13;

type Filter = 'all' | AnnouncementCategory;
const FILTERS: Array<{ label: string; value: Filter }> = [
  { label: 'All', value: 'all' },
  ...(Object.keys(ANNOUNCEMENT_CATEGORY_LABELS) as AnnouncementCategory[]).map((c) => ({
    label: ANNOUNCEMENT_CATEGORY_LABELS[c],
    value: c,
  })),
];

type Row = { kind: 'label'; text: string } | { kind: 'item'; item: Announcement };

/** v2 Announcements (35:646) — broadcasts feed, newest first, four-month window. */
export default function AnnouncementsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const [filter, setFilter] = useState<Filter>('all');
  // `search` is what's typed; `query` is the debounced value actually sent to the API.
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Announcement[]>([]);
  const [pinned, setPinned] = useState<Announcement | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'refreshing' | 'more'>('loading');
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      const id = ++request.current;
      const category = filter === 'all' ? undefined : filter;
      const q = query || undefined;
      setState(mode === 'initial' ? 'loading' : mode === 'refresh' ? 'refreshing' : 'more');
      try {
        if (mode === 'more') {
          const page = await announcementsRepository.list({ category, q, cursor });
          if (id !== request.current) return;
          setItems((prev) => [...prev, ...page.announcements]);
          setCursor(page.next_cursor);
        } else {
          const [page, pins, count] = await Promise.all([
            announcementsRepository.list({ category, q }),
            announcementsRepository.list({ category, q, pinned: true, limit: 5 }).catch(() => null),
            announcementsRepository.unreadCount().catch(() => 0),
          ]);
          if (id !== request.current) return;
          setItems(page.announcements);
          setCursor(page.next_cursor);
          setPinned(pins?.announcements.find((a) => isPinned(a)) ?? null);
          setUnread(count);
        }
        setError(null);
      } catch (err) {
        if (id === request.current) setError(getErrorMessage(err));
      } finally {
        if (id === request.current) setState('ready');
      }
    },
    [filter, query, cursor],
  );

  // Reload when the filter or search changes; the cursor dependency must not retrigger this.
  useEffect(() => {
    void load('initial');
  }, [filter, query]);

  const clearFilters = () => {
    setSearch('');
    setQuery('');
    setFilter('all');
  };

  // Coming back from a detail screen: refresh the read dots quietly.
  useFocusEffect(
    useCallback(() => {
      announcementsRepository.unreadCount().then(setUnread).catch(() => undefined);
    }, []),
  );

  const markAllRead = async () => {
    setUnread(0);
    setItems((prev) => prev.map((a) => ({ ...a, unread: false })));
    try {
      await announcementsRepository.markAllRead();
    } catch {
      void load('refresh');
    }
  };

  const rows = useMemo<Row[]>(() => {
    const feed = items.filter((a) => a._id !== pinned?._id);
    const today = feed.filter((a) => isToday(a.published_at));
    const earlier = feed.filter((a) => !isToday(a.published_at));
    return [
      ...(today.length ? [{ kind: 'label', text: 'TODAY' } as Row, ...today.map((item) => ({ kind: 'item', item }) as Row)] : []),
      ...(earlier.length ? [{ kind: 'label', text: 'EARLIER' } as Row, ...earlier.map((item) => ({ kind: 'item', item }) as Row)] : []),
    ];
  }, [items, pinned]);

  const open = (a: Announcement) => {
    if (a.unread) setItems((prev) => prev.map((x) => (x._id === a._id ? { ...x, unread: false } : x)));
    navigation.navigate('AnnouncementDetail', { id: a._id });
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Typography variant="displayHero" color="text" style={styles.title}>
            Broadcasts
          </Typography>
          <Typography variant="bodySmall" color="textMuted">
            {unread > 0 ? `${unread} unread · ` : ''}last 4 months
          </Typography>
        </View>
        {unread > 0 ? (
          <Pressable
            onPress={markAllRead}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.markAll,
              { backgroundColor: colors.surfaceInner, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Icon name="check-check" size={16} color="primary" />
            <Typography color="primary" style={styles.markAllText}>
              Mark all read
            </Typography>
          </Pressable>
        ) : null}
      </View>

      <SearchInput
        value={search}
        onChangeText={setSearch}
        onSearch={(t) => setQuery(t.trim().slice(0, 100))}
        placeholder="Search announcements"
      />

      {/* Bleeds to the screen edges so the chip row scrolls under the gutter instead of clipping at it. */}
      <View style={styles.chipsBleed}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} style={styles.chipsRow} />
      </View>

      {error && state !== 'loading' ? <ErrorState title="Couldn’t load announcements" message={error} onRetry={() => load('initial')} /> : null}
      {pinned ? <PinnedCard item={pinned} onPress={() => open(pinned)} /> : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Announcements" />
      <FlatList
        data={state === 'loading' ? [] : rows}
        keyExtractor={(row, i) => (row.kind === 'item' ? row.item._id : `label-${i}`)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(110, insets.bottom + 90) },
        ]}
        renderItem={({ item: row }) =>
          row.kind === 'label' ? (
            <Typography color="textMuted" style={styles.group}>
              {row.text}
            </Typography>
          ) : (
            <AnnouncementCard
              author={row.item.author.display_name}
              authorAvatar={row.item.author.avatar_url}
              meta={`${row.item.author.role_label} · ${timeAgo(row.item.published_at)}`}
              title={row.item.title}
              body={row.item.body}
              unread={row.item.unread}
              priority={
                row.item.priority !== 'normal' || row.item.unread ? ANNOUNCEMENT_PRIORITY[row.item.priority] : undefined
              }
              tags={announcementTags(row.item)}
              onPress={() => open(row.item)}
            />
          )
        }
        ListEmptyComponent={
          state === 'loading' ? (
            <View style={styles.skeletons}>
              <Skeleton height={290} borderRadius={22} />
              <Skeleton height={150} borderRadius={22} />
              <Skeleton height={150} borderRadius={22} />
            </View>
          ) : !error && !pinned ? (
            <EmptyState
              icon={query ? 'search' : 'megaphone'}
              title={
                query
                  ? `No announcements match “${query}”`
                  : filter === 'all'
                    ? 'No broadcasts yet'
                    : `Nothing from ${ANNOUNCEMENT_CATEGORY_LABELS[filter]}`
              }
              description={
                query
                  ? 'Try different words, or clear the search.'
                  : filter === 'all'
                    ? 'New posts from the core team show up here.'
                    : 'Try another club or clear the filter.'
              }
              actionLabel={query ? 'Clear search' : filter === 'all' ? undefined : 'Show all'}
              onAction={query ? clearFilters : filter === 'all' ? undefined : () => setFilter('all')}
            />
          ) : undefined
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cursor && state === 'ready') void load('more');
        }}
        ListFooterComponent={state === 'more' ? <Skeleton height={150} borderRadius={22} /> : undefined}
        refreshControl={
          <RefreshControl refreshing={state === 'refreshing'} onRefresh={() => load('refresh')} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/** Large pinned post: media (or blue gradient + megaphone watermark), badges, then the text. */
function PinnedCard({ item, onPress }: { item: Announcement; onPress: () => void }) {
  const { colors } = useTheme();
  const media = resolveMediaUrl(item.media_url);
  const priority = ANNOUNCEMENT_PRIORITY[item.priority];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pinned: ${item.title}`}
      style={({ pressed }) => [
        styles.pinned,
        { backgroundColor: colors.surface, borderColor: colors.primary },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.pinnedMedia}>
        {media ? (
          <Image source={{ uri: media }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <>
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="pinned-cover" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#5C8FA8" />
                  <Stop offset="1" stopColor="#141821" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#pinned-cover)" />
            </Svg>
            <View style={styles.watermark} pointerEvents="none">
              <MegaphoneWatermark width={160} height={160} />
            </View>
          </>
        )}
        <View style={styles.badges}>
          <View style={[styles.pinBadge, { backgroundColor: colors.primarySolid }]}>
            <Icon name="pin" size={12} color="white" />
            <Typography color="primaryText" style={styles.pinText}>
              PINNED
            </Typography>
          </View>
          {item.priority !== 'normal' ? <Badge label={priority.label} variant={priority.variant} /> : null}
        </View>
      </View>
      <View style={styles.pinnedBody}>
        <Typography color="textMuted" style={styles.pinnedKicker}>
          {(ANNOUNCEMENT_CATEGORY_LABELS[item.categories[0]] ?? '').toUpperCase()} · {timeAgo(item.published_at).toUpperCase()}
        </Typography>
        <Typography variant="h2" color="text">
          {item.title}
        </Typography>
        <Typography variant="body" color="textMuted" numberOfLines={3}>
          {item.body}
        </Typography>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  // Same gutter / rhythm as the Events tab so the two feeds feel like one app.
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 32, gap: 11 },
  header: { gap: 12, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 32, lineHeight: 40 },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  markAllText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 12, lineHeight: 15 },
  chipsBleed: { marginHorizontal: -GUTTER },
  chipsRow: { paddingHorizontal: GUTTER },
  // Extra space above a TODAY / EARLIER label so it groups with the cards below it.
  group: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1, marginTop: 8, marginLeft: 2 },
  skeletons: { gap: 11 },
  pinned: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  pinnedMedia: { height: 172, justifyContent: 'flex-end', padding: 14, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -6, top: 5, transform: [{ rotate: '12deg' }] },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // Same 21px height as the priority Badge beside it.
  pinBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 21, paddingHorizontal: 9, borderRadius: 999 },
  pinText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.6, includeFontPadding: false, textAlignVertical: 'center' },
  // Matches AnnouncementCard's 16px padding so pinned and regular cards line up.
  pinnedBody: { gap: 6, padding: 16 },
  pinnedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
});
