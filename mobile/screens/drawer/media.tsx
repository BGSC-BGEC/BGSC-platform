import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Spinner } from '../../src/feedback/Spinner';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { mediaRepository } from '../../src/repositories/MediaRepository';
import { getErrorMessage } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/api/config';
import type { MediaCategory, MediaItem } from '../../src/api/types';

type TypeFilter = 'all' | 'image' | 'video';
type CategoryFilter = 'all' | MediaCategory;

const TYPES: Array<{ label: string; value: TypeFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Photos', value: 'image' },
  { label: 'Videos', value: 'video' },
];

const CATEGORIES: Array<{ label: string; value: CategoryFilter }> = [
  { label: 'Everything', value: 'all' },
  { label: 'Events', value: 'event' },
  { label: 'Community', value: 'community' },
  { label: 'Memories', value: 'memories' },
  { label: 'Hall of Fame', value: 'hall_of_fame' },
  { label: 'Sponsors', value: 'sponsor' },
];

const COLUMNS = 3;
const GAP = 8;

export default function Media() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((width - 40 - GAP * (COLUMNS - 1)) / COLUMNS);

  const [type, setType] = useState<TypeFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', nextPage = 1) => {
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const res = await mediaRepository.list({
          media_type: type === 'all' ? undefined : type,
          category: category === 'all' ? undefined : category,
          page: nextPage,
          limit: 30,
        });
        if (id !== requestId.current) return;
        setItems((prev) => (mode === 'more' ? [...prev, ...res.items] : res.items));
        setPage(res.page);
        setTotalPages(res.total_pages ?? 1);
        setTotal(res.total);
        setError(null);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(getErrorMessage(err));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [type, category],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const upload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await popup.warning('Permission needed', 'Allow photo library access to share media with the community.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const okToSend = await popup.confirm({
      title: 'Share with BGSC?',
      message: `Your ${isVideo ? 'video' : 'photo'} will be reviewed by a moderator before it appears in the gallery.`,
      confirmLabel: 'Upload',
    });
    if (!okToSend) return;
    setUploading(true);
    try {
      await mediaRepository.upload({
        uri: asset.uri,
        mimeType: asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        filename: asset.fileName ?? (isVideo ? 'upload.mp4' : 'upload.jpg'),
        category: category === 'all' ? 'community' : category,
      });
      await popup.success('Upload received', 'Thanks for sharing! It will appear here once a moderator approves it.');
    } catch (err) {
      await popup.error('Upload failed', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <Typography variant="body" color="textMuted">Photos and videos from BGSC events and the community.</Typography>
      <FilterChips options={TYPES} value={type} onChange={setType} />
      <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />
      <Button label="Share a photo or video" variant="outline" leftIcon="camera" fullWidth loading={uploading} onPress={() => void upload()} />
      <SectionHeader title="Gallery" badge={loading ? undefined : total} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Media" />
      <FlatList
        data={loading || error ? [] : items}
        keyExtractor={(item) => item._id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.columns}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={colors.accent} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!loading && !loadingMore && page < totalPages) void load('more', page + 1);
        }}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => navigation.navigate('MediaViewer', { items, index })}
            style={({ pressed }) => [
              styles.tile,
              { width: tileSize, height: tileSize, backgroundColor: colors.surfaceInner },
              pressed && styles.pressed,
            ]}
            accessibilityRole="imagebutton"
            accessibilityLabel={item.caption ?? (item.media_type === 'video' ? 'Video' : 'Photo')}
          >
            {item.media_type === 'image' ? (
              <Image
                source={{ uri: resolveMediaUrl(item.thumbnail_url ?? item.url) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
                recyclingKey={item._id}
              />
            ) : (
              <View style={styles.videoTile}>
                <Icon name="play-circle" size="xl" color="accent" />
                {item.metadata?.duration_seconds ? (
                  <Typography variant="caption" color="textMuted">
                    {Math.floor(item.metadata.duration_seconds / 60)}:{String(Math.round(item.metadata.duration_seconds % 60)).padStart(2, '0')}
                  </Typography>
                ) : null}
              </View>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} width={tileSize} height={tileSize} borderRadius={16} />
              ))}
            </View>
          ) : error ? (
            <ErrorState title="Could not load media" message={error} onRetry={() => void load('initial')} />
          ) : (
            <Card variant="inner">
              <EmptyState icon="image" title="Nothing here yet" description="Photos and videos from events will show up here." />
            </Card>
          )
        }
        ListFooterComponent={loadingMore ? <Spinner style={styles.footer} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, gap: GAP },
  header: { gap: 16, marginBottom: 8 },
  columns: { gap: GAP },
  tile: { borderRadius: 16, overflow: 'hidden' },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pressed: { opacity: 0.8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  footer: { paddingVertical: 16 },
});
