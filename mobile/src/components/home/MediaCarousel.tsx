import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { useColors } from '@/hooks/use-colors';

import { ImageViewer } from './ImageViewer';
import { VideoPlayer } from './VideoPlayer';

interface MediaItem {
  type: 'image' | 'video';
  uri: string;
}

interface Props {
  media: MediaItem[];
}

const ITEM_HEIGHT = 220;

/**
 * Renders a single image, multi-image paginated carousel, or inline video player.
 *
 * - Single image:  full-width image, tap → full-screen ImageViewer
 * - Multi image:   horizontal paginated FlatList with dot indicator, tap → ImageViewer at that index
 * - Single video:  inline VideoPlayer with play/pause/mute/progress controls
 * - Mixed (future): mixed carousel (video items tap to play inline; image items tap to open viewer)
 */
export function MediaCarousel({ media }: Props) {
  const colors = useColors();

  // Measured width of the carousel container — FlatList items must match this exactly.
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  if (media.length === 0) return null;

  const imageUris = media.filter((m) => m.type === 'image').map((m) => m.uri);

  const openViewer = (mediaIndex: number) => {
    const item = media[mediaIndex];
    if (item?.type !== 'image') return;
    const imageIndex = imageUris.indexOf(item.uri);
    setViewerStartIndex(imageIndex >= 0 ? imageIndex : 0);
    setViewerVisible(true);
  };

  // ── Render a single slide ───────────────────────────────────────────────
  const renderSlide = (item: MediaItem, index: number) => {
    const w = containerWidth > 0 ? containerWidth : 0;

    if (item.type === 'video') {
      return (
        <View style={{ width: w }}>
          <VideoPlayer width={w} height={ITEM_HEIGHT} />
        </View>
      );
    }

    const imageContent = item.uri.startsWith('http') ? (
      <Image
        source={{ uri: item.uri }}
        style={{ width: w, height: ITEM_HEIGHT }}
        contentFit="cover"
        transition={300}
        accessibilityLabel={`Post image ${index + 1}`}
      />
    ) : (
      <View
        style={[
          styles.imgPlaceholder,
          { width: w, height: ITEM_HEIGHT, backgroundColor: colors.border },
        ]}>
        <Text style={styles.imgPlaceholderIcon}>🖼</Text>
        {media.length > 1 && (
          <Text style={[styles.imgPlaceholderSub, { color: colors.textMuted }]}>
            Image {index + 1}
          </Text>
        )}
      </View>
    );

    return (
      <Pressable style={{ width: w }} onPress={() => openViewer(index)} accessibilityLabel="Open image viewer">
        {imageContent}
      </Pressable>
    );
  };

  // ── Single-item shortcut ────────────────────────────────────────────────
  if (media.length === 1) {
    return (
      <View
        style={styles.singleWrap}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        {containerWidth > 0 && renderSlide(media[0], 0)}
        <ImageViewer
          visible={viewerVisible}
          images={imageUris}
          initialIndex={viewerStartIndex}
          onClose={() => setViewerVisible(false)}
        />
      </View>
    );
  }

  // ── Multi-item carousel ─────────────────────────────────────────────────
  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 && (
        <FlatList
          horizontal
          pagingEnabled
          snapToInterval={containerWidth}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          data={media}
          keyExtractor={(_, i) => String(i)}
          style={{ width: containerWidth, borderRadius: 10, overflow: 'hidden' }}
          getItemLayout={(_, i) => ({
            length: containerWidth,
            offset: containerWidth * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) => {
            setActiveIndex(
              Math.round(e.nativeEvent.contentOffset.x / containerWidth)
            );
          }}
          renderItem={({ item, index }) => renderSlide(item, index)}
        />
      )}

      {/* Dot indicator strip */}
      <View style={styles.dotRow}>
        {media.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === activeIndex ? colors.accent : colors.border,
                width: i === activeIndex ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>

      <ImageViewer
        visible={viewerVisible}
        images={imageUris}
        initialIndex={viewerStartIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  singleWrap: { borderRadius: 10, overflow: 'hidden' },

  imgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
  },
  imgPlaceholderIcon: { fontSize: 38, opacity: 0.65 },
  imgPlaceholderSub: { fontSize: 13 },

  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  dot: { height: 6, borderRadius: 3 },
});
