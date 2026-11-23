import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { FONT_FAMILIES } from '../theme/typography';
import { withAlpha } from '../theme/colors';

export const TAB_ICONS: Record<string, IconName> = {
  HomeTab: 'home',
  EventsTab: 'calendar',
  AnnouncementsTab: 'megaphone',
  ProfileTab: 'user',
  SocialTab: 'users',
};

const MAX_INDICATOR_WIDTH = 68;
const INDICATOR_GUTTER = 6;
const INDICATOR_RADIUS = 16;
const BAR_HEIGHT = 58;
const IS_IOS = Platform.OS === 'ios';

/**
 * Mobile Bottom TabBar:
 * Floating frosted-glass pill with a sliding liquid-glass squircle indicator.
 *
 * Layout: the indicator lives inside the same row as the tabs, so its position is
 * computed from the row's own width (not the pill's outer width, which includes
 * padding and border).
 *
 * Glass: real blur on iOS. Android's BlurView without a blur target only tints,
 * so the tint there is more opaque to stay legible over busy content.
 *
 * Shadows: kept on views without `overflow: hidden` (iOS clips shadows otherwise),
 * and no `elevation` on translucent views (Android draws grey artifacts through them).
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const routes = state.routes;
  const numTabs = routes.length;
  const activeIndex = state.index;

  // 0 until the row is measured; the indicator stays hidden until then.
  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const iconScales = useRef(routes.map(() => new Animated.Value(1))).current;
  const lastAnimatedIndex = useRef(activeIndex);

  const tabWidth = rowWidth > 0 ? rowWidth / numTabs : 0;
  const indicatorWidth = Math.max(0, Math.min(MAX_INDICATOR_WIDTH, tabWidth - INDICATOR_GUTTER));
  const targetX = useCallback(
    (index: number) => index * tabWidth + (tabWidth - indicatorWidth) / 2,
    [tabWidth, indicatorWidth],
  );

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Snap into place on (re)measure; spring + icon pop when the active tab changes.
  useEffect(() => {
    if (rowWidth <= 0) return;

    if (lastAnimatedIndex.current === activeIndex) {
      indicatorX.setValue(targetX(activeIndex));
      return;
    }
    lastAnimatedIndex.current = activeIndex;

    Animated.spring(indicatorX, {
      toValue: targetX(activeIndex),
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();

    const scale = iconScales[activeIndex];
    if (scale) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [activeIndex, rowWidth, targetX, indicatorX, iconScales]);

  const handleRowLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - rowWidth) > 0.5) setRowWidth(width);
  };

  // Liquid glass: a thin tint over a strong blur. Android has no real blur here, so
  // its tint stays heavier to keep labels legible over busy content.
  const tintTone = isDark
    ? IS_IOS ? 'rgba(16, 20, 32, 0.22)' : 'rgba(18, 22, 34, 0.9)'
    : IS_IOS ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.92)';
  // Rim: bright top edge, softer sides, darker bottom edge (thick glass catching light).
  const rim = {
    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.55)',
    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(255, 255, 255, 0.98)',
    borderBottomColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.1)',
  };
  const sheenTone = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.95)';
  // Curved-surface light: strong top highlight, faint bottom glow, diagonal streak.
  const highlight = isDark
    ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'] as const
    : ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as const;
  const bottomGlow = isDark
    ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)'] as const
    : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)'] as const;
  const streak = isDark
    ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)'] as const
    : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)'] as const;
  const inactiveColor = isDark ? withAlpha('#FFFFFF', 0.65) : withAlpha('#0F172A', 0.65);
  const activeColor = '#141821'; // dark on the coral pill, like the primary buttons (white is only 2.9:1)

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      {/* Shadow carrier: no clipping, so the iOS shadow is not cut off. */}
      <View style={styles.pillShadow}>
        {/* Glass body: clipped to the pill shape. */}
        <View style={[styles.pillGlass, rim]}>
          <BlurView
            pointerEvents="none"
            intensity={isDark ? 70 : 85}
            tint={
              IS_IOS
                ? isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'
                : isDark ? 'dark' : 'light'
            }
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintTone }]} />
          <ExpoLinearGradient
            pointerEvents="none"
            colors={highlight}
            locations={[0, 0.45, 0.6]}
            style={StyleSheet.absoluteFill}
          />
          <ExpoLinearGradient
            pointerEvents="none"
            colors={bottomGlow}
            style={styles.bottomGlow}
          />
          <ExpoLinearGradient
            pointerEvents="none"
            colors={streak}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0.3, 0.42, 0.54]}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={[styles.topSheen, { backgroundColor: sheenTone }]} />

          <View style={styles.tabsRow} onLayout={handleRowLayout}>
            {/* Sliding liquid orange glass squircle */}
            {indicatorWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.indicatorShadow,
                  { width: indicatorWidth, transform: [{ translateX: indicatorX }] },
                ]}
              >
                <View style={styles.indicatorGlass}>
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                      <LinearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#F0A48E" stopOpacity={0.95} />
                        <Stop offset="30%" stopColor="#E68A70" stopOpacity={0.9} />
                        <Stop offset="72%" stopColor="#DF7A5E" stopOpacity={0.92} />
                        <Stop offset="100%" stopColor="#B4553C" stopOpacity={0.96} />
                      </LinearGradient>
                      <LinearGradient id="glassSheenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
                        <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.12} />
                        <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                      </LinearGradient>
                      <LinearGradient id="glassCausticGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                        <Stop offset="0%" stopColor="#F6C8B9" stopOpacity={0.4} />
                        <Stop offset="100%" stopColor="#F6C8B9" stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#glassBodyGrad)" />
                    <Rect width="100%" height="52%" fill="url(#glassSheenGrad)" />
                    <Rect width="100%" height="34%" y="66%" fill="url(#glassCausticGrad)" />
                  </Svg>
                  <View pointerEvents="none" style={styles.indicatorSheen} />
                </View>
              </Animated.View>
            ) : null}

            {routes.map((route, index) => {
              const focused = activeIndex === index;
              const { options } = descriptors[route.key];
              const label =
                typeof options.tabBarLabel === 'string'
                  ? options.tabBarLabel
                  : options.title ?? route.name.replace(/Tab$/, '');
              const iconName = TAB_ICONS[route.name] ?? 'home';
              const iconScale = iconScales[index] ?? 1;
              const color = focused ? activeColor : inactiveColor;

              const onPress = () => {
                triggerHaptic();
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
                  <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
                    <Icon name={iconName} size={19} color={color} />
                  </Animated.View>
                  <Typography
                    variant="caption"
                    style={[
                      styles.label,
                      {
                        color,
                        fontFamily: focused ? FONT_FAMILIES.bodyBold : FONT_FAMILIES.bodyMedium,
                        fontWeight: focused ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  pillShadow: {
    width: '92%',
    maxWidth: 400,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      default: {},
    }),
  },
  pillGlass: {
    flex: 1,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  topSheen: {
    position: 'absolute',
    top: 1,
    left: 22,
    right: 22,
    height: 1.2,
    borderRadius: 1,
  },
  bottomGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorShadow: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: INDICATOR_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: '#DF7A5E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      default: {},
    }),
  },
  indicatorGlass: {
    flex: 1,
    borderRadius: INDICATOR_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(154, 52, 18, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
    borderRightColor: 'rgba(255, 255, 255, 0.22)',
  },
  indicatorSheen: {
    position: 'absolute',
    top: 1.5,
    left: 8,
    right: 8,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 1,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
  },
  label: {
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: -0.1,
  },
});
