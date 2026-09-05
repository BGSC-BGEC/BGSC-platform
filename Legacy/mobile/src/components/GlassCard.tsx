import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useThemeStore } from '@/core/stores/themeStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';

export interface GlassCardProps {
  children: ReactNode;
  style?: object;
  /** Selected state → accentMuted tint + borderActive (master §7.3). */
  selected?: boolean;
  /** Solid fallback — devices without backdrop-filter support (master §4.3). */
  variant?: 'glass' | 'solid';
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Reusable glassmorphism card (master doc §4.3 / §7.3).
 *
 * BlurView (intensity ~55 ≈ blur(20px)) + translucent surface overlay +
 * hairline sage border. `variant="solid"` renders `surfaceSolid` for
 * low-perf devices that don't support backdrop-filter.
 */
export function GlassCard({
  children,
  style,
  selected = false,
  variant = 'glass',
  onPress,
  accessibilityLabel,
}: GlassCardProps) {
  const colors = useColors();
  const preference = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  const blurTint: 'light' | 'dark' = (preference === 'system' ? system : preference) === 'light' ? 'light' : 'dark';
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const pressIn = () => {
    // 120 ms spring press (master §8): scale 0.98, opacity 0.9.
    Animated.spring(scale, { toValue: 0.98, speed: 40, bounciness: 0, useNativeDriver: true }).start();
    Animated.timing(opacity, { toValue: 0.9, duration: 120, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 0, useNativeDriver: true }).start();
    Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  const surface = (
    <>
      {variant === 'glass' ? (
        <BlurView
          intensity={55}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod="dimezisBlurView"
        />
      ) : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSolid }]} />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: selected ? colors.accentMuted : colors.surface },
        ]}
      />
    </>
  );

  const cardStyle = [
    styles.card,
    {
      backgroundColor: variant === 'solid' ? colors.surfaceSolid : 'transparent',
      borderColor: selected ? colors.borderActive : colors.border,
    },
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={[{ transform: [{ scale }], opacity }]}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={cardStyle}
        >
          {surface}
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={cardStyle}>
      {surface}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
  },
});
