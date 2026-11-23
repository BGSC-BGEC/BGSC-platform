import React from 'react';
import { Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { GLASS_ACTIVE_FILL, GLASS_ACTIVE_INK } from '../navigation/glass';

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
 * Selected chip is the tab bar's coral pill (same gradient and ink); others sit on the inner surface.
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
                ? styles.chipActive
                : { backgroundColor: colors.surfaceInner, borderColor: colors.border },
            ]}
          >
            {selected ? (
              <LinearGradient
                pointerEvents="none"
                colors={GLASS_ACTIVE_FILL}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chipFill}
              />
            ) : null}
            <Typography variant="caption" color={selected ? GLASS_ACTIVE_INK : 'text'} style={styles.label} numberOfLines={1}>
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // alignItems: a taller chip can't stretch its neighbours.
  row: { gap: 6, paddingVertical: 1, alignItems: 'center' },
  // flexShrink 0: chips keep their natural width and the row scrolls, instead of squeezing a long
  // label ("Around the Net") onto two lines.
  chip: { overflow: 'hidden', flexShrink: 0, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4.5 },
  chipActive: { borderColor: 'transparent' },
  // -1: cover the (transparent) 1px border too, so the chip keeps its size.
  chipFill: { position: 'absolute', top: -1, right: -1, bottom: -1, left: -1 },
  // includeFontPadding off so the label sits centred in the chip on Android.
  label: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11.5, lineHeight: 14, includeFontPadding: false, textAlignVertical: 'center' },
});
