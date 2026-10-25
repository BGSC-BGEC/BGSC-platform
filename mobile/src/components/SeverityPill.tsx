import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

export interface SeverityPillProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SeverityPill({
  label,
  selected,
  disabled = false,
  onPress,
  style,
}: SeverityPillProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.accentMuted : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Typography
        variant="button"
        color={selected ? 'primary' : 'textMuted'}
        align="center"
        numberOfLines={1}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
});
