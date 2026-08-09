import { useQuery } from '@tanstack/react-query';

import { MediaRepository } from '@/core/repositories/MediaRepository';
import { useAuthStore } from '@/core/stores/authStore';

/**
 * Media queries (master §12.3 key conventions — ['media', <section>]).
 * Public read screen — no guest gate. Mock-backed until the media service
 * ships (see MediaRepository TODO). 60 s staleTime; pull-to-refresh is the
 * freshness mechanism, matching useHallOfFame.
 */
export function useMediaReel() {
  return useQuery({
    queryKey: ['media', 'reel'],
    queryFn: () => MediaRepository.getReels(),
    staleTime: 60_000,
  });
}

export function useMediaHighlights() {
  return useQuery({
    queryKey: ['media', 'highlights'],
    queryFn: () => MediaRepository.getHighlights(),
    staleTime: 60_000,
  });
}

export function useMediaAlbums() {
  return useQuery({
    queryKey: ['media', 'albums'],
    queryFn: () => MediaRepository.getAlbums(),
    staleTime: 60_000,
  });
}

export function useMediaCommunity() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['media', 'community'],
    queryFn: () => MediaRepository.getCommunity(Boolean(user)),
    staleTime: 60_000,
  });
}

export function useMediaSponsors() {
  return useQuery({
    queryKey: ['media', 'sponsors'],
    queryFn: () => MediaRepository.getSponsors(),
    staleTime: 60_000,
  });
}

/** Auth-only (media-page-design.md §7) — `enabled` keeps it idle for guests. */
export function useMediaMemories(enabled: boolean) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['media', 'memories'],
    queryFn: () => MediaRepository.getMemories(user?.id ?? 'me'),
    enabled,
    staleTime: 60_000,
  });
}
