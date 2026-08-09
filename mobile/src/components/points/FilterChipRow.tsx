import { StyleSheet, View } from 'react-native';

import { ChipFilter } from '@/components/ChipFilter';
import type { TransactionFilter } from '@/core/types';

const TX_FILTERS: { label: string; value: TransactionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Earned', value: 'earn' },
  { label: 'Spent', value: 'spend' },
  { label: 'Refunded', value: 'refund' },
];

export interface FilterChipRowProps {
  value: TransactionFilter;
  onChange: (value: TransactionFilter) => void;
}

/**
 * Transaction filter chips (points spec §4.4): single-select, default All;
 * tapping the active chip reverts to All.
 */
export function FilterChipRow({ value, onChange }: FilterChipRowProps) {
  return (
    <View style={styles.row}>
      <ChipFilter<TransactionFilter>
        options={TX_FILTERS}
        value={value}
        onChange={(v) => onChange(v ?? 'all')}
        accessibilityLabel="Transaction filter"
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
