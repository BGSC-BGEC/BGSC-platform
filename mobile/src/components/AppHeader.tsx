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

  const pillButton = [
    styles.pillBtn,
    {
      backgroundColor: withAlpha(colors.surface, 0.75),
      borderColor: withAlpha('#FFFFFF', 0.22),
    },
    Platform.OS === 'web' && ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
    } as any),
    shadow('flat'),
  ];

  const isBrand = title === 'BGSC';

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: withAlpha(colors.background, 0.88),
          borderBottomColor: withAlpha(colors.border, 0.75),
          paddingTop: insets.top + 10,
        },
        Platform.OS === 'web' && ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.15)',
        } as any),
      ]}
    >
      {showBackButton ? (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [pillButton, pressed && styles.pressed]}
        >
          <Icon name="arrow-left" size={22} color="text" />
        </Pressable>
      ) : showMenuButton ? (
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={8}
          style={({ pressed }) => [pillButton, pressed && styles.pressed]}
        >
          <Icon name="menu" size={22} color="text" />
        </Pressable>
      ) : null}

      {isBrand ? (
        <View style={styles.brandTitleWrap}>
          <Typography variant="h2" color="text" style={styles.brandTitle}>
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
        <View style={styles.rightActions}>
          <Pressable
            // pop: go back to an existing copy instead of stacking another (v7 navigate always pushes)
            onPress={() => navigation.navigate('Notifications', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={6}
            style={({ pressed }) => [pillButton, styles.bell, pressed && styles.pressed]}
          >
            <Icon name="bell" size={20} color="text" />
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
          <Pressable
            onPress={() => navigation.navigate('Profile', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={6}
            style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}
          >
            <Avatar name={user?.fullName || user?.username} uri={user?.avatar_url} size={38} ring />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  pillBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  bell: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  brandTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  brandTitle: {
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 24,
    letterSpacing: 0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPressable: {
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
});
