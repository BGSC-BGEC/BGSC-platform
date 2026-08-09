import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export interface SkeletonBlockProps {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}

/**
 * Skeleton shimmer (master doc §7.8): opacity pulse 0.3 ↔ 0.7, ~750 ms each
 * direction, `useNativeDriver: true`. Colour: `border`. Use for data loading
 * — never full-page spinners.
 */
export function SkeletonBlock({ width = '100%', height, radius = 8, style }: SkeletonBlockProps) {
  const colors = useColors();
  const [pulse] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius, backgroundColor: colors.border, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Column of skeleton blocks for a card-shaped placeholder. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} height={14} style={{ marginBottom: i < lines - 1 ? 8 : 0 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(142, 182, 155, 0.15)',
    padding: 14,
    gap: 8,
  },
});
