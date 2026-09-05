/**
 * Media domain types + repository (media-page-design.md).
 *
 * The media service is Phase 2 — there is no `docs/Backend Documentation/`
 * entry for it and no live endpoints, so every method serves local mock data
 * behind a small delay (same pattern as `components/home/mock-feed.ts`).
 *
 * TODO(media): replace mocks with ApiClient calls once the media service
 * ships. Expected contract (media-page-design.md §5.3/§6/§8/§9):
 *   GET /media/reels                     — featured reels (category: featured)
 *   GET /media/highlights                — admin-curated recaps (category: highlight)
 *   GET /media/albums                    — event photo/video albums
 *   GET /media/community                 — public (+ friends_only when authed) uploads
 *   GET /media/sponsors                  — sponsor galleries
 *   GET /media/users/:userId/memories    — personal "year in review" summary
 * Query keys live in `hooks/use-media.ts` (['media', ...] per master §12.3).
 */

export type MediaCategory = 'all' | 'highlights' | 'albums' | 'community' | 'memories' | 'sponsors';

export type MediaKind = 'photo' | 'video';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  title: string;
  /** Thumbnail/remote asset uri. */
  uri: string;
  /** Intrinsic dimensions — masonry height derives from the ratio. */
  width: number;
  height: number;
  durationSec?: number;
  uploaderName?: string;
  visibility: 'public' | 'friends_only';
}

export interface MediaAlbum {
  id: string;
  eventId?: string;
  eventName: string;
  coverUri: string;
  photoCount: number;
  videoCount: number;
  createdAt: string;
}

export interface MediaSponsorGallery {
  id: string;
  sponsorId: string;
  sponsorName: string;
  coverUri: string;
  logoUri?: string;
}

export interface MediaReel {
  id: string;
  eventId?: string;
  eventName: string;
  title: string;
  imageUri: string;
  /** null/undefined → animated image fallback (no expo-av/expo-video installed). */
  videoUri?: string;
  durationSec?: number;
}

export interface MemoriesSummary {
  seasonLabel: string;
  itemCount: number;
  /** Collage covers, up to 6 (design §7.1). */
  coverUris: string[];
  highlightEventName?: string;
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 450));

// ─── Mock catalog ────────────────────────────────────────────────────────────
// Remote picsum.photos assets stand in until real media exists. All items are
// `visibility: 'public'` — no friends_only data to gate yet.

const REELS: MediaReel[] = [
  {
    id: 'reel-1',
    eventId: 'ev-offside-s3',
    eventName: 'Offside Season 3',
    title: 'Final Highlights',
    imageUri: 'https://picsum.photos/seed/bgsc-reel-offside/1280/720',
    durationSec: 154,
  },
  {
    id: 'reel-2',
    eventId: 'ev-airball-cup',
    eventName: 'Airball Cup',
    title: 'Championship Night',
    imageUri: 'https://picsum.photos/seed/bgsc-reel-airball/1280/720',
    durationSec: 128,
  },
];

const HIGHLIGHTS: MediaItem[] = [
  {
    id: 'hl-1',
    kind: 'video',
    title: 'Airball S2 — Semi Final',
    uri: 'https://picsum.photos/seed/bgsc-hl-airball/600/800',
    width: 600,
    height: 800,
    durationSec: 214,
    visibility: 'public',
  },
  {
    id: 'hl-2',
    kind: 'video',
    title: 'Offside S3 — Matchday 6',
    uri: 'https://picsum.photos/seed/bgsc-hl-offside/600/800',
    width: 600,
    height: 800,
    durationSec: 178,
    visibility: 'public',
  },
  {
    id: 'hl-3',
    kind: 'video',
    title: 'PowerPlay W4 — Finals',
    uri: 'https://picsum.photos/seed/bgsc-hl-powerplay/600/800',
    width: 600,
    height: 800,
    durationSec: 245,
    visibility: 'public',
  },
  {
    id: 'hl-4',
    kind: 'video',
    title: 'BGEC Valorant Open',
    uri: 'https://picsum.photos/seed/bgsc-hl-valorant/600/800',
    width: 600,
    height: 800,
    durationSec: 320,
    visibility: 'public',
  },
  {
    id: 'hl-5',
    kind: 'video',
    title: 'FitSoc 5K Charity Run',
    uri: 'https://picsum.photos/seed/bgsc-hl-fitsoc/600/800',
    width: 600,
    height: 800,
    durationSec: 96,
    visibility: 'public',
  },
];

const ALBUMS: MediaAlbum[] = [
  {
    id: 'al-1',
    eventId: 'ev-offside-s3',
    eventName: 'Offside Season 3',
    coverUri: 'https://picsum.photos/seed/bgsc-album-offside/600/600',
    photoCount: 142,
    videoCount: 8,
    createdAt: '2026-06-18T10:00:00.000Z',
  },
  {
    id: 'al-2',
    eventId: 'ev-airball-cup',
    eventName: 'Airball Cup',
    coverUri: 'https://picsum.photos/seed/bgsc-album-airball/600/600',
    photoCount: 98,
    videoCount: 12,
    createdAt: '2026-05-30T10:00:00.000Z',
  },
  {
    id: 'al-3',
    eventId: 'ev-fitsoc-marathon',
    eventName: 'FitSoc Marathon',
    coverUri: 'https://picsum.photos/seed/bgsc-album-fitsoc/600/600',
    photoCount: 67,
    videoCount: 4,
    createdAt: '2026-04-12T10:00:00.000Z',
  },
  {
    id: 'al-4',
    eventId: 'ev-waves-fest',
    eventName: 'Waves Surf Fest',
    coverUri: 'https://picsum.photos/seed/bgsc-album-waves/600/600',
    photoCount: 54,
    videoCount: 6,
    createdAt: '2026-03-02T10:00:00.000Z',
  },
];

