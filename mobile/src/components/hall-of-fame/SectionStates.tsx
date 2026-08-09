import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Shared section states (hall-of-fame spec §10/§11): inline empty text,
 * inline retry, and skeleton card rows matching the live carousel shapes.
 */

export function SectionEmpty({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

export function SectionError({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        Could not load this section
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading section"
        hitSlop={8}
        style={styles.retry}
      >
        <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

/** Horizontal row of card-shaped skeleton blocks (spec §11 winner cards). */
export function CardSkeletonRow({ count = 3, height = 170 }: { count?: number; height?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skeletonRow}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} width={280} height={height} radius={16} />
      ))}
    </ScrollView>
  );
}

/** Whole-page states (spec §10 "Entire page"). */
export function PageEmpty() {
  const colors = useColors();
  return (
    <View style={styles.pageState}>
      <Text style={styles.pageEmoji}>🏆</Text>
      <Text style={[styles.pageTitle, { color: colors.text }]}>No champions yet — check back soon!</Text>
    </View>
  );
}

export function PageError({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.pageState}>
      <Text style={styles.pageEmoji}>🏆</Text>
      <Text style={[styles.pageTitle, { color: colors.text }]}>
        Could not load the Hall of Fame
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading Hall of Fame"
        hitSlop={8}
        style={styles.retry}
      >
        <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
  skeletonRow: {
    gap: 12,
    paddingRight: 16,
  },
  pageState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  pageEmoji: {
    fontSize: 44,
  },
  pageTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
});
