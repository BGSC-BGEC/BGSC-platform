import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { FONT_FAMILIES } from '../theme/typography';

export const TAB_ICONS: Record<string, IconName> = {
  HomeTab: 'home',
  AnnouncementsTab: 'megaphone',
  SocialTab: 'users',
};

/** v2/TabBar — Home · Announcements · Social; active tab gets the tinted pill. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        const tint = focused ? 'primary' : 'textMuted';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.tab}
          >
            <View style={[styles.pill, focused && { backgroundColor: colors.accentMuted }]}>
              <Icon name={TAB_ICONS[route.name] ?? 'home'} size={22} color={tint} />
            </View>
            <Typography variant="caption" color={tint} style={styles.label} numberOfLines={1}>
              {label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  pill: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999 },
  label: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15 },
});
