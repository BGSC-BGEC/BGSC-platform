import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';

import { GlassFilterBar } from '@/components/media/GlassFilterBar';
import { ActionContextSheet, type MediaAction } from '@/components/media/ActionContextSheet';
import { MediaCategoryView } from '@/components/media/MediaCategoryView';
import type { MediaCallbacks } from '@/components/media/sections';
import {
  AlbumsSection,
  CommunitySection,
  HeroReelSection,
  HighlightsSection,
  MemoriesSection,
  SponsorsSection,
} from '@/components/media/sections';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import type {
  MediaAlbum,
  MediaCategory,
  MediaItem,
} from '@/core/repositories/MediaRepository';
import { useColors } from '@/hooks/use-colors';
import { useMediaReel } from '@/hooks/use-media';

/**
 * Media (master §9 / media-page-design.md) — public read, no guest gate.
 * Cinematic editorial feed: auto-playing Hero Reel (Ken Burns image stand-in
 * until expo-video lands), Highlights + Event Albums + Sponsors strips,
 * auth-only Memories card, 2-col Community masonry. Category chips collapse
 * to a single-section view; search filters strips + grids client-side.
 *
 * Phase stubs (taps toast, no routes yet):
 *   - Full-Screen Viewer (design §11) — Phase D
 *   - Album Detail route /(stack)/media/album/[id] (design §8) — Phase C
 *   - Memories viewer /(stack)/media/memories — Phase C
 *   - Advanced Filter sheet ⚙ (design §12) — Phase E
 *   - Real video reels + mute toggle (design §4.1) — needs media service + expo-video
 */
export default function MediaScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const { width: screenWidth } = useWindowDimensions();

  const [category, setCategory] = useState<MediaCategory>('all');
  const [query, setQuery] = useState('');
  const [sheetTitle, setSheetTitle] = useState<string | null>(null);

  const reel = useMediaReel();

  const callbacks: MediaCallbacks = {
    onOpenReel: () => viewerStub(toast),
    onOpenItem: () => viewerStub(toast),
    onLongPressItem: (item: MediaItem) => setSheetTitle(`${item.title} · ${item.uploaderName ?? 'community'}`),
    onOpenAlbum: () => albumStub(toast),
    onLongPressAlbum: (album: MediaAlbum) => setSheetTitle(album.eventName),
    onOpenSponsor: () => sponsorStub(toast),
    onOpenMemories: () => memoriesStub(toast),
    onSeeAll: (next) => setCategory(next),
    onClearFilters: () => {
      setQuery('');
      setCategory('all');
    },
  };

  const handleAction = (action: MediaAction) => {
    setSheetTitle(null);
    switch (action) {
      case 'download':
        if (!user) {
          toast.show('Sign in to download media', { actionLabel: 'Login', onAction: () => router.push('/login') });
        } else {
          toast.show('Downloads arrive with the media service (Phase 2).');
        }
        break;
      case 'share':
        void Share.share({ message: `${sheetTitle ?? 'BGSC media'} — shared from BGSC` });
        break;
      case 'report':
        if (!user) {
          toast.show('Sign in to report media', { actionLabel: 'Login', onAction: () => router.push('/login') });
        } else {
          toast.show('Reporting arrives with the media service (Phase 2).');
        }
        break;
    }
  };

  return (
    <Screen scroll={false} padded={false} bottomInset={24}>
      <GlassFilterBar query={query} onChangeQuery={setQuery} category={category} onChangeCategory={setCategory} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={reel.isRefetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['media'] })}
            tintColor={colors.textMuted}
          />
        }
      >
        {category === 'all' ? (
          <View>
            <HeroReelSection
              reels={reel.data ?? []}
              callbacks={callbacks}
              loading={reel.isPending}
              height={Math.min(screenWidth * (9 / 16), screenWidth * 0.55)}
            />
            <HighlightsSection query={query} callbacks={callbacks} />
            <AlbumsSection query={query} callbacks={callbacks} />
            {user ? <MemoriesSection callbacks={callbacks} /> : null}
            <CommunitySection query={query} callbacks={callbacks} />
            <SponsorsSection callbacks={callbacks} />
          </View>
        ) : (
          <MediaCategoryView
            category={category}
            query={query}
            onLogin={() => router.push('/login')}
            callbacks={callbacks}
          />
        )}
      </ScrollView>

      <ActionContextSheet visible={sheetTitle !== null} title={sheetTitle ?? undefined} onClose={() => setSheetTitle(null)} onAction={handleAction} />
    </Screen>
  );
}

// ─── Phase stubs ──────────────────────────────────────────────────────────────

function viewerStub(toast: { show: (m: string) => void }): void {
  toast.show('Full-screen viewer arrives with Phase 2 media.');
}

function albumStub(toast: { show: (m: string) => void }): void {
  toast.show('Album detail arrives with Phase 2 media.');
}

function sponsorStub(toast: { show: (m: string) => void }): void {
  toast.show('Sponsor galleries arrive with Phase 2 media.');
}

function memoriesStub(toast: { show: (m: string) => void }): void {
  toast.show('Your memories slideshow arrives with Phase 2 media.');
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
});
