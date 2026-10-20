import React from 'react';
import { Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';

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
 * v2/Chip row — single-select filters (category / type / period).
 * Selected chip is solid orange with white text; others sit on the inner surface.
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
              selected
                ? { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid }
                : { backgroundColor: colors.surfaceInner, borderColor: colors.border },
            ]}
          >
            <Typography variant="caption" color={selected ? 'primaryText' : 'text'} style={styles.label}>
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
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 12, lineHeight: 15 },
});
