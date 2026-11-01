import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, G, Defs, RadialGradient, Stop, Line } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export interface GamingBackdropProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

/**
 * Gaming backdrop with thematic vector icons and ambient gradients.
 */
export function GamingBackdrop({
  width = '100%',
  height = 280,
  style,
}: GamingBackdropProps) {
  const { colors } = useTheme();
  const iconColor = colors.text;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg
        width={width}
        height={height}
        viewBox="0 0 390 280"
        preserveAspectRatio="xMidYMin slice"
      >
        <Defs>
          <RadialGradient id="gamingGlow" cx="50%" cy="38%" r="68%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.32" />
            <Stop offset="45%" stopColor={colors.primary} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={colors.background} stopOpacity="0" />
          </RadialGradient>

          <RadialGradient id="gamepadGlow" cx="80%" cy="25%" r="40%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={colors.background} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect width="100%" height="100%" fill="url(#gamingGlow)" />
        <Rect width="100%" height="100%" fill="url(#gamepadGlow)" />

        <G opacity={0.22}>
          <Circle cx="40" cy="30" r="1.5" fill={iconColor} />
          <Circle cx="80" cy="20" r="1.2" fill={iconColor} />
          <Circle cx="150" cy="25" r="1.5" fill={iconColor} />
          <Circle cx="240" cy="22" r="1.5" fill={iconColor} />
          <Circle cx="350" cy="28" r="1.2" fill={iconColor} />

          <Circle cx="60" cy="85" r="1.5" fill={colors.primary} />
          <Circle cx="100" cy="110" r="1.2" fill={iconColor} />
          <Circle cx="160" cy="95" r="1.5" fill={iconColor} />
          <Circle cx="230" cy="105" r="1.8" fill={colors.primary} />
          <Circle cx="280" cy="90" r="1.2" fill={iconColor} />

          <Circle cx="35" cy="165" r="1.5" fill={iconColor} />
          <Circle cx="95" cy="180" r="1.5" fill={iconColor} />
          <Circle cx="155" cy="170" r="1.2" fill={iconColor} />
          <Circle cx="235" cy="175" r="1.5" fill={colors.primary} />
          <Circle cx="310" cy="165" r="1.5" fill={iconColor} />
          <Circle cx="365" cy="180" r="1.2" fill={iconColor} />

          <Circle cx="80" cy="240" r="1.5" fill={iconColor} />
          <Circle cx="190" cy="235" r="1.8" fill={colors.primary} />
          <Circle cx="305" cy="240" r="1.5" fill={iconColor} />

          <Line x1="40" y1="30" x2="80" y2="20" stroke={iconColor} strokeWidth="0.8" strokeDasharray="3,3" opacity={0.4} />
          <Line x1="230" y1="105" x2="280" y2="90" stroke={colors.primary} strokeWidth="0.8" strokeDasharray="2,2" opacity={0.5} />
          <Line x1="155" y1="170" x2="235" y2="175" stroke={iconColor} strokeWidth="0.8" strokeDasharray="3,3" opacity={0.4} />
        </G>

        <G transform="translate(290, 56) rotate(10)" opacity={0.32}>
          <Path
            d="M 12 18 C 12 8, 24 4, 38 4 C 52 4, 64 8, 64 18 C 64 30, 68 46, 58 52 C 50 56, 44 42, 38 42 C 32 42, 26 56, 18 52 C 8 46, 12 30, 12 18 Z"
            fill={iconColor}
          />
          <Rect x="20" y="18" width="10" height="4" rx="1" fill={colors.background} />
          <Rect x="23" y="15" width="4" height="10" rx="1" fill={colors.background} />
          <Circle cx="50" cy="16" r="2.2" fill={colors.primary} />
          <Circle cx="56" cy="20" r="2.2" fill={colors.primary} />
          <Circle cx="44" cy="20" r="2.2" fill={colors.primary} />
          <Circle cx="50" cy="24" r="2.2" fill={colors.primary} />
          <Circle cx="30" cy="28" r="4.5" fill={colors.background} />
          <Circle cx="46" cy="28" r="4.5" fill={colors.background} />
        </G>

        <G transform="translate(18, 66) rotate(-14)" opacity={0.28}>
          <Path d="M 4 4 L 32 32 M 8 4 L 4 8 M 28 26 L 34 26 L 34 32 L 28 32 Z M 31 31 L 37 37" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M 32 4 L 4 32 M 28 4 L 32 8 M 8 26 L 2 26 L 2 32 L 8 32 Z M 5 31 L -1 37" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" />
        </G>

        <G transform="translate(178, 26)" opacity={0.28}>
          <Path d="M 3 20 L 7 7 L 15 14 L 23 7 L 27 20 Z" fill={iconColor} />
          <Circle cx="7" cy="6" r="2.2" fill={colors.primary} />
          <Circle cx="15" cy="13" r="2.2" fill={colors.primary} />
          <Circle cx="23" cy="6" r="2.2" fill={colors.primary} />
        </G>

        <G transform="translate(108, 48) rotate(-10)" opacity={0.42}>
          <Path d="M 14 0 L 4 15 L 12 15 L 6 28 L 22 11 L 13 11 Z" fill={colors.primary} />
        </G>

        <G transform="translate(16, 138)" opacity={0.30}>
          <Circle cx="20" cy="20" r="16" stroke={iconColor} strokeWidth="2" fill="none" />
          <Circle cx="20" cy="20" r="7" stroke={iconColor} strokeWidth="1.5" fill="none" />
          <Circle cx="20" cy="20" r="2.5" fill={colors.primary} />
          <Path d="M 20 0 L 20 9 M 20 31 L 20 40 M 0 20 L 9 20 M 31 20 L 40 20" stroke={iconColor} strokeWidth="2" strokeLinecap="round" />
        </G>

        <G transform="translate(272, 132) rotate(6)" opacity={0.32}>
          <Path d="M 6 6 L 30 6 C 30 18, 24 24, 18 24 C 12 24, 6 18, 6 6 Z" fill={iconColor} />
          <Path d="M 6 10 C 1 10, 1 18, 6 18" stroke={iconColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Path d="M 30 10 C 35 10, 35 18, 30 18" stroke={iconColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Rect x="16" y="24" width="4" height="6" fill={iconColor} />
          <Rect x="11" y="30" width="14" height="4" rx="1.5" fill={iconColor} />
          <Circle cx="18" cy="14" r="3" fill={colors.primary} />
        </G>

        <G transform="translate(328, 142) rotate(-6)" opacity={0.30}>
          <Path d="M 6 24 C 6 12, 14 4, 24 4 C 34 4, 42 12, 42 24" stroke={iconColor} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Rect x="2" y="20" width="8" height="15" rx="4" fill={iconColor} />
          <Rect x="38" y="20" width="8" height="15" rx="4" fill={iconColor} />
          <Path d="M 8 32 C 8 38, 16 42, 22 40" stroke={iconColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          <Circle cx="23" cy="40" r="2.5" fill={colors.primary} />
        </G>

        <G transform="translate(32, 205) rotate(15)" opacity={0.28}>
          <Path d="M 16 2 L 29 9 L 29 25 L 16 32 L 3 25 L 3 9 Z" stroke={iconColor} strokeWidth="2" fill="none" />
          <Path d="M 16 2 L 16 32 M 3 9 L 29 25 M 3 25 L 29 9" stroke={iconColor} strokeWidth="1.2" />
        </G>

        <G transform="translate(322, 212) rotate(4)" opacity={0.28}>
          <Path d="M 18 2 L 32 7 C 32 19, 25 27, 18 31 C 11 27, 4 19, 4 7 Z" stroke={iconColor} strokeWidth="2.2" fill="none" />
          <Circle cx="18" cy="15" r="3.5" fill={colors.primary} />
        </G>

        <G transform="translate(86, 146) rotate(8)" opacity={0.26}>
          <Path
            d="M 6 10 C 6 4, 14 2, 22 2 C 30 2, 38 4, 38 10 C 38 18, 40 26, 34 30 C 30 32, 26 24, 22 24 C 18 24, 14 32, 10 30 C 4 26, 6 18, 6 10 Z"
            fill={iconColor}
          />
          <Circle cx="16" cy="14" r="2" fill={colors.primary} />
          <Circle cx="28" cy="14" r="2" fill={colors.primary} />
        </G>
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
    bottom: 0,
    overflow: 'hidden',
  },
});
