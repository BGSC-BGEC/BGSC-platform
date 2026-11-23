import React, { useCallback, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, View, type StatusBarStyle } from 'react-native';
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
  /**
   * 'brand': orange band with white title/actions and a rounded sheet edge below it (section roots).
   * 'plain': the translucent header (pushed screens). Defaults to 'brand' on screens with the menu button.
   */
  tone?: 'brand' | 'plain';
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
  tone,
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
  const brandTone = (tone ?? (showMenuButton && !showBackButton ? 'brand' : 'plain')) === 'brand';

  // White status-bar icons over the orange band, only while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      if (!brandTone) return undefined;
      const entry = StatusBar.pushStackEntry({ barStyle: 'light-content' as StatusBarStyle, animated: true });
      return () => StatusBar.popStackEntry(entry);
    }, [brandTone]),
  );

  const fg = brandTone ? colors.white : colors.text;
  const buttonSkin = brandTone
    ? { backgroundColor: withAlpha(colors.white, 0.18), borderColor: withAlpha(colors.white, 0.28) }
    : { backgroundColor: withAlpha(colors.surface, 0.72), borderColor: withAlpha(colors.border, 0.5) };
  const buttonShadow = brandTone ? null : shadow('flat');

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: brandTone ? colors.primary : withAlpha(colors.background, 0.92),
          paddingTop: insets.top + (brandTone ? 2 : 4),
        },
      ]}
    >
    <View style={[styles.header, brandTone && styles.headerBrand]}>
      {showBackButton ? (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionBtn,
            buttonSkin,
            buttonShadow,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="arrow-left" size={20} color={fg} />
        </Pressable>
      ) : showMenuButton ? (
        <Pressable
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          hitSlop={10}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.menuBtn,
            buttonSkin,
            brandTone && styles.menuBtnBrand,
            buttonShadow,
            pressed && styles.pressed,
          ]}
        >
          {/* Staggered two-line glyph: long bar over a short one, left-aligned. */}
          <View style={styles.menuGlyph}>
            <View style={[styles.menuBar, styles.menuBarLong, { backgroundColor: fg }]} />
            <View style={[styles.menuBar, styles.menuBarShort, { backgroundColor: brandTone ? fg : colors.primary }]} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.actionSpacer} />
      )}

      {isBrand ? (
        <View style={styles.brandTitleWrap}>
          <Typography variant="h3" color={fg} style={styles.brandTitle}>
            BGSC
          </Typography>
          <View style={[styles.brandDot, { backgroundColor: brandTone ? colors.white : colors.primary }]} />
        </View>
      ) : (
        <Typography variant="h3" color={fg} numberOfLines={1} style={styles.title}>
          {title}
        </Typography>
      )}

      {showNotifications ? (
        <View
          style={[
            styles.actionsCapsule,
            buttonSkin,
            buttonShadow,
          ]}
        >
          <Pressable
            onPress={() => navigation.navigate('Notifications', undefined, { pop: true })}
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={8}
            style={({ pressed }) => [styles.capsuleBtn, pressed && styles.pressed]}
          >
            <Icon name="bell" size={18} color={fg} />
            {unread > 0 ? (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: brandTone ? colors.white : colors.primary,
                    borderColor: brandTone ? colors.primary : colors.surface,
                  },
                ]}
              />
            ) : null}
          </Pressable>

          <View style={[styles.capsuleDivider, { backgroundColor: brandTone ? withAlpha(colors.white, 0.35) : withAlpha(colors.border, 0.6) }]} />

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
    {brandTone ? <View style={[styles.sheetLip, { backgroundColor: colors.background }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  headerBrand: {
    paddingTop: 0,
    paddingBottom: 10,
  },
  // The top of the content "sheet": the screen's own background with rounded corners, so the
  // orange band reads as sitting behind the page (the list below continues the same colour).
  sheetLip: {
    height: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  menuBtn: {
    borderRadius: 19,
  },
  // On orange: a soft frosted disc, no hard outline.
  menuBtnBrand: {
    borderColor: 'transparent',
  },
  menuGlyph: {
    width: 18,
    gap: 5,
    alignItems: 'flex-start',
  },
  menuBar: {
    height: 2.25,
    borderRadius: 2,
  },
  menuBarLong: {
    width: 18,
  },
  menuBarShort: {
    width: 11,
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
