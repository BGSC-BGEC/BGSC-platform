import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme/ThemeProvider';

/**
 * Frosted-glass finish for cards that sit on solid surfaces (nothing behind them to
 * blur), so the "frost" comes from light, not blur:
 *  - FrostedSheen: a soft diagonal light falloff. Put it as the card's FIRST child so
 *    content draws on top of it.
 *  - FrostedRim: a faint edge, a touch brighter on top. Put it as the card's LAST child.
 * Both clip themselves to `radius`, so the card itself doesn't need overflow: hidden
 * (which would clip its iOS shadow). Kept deliberately subtle.
 */

const DARK_SHEEN = ['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0)'] as const;
const LIGHT_SHEEN = ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as const;

export function FrostedSheen({ radius }: { radius: number }) {
  const { isDark } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <LinearGradient
        colors={isDark ? DARK_SHEEN : LIGHT_SHEEN}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function FrostedRim({ radius }: { radius: number }) {
  const { isDark } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
          borderTopColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
        },
      ]}
    />
  );
}
