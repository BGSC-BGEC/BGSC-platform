import { StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

/** "─── OR ───" divider (handoffSpec §3.7). */
export function OrDivider() {
  const colors = lightColors;
  return (
    <View style={styles.orRow}>
      <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.orText, { color: colors.textMuted }]}>OR</Text>
      <View style={[styles.orLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
