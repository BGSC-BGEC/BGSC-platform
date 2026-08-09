import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { FadeOverlay } from '@/components/media/FadeOverlay';
import { FONTS } from '@/core/theme/fonts';
import type { MemoriesSummary } from '@/core/repositories/MediaRepository';
import { useColors } from '@/hooks/use-colors';

interface MemoriesCardProps {
  summary: MemoriesSummary;
  onPress: () => void;
}

/**
 * "Your Memories" full-width season card (media-page-design.md §7) — auth
 * only; the screen hides this entirely for guests. Collage of up to 6 covers
 * in a 3×2 grid, bottom fade, accent hairline border, accent left rule on the
 * title block.
 */
export function MemoriesCard({ summary, onPress }: MemoriesCardProps) {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const height = screenWidth * 0.55;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Your memories — view all"
      style={({ pressed }) => [
        styles.card,
        {
          height,
          borderColor: colors.accentMuted,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      {summary.coverUris.length > 0 ? (
        <View style={styles.collage}>
          {summary.coverUris.slice(0, 6).map((uri, i) => (
            <View key={i} style={styles.cell}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.backgroundMid }]}>
          <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Start capturing your BGSC journey.
          </Text>
        </View>
      )}

      <FadeOverlay fraction={0.45} />

      <View style={styles.titleRow}>
        <View style={[styles.accentRule, { backgroundColor: colors.accent }]} />
        <View style={styles.titleCol}>
          <Text style={[styles.title, { color: colors.accent }]}>YOUR MEMORIES</Text>
          <Text style={[styles.season, { color: colors.textMuted }]}>
            {summary.seasonLabel} · {summary.itemCount} moments
          </Text>
        </View>
        <View style={styles.viewAllBtn}>
          <Text style={[styles.viewAll, { color: colors.accent }]}>View all →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  collage: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 2,
  },
  cell: {
    width: '33.2%',
    height: '49.5%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  empty: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  titleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  accentRule: {
    width: 3,
    height: 34,
    borderRadius: 2,
  },
  titleCol: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: FONTS.hero,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.5,
  },
  season: {
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  viewAllBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  viewAll: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
});
