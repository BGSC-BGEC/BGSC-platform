import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';

import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Badge } from '../../src/components/Badge';
import { Avatar } from '../../src/components/Avatar';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
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
  const initialItems: MediaItem[] = route.params?.items ?? [];
  const ids: string[] = route.params?.ids ?? (route.params?.id ? [route.params.id] : initialItems.map((item) => item._id));
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [index, setIndex] = useState<number>(route.params?.id ? Math.max(0, ids.indexOf(route.params.id)) : route.params?.index ?? 0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const viewable = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const first = viewableItems[0]?.index;
    if (first != null) setIndex(first);
  }).current;

  const currentId = ids[index];
  const detail = useAsyncResource(() => mediaRepository.get(currentId), [currentId]);
  const [liking, setLiking] = useState(false);
  const likeBusy = useRef(false);
  useEffect(() => {
    if (detail.data?._id !== currentId) return;
    const item = detail.data;
    setItems((prev) => [...prev.filter((old) => old._id !== item._id), item]);
    if (item.liked_by_me !== undefined) setLiked((prev) => ({ ...prev, [item._id]: item.liked_by_me! }));
  }, [currentId, detail.data]);
  const current = items.find((item) => item._id === currentId);

  const toggleLike = async () => {
    if (!current || likeBusy.current) return;
    likeBusy.current = true; setLiking(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await mediaRepository.toggleLike(current._id);
      setLiked((prev) => ({ ...prev, [current._id]: res.liked }));
      setItems((prev) => prev.map((m) => (m._id === current._id ? { ...m, likes_count: res.likes_count } : m)));
    } catch (err) {
      await popup.error('Could not update like', getErrorMessage(err));
    } finally { likeBusy.current = false; setLiking(false); }
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
        key={width}
        data={ids}
        horizontal
        pagingEnabled
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(id) => id}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={viewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item: id, index: i }) => { const item = items.find((entry) => entry._id === id); return (
          <View style={{ width, height }}>
            {!item ? <View style={styles.loading}><Skeleton height={240} />{detail.error && i === index ? <ErrorState title="Could not load media" message={detail.error} onRetry={() => void detail.reload()} /> : null}</View> : item.media_type === 'video' ? (
              <VideoSlide uri={resolveMediaUrl(item.url)!} active={i === index} />
            ) : (
              <Image source={{ uri: resolveMediaUrl(item.url) }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
            )}
          </View>
        ); }}
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
          {index + 1} / {ids.length}
        </Typography>
      </SafeAreaView>

      {current ? (
        <SafeAreaView
          style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
          edges={['bottom']}
        >
          <ScrollView contentContainerStyle={styles.metadata}>
          {detail.error ? <ErrorState title="Could not refresh media" message={detail.error} onRetry={() => void detail.reload()} /> : null}
          <View style={styles.captionBlock}>
            <Avatar name={current.uploader?.display_name} uri={current.uploader?.avatar_url} size={32} />
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
          <View style={styles.tags}>{current.tags?.map((tag) => <Badge key={tag} label={`#${tag}`} variant="muted" />)}</View>
          <View style={styles.actions}>
            <Pressable disabled={liking} onPress={() => void toggleLike()} style={styles.action} accessibilityRole="button" accessibilityState={{ selected: liked[current._id], disabled: liking }} accessibilityLabel={liked[current._id] ? "Unlike" : "Like"}>
              <Icon name={liked[current._id] ? 'heart' : 'heart-outline'} size="md" color={liked[current._id] ? 'danger' : 'text'} />
              <Typography variant="caption">{current.likes_count}</Typography>
            </Pressable>
            <Pressable onPress={() => void share()} style={styles.action} accessibilityLabel="Share">
              <Icon name="share" size="md" />
              <Typography variant="caption">Share</Typography>
            </Pressable>
            <Pressable onPress={() => { const url = resolveMediaUrl(current.url); if (url) void Linking.openURL(url).catch((err) => popup.error('Could not open file', getErrorMessage(err))); }} style={styles.action} accessibilityRole="button" accessibilityLabel="Open original to save">
              <Icon name="external-link" size="md" /><Typography variant="caption">Open</Typography>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('App', { screen: 'Feedback', params: { reportMediaId: current._id } })} style={styles.action} accessibilityRole="button" accessibilityLabel="Report media">
              <Icon name="lock" size="md" /><Typography variant="caption">Report</Typography>
            </Pressable>
          </View>
          </ScrollView>
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
  roundButton: { width: 44, height: 44, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  metadata: { gap: 12 },
  bottomBar: {
    maxHeight: '50%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  captionBlock: { gap: 4 },
  loading: { flex: 1, justifyContent: 'center', padding: 20, gap: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
