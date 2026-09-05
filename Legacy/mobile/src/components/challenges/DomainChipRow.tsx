import { StyleSheet, View } from 'react-native';

import { ChipFilter } from '@/components/ChipFilter';
import type { ChallengeDomain } from '@/core/types';

const DOMAIN_OPTIONS: { label: string; value: ChallengeDomain }[] = [
  { label: 'Sports', value: 'sports' },
  { label: 'Esports', value: 'esports' },
  { label: 'Game Dev', value: 'game_dev' },
  { label: 'General', value: 'general' },
];

export interface DomainChipRowProps {
  value: ChallengeDomain | null;
  onChange: (value: ChallengeDomain | null) => void;
}

/** Domain filter row (points spec §5.1): single-select, default All. */
export function DomainChipRow({ value, onChange }: DomainChipRowProps) {
  return (
    <View style={styles.row}>
      <ChipFilter<ChallengeDomain>
        options={DOMAIN_OPTIONS}
        value={value}
        onChange={onChange}
        accessibilityLabel="Challenge domain filter"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
