import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedbackTabKey } from '@/components/feedback/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

const TABS: { key: FeedbackTabKey; label: string }[] = [
  { key: 0, label: 'Submit Ticket' },
  { key: 1, label: 'FAQ' },
  { key: 2, label: 'Directory' },
];

export interface FeedbackTabRailProps {
  active: FeedbackTabKey;
  onChange: (index: FeedbackTabKey) => void;
}

/**
 * Sticky segmented bar (feedback spec §2.2): text-only tabs over a surfaceMuted
 * capsule track, accent sliding pill gliding behind the active tab via spring
 * (damping 18, stiffness 150 — same physics as the Home rail). Taps fire
 * `Haptics.selectionAsync()`; the pill follows taps and pager swipes alike.
 */
export function FeedbackTabRail({ active, onChange }: FeedbackTabRailProps) {
  const colors = useColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const [pill] = useState(() => new Animated.Value(0));

  const segment = trackWidth / TABS.length;

  useEffect(() => {
    Animated.spring(pill, {
      toValue: active * segment,
      damping: 18,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  }, [active, segment, pill]);

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              backgroundColor: colors.accent,
              left: 4,
              width: Math.max(0, segment - 8),
              transform: [{ translateX: pill }],
            },
          ]}
        />
      ) : null}
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            style={styles.tab}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: isActive ? colors.text : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 12,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 20,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
