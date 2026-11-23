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
import * as Haptics from 'expo-haptics';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { FONT_FAMILIES } from '../theme/typography';
import { GLASS_ACTIVE_FILL, GLASS_ACTIVE_GLOW, GLASS_ACTIVE_INK, glassTokens } from './glass';

export const TAB_ICONS: Record<string, IconName> = {
  HomeTab: 'home',
  EventsTab: 'calendar',
  AnnouncementsTab: 'megaphone',
  ProfileTab: 'user',
  SocialTab: 'users',
};

const MAX_INDICATOR_WIDTH = 84;
const INDICATOR_GUTTER = 6;
const BAR_HEIGHT = 58;
/** Gap between the indicator and the bar's top/bottom edges. */
const INDICATOR_INSET = 4;
/**
 * Pill, like the bar: radius = half its height. That also equals the bar's radius
 * minus the inset, so the indicator's ends run parallel to the bar's ends.
 */
const INDICATOR_RADIUS = BAR_HEIGHT / 2 - INDICATOR_INSET;
/** Active-tab pill fill (shared with the drawer's active item). */
const INDICATOR_FILL = GLASS_ACTIVE_FILL;

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

  // Liquid glass material, shared with the side drawer (see ./glass.ts).
  const glass = glassTokens(isDark);
  const tintTone = glass.tint;
  const rim = glass.rim;
  const highlight = glass.highlight;
  const bottomGlow = glass.bottomGlow;
  const streak = glass.streak;
  const inactiveColor = glass.inactiveInk;
  const activeColor = GLASS_ACTIVE_INK;

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
            intensity={glass.blurIntensity}
            tint={glass.blurTint}
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
                {/* Solid, fully opaque fill edge to edge: no border ring, no white overlays. */}
                <View style={styles.indicatorGlass}>
                  <ExpoLinearGradient
                    colors={INDICATOR_FILL}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
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
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    borderRadius: INDICATOR_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: GLASS_ACTIVE_GLOW,
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
