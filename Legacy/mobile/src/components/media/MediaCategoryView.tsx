import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { CommunityMasonry } from '@/components/media/CommunityMasonry';
import { GlassMediaCard } from '@/components/media/GlassMediaCard';
import { MemoriesCard } from '@/components/media/MemoriesCard';
import { SectionHeader } from '@/components/media/SectionHeader';
import type { MediaCallbacks } from '@/components/media/sections';
import { MasonrySkeleton, MediaEmpty, MediaError, MemoriesSkeleton, StripSkeleton } from '@/components/media/SectionStates';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import type { MediaCategory } from '@/core/repositories/MediaRepository';
import { useColors } from '@/hooks/use-colors';
import {
  useMediaAlbums,
  useMediaCommunity,
  useMediaHighlights,
  useMediaMemories,
  useMediaSponsors,
} from '@/hooks/use-media';

const SCREEN_PAD = 16;
const GRID_GAP = 8;

interface MediaCategoryViewProps {
  category: MediaCategory;
  query: string;
  onLogin: () => void;
  callbacks: MediaCallbacks;
}

/**
 * Single-category view (media-page-design.md §3.2 Phase B): the page collapses
 * to one category's content when a chip is selected. Highlights/Community use
 * the masonry; Albums/Sponsors use a 2-col square grid; Memories renders the
 * auth card (or a login prompt for guests).
 */
export function MediaCategoryView({ category, query, onLogin, callbacks }: MediaCategoryViewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const colWidth = (screenWidth - SCREEN_PAD * 2 - GRID_GAP) / 2;

  switch (category) {
    case 'highlights':
      return <HighlightsGrid query={query} callbacks={callbacks} />;
    case 'albums':
      return <AlbumsGrid colWidth={colWidth} query={query} callbacks={callbacks} />;
    case 'community':
      return <CommunityGrid query={query} callbacks={callbacks} />;
    case 'memories':
      return (
        <View>
          <SectionHeader title="MEMORIES" />
          <MemoriesView onLogin={onLogin} callbacks={callbacks} />
        </View>
      );
    case 'sponsors':
      return <SponsorsGrid colWidth={colWidth} callbacks={callbacks} />;
    default:
      return null;
  }
}

function HighlightsGrid({ query, callbacks }: { query: string; callbacks: MediaCallbacks }) {
  const { data, isPending, isError, refetch } = useMediaHighlights();
  if (isPending) return <MasonrySkeleton />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  const items = (data ?? []).filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View>
      <SectionHeader title="HIGHLIGHTS" />
      {items.length === 0 ? (
        <MediaEmpty message={query ? 'No highlights match your search' : 'No highlights yet'} />
      ) : (
        <CommunityMasonry items={items} onPressItem={callbacks.onOpenItem} onLongPressItem={callbacks.onLongPressItem} />
      )}
    </View>
  );
}

function CommunityGrid({ query, callbacks }: { query: string; callbacks: MediaCallbacks }) {
  const { data, isPending, isError, refetch } = useMediaCommunity();
  if (isPending) return <MasonrySkeleton />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  const items = (data ?? []).filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View>
      <SectionHeader title="COMMUNITY" />
      {items.length === 0 ? (
        <MediaEmpty message={query ? 'No media matches your filters' : 'No community media yet'} />
      ) : (
        <CommunityMasonry items={items} onPressItem={callbacks.onOpenItem} onLongPressItem={callbacks.onLongPressItem} />
      )}
    </View>
  );
}

function AlbumsGrid({
  colWidth,
  query,
  callbacks,
}: {
  colWidth: number;
  query: string;
  callbacks: MediaCallbacks;
}) {
  const { data, isPending, isError, refetch } = useMediaAlbums();
  if (isPending) return <StripSkeleton width={colWidth} height={colWidth} count={2} />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  const albums = (data ?? []).filter((a) => a.eventName.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View>
      <SectionHeader title="EVENT ALBUMS" />
      {albums.length === 0 ? (
        <MediaEmpty message={query ? 'No albums match your search' : 'No albums yet'} />
      ) : (
        <View style={styles.grid}>
          {albums.map((album) => (
            <GlassMediaCard
              key={album.id}
              uri={album.coverUri}
              title={album.eventName}
              subtitle={`${album.photoCount} pics · ${album.videoCount} videos`}
              width={colWidth}
              aspectRatio={1}
              badgeIcon="albums-outline"
              onPress={() => callbacks.onOpenAlbum(album)}
              onLongPress={() => callbacks.onLongPressAlbum(album)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SponsorsGrid({ colWidth, callbacks }: { colWidth: number; callbacks: MediaCallbacks }) {
  const { data, isPending, isError, refetch } = useMediaSponsors();
  if (isPending) return <StripSkeleton width={colWidth} height={colWidth} count={2} />;
  if (isError) return <MediaError onRetry={() => refetch()} />;
  const sponsors = data ?? [];
  return (
    <View>
      <SectionHeader title="SPONSORS" />
      {sponsors.length === 0 ? (
        <MediaEmpty message="No sponsor galleries yet" />
      ) : (
        <View style={styles.grid}>
          {sponsors.map((sponsor) => (
            <GlassMediaCard
              key={sponsor.id}
              uri={sponsor.coverUri}
              title={sponsor.sponsorName}
              width={colWidth}
              aspectRatio={1}
              logoUri={sponsor.logoUri}
              onPress={() => callbacks.onOpenSponsor(sponsor)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function MemoriesView({ onLogin, callbacks }: { onLogin: () => void; callbacks: MediaCallbacks }) {
  const { width: screenWidth } = useWindowDimensions();
  const { data, isPending } = useMediaMemories(true);
  if (isPending) return <MemoriesSkeleton height={screenWidth * 0.55} />;
  if (data) return <MemoriesCard summary={data} onPress={() => callbacks.onOpenMemories(data)} />;
  return <GuestMemoriesPrompt onLogin={onLogin} />;
}

/** Auth-only section, guest asked to sign in (design §18 permission logic). */
function GuestMemoriesPrompt({ onLogin }: { onLogin: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.guestCard, { borderColor: colors.border, backgroundColor: colors.backgroundMid }]}>
      <Ionicons name="sparkles-outline" size={22} color={colors.accent} />
      <Text style={[styles.guestTitle, { color: colors.text }]}>Your season, in moments</Text>
      <Text style={[styles.guestBody, { color: colors.textMuted }]}>
        Sign in to see your personal memories reel from this season.
      </Text>
      <PillButton label="Login" variant="ghost" onPress={onLogin} fullWidth={false} style={styles.guestCta} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: SCREEN_PAD,
  },
  guestCard: {
    marginHorizontal: SCREEN_PAD,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  guestTitle: {
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  guestBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  guestCta: {
    marginTop: 6,
    paddingHorizontal: 28,
  },
});