const COMMUNITY: MediaItem[] = [
  {
    id: 'cm-1',
    kind: 'photo',
    title: 'Matchday crowd',
    uri: 'https://picsum.photos/seed/bgsc-cm-crowd/800/800',
    width: 800,
    height: 800,
    uploaderName: 'nikunj.bgsc',
    visibility: 'public',
  },
  {
    id: 'cm-2',
    kind: 'video',
    title: 'Final whistle sprint',
    uri: 'https://picsum.photos/seed/bgsc-cm-sprint/720/960',
    width: 720,
    height: 960,
    durationSec: 42,
    uploaderName: 'ananya.runs',
    visibility: 'public',
  },
  {
    id: 'cm-3',
    kind: 'photo',
    title: 'Team huddle',
    uri: 'https://picsum.photos/seed/bgsc-cm-huddle/960/540',
    width: 960,
    height: 540,
    uploaderName: 'kabir.airball',
    visibility: 'public',
  },
  {
    id: 'cm-4',
    kind: 'photo',
    title: 'Golden hour at the courts',
    uri: 'https://picsum.photos/seed/bgsc-cm-golden/800/600',
    width: 800,
    height: 600,
    uploaderName: 'dev.bgec',
    visibility: 'public',
  },
  {
    id: 'cm-5',
    kind: 'photo',
    title: 'Trophy lift',
    uri: 'https://picsum.photos/seed/bgsc-cm-trophy/640/800',
    width: 640,
    height: 800,
    uploaderName: 'meera.fit',
    visibility: 'public',
  },
  {
    id: 'cm-6',
    kind: 'video',
    title: 'Penalty shootout',
    uri: 'https://picsum.photos/seed/bgsc-cm-penalty/800/800',
    width: 800,
    height: 800,
    durationSec: 68,
    uploaderName: 'rohan.offside',
    visibility: 'public',
  },
  {
    id: 'cm-7',
    kind: 'photo',
    title: 'Paddlers after the race',
    uri: 'https://picsum.photos/seed/bgsc-cm-paddlers/720/960',
    width: 720,
    height: 960,
    uploaderName: 'waves.crew',
    visibility: 'public',
  },
  {
    id: 'cm-8',
    kind: 'photo',
    title: 'Sunrise warm-up',
    uri: 'https://picsum.photos/seed/bgsc-cm-sunrise/800/800',
    width: 800,
    height: 800,
    uploaderName: 'ananya.runs',
    visibility: 'public',
  },
];

const SPONSORS: MediaSponsorGallery[] = [
  {
    id: 'sp-1',
    sponsorId: 'sp-fitsoc',
    sponsorName: 'FitSoc',
    coverUri: 'https://picsum.photos/seed/bgsc-sponsor-fitsoc/600/600',
    logoUri: 'https://picsum.photos/seed/bgsc-logo-fitsoc/100/100',
  },
  {
    id: 'sp-2',
    sponsorId: 'sp-bgec',
    sponsorName: 'BGEC',
    coverUri: 'https://picsum.photos/seed/bgsc-sponsor-bgec/600/600',
    logoUri: 'https://picsum.photos/seed/bgsc-logo-bgec/100/100',
  },
  {
    id: 'sp-3',
    sponsorId: 'sp-airball',
    sponsorName: 'Airball',
    coverUri: 'https://picsum.photos/seed/bgsc-sponsor-airball/600/600',
    logoUri: 'https://picsum.photos/seed/bgsc-logo-airball/100/100',
  },
];

const MEMORIES: MemoriesSummary = {
  seasonLabel: 'BGSC 2025–26',
  itemCount: 47,
  coverUris: [
    'https://picsum.photos/seed/bgsc-mem-1/400/400',
    'https://picsum.photos/seed/bgsc-mem-2/400/400',
    'https://picsum.photos/seed/bgsc-mem-3/400/400',
    'https://picsum.photos/seed/bgsc-mem-4/400/400',
    'https://picsum.photos/seed/bgsc-mem-5/400/400',
    'https://picsum.photos/seed/bgsc-mem-6/400/400',
  ],
  highlightEventName: 'Offside Season 3',
};

export const MediaRepository = {
  getReels(): Promise<MediaReel[]> {
    return delay().then(() => REELS);
  },

  getHighlights(): Promise<MediaItem[]> {
    return delay().then(() => HIGHLIGHTS);
  },

  getAlbums(): Promise<MediaAlbum[]> {
    return delay().then(() => ALBUMS);
  },

  /** Returns uploads visible to the caller — public always, friends_only only when authed. */
  getCommunity(authed: boolean): Promise<MediaItem[]> {
    const visible = COMMUNITY.filter(
      (item) => item.visibility === 'public' || (authed && item.visibility === 'friends_only'),
    );
    return delay().then(() => visible);
  },

  getSponsors(): Promise<MediaSponsorGallery[]> {
    return delay().then(() => SPONSORS);
  },

  /** Auth-only (media-page-design.md §7). */
  getMemories(userId: string): Promise<MemoriesSummary> {
    void userId;
    return delay().then(() => MEMORIES);
  },
};
