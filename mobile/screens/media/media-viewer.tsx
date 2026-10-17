import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';

import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { mediaRepository } from '../../src/repositories/MediaRepository';
import { getErrorMessage } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/api/config';
import type { MediaItem } from '../../src/api/types';
import { formatDate } from '../../src/utils/format';

function VideoSlide({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  // Stop playback when the member swipes to another slide.
  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />;
}

/** Full-screen swipeable viewer for photos and videos. */
export default function MediaViewer() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const popup = usePopup();
  const { width, height } = useWindowDimensions();
  const [items, setItems] = useState<MediaItem[]>(route.params?.items ?? []);
  const [index, setIndex] = useState<number>(route.params?.index ?? 0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const viewable = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const first = viewableItems[0]?.index;
    if (first != null) setIndex(first);
  }).current;

  const current = items[index];

  const toggleLike = async () => {
    if (!current) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await mediaRepository.toggleLike(current._id);
      setLiked((prev) => ({ ...prev, [current._id]: res.liked }));
      setItems((prev) => prev.map((m) => (m._id === current._id ? { ...m, likes_count: res.likes_count } : m)));
    } catch (err) {
      await popup.error('Could not update like', getErrorMessage(err));
    }
  };

  const share = async () => {
    if (!current) return;
    const url = resolveMediaUrl(current.url) ?? '';
    try {
      await Share.share({ message: current.caption ? `${current.caption}\n${url}` : url, url });
    } catch {
      // User dismissed the share sheet.
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={items}
        horizontal
        pagingEnabled
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={viewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height }}>
            {item.media_type === 'video' ? (
              <VideoSlide uri={resolveMediaUrl(item.url)!} active={i === index} />
            ) : (
              <Image source={{ uri: resolveMediaUrl(item.url) }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            )}
          </View>
        )}
      />

      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.roundButton, { backgroundColor: colors.surface }]}
          accessibilityLabel="Close viewer"
        >
          <Icon name="close" size="md" />
        </Pressable>
        <Typography variant="mono" color="textMuted">
          {index + 1} / {items.length}
        </Typography>
      </SafeAreaView>

      {current ? (
        <SafeAreaView
          style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
          edges={['bottom']}
        >
          <View style={styles.captionBlock}>
            {current.caption ? (
              <Typography variant="body" numberOfLines={3}>
                {current.caption}
              </Typography>
            ) : null}
            <Typography variant="caption" color="textMuted">
              {current.uploader?.display_name ? `${current.uploader.display_name} · ` : ''}
              {formatDate(current.created_at)}
            </Typography>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => void toggleLike()} style={styles.action} accessibilityLabel="Like">
              <Icon name={liked[current._id] ? 'heart' : 'heart-outline'} size="md" color={liked[current._id] ? 'danger' : 'text'} />
              <Typography variant="caption">{current.likes_count}</Typography>
            </Pressable>
            <Pressable onPress={() => void share()} style={styles.action} accessibilityLabel="Share">
              <Icon name="share" size="md" />
              <Typography variant="caption">Share</Typography>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  captionBlock: { flex: 1, gap: 4 },
  actions: { flexDirection: 'row', gap: 16 },
  action: { alignItems: 'center', gap: 2 },
});
