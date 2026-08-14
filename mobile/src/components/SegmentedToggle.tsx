import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface SegmentedToggleProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
}

/**
 * Segmented toggle (master doc §7.6): pill track (`surfaceMuted`), equal
 * segments, active = elevated light pill with subtle shadow, Inter 600 label.
 * Indicator slides via transform (150 ms, useNativeDriver) — width and travel
 * scale with the option count.
 */
export function SegmentedToggle({ options, value, onChange, accessibilityLabel }: SegmentedToggleProps) {
  const colors = useColors();
  const count = Math.max(1, options.length);
  const segWidth = 100 / count;
  const index = Math.max(0, options.indexOf(value));
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: index * segWidth,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [index, segWidth, translateX]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel ?? 'Segmented control'}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
    >
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: colors.surfaceSolid,
            shadowColor: '#000',
            width: `${segWidth}%`,
            transform: [{ translateX }],
          },
        ]}
      />
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityLabel={opt}
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.text : colors.textMuted },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 999,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});
