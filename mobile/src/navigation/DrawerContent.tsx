import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Avatar } from '../components/Avatar';
import { BgscLogo } from '../components/BgscLogo';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { GLASS_ACTIVE_FILL, GLASS_ACTIVE_GLOW, GLASS_ACTIVE_INK, glassTokens } from './glass';
import { GlassSurface } from './GlassSurface';
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

/**
 * Side drawer in the bottom tab bar's design language: a floating liquid-glass panel,
 * pill-shaped rows, the active row as the coral pill with dark ink, haptic taps.
 * Profile card, sections (active = current drawer route), Log out.
 */
export function DrawerContent({ state, navigation }: DrawerContentComponentProps) {
  const { colors, isDark } = useTheme();
  const glass = glassTokens(isDark);
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

  const tap = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = (item: Item) => {
    const active = item.screen
      ? current === item.route && activeTabName === item.screen
      : current === item.route;
    const ink = active ? GLASS_ACTIVE_INK : glass.inactiveInk;
    const badgeText = badge[item.label] || badge[item.route];
    return (
      <Pressable
        key={item.screen ? `${item.route}-${item.screen}` : item.route}
        onPress={() => {
          tap();
          go(item.route, item.screen);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.pressed]}
      >
        {/* Active item = the tab bar's coral pill. */}
        {active ? (
          <LinearGradient
            pointerEvents="none"
            colors={GLASS_ACTIVE_FILL}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.pill]}
          />
        ) : null}
        <Icon name={item.icon} size={20} color={ink} />
        <Typography
          variant="body"
          style={[
            styles.itemLabel,
            active ? { color: GLASS_ACTIVE_INK, fontFamily: FONT_FAMILIES.bodyBold } : { color: colors.text },
          ]}
        >
          {item.label}
        </Typography>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: active ? 'rgba(20, 24, 33, 0.14)' : colors.accentMuted }]}>
            <Typography variant="caption" style={[styles.badgeText, { color: active ? GLASS_ACTIVE_INK : colors.primary }]}>
              {badgeText}
            </Typography>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    // Full-height glass panel attached to the left edge; only the right corners round.
    <View style={styles.frame}>
      <GlassSurface radius={PANEL_RADIUS} style={styles.panel}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => {
              tap();
              go('MainTabs', 'ProfileTab');
            }}
            accessibilityRole="button"
            accessibilityLabel="View profile"
            style={({ pressed }) => [
              styles.profile,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.55)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
              },
              pressed && styles.pressed,
            ]}
          >
            <Avatar name={user?.fullName || user?.username} uri={user?.avatar_url} size={48} />
            <View style={styles.profileText}>
              <Typography variant="body" color="text" style={styles.itemLabel} numberOfLines={1}>
                {user?.fullName || user?.username || 'Your profile'}
              </Typography>
              <Typography variant="bodySmall" style={[styles.meta, { color: glass.inactiveInk }]} numberOfLines={1}>
                {meta}
              </Typography>
            </View>
            <Icon name="chevron-right" size={18} color={glass.inactiveInk} />
          </Pressable>

          <View style={styles.group}>{PRIMARY.map(renderItem)}</View>
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)' }]} />
          <View style={styles.group}>{SECONDARY.map(renderItem)}</View>

          <View style={styles.spacer} />

          <Pressable
            onPress={() => {
              tap();
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
          <View style={styles.versionRow}>
            <BgscLogo size={18} />
            <Typography variant="mono" style={[styles.version, { color: glass.inactiveInk }]}>
              BGSC 1.0.0
            </Typography>
          </View>
        </ScrollView>
      </GlassSurface>
    </View>
  );
}

/** Rounding on the panel's right-hand corners (the left side meets the screen edge). */
const PANEL_RADIUS = 28;
/** Menu rows are pills, like the tab bar's active indicator. */
const ITEM_HEIGHT = 46;

const styles = StyleSheet.create({
  frame: { flex: 1 },
  // Square on the left (flush with the screen edge), rounded on the right; no left
  // border so the rim doesn't draw a line down the screen edge.
  panel: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
  },
  content: { flexGrow: 1, paddingHorizontal: 12, gap: 18 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  profileText: { flex: 1, gap: 4 },
  meta: { fontSize: 11 },
  group: { gap: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: ITEM_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: ITEM_HEIGHT / 2,
  },
  // Coloured glow under the active pill (iOS), like the tab bar's indicator.
  itemActive: Platform.select({
    ios: {
      shadowColor: GLASS_ACTIVE_GLOW,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
    },
    default: {},
  }) as object,
  pill: { borderRadius: ITEM_HEIGHT / 2 },
  itemLabel: { flex: 1, fontFamily: FONT_FAMILIES.bodySemiBold },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginHorizontal: 8 },
  spacer: { flex: 1 },
  versionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  version: { fontSize: 10 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
