import React from 'react';
import { Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';

export interface FilterChipOption<T extends string> {
  label: string;
  value: T;
}

export interface FilterChipsProps<T extends string> {
  options: ReadonlyArray<FilterChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/**
 * Horizontal pill filter row (category / type / period selectors).
 * Selected chip uses the primary orange, others sit on the card surface.
 */
export function FilterChips<T extends string>({ options, value, onChange, style }: FilterChipsProps<T>) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              { backgroundColor: selected ? colors.accent : colors.surface, borderColor: colors.border },
            ]}
          >
            <Typography variant="caption" color={selected ? 'primaryText' : 'text'}>
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
});
