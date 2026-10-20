import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

export interface CountdownRingProps {
  /** Seconds left; null shows a dash */
  seconds: number | null;
  /** Full timer length, for the arc */
  total: number;
  size?: number;
  stroke?: number;
  /** Ring/label colour; defaults to danger under 5s, else primary */
  color?: string;
}

/** Circular bid timer — the arc shrinks as the seconds run out. */
export function CountdownRing({ seconds, total, size = 64, stroke = 4, color }: CountdownRingProps) {
  const { colors } = useTheme();
  const tone = color ?? (seconds != null && seconds <= 5 ? colors.danger : colors.primary);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = seconds != null && total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={seconds != null ? `${seconds} seconds left` : undefined}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceInner} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * progress} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Typography variant="mono" style={{ color: tone, fontSize: size >= 56 ? 16 : 12 }}>
          {seconds != null ? `${seconds}s` : '—'}
        </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
