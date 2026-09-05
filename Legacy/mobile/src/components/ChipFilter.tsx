import { Pressable, StyleSheet, Text } from 'react-native';

import { CATEGORY_COLORS } from '@/core/theme/tokens';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface ChipOption<T extends string> {
  label: string;
  value: T;
}

export interface ChipFilterProps<T extends string> {
  options: ChipOption<T>[];
  /** Currently selected value (single-select). */
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tag chips use the category colour as fill (master §4.4 / §7.4). */
  variant?: 'single' | 'tag';
  accessibilityLabel?: string;
}

/**
 * Filter chip row (master doc §7.4).
 * - single: active → accent fill; tapping the active chip deselects.
 * - tag: active → category colour fill, white label (event/announcement pills).
 */
export function ChipFilter<T extends string>({
  options,
  value,
  onChange,
  variant = 'single',
  accessibilityLabel,
}: ChipFilterProps<T>) {
  const colors = useColors();

  return (
    <>
      {options.map((opt) => {
        const active = value === opt.value;
        const tagColor = CATEGORY_COLORS[opt.label] ?? colors.accent;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(active ? null : opt.value)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? `${opt.label} filter`}
            accessibilityState={{ selected: active }}
            hitSlop={4}
            style={[
              styles.chip,
              {
                backgroundColor: active
                  ? variant === 'tag'
                    ? tagColor
                    : colors.accent
                  : 'transparent',
                borderColor: active ? 'transparent' : colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? colors.accentText : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});
