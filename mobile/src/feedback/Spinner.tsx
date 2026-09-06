import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { UIThemeColors } from '../theme/colors';

export interface SpinnerProps {
  size?: 'small' | 'large' | number;
  color?: keyof UIThemeColors | string;
  style?: ViewStyle;
}

/**
 * Branded loading spinner matching the UI theme colors.
 */
export function Spinner({
  size = 'small',
  color = 'primary',
  style,
}: SpinnerProps) {
  const { colors } = useTheme();

  const resolvedColor =
    color in colors ? colors[color as keyof UIThemeColors] : color;

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator
        size={typeof size === 'number' ? 'small' : size}
        color={resolvedColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

