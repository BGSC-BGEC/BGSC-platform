import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  subtitle?: string;
  disabled?: boolean;
  color?: 'primary' | 'secondary' | 'accent';
  style?: ViewStyle;
}

export function Checkbox({
  checked,
  onChange,
  label,
  subtitle,
  disabled = false,
  color = 'primary',
  style,
}: CheckboxProps) {
  const { colors } = useTheme();

  const handleToggle = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(!checked);
  };

  const activeColor =
    color === 'secondary'
      ? colors.secondary
      : color === 'accent'
      ? colors.accent
      : colors.primary;

  return (
    <Pressable
      onPress={handleToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={[
        styles.container,
        { opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? activeColor : colors.border,
            backgroundColor: checked ? activeColor : colors.surfaceMuted,
          },
        ]}
      >
        {checked && (
          <Icon
            name="check"
            size={14}
            color={color === 'secondary' ? colors.secondaryText : colors.primaryText}
          />
        )}
      </View>

      {(label || subtitle) && (
        <View style={styles.textContainer}>
          {label && (
            <Typography variant="body" color="text">
              {label}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="caption" color="textMuted">
              {subtitle}
            </Typography>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
});

