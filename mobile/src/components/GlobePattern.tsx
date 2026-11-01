import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';

export interface GlobePatternProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

// Fixed pseudo-random coordinate grid of dots forming a subtle stylized map / constellation
const DOTS = [
  // Americas cluster
  { cx: 45, cy: 35, r: 1.5, o: 0.3 },
  { cx: 60, cy: 28, r: 2, o: 0.5 },
  { cx: 75, cy: 38, r: 1.5, o: 0.4 },
  { cx: 90, cy: 45, r: 2.2, o: 0.6 },
  { cx: 105, cy: 40, r: 1.8, o: 0.4 },
  { cx: 70, cy: 60, r: 2, o: 0.45 },
  { cx: 85, cy: 75, r: 2.5, o: 0.6 },
  { cx: 95, cy: 95, r: 2, o: 0.5 },
  { cx: 100, cy: 115, r: 1.5, o: 0.35 },

  // Europe / Africa cluster
  { cx: 175, cy: 25, r: 2, o: 0.4 },
  { cx: 190, cy: 32, r: 2.5, o: 0.65 },
  { cx: 205, cy: 28, r: 2, o: 0.5 },
  { cx: 185, cy: 50, r: 2, o: 0.4 },
  { cx: 200, cy: 65, r: 2.8, o: 0.6 },
  { cx: 215, cy: 80, r: 2, o: 0.5 },
  { cx: 205, cy: 100, r: 2.5, o: 0.45 },
  { cx: 220, cy: 120, r: 1.8, o: 0.35 },

  // Asia / Oceania cluster
  { cx: 250, cy: 30, r: 2, o: 0.45 },
  { cx: 270, cy: 35, r: 2.8, o: 0.7 },
  { cx: 290, cy: 40, r: 2.2, o: 0.5 },
  { cx: 310, cy: 48, r: 3, o: 0.8 },
  { cx: 330, cy: 42, r: 2.2, o: 0.5 },
  { cx: 280, cy: 65, r: 2.5, o: 0.6 },
  { cx: 300, cy: 75, r: 2.8, o: 0.65 },
  { cx: 325, cy: 85, r: 2, o: 0.4 },
  { cx: 315, cy: 110, r: 2.5, o: 0.55 },
  { cx: 335, cy: 125, r: 2.2, o: 0.45 },

  // Background ambient grid points
  { cx: 25, cy: 20, r: 1.2, o: 0.2 },
  { cx: 135, cy: 22, r: 1.2, o: 0.2 },
  { cx: 155, cy: 70, r: 1.2, o: 0.25 },
  { cx: 240, cy: 95, r: 1.2, o: 0.25 },
  { cx: 360, cy: 55, r: 1.4, o: 0.3 },
  { cx: 375, cy: 90, r: 1.2, o: 0.2 },
  { cx: 120, cy: 85, r: 1.2, o: 0.2 },
  { cx: 160, cy: 110, r: 1.4, o: 0.25 },
];

export function GlobePattern({
  width = '100%',
  height = 140,
  style,
}: GlobePatternProps) {
  const { colors } = useTheme();
  const dotColor = colors.text;
  const arcColor = colors.primary;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="globeGlow" cx="60%" cy="40%" r="60%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={colors.background} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient warm radial glow */}
        <Path d="M 0 0 L 400 0 L 400 140 L 0 140 Z" fill="url(#globeGlow)" />

        {/* Subtle flight / connection arcs */}
        <Path
          d="M 90 45 Q 190 10 310 48"
          fill="none"
          stroke={withAlpha(arcColor, 0.3)}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <Path
          d="M 200 65 Q 260 40 300 75"
          fill="none"
          stroke={withAlpha(arcColor, 0.25)}
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Small flight node icon at midpoint of main arc */}
        <Circle cx="200" cy="27" r="3" fill={colors.primary} />
        <Circle cx="200" cy="27" r="6" fill={withAlpha(colors.primary, 0.25)} />

        {/* Dot matrix */}
        {DOTS.map((dot, index) => (
          <Circle
            key={index}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            fill={dotColor}
            opacity={dot.o * 0.45}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
});
