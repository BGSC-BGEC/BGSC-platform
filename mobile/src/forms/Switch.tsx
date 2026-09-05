import React, { useEffect, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  color?: 'primary' | 'secondary' | 'accent';
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const PADDING = 3;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

export function Switch({
  value,
  onValueChange,
  disabled = false,
  color = 'primary',
  accessibilityLabel = 'Toggle switch',
  style,
}: SwitchProps) {
  const { colors } = useTheme();
  const [translateX] = useState(() => new Animated.Value(value ? TRAVEL : 0));

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? TRAVEL : 0,
      tension: 100,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  const handleToggle = () => {
    if (disabled) return;
    void Haptics.selectionAsync();
    onValueChange(!value);
  };

  const activeTrackColor =
    color === 'secondary'
      ? colors.secondary
      : color === 'accent'
      ? colors.accent
      : colors.primary;

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          backgroundColor: value ? activeTrackColor : colors.surfaceMuted,
          borderColor: value ? activeTrackColor : colors.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.primaryText,
            transform: [{ translateX }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    padding: PADDING,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
