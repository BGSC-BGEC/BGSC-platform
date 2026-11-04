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

const SQUIRCLE_WIDTH = 68;

/**
 * Mobile Bottom TabBar:
 * Floating frosted pill capsule with sliding liquid-glass squircle indicator.
 * Matches Image 2 layout with the refined curved square (squircle) glass aesthetic.
 * 100% native on iOS and Android.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const routes = state.routes;
  const numTabs = routes.length;
  const activeIndex = state.index;

  const [barWidth, setBarWidth] = useState<number>(360);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  // Tab bounce scale values
  const iconScales = useRef(routes.map(() => new Animated.Value(1))).current;

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const getTargetX = useCallback(
    (index: number, containerW: number) => {
      const tabW = containerW / numTabs;
      return index * tabW + (tabW - SQUIRCLE_WIDTH) / 2;
    },
    [numTabs]
  );

  const animateToTab = useCallback(
    (index: number, immediate = false, containerW = barWidth) => {
      const targetX = getTargetX(index, containerW);

      if (immediate) {
        indicatorX.setValue(targetX);
        return;
      }

      Animated.spring(indicatorX, {
        toValue: targetX,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }).start();

      // Icon pop micro-interaction
      if (iconScales[index]) {
        Animated.sequence([
          Animated.timing(iconScales[index], {
            toValue: 1.18,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(iconScales[index], {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    [barWidth, getTargetX, indicatorX, iconScales]
  );

  const handleBarLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - barWidth) > 1) {
      setBarWidth(width);
      if (isFirstRender.current) {
        animateToTab(activeIndex, true, width);
        isFirstRender.current = false;
      } else {
        animateToTab(activeIndex, false, width);
      }
    }
  };

  useEffect(() => {
    if (!isFirstRender.current) {
      animateToTab(activeIndex, false);
    }
  }, [activeIndex, animateToTab]);

  const bgTone = isDark ? 'rgba(16, 20, 32, 0.94)' : 'rgba(255, 255, 255, 0.94)';
  const borderTone = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)';
  const topBorderTone = isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.95)';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View
        onLayout={handleBarLayout}
        style={[
          styles.pillBar,
          {
            backgroundColor: bgTone,
            borderColor: borderTone,
            borderTopColor: topBorderTone,
          },
        ]}
      >
        {/* Specular Glare Line along top edge */}
        <View pointerEvents="none" style={styles.topSheen} />

        {/* Sliding Liquid Orange Glass Squircle (Curved Square) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.squircleIndicator,
            {
              transform: [{ translateX: indicatorX }],
            },
          ]}
        >
          {/* Multi-layer SVG Liquid Glass with Specular Curvature & Caustics */}
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              {/* Rich Translucent Orange Glass Body */}
              <LinearGradient id="glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FDBA74" stopOpacity={0.92} />
                <Stop offset="28%" stopColor="#FB923C" stopOpacity={0.82} />
                <Stop offset="72%" stopColor="#F97316" stopOpacity={0.85} />
                <Stop offset="100%" stopColor="#C2410C" stopOpacity={0.95} />
              </LinearGradient>
              {/* Specular Curvature Reflection Highlight (top 50%) */}
              <LinearGradient id="glassSheenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.55} />
                <Stop offset="42%" stopColor="#FFFFFF" stopOpacity={0.16} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
              </LinearGradient>
              {/* Bottom Caustic Glow Reflection */}
              <LinearGradient id="glassCausticGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <Stop offset="0%" stopColor="#FED7AA" stopOpacity={0.38} />
                <Stop offset="100%" stopColor="#FED7AA" stopOpacity={0.0} />
              </LinearGradient>
            </Defs>
            {/* Base Translucent Liquid Body */}
            <Rect width="100%" height="100%" rx={16} ry={16} fill="url(#glassBodyGrad)" />
            {/* Top Curvature Glass Sheen */}
            <Rect width="100%" height="52%" rx={16} ry={16} fill="url(#glassSheenGrad)" />
            {/* Bottom Caustic Glow */}
            <Rect width="100%" height="32%" y="68%" rx={16} ry={16} fill="url(#glassCausticGrad)" />
          </Svg>

          {/* Crisp Specular Light Edge at very top */}
          <View pointerEvents="none" style={styles.squircleSheen} />
        </Animated.View>

        {/* Tab Items */}
        {routes.map((route, index) => {
          const focused = activeIndex === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name.replace(/Tab$/, '');

          const iconName = TAB_ICONS[route.name] ?? 'home';
          const iconScale = iconScales[index] || 1;

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

          const activeColor = '#FFFFFF';
          const inactiveColor = isDark
            ? withAlpha('#FFFFFF', 0.65)
            : withAlpha('#0F172A', 0.65);

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.tab}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  { transform: [{ scale: iconScale }] },
                ]}
              >
                <Icon
                  name={iconName}
                  size={19}
                  color={focused ? activeColor : inactiveColor}
                />
              </Animated.View>

              <Typography
                variant="caption"
                style={[
                  styles.label,
                  {
                    color: focused ? activeColor : inactiveColor,
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
  pillBar: {
    width: '92%',
    maxWidth: 400,
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 9999,
    borderWidth: 1,
    position: 'relative',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 9999,
  },
  squircleIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    width: SQUIRCLE_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(154, 52, 18, 0.50)',
    borderLeftColor: 'rgba(255, 255, 255, 0.30)',
    borderRightColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  squircleSheen: {
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
    zIndex: 2,
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
