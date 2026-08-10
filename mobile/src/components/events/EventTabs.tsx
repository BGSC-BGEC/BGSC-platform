import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { EventStatus } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeStore } from '@/core/stores/themeStore';
import { useColors } from '@/hooks/use-colors';

/** Teal-600 — spec §2.4 active filter chip fill (not accent/orange). */
const FILTER_ACTIVE_BG = '#235347';

export type EventsTabKey = 'leagues' | 'bgec' | 'fitsoc' | 'general';

const TABS: { key: EventsTabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'leagues', label: 'Leagues', icon: 'trophy-outline' },
  { key: 'bgec', label: 'BGEC', icon: 'game-controller-outline' },
  { key: 'fitsoc', label: 'FitSoc', icon: 'walk-outline' },
  { key: 'general', label: 'General', icon: 'sparkles-outline' },
];

/**
 * Sticky category tab bar (spec §2.3): glass container backed by BlurView,
 * 4 tabs with icon + label, accent underline glide spring (§10.2), Haptics on tap.
 */
export function EventTabs({
  value,
  onChange,
}: {
  value: EventsTabKey;
  onChange: (tab: EventsTabKey) => void;
}) {
  const colors = useColors();
  const preference = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  const blurTint: 'light' | 'dark' =
    (preference === 'system' ? system : preference) === 'light' ? 'light' : 'dark';

  const reducedMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const tabWidth = screenWidth / TABS.length; // approximate; actual layout may differ

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === value));
  const [glide] = useState(() => new Animated.Value(activeIndex));

  useEffect(() => {
    // H-12: useNativeDriver:true is incompatible with string-valued outputRange
    // ('0%', '25%'…). Switch to pixel-based translation driven by the measured
    // container width, then the native driver is safe to use.
    // H-18/H-19 pattern: honour Reduce Motion — snap instead of spring when set.
    if (reducedMotion) {
      glide.setValue(activeIndex);
    } else {
      Animated.spring(glide, {
        toValue: activeIndex,
        damping: 18,
        stiffness: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, glide, reducedMotion]);

  // H-12: translateX must be numeric (pixels) to be compatible with useNativeDriver.
  // Drive it from segmentWidth derived from screenWidth.
  const containerWidth = screenWidth - 32; // 16 px screen padding each side
  const segmentWidth = containerWidth / TABS.length;
  const underlineX = glide.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, segmentWidth, segmentWidth * 2, segmentWidth * 3],
  });

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <BlurView intensity={55} tint={blurTint} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
      {TABS.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.label} events`}
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <Ionicons name={tab.icon} size={15} color={active ? colors.text : colors.textMuted} />
            <Text
              style={[
                styles.tabLabel,
                { color: active ? colors.text : colors.textMuted },
                active && { fontFamily: FONTS.heading },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View
        style={[
          styles.underline,
          { backgroundColor: colors.accent, transform: [{ translateX: underlineX }] },
        ]}
      />
    </View>
  );
}

/**
 * Sticky multi-select status filter row (spec §2.4): teal-600 active fill,
 * not the accent/orange — filter chips are navigation, not CTAs.
 */
export function StatusFilterChips({
  value,
  onChange,
  counts,
}: {
  value: ReadonlySet<EventStatus>;
  onChange: (status: EventStatus) => void;
  counts: Record<EventStatus, number>;
}) {
  const colors = useColors();
  const options: { key: EventStatus; label: string }[] = [
    { key: 'past', label: 'Past' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'ongoing', label: 'Ongoing' },
  ];

  return (
    <View style={styles.filterRow}>
      {options.map((opt) => {
        const active = value.has(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${opt.label} events`}
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              {
                backgroundColor: active ? FILTER_ACTIVE_BG : 'transparent',
                borderColor: active ? 'transparent' : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                { color: active ? colors.text : colors.textMuted },
                active && { fontFamily: FONTS.heading },
              ]}
            >
              {opt.label}
            </Text>
            <View
              style={[
                styles.count,
                { backgroundColor: active ? 'rgba(218,241,222,0.20)' : colors.surfaceMuted },
              ]}
            >
              <Text
                style={[
                  styles.countText,
                  { color: active ? colors.text : colors.textMuted },
                ]}
              >
                {counts[opt.key]}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    padding: 4,
    marginVertical: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  tab: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
  underline: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: '25%',
    height: 2,
    borderRadius: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  chipLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    fontFamily: FONTS.heading,
    fontSize: 12,
  },
});
