import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';

export interface ButtonGroupOption<T = string> {
  label: string;
  value: T;
  icon?: IconName;
}

export interface ButtonGroupProps<T = string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

export function ButtonGroup<T = string>({
  options,
  value,
  onChange,
  style,
}: ButtonGroupProps<T>) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {options.map((opt, i) => {
        const isSelected = opt.value === value;

        const handlePress = () => {
          if (isSelected) return;
          void Haptics.selectionAsync();
          onChange(opt.value);
        };

        return (
          <Pressable
            key={i}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={opt.label}
            style={[
              styles.option,
              isSelected && [
                styles.selectedOption,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ],
            ]}
          >
            {opt.icon && (
              <Icon
                name={opt.icon}
                size="xs"
                color={isSelected ? 'primary' : 'textSubtle'}
                style={styles.icon}
              />
            )}
            <Typography
              variant="label"
              color={isSelected ? 'text' : 'textSubtle'}
              style={isSelected ? styles.selectedLabel : undefined}
            >
              {opt.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  option: {
    flex: 1,
    height: 36,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectedOption: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  icon: {
    marginRight: 6,
  },
  selectedLabel: {
    fontWeight: '700',
  },
});

