import React, { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface SkeletonProps {
  width?: number | `${number}%` | 'auto';
  height?: number | `${number}%` | 'auto';
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Base Shimmer Skeleton block with hardware-accelerated looping pulse.
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const [opacityAnim] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.75,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

/** Circular Skeleton for avatars */
export function SkeletonCircle({
  size = 44,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

/** Multi-line text placeholder with varied line widths */
export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  gap = 8,
  style,
}: {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  const widths: (`${number}%`)[] = ['100%', '92%', '78%', '60%'];

  return (
    <View style={[styles.textGroup, { gap }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={widths[i % widths.length]}
          height={lineHeight}
          borderRadius={4}
        />
      ))}
    </View>
  );
}

/** Pre-built Skeleton Card */
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }, style]}>
      <View style={styles.cardHeader}>
        <SkeletonCircle size={40} />
        <View style={styles.cardHeaderDetails}>
          <Skeleton width="60%" height={14} borderRadius={4} />
          <Skeleton width="40%" height={10} borderRadius={4} />
        </View>
      </View>
      <SkeletonText lines={2} lineHeight={12} gap={6} />
    </View>
  );
}

// Attach subcomponents
Skeleton.Circle = SkeletonCircle;
Skeleton.Text = SkeletonText;
Skeleton.Card = SkeletonCard;

const styles = StyleSheet.create({
  textGroup: {
    width: '100%',
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeaderDetails: {
    flex: 1,
    gap: 6,
  },
});
