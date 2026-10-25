import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { BottomSheet } from '../../src/components/BottomSheet';
import { Badge } from '../../src/components/Badge';
import { Fab } from '../../src/components/Fab';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { TextInput } from '../../src/forms/TextInput';
import { Alert } from '../../src/feedback/Alert';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { mediaUploadError } from '../../src/utils/community';
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
import { useResponsive } from '../../src/responsive/useResponsive';
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

const COLUMNS = 2;
const GAP = 8;

export default function Media() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { contentWidth, gutter } = useResponsive();
  const tileSize = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  const [album, setAlbum] = useState<string>('all');
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState('');
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('community');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadLock = useRef(false);
  const [albumPage, setAlbumPage] = useState(1);
  const albums = useAsyncResource(() => mediaRepository.albums({ page: albumPage }), [albumPage]);
  const pending = useAsyncResource(() => mediaRepository.list({ mine: true, status: 'pending', limit: 50 }), []);
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
          album_id: album === 'all' ? undefined : album,
          status: 'approved',
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
    [type, category, album],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const chooseFiles = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setUploadError('Allow photo library access to share media with the community.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, allowsMultipleSelection: true, selectionLimit: 5 });
      if (result.canceled) return;
      for (const asset of result.assets) {
        const problem = mediaUploadError(asset.mimeType ?? '', asset.fileSize);
        if (problem) { setUploadError(problem); return; }
      }
      setSelected(result.assets); setUploadError(null);
    } catch (err) { setUploadError(getErrorMessage(err)); }
  };

  const upload = async () => {
    if (uploadLock.current || !selected.length) return;
    uploadLock.current = true; setUploading(true); setUploadError(null);
    try {
      for (const asset of selected) {
        await mediaRepository.upload({ uri: asset.uri, mimeType: asset.mimeType!, filename: asset.fileName ?? 'upload', category: uploadCategory, caption: caption.trim() || undefined, album_id: album === 'all' ? undefined : album });
        setSelected((prev) => prev.filter((item) => item.uri !== asset.uri));
      }
      setSheet(false); setCaption('');
    } catch (err) { setUploadError(getErrorMessage(err)); }
    finally {
      uploadLock.current = false; setUploading(false);
      void pending.reload(); void load('refresh');
    }
  };

  const header = (
    <View style={styles.header}>
      <Typography variant="displayTitle">Moments</Typography>
      <Typography variant="body" color="textMuted">Photos and videos from BGSC events and the community.</Typography>
      <SegmentedTabs tabs={TYPES} value={type} onChange={setType} />
      <FilterChips options={CATEGORIES} value={category} onChange={setCategory} />
      <SectionHeader title="Albums" />
      {albums.loading ? <Skeleton height={80} /> : albums.error ? <ErrorState title="Could not load albums" message={albums.error} onRetry={() => void albums.reload()} /> : albums.data?.items.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRow}>
        <Card onPress={() => setAlbum('all')} selected={album === 'all'} style={styles.album}><Icon name="image" color="accent" /><Typography variant="h4">All moments</Typography></Card>
        {albums.data.items.map((item) => <Card key={item._id} onPress={() => setAlbum(item._id)} selected={album === item._id} style={styles.album}><Icon name="image" color="accent" /><Typography variant="h4">{item.title}</Typography><Typography variant="caption" color="textMuted">{item.media_count} items</Typography></Card>)}
      </ScrollView> : <Typography color="textMuted">Albums will appear after your first event.</Typography>}
      {(albums.data?.total_pages ?? 1) > 1 ? <View style={styles.albumRow}><Button label="Previous albums" variant="ghost" disabled={albumPage === 1} onPress={() => setAlbumPage(albumPage - 1)} /><Button label="More albums" variant="ghost" disabled={albumPage >= (albums.data?.total_pages ?? 1)} onPress={() => setAlbumPage(albumPage + 1)} /></View> : null}
      {pending.error ? <ErrorState title="Your pending uploads are unavailable" message={pending.error} onRetry={() => void pending.reload()} /> : null}
      {pending.data?.items.length ? (
        <Card variant="inner">
          <View style={styles.pendingHeader}>
            <Icon name="clock" color="warning" />
            <View style={{ flex: 1 }}>
              <Typography variant="h4">{pending.data.total} pending review</Typography>
              <Typography variant="caption" color="textMuted">Visible only to you and authorised moderators.</Typography>
            </View>
            <Badge label="Pending" variant="warning" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumRow}>
            {pending.data.items.map((item) => {
              const previewUri = resolveMediaUrl(item.thumbnail_url ?? item.url ?? `/media/${item._id}/file`);
              return (
                <View key={item._id} style={[styles.pendingTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.pendingThumb, { backgroundColor: colors.surfaceInner }]}>
                    {item.media_type === 'image' && previewUri ? (
                      <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    ) : (
                      <Icon name={item.media_type === 'video' ? 'play-circle' : 'image'} color="accent" size="lg" />
                    )}
                  </View>
                  <Typography variant="caption" color="textMuted" numberOfLines={1}>
                    {item.caption || item.original_filename || 'Pending upload'}
                  </Typography>
                </View>
              );
            })}
          </ScrollView>
        </Card>
      ) : null}
      <SectionHeader title="Gallery" badge={loading ? undefined : total} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Media" />
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(item) => item._id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.columns}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load('refresh'); void pending.reload(); void albums.reload(); }} tintColor={colors.accent} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!loading && !loadingMore && page < totalPages) void load('more', page + 1);
        }}
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => navigation.navigate('MediaViewer', { id: item._id, ids: items.map((entry) => entry._id) })}
            style={({ pressed }) => [
              styles.tile,
              { width: tileSize, height: tileSize * 1.18, backgroundColor: colors.surfaceInner },
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
            <View style={[styles.likes, { backgroundColor: colors.surface }]}><Typography variant="caption">♥ {item.likes_count}</Typography></View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
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
        ListFooterComponent={loadingMore ? <Spinner style={styles.footer} /> : error && items.length ? <ErrorState title="Could not refresh media" message={error} onRetry={() => void load('refresh')} /> : null}
      />
      <Fab label="Share" onPress={() => setSheet(true)} />
      <BottomSheet visible={sheet} onClose={() => { if (!uploading) setSheet(false); }} dismissOnBackdrop={!uploading} style={{ maxHeight: '90%' }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
          <Typography variant="h2">Share with BGSC</Typography>
          <ScrollView horizontal contentContainerStyle={styles.albumRow}>{selected.map((asset) => <View key={asset.uri} style={styles.preview}>{asset.type === 'video' ? <Icon name="play-circle" color="accent" size="xl" /> : <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>)}</ScrollView>
          <Button label={selected.length ? 'Change selection' : 'Choose photos or videos'} variant="outline" disabled={uploading} onPress={() => void chooseFiles()} />
          <TextInput label="Caption" value={caption} onChangeText={setCaption} maxLength={500} disabled={uploading} />
          <FilterChips options={CATEGORIES.filter((item) => item.value !== 'all') as Array<{ label: string; value: MediaCategory }>} value={uploadCategory} onChange={setUploadCategory} />
          <Alert variant="info" title="Reviewed before publication" description="Images up to 10 MB; videos up to 50 MB. JPG, PNG, WebP, MP4 and WebM are supported." />
          {uploadError ? <Alert variant="error" title="Could not upload" description={uploadError} /> : null}
          <Button label={`Upload${selected.length ? ` ${selected.length}` : ''}`} loading={uploading} disabled={!selected.length} onPress={() => void upload()} />
          <Button label="Cancel" variant="outline" disabled={uploading} onPress={() => setSheet(false)} />
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 100, gap: GAP },
  albumRow: { gap: 12, paddingVertical: 4 },
  album: { width: 150, minHeight: 110 },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingTile: { width: 112, borderRadius: 14, borderWidth: 1, padding: 6, gap: 6 },
  pendingThumb: { width: '100%', height: 76, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  preview: { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sheetContent: { gap: 16, paddingBottom: 12 },
  likes: { position: 'absolute', left: 8, bottom: 8, borderRadius: 20, padding: 6 },
  header: { gap: 16, marginBottom: 8 },
  columns: { gap: GAP },
  tile: { borderRadius: 16, overflow: 'hidden' },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pressed: { opacity: 0.8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  footer: { paddingVertical: 16 },
});
