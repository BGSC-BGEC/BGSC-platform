import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChipFilter, type ChipOption } from '@/components/ChipFilter';
import { FONTS } from '@/core/theme/fonts';
import type { MediaCategory } from '@/core/repositories/MediaRepository';
import { useColors } from '@/hooks/use-colors';

export const MEDIA_CATEGORIES: ChipOption<MediaCategory>[] = [
  { label: 'All', value: 'all' },
  { label: 'Highlights', value: 'highlights' },
  { label: 'Albums', value: 'albums' },
  { label: 'Community', value: 'community' },
  { label: 'Memories', value: 'memories' },
  { label: 'Sponsors', value: 'sponsors' },
];

interface GlassFilterBarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  category: MediaCategory;
  onChangeCategory: (category: MediaCategory) => void;
}

/**
 * Sticky glass filter bar (media-page-design.md §3): search pill + single-select
 * category chips in a horizontal scroll.
 *
 * TODO(media): the ⚙ Advanced Filter chip (design §3.2, sheet spec §12) is
 * Phase E — omit until AdvancedFilterSheet ships.
 */
export function GlassFilterBar({ query, onChangeQuery, category, onChangeCategory }: GlassFilterBarProps) {
  const colors = useColors();

  return (
    <BlurView intensity={50} tint="dark" style={[styles.bar, { borderBottomColor: colors.border }]} experimentalBlurMethod="dimezisBlurView">
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />

      <View style={[styles.search, { borderColor: colors.border }]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search media, tags, events…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search media"
          style={[styles.input, { color: colors.text }]}
        />
        {query.length > 0 ? (
          <Ionicons name="close-circle" size={16} color={colors.textMuted} onPress={() => onChangeQuery('')} />
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <ChipFilter
          options={MEDIA_CATEGORIES}
          value={category}
          onChange={(value) => onChangeCategory(value ?? 'all')}
          accessibilityLabel="Filter media by category"
        />
      </ScrollView>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 10,
    overflow: 'hidden',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    paddingVertical: 10,
  },
  chipRow: {
    gap: 8,
    paddingRight: 16,
  },
});
