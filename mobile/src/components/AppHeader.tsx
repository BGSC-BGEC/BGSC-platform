import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../typography/Typography';
import { Icon } from '../icons/Icon';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import { FONT_FAMILIES } from '../theme/typography';
import { useAuth } from '../../store/auth';
import { notificationsRepository } from '../repositories/NotificationsRepository';

interface AppHeaderProps {
  title?: string;
  /** Pushed screens: arrow back instead of the drawer button */
  showBackButton?: boolean;
  showMenuButton?: boolean;
  /** Bell + avatar on the right */
  showNotifications?: boolean;
}

const UNREAD_POLL_MS = 30000;

/**
 * Top application header with navigation actions and status indicators.
 */
export function AppHeader({
  title = 'BGSC',
  showBackButton = false,
  showMenuButton = true,
  showNotifications = true,
}: AppHeaderProps) {
  const { colors, shadow } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  // Refresh the dot whenever the screen comes back into focus, and poll while it is visible.
  useFocusEffect(
    useCallback(() => {
      if (!showNotifications) return undefined;
      let alive = true;
      const load = () =>
        notificationsRepository
          .getUnreadCount()
          .then((n) => alive && setUnread(n))
          .catch(() => undefined);
      load();
      const timer = setInterval(load, UNREAD_POLL_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [showNotifications]),
  );

  const isBrand = title === 'BGSC';

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: withAlpha(colors.background, 0.92),
          paddingTop: insets.top + 4,
        },
      ]}
    >
      {showBackButton ? (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: withAlpha(colors.surface, 0.72),
              borderColor: withAlpha(colors.border, 0.5),
            },
            shadow('flat'),
            pressed && styles.pressed,
          ]}
        >
          <Icon name="arrow-left" size={20} color="text" />
        </Pressable>
      ) : showMenuButton ? (
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: withAlpha(colors.surface, 0.72),
              borderColor: withAlpha(colors.border, 0.5),
            },
            shadow('flat'),
            pressed && styles.pressed,
          ]}
        >
          <Icon name="menu" size={20} color="text" />
        </Pressable>
      ) : (
        <View style={styles.actionSpacer} />
      )}

      {isBrand ? (
        <View style={styles.brandTitleWrap}>
          <Typography variant="h3" color="text" style={styles.brandTitle}>
            BGSC
          </Typography>
          <View style={[styles.brandDot, { backgroundColor: colors.primary }]} />
        </View>
      ) : (
        <Typography variant="h3" color="text" numberOfLines={1} style={styles.title}>
          {title}
        </Typography>
      )}

      {showNotifications ? (
        <View
          style={[
            styles.actionsCapsule,
            {
              backgroundColor: withAlpha(colors.surface, 0.72),
              borderColor: withAlpha(colors.border, 0.5),
            },
            shadow('flat'),
          ]}
        >
          <Pressable
            onPress={() => navigation.navigate('Notifications', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={8}
            style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]}
          >
            <Icon name="bell" size={18} color="text" />
            {unread > 0 ? (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.surface,
                  },
                ]}
              />
            ) : null}
          </Pressable>

          <View style={[styles.capsuleDivider, { backgroundColor: withAlpha(colors.border, 0.6) }]} />

          <Pressable
            onPress={() => navigation.navigate('Profile', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={6}
            style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}
          >
            <Avatar name={user?.fullName || user?.username} uri={user?.avatar_url} size={28} ring={false} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 6,
    zIndex: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 2,
  },
  actionSpacer: {
    width: 38,
    height: 38,
  },
  actionsCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingLeft: 4,
    paddingRight: 4,
    gap: 1,
    zIndex: 2,
  },
  capsuleBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  capsuleDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 2,
  },
  avatarPressable: {
    borderRadius: 14,
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    borderWidth: 1.5,
  },
  brandTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  brandTitle: {
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 19,
    letterSpacing: 1.1,
  },
  brandDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    marginBottom: 5,
  },
  title: {
    flex: 1,
    fontSize: 17,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },
});
