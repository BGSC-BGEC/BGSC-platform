import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DrawerActions, useFocusEffect, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../typography/Typography';
import { Icon } from '../icons/Icon';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeProvider';
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

/** v2/AppHeader — drawer or back button, title, bell (→ Notifications) and avatar (→ Profile). */
export function AppHeader({
  title = 'BGSC',
  showBackButton = false,
  showMenuButton = true,
  showNotifications = true,
}: AppHeaderProps) {
  const { colors } = useTheme();
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

  const squareButton = [styles.square, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
      {showBackButton ? (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={({ pressed }) => [squareButton, pressed && styles.pressed]}
        >
          <Icon name="arrow-left" size={24} color="text" />
        </Pressable>
      ) : showMenuButton ? (
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={8}
          style={({ pressed }) => [squareButton, pressed && styles.pressed]}
        >
          <Icon name="menu" size={24} color="text" />
        </Pressable>
      ) : null}

      <Typography variant="h3" color="text" numberOfLines={1} style={styles.title}>
        {title}
      </Typography>

      {showNotifications ? (
        <>
          <Pressable
            // pop: go back to an existing copy instead of stacking another (v7 navigate always pushes)
            onPress={() => navigation.navigate('Notifications', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={6}
            style={({ pressed }) => [squareButton, styles.bell, pressed && styles.pressed]}
          >
            <Icon name="bell" size={24} color="text" />
            {unread > 0 ? <View style={[styles.dot, { backgroundColor: colors.danger, borderColor: colors.surface }]} /> : null}
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Profile', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar name={user?.fullName || user?.username} uri={user?.avatar_url} size={40} />
          </Pressable>
        </>
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
    paddingBottom: 12,
  },
  square: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  bell: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  title: { flex: 1 },
  pressed: { opacity: 0.6 },
});
