import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../../store/auth';
import { useConfirmLogout } from '../hooks/useConfirmLogout';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { eventsRepository } from '../repositories/EventsRepository';
import { leaderboardRepository } from '../repositories/LeaderboardRepository';

type Item = { label: string; icon: IconName; route: string; screen?: string };

/** Drawer routes, in order. `route` is the drawer screen; Settings is a pushed stack screen. */
const PRIMARY: Item[] = [
  { label: 'Home', icon: 'home', route: 'MainTabs', screen: 'HomeTab' },
  { label: 'Events', icon: 'calendar', route: 'MainTabs', screen: 'EventsTab' },
  { label: 'Leaderboard', icon: 'trophy', route: 'Leaderboard' },
  { label: 'Points & challenges', icon: 'target', route: 'Challenges' },
  { label: 'Hall of Fame', icon: 'sparkles', route: 'HallOfFame' },
  { label: 'Media', icon: 'image', route: 'Media' },
];
const SECONDARY: Item[] = [
  { label: 'Feedback & help', icon: 'message', route: 'Feedback' },
  { label: 'Settings', icon: 'settings', route: 'Settings' },
];

function isRegistrationOpen(e: { registration: { opens_at: string | null; closes_at: string } }, now: number) {
  const opens = e.registration.opens_at ? Date.parse(e.registration.opens_at) : 0;
  return opens <= now && now < Date.parse(e.registration.closes_at);
}

/** v2/Drawer — profile card, sections (active = current drawer route), Log out. */
export function DrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const confirmLogout = useConfirmLogout();
  const drawerRoute = state.routes[state.index];
  const current = drawerRoute?.name;

  // If inside MainTabs (BottomTabsLayout), determine the currently focused tab
  const childState = drawerRoute?.state;
  const activeTabName = childState?.routes?.[childState?.index ?? 0]?.name ?? 'HomeTab';

  // Badges and rank are nice-to-have: failures just hide them.
  const { data: openCount } = useAsyncResource(
    () =>
      eventsRepository
        .list({ status: ['upcoming', 'ongoing'], limit: 50 })
        .then((res) => res.events.filter((e) => isRegistrationOpen(e, Date.now())).length)
        .catch(() => 0),
    [],
  );
  const { data: myRank } = useAsyncResource(
    () => (user ? leaderboardRepository.findMyGlobalRank(user.id).catch(() => null) : Promise.resolve(null)),
    [user?.id],
  );

  const go = (route: string, screen?: string) => {
    navigation.closeDrawer();
    if (screen) {
      // Switching to a tab inside MainTabs shifts both the screen and bottom navigation bar
      (navigation as any).navigate(route, { screen });
    } else {
      // pop: reuse an existing copy of a stack route (Profile, Settings) instead of stacking another.
      navigation.navigate(route, undefined, { pop: true });
    }
  };

  const badge: Record<string, string | undefined> = {
    Events: openCount ? `${openCount} open` : undefined,
  };

  const meta = [
    user?.pointsBalance != null ? `${user.pointsBalance.toLocaleString()} pts` : null,
    myRank ? `#${myRank.rank}` : null,
    'View profile',
  ]
    .filter(Boolean)
    .join(' · ');

  const renderItem = (item: Item) => {
    const active = item.screen
      ? current === item.route && activeTabName === item.screen
      : current === item.route;
    const tint = active ? 'primary' : 'text';
    return (
      <Pressable
        key={item.screen ? `${item.route}-${item.screen}` : item.route}
        onPress={() => go(item.route, item.screen)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.item,
          active && {
            backgroundColor: withAlpha(colors.primary, 0.16),
            borderColor: withAlpha(colors.primary, 0.38),
            borderWidth: 1,
          },
          pressed && styles.pressed,
        ]}
      >
        <Icon name={item.icon} size={20} color={active ? 'primary' : 'textMuted'} />
        <Typography variant="body" color={tint} style={styles.itemLabel}>
          {item.label}
        </Typography>
        {badge[item.label] || badge[item.route] ? (
          <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
            <Typography variant="caption" color="primary" style={styles.badgeText}>
              {badge[item.label] || badge[item.route]}
            </Typography>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    >
      <Pressable
        onPress={() => go('Profile')}
        accessibilityRole="button"
        accessibilityLabel="View profile"
        style={({ pressed }) => [
          styles.profile,
          {
            backgroundColor: withAlpha(colors.surfaceInner, 0.85),
            borderColor: withAlpha(colors.border, 0.75),
            borderTopColor: withAlpha('#FFFFFF', 0.2),
          },
          pressed && styles.pressed,
        ]}
      >
        <Avatar name={user?.fullName || user?.username} uri={user?.avatar_url} size={48} />
        <View style={styles.profileText}>
          <Typography variant="body" color="text" style={styles.itemLabel} numberOfLines={1}>
            {user?.fullName || user?.username || 'Your profile'}
          </Typography>
          <Typography variant="bodySmall" color="textMuted" style={styles.meta} numberOfLines={1}>
            {meta}
          </Typography>
        </View>
        <Icon name="chevron-right" size={18} color="textMuted" />
      </Pressable>

      <View style={styles.group}>{PRIMARY.map(renderItem)}</View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.group}>{SECONDARY.map(renderItem)}</View>

      <View style={styles.spacer} />

      <Pressable
        onPress={() => {
          navigation.closeDrawer();
          void confirmLogout();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
      >
        <Icon name="arrow-left" size={20} color="dangerText" />
        <Typography variant="body" style={[styles.itemLabel, { color: colors.dangerText }]}>
          Log out
        </Typography>
      </Pressable>
      <Typography variant="mono" color="textMuted" style={styles.version}>
        BGSC 1.0.0
      </Typography>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 20 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  profileText: { flex: 1, gap: 4 },
  meta: { fontSize: 11 },
  group: { gap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12 },
  itemLabel: { flex: 1, fontFamily: FONT_FAMILIES.bodySemiBold },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15 },
  divider: { height: 1 },
  spacer: { flex: 1 },
  version: { fontSize: 10 },
  pressed: { opacity: 0.6 },
});
