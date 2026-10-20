import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppHeader } from '../../src/components/AppHeader';
import { AnnouncementCard, announcementTags } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { FilterChips } from '../../src/components/FilterChips';
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
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const [filter, setFilter] = useState<Filter>('all');
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
      setState(mode === 'initial' ? 'loading' : mode === 'refresh' ? 'refreshing' : 'more');
      try {
        if (mode === 'more') {
          const page = await announcementsRepository.list({ category, cursor });
          if (id !== request.current) return;
          setItems((prev) => [...prev, ...page.announcements]);
          setCursor(page.next_cursor);
        } else {
          const [page, pins, count] = await Promise.all([
            announcementsRepository.list({ category }),
            announcementsRepository.list({ category, pinned: true, limit: 5 }).catch(() => null),
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
    [filter, cursor],
  );

  // Reload when the filter changes; the cursor dependency must not retrigger this.
  useEffect(() => {
    void load('initial');
  }, [filter]);

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

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

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
        contentContainerStyle={styles.content}
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
              <Skeleton height={300} borderRadius={24} />
              <Skeleton height={150} borderRadius={20} />
              <Skeleton height={150} borderRadius={20} />
            </View>
          ) : !error && !pinned ? (
            <EmptyState
              icon="megaphone"
              title={filter === 'all' ? 'No broadcasts yet' : `Nothing from ${ANNOUNCEMENT_CATEGORY_LABELS[filter]}`}
              description={filter === 'all' ? 'New posts from the core team show up here.' : 'Try another club or clear the filter.'}
              actionLabel={filter === 'all' ? undefined : 'Show all'}
              onAction={filter === 'all' ? undefined : () => setFilter('all')}
            />
          ) : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (cursor && state === 'ready') void load('more');
        }}
        ListFooterComponent={state === 'more' ? <Skeleton height={150} borderRadius={20} /> : null}
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
                  <Stop offset="1" stopColor="#1F2126" />
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
  header: { gap: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  title: { fontSize: 34, lineHeight: 48 },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  markAllText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 12, lineHeight: 15 },
  group: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  skeletons: { gap: 20 },
  pinned: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  pinnedMedia: { height: 197, justifyContent: 'flex-end', padding: 16, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -6, top: 5, transform: [{ rotate: '12deg' }] },
  badges: { flexDirection: 'row', gap: 8 },
  pinBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  pinText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.6 },
  pinnedBody: { gap: 8, padding: 20 },
  pinnedKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
});
