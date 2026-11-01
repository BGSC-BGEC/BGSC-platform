import React from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidNavbar, NimbusIcons, type LiquidNavItem } from './LiquidNavbar';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import { FONT_FAMILIES } from '../theme/typography';

export const TAB_ICONS: Record<string, IconName> = {
  HomeTab: 'home',
  EventsTab: 'calendar',
  AnnouncementsTab: 'megaphone',
  ProfileTab: 'user',
  SocialTab: 'users',
};

/**
 * Waterline Liquid TabBar:
 * On Web: Full WebGL shader, fluid droplet splitting/merging, SVG refraction filter,
 * cursor meniscus, caustics, and synthesized water sound effects.
 * On Native: High-performance floating frosted pill with smooth active indicator.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, shadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const orangeAccent = colors.primary || '#f97316';

  // 1. Web Implementation: Full Liquid Crystal Navbar with WebGL shader & physics
  if (Platform.OS === 'web') {
    const navItems: LiquidNavItem[] = state.routes.map((route, index) => {
      const { options } = descriptors[route.key];
      const label =
        typeof options.tabBarLabel === 'string'
          ? options.tabBarLabel
          : options.title ?? route.name.replace(/Tab$/, '');

      let icon = NimbusIcons.home;
      let fx: LiquidNavItem['fx'] = 'glow';

      if (route.name === 'HomeTab') {
        icon = NimbusIcons.home;
        fx = 'glow';
      } else if (route.name === 'EventsTab') {
        icon = NimbusIcons.flights;
        fx = 'plane';
      } else if (route.name === 'AnnouncementsTab') {
        icon = NimbusIcons.status;
        fx = 'drop';
      } else if (route.name === 'ProfileTab') {
        icon = NimbusIcons.profile;
        fx = 'wave';
      } else if (route.name === 'SocialTab') {
        icon = NimbusIcons.user;
        fx = 'wave';
      }

      return {
        key: route.key,
        label,
        icon,
        fx,
        onPress: () => {
          const focused = state.index === index;
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        },
      };
    });

    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.webWrapper,
          {
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        <LiquidNavbar
          items={navItems}
          active={state.index}
          tone={isDark ? 'dark' : 'light'}
          sound={true}
        />
      </View>
    );
  }

  // 2. Native Fallback (iOS / Android)
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.nativeWrapper,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View
        style={[
          styles.pillBar,
          {
            backgroundColor: isDark
              ? withAlpha(colors.surface, 0.85)
              : withAlpha(colors.surface, 0.92),
            borderColor: isDark
              ? withAlpha('#FFFFFF', 0.15)
              : withAlpha('#000000', 0.08),
          },
          shadow('elevated'),
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name.replace(/Tab$/, '');

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
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
              <View
                style={[
                  styles.itemCapsule,
                  focused && [
                    styles.itemCapsuleActive,
                    {
                      backgroundColor: orangeAccent,
                      shadowColor: orangeAccent,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.38,
                      shadowRadius: 10,
                      elevation: 6,
                    },
                  ],
                ]}
              >
                <Icon
                  name={TAB_ICONS[route.name] ?? 'home'}
                  size={19}
                  color={focused ? '#FFFFFF' : 'textMuted'}
                />
                <Typography
                  variant="caption"
                  color={focused ? '#FFFFFF' : 'textMuted'}
                  style={[
                    styles.label,
                    focused ? styles.activeLabel : styles.inactiveLabel,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  nativeWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 9999,
    borderWidth: 1,
    minWidth: 280,
    maxWidth: 420,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCapsule: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    minWidth: 64,
    minHeight: 50,
    gap: 3,
  },
  itemCapsuleActive: {
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: -0.1,
  },
  activeLabel: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inactiveLabel: {
    fontFamily: FONT_FAMILIES.bodyMedium,
    fontWeight: '500',
  },
});
