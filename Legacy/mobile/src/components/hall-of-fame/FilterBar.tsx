import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export type HallOfFameType = 'League' | 'Highlight' | 'Challenge' | 'Sponsor';

export interface HallOfFameFilters {
  /** 'YYYY' or null = All Years. */
  year: string | null;
  type: HallOfFameType | null;
  /** Sponsor name or null = All Sponsors. */
  sponsor: string | null;
}

export const EMPTY_FILTERS: HallOfFameFilters = { year: null, type: null, sponsor: null };

export const HALL_OF_FAME_TYPES: HallOfFameType[] = ['League', 'Highlight', 'Challenge', 'Sponsor'];

interface FilterBarProps {
  filters: HallOfFameFilters;
  onChange: (filters: HallOfFameFilters) => void;
  years: string[];
  sponsors: string[];
}

interface FilterChip {
  key: keyof HallOfFameFilters;
  placeholder: string;
  options: string[];
}

/**
 * Sticky filter row (hall-of-fame spec §4): dropdown chips — inactive chips
 * are outlined placeholders, active chips are accent-filled with the selected
 * value and a clear (×). Tap opens a single-select bottom sheet.
 *
 * TODO(Phase 2): Sport filter — event-winners DTO carries no sport/tag field;
 * add once the backend exposes it.
 */
export function FilterBar({ filters, onChange, years, sponsors }: FilterBarProps) {
  const colors = useColors();
  const [openChip, setOpenChip] = useState<keyof HallOfFameFilters | null>(null);

  const chips: FilterChip[] = [
    { key: 'year', placeholder: 'Year', options: years },
    {
      key: 'type',
      placeholder: 'Type',
      options: HALL_OF_FAME_TYPES,
    },
    { key: 'sponsor', placeholder: 'Sponsor', options: sponsors },
  ];

  const activeChip = openChip ? chips.find((c) => c.key === openChip) ?? null : null;
  const activeValue = openChip ? filters[openChip] : null;

  const select = (value: string | null) => {
    if (openChip) onChange({ ...filters, [openChip]: value });
    setOpenChip(null);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {chips.map((chip) => {
          const value = filters[chip.key];
          const active = value !== null;
          return (
            <Pressable
              key={chip.key}
              onPress={() => setOpenChip(chip.key)}
              accessibilityRole="button"
              accessibilityLabel={`${chip.placeholder} filter${active ? `: ${value}` : ''}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : 'transparent',
                  borderColor: active ? 'transparent' : colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: active ? colors.accentText : colors.textMuted }]}>
                {active ? value : chip.placeholder}
              </Text>
              {active ? (
                <Pressable
                  onPress={() => onChange({ ...filters, [chip.key]: null })}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear ${chip.placeholder} filter`}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={colors.accentText} />
                </Pressable>
              ) : (
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <BottomSheet
        visible={openChip !== null}
        onClose={() => setOpenChip(null)}
        title={activeChip?.placeholder}
      >
        <View style={styles.sheetList}>
          <SheetOption
            label={activeChip?.key === 'year' ? 'All Years' : activeChip?.key === 'type' ? 'All Types' : 'All Sponsors'}
            selected={activeValue === null}
            onPress={() => select(null)}
          />
          {(activeChip?.options ?? []).map((option) => (
            <SheetOption
              key={option}
              label={option}
              selected={activeValue === option}
              onPress={() => select(option)}
            />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function SheetOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.option, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.optionLabel, { color: selected ? colors.accent : colors.text }]}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 16,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 44,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  sheetList: {
    paddingBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
});
