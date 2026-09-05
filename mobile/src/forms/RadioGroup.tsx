import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';

export interface RadioOption<T = string> {
  label: string;
  value: T;
  subtitle?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T = string> {
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color?: 'primary' | 'secondary' | 'accent';
  containerStyle?: ViewStyle;
}

export function RadioGroup<T = string>({
  options,
  value,
  onChange,
  color = 'primary',
  containerStyle,
}: RadioGroupProps<T>) {
  const { colors } = useTheme();

  const activeColor =
    color === 'secondary'
      ? colors.secondary
      : color === 'accent'
      ? colors.accent
      : colors.primary;

  return (
    <View style={[styles.group, containerStyle]}>
      {options.map((opt, index) => {
        const isSelected = opt.value === value;
        const isDisabled = Boolean(opt.disabled);

        const handleSelect = () => {
          if (isDisabled || isSelected) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(opt.value);
        };

        return (
          <Pressable
            key={index}
            onPress={handleSelect}
            disabled={isDisabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
            accessibilityLabel={opt.label}
            style={[
              styles.optionRow,
              { opacity: isDisabled ? 0.45 : 1 },
            ]}
          >
            <View
              style={[
                styles.outerCircle,
                {
                  borderColor: isSelected ? activeColor : colors.border,
                },
              ]}
            >
              {isSelected && (
                <View
                  style={[
                    styles.innerDot,
                    { backgroundColor: activeColor },
                  ]}
                />
              )}
            </View>

            <View style={styles.textDetails}>
              <Typography variant="body" color="text">
                {opt.label}
              </Typography>
              {opt.subtitle && (
                <Typography variant="caption" color="textMuted">
                  {opt.subtitle}
                </Typography>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  outerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textDetails: {
    flex: 1,
    gap: 2,
  },
});

