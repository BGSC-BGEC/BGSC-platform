import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { FilterChips } from '../../src/components/FilterChips';
import { SearchInput } from '../../src/forms/SearchInput';
import { Skeleton } from '../../src/feedback/Skeleton';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
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

/** Horizontal page padding — matches the Events tab. */
const GUTTER = 16;

type Filter = 'all' | AnnouncementCategory;
const FILTERS: Array<{ label: string; value: Filter }> = [
  { label: 'All', value: 'all' },
  ...(Object.keys(ANNOUNCEMENT_CATEGORY_LABELS) as AnnouncementCategory[]).map((c) => ({
    label: ANNOUNCEMENT_CATEGORY_LABELS[c],
    value: c,
  })),
];

/** `divider`: a hairline under this post (another post follows in the same group). */
type Row = { kind: 'label'; text: string } | { kind: 'item'; item: Announcement; divider: boolean };

/**
 * Announcements — a broadcasts feed, newest first, four-month window. One continuous surface:
 * a pinned post up top, then plain post rows grouped under Today / Earlier with hairlines between.
 */
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
    const group = (text: string, list: Announcement[]): Row[] =>
      list.length
        ? [{ kind: 'label', text }, ...list.map((item, i) => ({ kind: 'item', item, divider: i < list.length - 1 }) as Row)]
        : [];
    return [
      ...group('Today', feed.filter((a) => isToday(a.published_at))),
      ...group('Earlier', feed.filter((a) => !isToday(a.published_at))),
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
          <Pressable onPress={markAllRead} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
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
      {pinned ? <PinnedPost item={pinned} onPress={() => open(pinned)} /> : null}
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
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(110, insets.bottom + 90) }]}
        renderItem={({ item: row }) =>
          row.kind === 'label' ? (
            <Typography color="text" style={styles.group}>
              {row.text}
            </Typography>
          ) : (
            <PostRow item={row.item} divider={row.divider} onPress={() => open(row.item)} />
          )
        }
        ListEmptyComponent={
          state === 'loading' ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={40} height={40} borderRadius={20} />
                  <View style={styles.skeletonText}>
                    <Skeleton height={12} width="45%" />
                    <Skeleton height={14} width="85%" />
                    <Skeleton height={12} width="70%" />
                  </View>
                </View>
              ))}
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
        ListFooterComponent={
          state === 'more' ? (
            <View style={styles.skeletonRow}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={styles.skeletonText}>
                <Skeleton height={12} width="45%" />
                <Skeleton height={14} width="85%" />
              </View>
            </View>
          ) : undefined
        }
        refreshControl={
          <RefreshControl refreshing={state === 'refreshing'} onRefresh={() => load('refresh')} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/** Priority only when it says something (urgent / important); "normal" shows nothing. */
function priorityOf(a: Announcement) {
  return a.priority !== 'normal' ? ANNOUNCEMENT_PRIORITY[a.priority] : undefined;
}

/**
 * One post as a feed row: avatar, who · role · when, then the title and a two-line preview.
 * Unread posts get a bold title and a small orange dot; urgent / important keep their status pill.
 */
function PostRow({ item, divider, onPress }: { item: Announcement; divider: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const name = item.author.display_name;
  const priority = priorityOf(item);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? 'Unread. ' : ''}${item.title}, from ${name}`}
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Avatar name={name} uri={item.author.avatar_url} size={40} color={authorColor(name, colors)} />
      <View style={styles.flex}>
        <View style={styles.meta}>
          <Typography color="text" style={[styles.small, styles.semibold, styles.name]} numberOfLines={1}>
            {name}
          </Typography>
          <Typography color="textMuted" style={[styles.small, styles.role]} numberOfLines={1}>
            {item.author.role_label} · {timeAgo(item.published_at)}
          </Typography>
          {item.unread ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        </View>
        <Typography color="text" style={item.unread ? [styles.postTitle, styles.bold] : styles.postTitle} numberOfLines={2}>
          {item.title}
        </Typography>
        <Typography color="textMuted" style={styles.preview} numberOfLines={2}>
          {item.body}
        </Typography>
        {priority ? (
          <View style={styles.statusRow}>
            <Badge label={priority.label} variant={priority.variant} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** The pinned post as a feature: its photo (if it has one), a small kicker, then a big title. */
function PinnedPost({ item, onPress }: { item: Announcement; onPress: () => void }) {
  const media = resolveMediaUrl(item.media_url);
  const priority = priorityOf(item);
  const category = ANNOUNCEMENT_CATEGORY_LABELS[item.categories[0]];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pinned: ${item.title}`}
      style={({ pressed }) => [styles.pinned, pressed && styles.pressed]}
    >
      {media ? <Image source={{ uri: media }} style={styles.pinnedMedia} contentFit="cover" /> : null}
      <Typography color="primary" style={styles.pinnedKicker}>
        PINNED{category ? ` · ${category.toUpperCase()}` : ''} · {timeAgo(item.published_at).toUpperCase()}
      </Typography>
      <Typography variant="h2" color="text">
        {item.title}
      </Typography>
      <Typography variant="body" color="textMuted" numberOfLines={3}>
        {item.body}
      </Typography>
      {priority ? (
        <View style={styles.statusRow}>
          <Badge label={priority.label} variant={priority.variant} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  small: { fontSize: 13, lineHeight: 18 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  bold: { fontFamily: FONT_FAMILIES.bodyBold },
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 32 },
  header: { gap: 14, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { fontSize: 32, lineHeight: 40 },
  markAllText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14, lineHeight: 20, marginBottom: 2 },
  chipsBleed: { marginHorizontal: -GUTTER },
  chipsRow: { paddingHorizontal: GUTTER },
  // Group heading (Today / Earlier): clear space above so it groups with the posts below it.
  group: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 15, lineHeight: 20, marginTop: 26, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  // Name keeps its width; role and time give way first on a narrow screen.
  name: { flexShrink: 0, maxWidth: '55%' },
  role: { flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginLeft: 2 },
  postTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 15.5, lineHeight: 21, marginTop: 3 },
  preview: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  statusRow: { flexDirection: 'row', marginTop: 8 },
  pinned: { gap: 6, marginTop: 10 },
  pinnedMedia: { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 6 },
  pinnedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
  skeletons: { gap: 6, marginTop: 20 },
  skeletonRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  skeletonText: { flex: 1, gap: 8 },
});
