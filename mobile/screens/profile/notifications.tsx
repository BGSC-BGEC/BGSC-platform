import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ProfileLayout } from './profile-layout';
import { notificationsRepository, type ApiNotification } from '../../src/repositories/NotificationsRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { EmptyState } from '../../src/feedback/EmptyState';
import { usePopup } from '../../src/popups/PopupProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { getErrorMessage } from '../../src/api/client';
import { formatRelative } from '../../src/utils/format';
import { notificationTarget } from '../../src/utils/account';

type Tab = 'all' | 'unread';
const TABS: ReadonlyArray<{ label: string; value: Tab }> = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
];

const DAY = 24 * 60 * 60 * 1000;

/** Today / This week / Earlier, in that order, keeping the inbox's own order inside each group. */
function groupByAge(items: ApiNotification[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const groups: Array<{ title: string; items: ApiNotification[] }> = [
    { title: 'Today', items: [] },
    { title: 'This week', items: [] },
    { title: 'Earlier', items: [] },
  ];
  for (const item of items) {
    const t = new Date(item.created_at).getTime();
    const g = t >= today ? 0 : t >= today - 6 * DAY ? 1 : 2;
    groups[g]!.items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

/**
 * Notifications, laid out like an activity feed: orange brand bar on top, then plain rows grouped by
 * age with hairlines between them. Tap a row to open it; long-press to dismiss it.
 */
export default function Notifications() {
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = tab === 'unread' ? { unread: true } : {};
  const inbox = useAsyncResource(() => notificationsRepository.inbox(query), [tab]);

  const act = async (task: () => Promise<unknown>, refresh = true) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
      if (refresh) await inbox.reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const open = (item: ApiNotification) =>
    void act(async () => {
      if (!item.read_at) await notificationsRepository.markAsRead(item._id);
      const target = notificationTarget(item.data);
      navigation.navigate(target.route, target.params);
    });

  const dismiss = async (item: ApiNotification) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await popup.confirm({ title: 'Dismiss notification?', message: item.title, confirmLabel: 'Dismiss' });
    if (ok) void act(() => notificationsRepository.deleteNotification(item._id));
  };

  const loadMore = () =>
    void act(async () => {
      const cursor = inbox.data?.next_cursor;
      if (!cursor) return;
      const page = await notificationsRepository.inbox({ cursor, ...query });
      inbox.setData((prev) =>
        prev
          ? {
              notifications: [
                ...prev.notifications,
                ...page.notifications.filter((n) => !prev.notifications.some((old) => old._id === n._id)),
              ],
              next_cursor: page.next_cursor,
            }
          : page,
      );
    }, false);

  const items = inbox.data?.notifications ?? [];
  const groups = useMemo(() => groupByAge(items), [items]);
  const hasUnread = items.some((n) => !n.read_at);

  return (
    <ProfileLayout
      title="Notifications"
      brandHeader
      showNotifications={false}
      refreshing={inbox.refreshing}
      onRefresh={() => void inbox.reload()}
    >
      {/* All · Unread as text tabs, Mark all read on the right */}
      <View style={styles.toolbar}>
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Pressable
                key={t.value}
                onPress={() => {
                  if (active) return;
                  void Haptics.selectionAsync();
                  setTab(t.value);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                hitSlop={8}
              >
                <Typography color={active ? 'text' : 'textMuted'} style={active ? [styles.tabText, styles.tabTextActive] : styles.tabText}>
                  {t.label}
                </Typography>
                <View style={[styles.tabLine, { backgroundColor: active ? colors.primary : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
        {hasUnread ? (
          <Pressable
            onPress={() => void act(() => notificationsRepository.markAllAsRead())}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Typography color="primary" style={styles.markAll}>
              Mark all read
            </Typography>
          </Pressable>
        ) : null}
      </View>

      {error || inbox.error ? <ErrorState message={error || inbox.error || ''} onRetry={() => void inbox.reload()} /> : null}

      {inbox.loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={12} width="90%" />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          title={tab === 'unread' ? 'No unread notifications' : 'You’re all caught up'}
          description="Your notifications will appear here."
          icon="bell"
        />
      ) : (
        groups.map((group) => (
          <View key={group.title}>
            <Typography color="text" style={styles.groupTitle}>
              {group.title}
            </Typography>
            {group.items.map((item, i) => {
              const unread = !item.read_at;
              return (
                <Pressable
                  key={item._id}
                  onPress={() => open(item)}
                  onLongPress={() => void dismiss(item)}
                  delayLongPress={350}
                  accessibilityRole="button"
                  accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.body}`}
                  accessibilityHint="Opens it. Long-press to dismiss."
                  accessibilityActions={[{ name: 'dismiss', label: 'Dismiss' }]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'dismiss') void dismiss(item);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    i < group.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  {/* Unread marker: a small dot in the gutter; read rows keep the space so titles align */}
                  <View style={[styles.dot, { backgroundColor: unread ? colors.primary : 'transparent' }]} />
                  <View style={styles.rowBody}>
                    <View style={styles.rowHead}>
                      <Typography
                        color="text"
                        style={unread ? [styles.title, styles.titleUnread] : styles.title}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Typography>
                      <Typography color="textMuted" style={styles.time}>
                        {formatRelative(item.created_at)}
                      </Typography>
                    </View>
                    {item.body ? (
                      <Typography color="textMuted" style={styles.body} numberOfLines={2}>
                        {item.body}
                      </Typography>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      )}

      {inbox.data?.next_cursor ? (
        <Pressable onPress={loadMore} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.loadMore, pressed && styles.pressed]}>
          <Typography color="primary" style={styles.markAll}>
            {busy ? 'Loading…' : 'Show older'}
          </Typography>
        </Pressable>
      ) : null}
    </ProfileLayout>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', gap: 22 },
  tabText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 16, lineHeight: 22 },
  tabTextActive: { fontFamily: FONT_FAMILIES.bodyBold },
  tabLine: { height: 2, borderRadius: 1, marginTop: 6 },
  markAll: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  groupTitle: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 15, lineHeight: 20, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  rowBody: { flex: 1, gap: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  title: { flex: 1, fontFamily: FONT_FAMILIES.bodyMedium, fontSize: 15, lineHeight: 21 },
  titleUnread: { fontFamily: FONT_FAMILIES.bodyBold },
  time: { fontSize: 12.5, lineHeight: 18 },
  body: { fontSize: 14, lineHeight: 20 },
  skeletons: { gap: 22, paddingTop: 6 },
  skeletonRow: { gap: 8, paddingLeft: 18 },
  loadMore: { alignSelf: 'center', paddingVertical: 6 },
  pressed: { opacity: 0.6 },
});
