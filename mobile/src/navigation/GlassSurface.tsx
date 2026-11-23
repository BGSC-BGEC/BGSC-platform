import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme/ThemeProvider';
import { glassTokens } from './glass';

export interface GlassSurfaceProps {
  radius: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Heavier tint for surfaces that hold body text over a scrim (sheets, popups). Bars and
   * controls keep the tab bar's thin tint.
   */
  panel?: boolean;
  /**
   * Draw as a background layer filling its parent (absolute, untouchable), for a parent that
   * keeps its own layout, padding and shadow. Put it as the parent's first child.
   */
  fill?: boolean;
  children?: React.ReactNode;
}

/**
 * The tab bar's liquid-glass material as a container: blur + tint, top highlight,
 * bottom glow, diagonal streak and rim, clipped to `radius`. Children render on top.
 *
 * Shadows belong on the parent, not here: this view clips (iOS would cut the shadow), and
 * Android draws elevation through translucent views, so keep shadows iOS-only.
 */
export function GlassSurface({ radius, style, panel = false, fill = false, children }: GlassSurfaceProps) {
  const { isDark } = useTheme();
  const g = glassTokens(isDark);
  return (
    <View
      pointerEvents={fill ? 'none' : undefined}
      style={[
        styles.surface,
        fill && StyleSheet.absoluteFill,
        { borderRadius: radius },
        g.rim,
        style,
      ]}
    >
      <BlurView pointerEvents="none" intensity={g.blurIntensity} tint={g.blurTint} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: panel ? g.panelTint : g.tint }]} />
      {/* Same light as the tab bar, concentrated near the top since panels are tall. */}
      <LinearGradient pointerEvents="none" colors={g.highlight} locations={[0, 0.12, 0.28]} style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={g.bottomGlow} style={styles.bottomGlow} />
      <LinearGradient
        pointerEvents="none"
        colors={g.streak}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0.3, 0.42, 0.54]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  bottomGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '25%',
  },
});
