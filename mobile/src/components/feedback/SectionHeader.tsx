import { StyleSheet, Text, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * In-tab section header (feedback spec §7.2): Barlow Condensed 700, 24 sp
 * (screen/section title tier), optional muted descriptor below.
 */
export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 24,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2,
  },
});
