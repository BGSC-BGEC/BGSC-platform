import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Shared media section states (media-page-design.md §15/§16): skeleton
 * shimmer shapes per section, inline empty text, inline retry, large
 * community-style empty state.
 */

/** Horizontal strip of card-shaped skeleton blocks (design §16 highlights/albums/sponsors). */
export function StripSkeleton({ width, height, count = 2 }: { width: number; height: number; count?: number }) {
  return (
    <View style={styles.stripRow}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} width={width} height={height} radius={16} />
      ))}
    </View>
  );
}

/** 2-col staggered skeleton (design §16 community — 6 rects, varied heights). */
export function MasonrySkeleton() {
  const heights = [140, 200, 160, 120, 180, 140];
  return (
    <View style={styles.masonryRow}>
      <View style={styles.column}>
        {heights.slice(0, 3).map((h, i) => (
          <SkeletonBlock key={i} height={h} radius={12} />
        ))}
      </View>
      <View style={styles.column}>
        {heights.slice(3).map((h, i) => (
          <SkeletonBlock key={i} height={h} radius={12} />
        ))}
      </View>
    </View>
  );
}

/** Full-width hero placeholder (design §16). */
export function HeroSkeleton({ height }: { height: number }) {
  return <SkeletonBlock height={height} radius={0} />;
}

/** Full-width memories card placeholder (design §16). */
export function MemoriesSkeleton({ height }: { height: number }) {
  return <SkeletonBlock height={height} radius={20} style={styles.memoriesSkeleton} />;
}

/** Inline empty text (design §15: albums "No albums yet"). */
export function MediaEmpty({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

/** Inline retry (design §15: community grid error). */
export function MediaError({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>Could not load this section</Text>
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

/** Large empty state for the community grid (design §15) — optional Clear CTA when filtered. */
export function LargeEmpty({
  title,
  message,
  onClear,
}: {
  title: string;
  message: string;
  onClear?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.pageState}>
      <Text style={styles.pageEmoji}>🎞️</Text>
      <Text style={[styles.pageTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.pageMessage, { color: colors.textMuted }]}>{message}</Text>
      {onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear filters"
          hitSlop={8}
          style={styles.retry}
        >
          <Text style={[styles.retryText, { color: colors.accent }]}>Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stripRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  masonryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  memoriesSkeleton: {
    marginHorizontal: 16,
  },
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
  pageState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  pageEmoji: {
    fontSize: 44,
  },
  pageTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    textAlign: 'center',
  },
  pageMessage: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
});
