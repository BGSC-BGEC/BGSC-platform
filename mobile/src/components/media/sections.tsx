import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CommunityMasonry } from '@/components/media/CommunityMasonry';
import { GlassMediaCard } from '@/components/media/GlassMediaCard';
import { HeroReel } from '@/components/media/HeroReel';
import { MemoriesCard } from '@/components/media/MemoriesCard';
import { SectionHeader } from '@/components/media/SectionHeader';
import { HeroSkeleton, LargeEmpty, MasonrySkeleton, MediaEmpty, MediaError, MemoriesSkeleton, StripSkeleton } from '@/components/media/SectionStates';
import type {
  MediaAlbum,
  MediaCategory,
  MediaItem,
  MediaReel,
  MediaSponsorGallery,
  MemoriesSummary,
} from '@/core/repositories/MediaRepository';
import {
  useMediaAlbums,
  useMediaCommunity,
  useMediaHighlights,
  useMediaMemories,
  useMediaSponsors,
} from '@/hooks/use-media';

const SCREEN_PAD = 16;
const STRIP_GAP = 12;

export interface MediaCallbacks {
  onOpenReel: (reel: MediaReel) => void;
  onOpenItem: (item: MediaItem) => void;
  onLongPressItem: (item: MediaItem) => void;
  onOpenAlbum: (album: MediaAlbum) => void;
  onLongPressAlbum: (album: MediaAlbum) => void;
  onOpenSponsor: (sponsor: MediaSponsorGallery) => void;
  onOpenMemories: (summary: MemoriesSummary) => void;
  onSeeAll: (category: MediaCategory) => void;
  onClearFilters: () => void;
}

/** Hero Reel (design §4). */
export function HeroReelSection({
  reels,
  callbacks,
  loading,
  height,
}: {
  reels: MediaReel[];
  callbacks: MediaCallbacks;
  loading: boolean;
  height: number;
}) {
  if (loading) return <HeroSkeleton height={height} />;
  if (reels.length === 0) return null; // design §15: hero hidden when empty
  return <HeroReel reels={reels} onOpen={callbacks.onOpenReel} />;
}

/** HIGHLIGHTS strip (design §5) — hidden entirely when empty (design §15). */
export function HighlightsSection({ query, callbacks }: { query: string; callbacks: MediaCallbacks }) {
  const { width: screenWidth } = useWindowDimensions();
  const { data, isPending, isError, refetch } = useMediaHighlights();
  const items = filterByQuery(data ?? [], query, (item) => item.title);

  if (isPending) return <StripSkeleton width={screenWidth * 0.65} height={(screenWidth * 0.65) / (3 / 4)} />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  if (items.length === 0) return null;

  return (
    <View>
      <SectionHeader title="HIGHLIGHTS" subtitle="Season recaps & matchday moments" onSeeAll={() => callbacks.onSeeAll('highlights')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {items.map((item) => (
          <GlassMediaCard
            key={item.id}
            uri={item.uri}
            title={item.title}
            width={screenWidth * 0.65}
            aspectRatio={3 / 4}
            isVideo
            durationSec={item.durationSec}
            condensedTitle
            onPress={() => callbacks.onOpenItem(item)}
            onLongPress={() => callbacks.onLongPressItem(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** EVENT ALBUMS strip (design §6) — inline empty text when empty (design §15). */
export function AlbumsSection({ query, callbacks }: { query: string; callbacks: MediaCallbacks }) {
  const { width: screenWidth } = useWindowDimensions();
  const { data, isPending, isError, refetch } = useMediaAlbums();
  const albums = filterByQuery(data ?? [], query, (a) => a.eventName);

  return (
    <View>
      <SectionHeader title="EVENT ALBUMS" onSeeAll={albums.length > 0 ? () => callbacks.onSeeAll('albums') : undefined} />
      {isPending ? (
        <StripSkeleton width={screenWidth * 0.48} height={screenWidth * 0.48} count={3} />
      ) : isError ? (
        <MediaError onRetry={() => refetch()} />
      ) : albums.length === 0 ? (
        <MediaEmpty message={query ? 'No albums match your search' : 'No albums yet'} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {albums.map((album) => (
            <GlassMediaCard
              key={album.id}
              uri={album.coverUri}
              title={album.eventName}
              subtitle={`${album.photoCount} pics · ${album.videoCount} videos`}
              width={screenWidth * 0.48}
              aspectRatio={1}
              badgeIcon="albums-outline"
              onPress={() => callbacks.onOpenAlbum(album)}
              onLongPress={() => callbacks.onLongPressAlbum(album)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** SPONSORS strip (design §9) — hidden entirely when empty (design §15). */
export function SponsorsSection({ callbacks }: { callbacks: MediaCallbacks }) {
  const { width: screenWidth } = useWindowDimensions();
  const { data, isPending, isError, refetch } = useMediaSponsors();

  if (isPending) return <StripSkeleton width={screenWidth * 0.48} height={screenWidth * 0.48} count={2} />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  if (!data || data.length === 0) return null;

  return (
    <View>
      <SectionHeader title="SPONSORS" onSeeAll={() => callbacks.onSeeAll('sponsors')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {data.map((sponsor) => (
          <GlassMediaCard
            key={sponsor.id}
            uri={sponsor.coverUri}
            title={sponsor.sponsorName}
            width={screenWidth * 0.48}
            aspectRatio={1}
            logoUri={sponsor.logoUri}
            onPress={() => callbacks.onOpenSponsor(sponsor)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** COMMUNITY masonry (design §8) — large empty state with clear CTA when filtered. */
export function CommunitySection({ query, callbacks }: { query: string; callbacks: MediaCallbacks }) {
  const { data, isPending, isError, refetch } = useMediaCommunity();
  const items = filterByQuery(data ?? [], query, (item) => item.title);

  if (isPending) return <MasonrySkeleton />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  if (items.length === 0) {
    return (
      <LargeEmpty
        title={query ? 'No media matches your filters' : 'No community media yet'}
        message={query ? 'Try a different search term.' : 'Be the first to share a moment from the field.'}
        onClear={query ? callbacks.onClearFilters : undefined}
      />
    );
  }

  return (
    <View>
      <SectionHeader title="COMMUNITY" subtitle="Uploads from the stands & the field" />
      <CommunityMasonry items={items} onPressItem={callbacks.onOpenItem} onLongPressItem={callbacks.onLongPressItem} />
    </View>
  );
}

/** YOUR MEMORIES card (design §7) — auth only; hidden on error (design §15). */
export function MemoriesSection({ callbacks }: { callbacks: MediaCallbacks }) {
  const { width: screenWidth } = useWindowDimensions();
  const { data, isPending } = useMediaMemories(true);

  if (isPending) return <MemoriesSkeleton height={screenWidth * 0.55} />;
  if (!data) return null;
  return <MemoriesCard summary={data} onPress={() => callbacks.onOpenMemories(data)} />;
}

/** Client-side keyword filter shared by strips and grids. */
function filterByQuery<T>(items: T[], query: string, field: (item: T) => string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => field(item).toLowerCase().includes(q));
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: SCREEN_PAD,
    gap: STRIP_GAP,
  },
});
