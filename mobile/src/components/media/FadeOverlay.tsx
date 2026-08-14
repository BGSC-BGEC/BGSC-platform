import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useColors } from '@/hooks/use-colors';

interface FadeOverlayProps {
  /** Fraction of the container height the fade occupies from the bottom (design: 0.35–0.40). */
  fraction?: number;
  style?: ViewStyle;
}

/**
 * Bottom fade approximating a LinearGradient (transparent → canvas) with four
 * stacked translucent layers, each covering an increasing band from the
 * bottom (25% / 50% / 75% / 100% of the fade region).
 *
 * TODO(media): replace with expo-linear-gradient when the dependency lands —
 * the design (media-page-design.md §13) specifies real gradients everywhere.
 * Kept token-only so it adapts to light mode.
 */
export function FadeOverlay({ fraction = 0.4, style }: FadeOverlayProps) {
  const colors = useColors();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${fraction * 100}%` }}>
        {[0.12, 0.2, 0.3, 0.42].map((opacity, i) => (
          // L-19: use stable key that doesn't change across renders.
          <View
            key={opacity}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: `${(i + 1) * 25}%`,
              backgroundColor: colors.background,
              opacity,
            }}
          />
        ))}
      </View>
    </View>
  );
}
