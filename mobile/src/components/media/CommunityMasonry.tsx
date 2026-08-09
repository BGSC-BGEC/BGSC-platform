import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { MediaItem } from '@/core/repositories/MediaRepository';
import { useColors } from '@/hooks/use-colors';

const COLUMN_GAP = 8;
const SCREEN_PAD = 16;
const MIN_ITEM_HEIGHT = 120;
const MAX_ITEM_HEIGHT = 280;

interface CommunityMasonryProps {
  items: MediaItem[];
  onPressItem: (item: MediaItem) => void;
  onLongPressItem: (item: MediaItem) => void;
}

/**
 * 2-column staggered masonry (media-page-design.md §8.1): each item's height
 * is its native aspect ratio mapped onto the column width, clamped 120–280 dp.
 * Items are assigned to the shorter column to balance heights. Pure thumbnails
 * at rest — no chrome (design §8.2); long-press reveals the action sheet.
 */
export function CommunityMasonry({ items, onPressItem, onLongPressItem }: CommunityMasonryProps) {
  const { width: screenWidth } = useWindowDimensions();
  const colWidth = (screenWidth - SCREEN_PAD * 2 - COLUMN_GAP) / 2;

  const [leftCol, rightCol] = useMemo(() => splitMasonry(items), [items]);

  return (
    <View style={styles.grid}>
      <View style={styles.column}>
        {leftCol.map((item) => (
          <MasonryItem
            key={item.id}
            item={item}
            width={colWidth}
            onPress={() => onPressItem(item)}
            onLongPress={() => onLongPressItem(item)}
          />
        ))}
      </View>
      <View style={styles.column}>
        {rightCol.map((item) => (
          <MasonryItem
            key={item.id}
            item={item}
            width={colWidth}
            onPress={() => onPressItem(item)}
            onLongPress={() => onLongPressItem(item)}
          />
        ))}
      </View>
    </View>
  );
}

interface MasonryItemProps {
  item: MediaItem;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}

function MasonryItem({ item, width, onPress, onLongPress }: MasonryItemProps) {
  const colors = useColors();
  const height = clampHeight(item, width);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.kind === 'video' ? ', video' : ''} by ${item.uploaderName ?? 'unknown'}`}
      style={({ pressed }) => [
        { width, height, borderRadius: 12, overflow: 'hidden', opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      {item.kind === 'video' ? (
        <View style={styles.playIcon}>
          <Ionicons name="play" size={20} color={colors.accentText} />
        </View>
      ) : null}
    </Pressable>
  );
}

function clampHeight(item: MediaItem, colWidth: number): number {
  const natural = (item.height / item.width) * colWidth;
  return Math.min(MAX_ITEM_HEIGHT, Math.max(MIN_ITEM_HEIGHT, natural));
}

/** Shortest-column-first assignment keeps the two columns roughly balanced. */
function splitMasonry(items: MediaItem[]): [MediaItem[], MediaItem[]] {
  const left: MediaItem[] = [];
  const right: MediaItem[] = [];
  let leftHeight = 0;
  let rightHeight = 0;
  for (const item of items) {
    const h = (item.height / item.width) * 200; // relative height, clamp is per-render
    if (leftHeight <= rightHeight) {
      left.push(item);
      leftHeight += h + COLUMN_GAP;
    } else {
      right.push(item);
      rightHeight += h + COLUMN_GAP;
    }
  }
  return [left, right];
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
    paddingHorizontal: SCREEN_PAD,
  },
  column: {
    flex: 1,
    gap: COLUMN_GAP,
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
});
