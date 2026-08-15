import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface SegmentedToggleProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
}

export function SegmentedToggle({ options, value, onChange, accessibilityLabel }: SegmentedToggleProps) {
  const colors = useColors();
  const count = Math.max(1, options.length);
  const index = Math.max(0, options.indexOf(value));

  const [trackWidth, setTrackWidth] = useState(0);
  const segWidthPx = trackWidth > 0 ? (trackWidth - 8) / count : 0;
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (segWidthPx <= 0) return;
    Animated.timing(translateX, {
      toValue: index * segWidthPx,
      duration: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, segWidthPx, translateX]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel ?? 'Segmented control'}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {segWidthPx > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: colors.surfaceSolid,
              shadowColor: '#000',
              width: segWidthPx,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
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
            <Text style={[styles.label, { color: active ? colors.text : colors.textMuted }]}>
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
