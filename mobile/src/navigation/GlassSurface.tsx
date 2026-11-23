import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme/ThemeProvider';
import { glassTokens } from './glass';

export interface GlassSurfaceProps {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * The tab bar's liquid-glass material as a container: blur + thin tint, top highlight,
 * bottom glow, diagonal streak and rim, clipped to `radius`. Children render on top.
 */
export function GlassSurface({ radius, style, children }: GlassSurfaceProps) {
  const { isDark } = useTheme();
  const g = glassTokens(isDark);
  return (
    <View
      style={[
        styles.surface,
        { borderRadius: radius },
        g.rim,
        style,
      ]}
    >
      <BlurView pointerEvents="none" intensity={g.blurIntensity} tint={g.blurTint} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: g.tint }]} />
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
