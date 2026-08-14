import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import type { ChallengeDifficulty } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

import { capitalize } from './format';

const DIFFICULTIES: ChallengeDifficulty[] = ['easy', 'medium', 'hard', 'legend'];

export interface DifficultyChipRowProps {
  /** Currently selected difficulties. */
  value: ChallengeDifficulty[];
  onChange: (value: ChallengeDifficulty[]) => void;
}

/**
 * Difficulty filter row (points spec §5.1): multi-select, default all four
 * selected (= no filter). At least one chip must remain selected.
 */
export function DifficultyChipRow({ value, onChange }: DifficultyChipRowProps) {
  const colors = useColors();

  const toggle = (d: ChallengeDifficulty) => {
    const active = value.includes(d);
    if (active && value.length === 1) return; // keep ≥1 selected
    onChange(active ? value.filter((v) => v !== d) : [...value, d]);
  };

  return (
    <View style={styles.row}>
      {DIFFICULTIES.map((d) => {
        const active = value.includes(d);
        return (
          <Pressable
            key={d}
            onPress={() => toggle(d)}
            accessibilityRole="button"
            accessibilityLabel={`${capitalize(d)} difficulty filter`}
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.accent : 'transparent',
                borderColor: active ? 'transparent' : colors.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: active ? colors.accentText : colors.textMuted }]}>
              {capitalize(d)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});
