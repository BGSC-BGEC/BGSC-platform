import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

/**
 * Placeholder wordmark (spec §3.1 contextual logo). Swap for the real
 * BGSC/BGEC/FitSoc SVG assets when branding is finalized.
 */
export function Logo({ label = 'BGSC' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
        <Text style={[styles.badgeText, { color: colors.primaryText }]}>
          {label.slice(0, 2)}
        </Text>
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 16, fontWeight: '700' },
});
