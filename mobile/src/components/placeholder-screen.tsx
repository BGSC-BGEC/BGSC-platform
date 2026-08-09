import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Placeholder for routes that haven't been built yet — glass card +
 * skeletons (never a spinner, per master §0.5).
 */
export function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  const colors = useColors();
  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <GlassCard>
        <SkeletonBlock height={16} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={16} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={16} width="60%" />
      </GlassCard>
      {note ? <Text style={[styles.note, { color: colors.textMuted }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 28,
  },
  note: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
});
