/**
 * Nimbus UI · Liquid Navbar — "Waterline" for BGSC Mobile
 * Fluid droplet animation, frosted pill container, and tactile haptic feedback.
 * 100% native React Native: smooth 60fps, works seamlessly on iOS, Android, and Web.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { withAlpha } from '../theme/colors';

export type NimbusFx = 'plane' | 'drop' | 'spin' | 'glow' | 'wave' | 'pop' | 'none';

export type LiquidNavItem = {
  key: string;
  label: string;
  iconName?: IconName;
  icon?: React.ReactNode;
  fx?: NimbusFx;
  onPress?: () => void;
};

export type LiquidNavbarProps = {
  items: LiquidNavItem[];
  active: number;
  onChange?: (index: number, item: LiquidNavItem) => void;
  tone?: 'light' | 'dark';
  compact?: boolean;
  sound?: boolean;
  style?: ViewStyle;
};

/* ---------- Compatible Icon Helpers for React Native ---------- */
export const NimbusIcons = {
  home: 'home' as IconName,
  flights: 'calendar' as IconName,
  plane: 'calendar' as IconName,
  status: 'megaphone' as IconName,
  profile: 'user' as IconName,
  user: 'user' as IconName,
  megaphone: 'megaphone' as IconName,
  users: 'users' as IconName,
};

export function LiquidNavbar({
  items,
  active,
  onChange,
  tone = 'dark',
  compact = false,
  style,
}: LiquidNavbarProps) {
  const isDark = tone === 'dark';

  // Layout tracking for sliding indicator
  const [tabLayouts, setTabLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(64)).current;
  const isFirstLayout = useRef(true);

  // Animated icon pop on tab switch
  const iconScales = useRef(items.map(() => new Animated.Value(1))).current;

  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const animateToTab = useCallback(
    (index: number, immediate = false) => {
      const layout = tabLayouts[index];
      if (!layout) return;

      // Curved square (squircle) geometry: width nicely proportioned to 48dp height
      const targetW = Math.max(Math.min(layout.width - 12, 64), 52);
      const targetX = layout.x + (layout.width - targetW) / 2;

      if (immediate) {
        indicatorX.setValue(targetX);
        indicatorW.setValue(targetW);
        return;
      }

      Animated.parallel([
        Animated.spring(indicatorX, {
          toValue: targetX,
          friction: 8,
          tension: 70,
          useNativeDriver: false,
        }),
        Animated.spring(indicatorW, {
          toValue: targetW,
          friction: 8,
          tension: 70,
          useNativeDriver: false,
        }),
      ]).start();

      // Icon pop
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
    [tabLayouts, indicatorX, indicatorW, iconScales]
  );

  useEffect(() => {
    if (tabLayouts[active]) {
      if (isFirstLayout.current) {
        animateToTab(active, true);
        isFirstLayout.current = false;
      } else {
        animateToTab(active, false);
      }
    }
  }, [active, tabLayouts, animateToTab]);

  const handleTabLayout = (index: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => {
      if (prev[index]?.x === x && prev[index]?.width === width) return prev;
      return { ...prev, [index]: { x, width } };
    });
  };

  const handleSelect = (index: number) => {
    triggerHaptic();
    onChange?.(index, items[index]);
    items[index]?.onPress?.();
  };

  const bgTone = isDark ? 'rgba(12, 18, 34, 0.72)' : 'rgba(255, 255, 255, 0.85)';
  const borderTone = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)';
  const topBorderTone = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.95)';

  return (
    <View style={[styles.navOuter, style]}>
      <BlurView
        intensity={isDark ? 50 : 75}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.navContainer,
          {
            backgroundColor: bgTone,
            borderColor: borderTone,
            borderTopColor: topBorderTone,
          },
        ]}
      >
        {/* Specular Inner Glare Line along top edge */}
        <View pointerEvents="none" style={styles.navTopSheen} />

        {/* Sliding Liquid Droplet Indicator - Sleek Modern Orange Glass */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.droplet,
            {
              transform: [{ translateX: indicatorX }],
              width: indicatorW,
            },
          ]}
        >
          {/* Refined Liquid Orange Glass: Translucent body with specular gleam and refractive caustic */}
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              {/* Translucent Liquid Glass Body */}
              <LinearGradient id="liquidGlassBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FDBA74" stopOpacity={0.84} />
                <Stop offset="30%" stopColor="#FB923C" stopOpacity={0.72} />
                <Stop offset="75%" stopColor="#F97316" stopOpacity={0.76} />
                <Stop offset="100%" stopColor="#C2410C" stopOpacity={0.88} />
              </LinearGradient>
              {/* Glass Curvature Specular Sheen (top 55%) */}
              <LinearGradient id="glassCurvatureSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.42} />
                <Stop offset="40%" stopColor="#FFFFFF" stopOpacity={0.12} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
              </LinearGradient>
              {/* Bottom Refractive Caustic */}
              <LinearGradient id="glassBottomCaustic" x1="0%" y1="100%" x2="0%" y2="0%">
                <Stop offset="0%" stopColor="#FED7AA" stopOpacity={0.35} />
                <Stop offset="100%" stopColor="#FED7AA" stopOpacity={0.0} />
              </LinearGradient>
            </Defs>
            {/* Base Translucent Liquid Glass */}
            <Rect width="100%" height="100%" rx={16} ry={16} fill="url(#liquidGlassBody)" />
            {/* Glass Curvature Sheen */}
            <Rect width="100%" height="55%" rx={16} ry={16} fill="url(#glassCurvatureSheen)" />
            {/* Bottom Caustic Glow */}
            <Rect width="100%" height="30%" y="70%" rx={16} ry={16} fill="url(#glassBottomCaustic)" />
          </Svg>

          {/* Delicate Top Specular Edge */}
          <View pointerEvents="none" style={styles.dropletSheen} />
        </Animated.View>

        {/* Tabs */}
        {items.map((it, i) => {
          const isCurrent = i === active;
          const iconScale = iconScales[i] || 1;

          return (
            <Pressable
              key={it.key || `${it.label}-${i}`}
              onLayout={(e) => handleTabLayout(i, e)}
              onPress={() => handleSelect(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isCurrent }}
              accessibilityLabel={it.label}
              style={[styles.item, compact && styles.itemCompact]}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  { transform: [{ scale: iconScale }] },
                ]}
              >
                {it.icon ? (
                  it.icon
                ) : (
                  <Icon
                    name={it.iconName ?? 'home'}
                    size={19}
                    color={isCurrent ? '#FFFFFF' : isDark ? withAlpha('#FFFFFF', 0.65) : withAlpha('#0F172A', 0.65)}
                  />
                )}
              </Animated.View>

              <Typography
                variant="caption"
                style={[
                  styles.label,
                  {
                    color: isCurrent
                      ? '#FFFFFF'
                      : isDark
                      ? withAlpha('#FFFFFF', 0.65)
                      : withAlpha('#0F172A', 0.65),
                    fontFamily: isCurrent ? FONT_FAMILIES.bodyBold : FONT_FAMILIES.bodyMedium,
                    fontWeight: isCurrent ? '700' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {it.label}
              </Typography>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  navOuter: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  navContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 9999,
    borderWidth: 1,
    overflow: 'hidden',
    height: 56,
  },
  navTopSheen: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 9999,
  },
  droplet: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.70)',
    borderBottomColor: 'rgba(154, 52, 18, 0.50)',
    borderLeftColor: 'rgba(255, 255, 255, 0.28)',
    borderRightColor: 'rgba(255, 255, 255, 0.20)',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.50,
    shadowRadius: 10,
    elevation: 6,
  },
  dropletSheen: {
    position: 'absolute',
    top: 1.5,
    left: 8,
    right: 8,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 1,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 16,
    gap: 3,
    zIndex: 2,
  },
  itemCompact: {
    paddingVertical: 2,
    paddingHorizontal: 2,
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
