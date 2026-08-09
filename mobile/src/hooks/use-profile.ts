import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { UserRepository } from '@/core/repositories/UserRepository';

/**
 * Profile queries (master doc §12.3 key conventions).
 *
 * The player card is the single purpose-built source for the hero section
 * (identity, sponsor, interest labels, aggregate stats); the full profile
 * adds bio, cover, social links and friend tags. Sponsor stats are a third
 * independent query (they can be null — not affiliated).
 */

/** Derive the exact shape the repository returns — no duplicated interface. */
export type PlayerCardData = Awaited<ReturnType<typeof UserRepository.getPlayerCard>>;

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => UserRepository.getProfile(),
    staleTime: 60_000,
  });
}

export function usePlayerCard() {
  return useQuery({
    queryKey: ['profile', 'player-card'],
    queryFn: () => UserRepository.getPlayerCard(),
    staleTime: 60_000,
  });
}

/** null = user is not affiliated with a sponsor. */
export function useSponsorStats() {
  return useQuery({
    queryKey: ['profile', 'sponsor-stats'],
    queryFn: () => UserRepository.getSponsorStats(),
    staleTime: 60_000,
  });
}

// ─── History (master §12.3: ['profile','history',<kind>]) ────────────────────

/** Events tab — real endpoint (event-service GET /events/me/registrations, 20/page). */
export function useEventHistory() {
  return useInfiniteQuery({
    queryKey: ['profile', 'history', 'events'],
    queryFn: ({ pageParam }) => UserRepository.getEventHistory(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length + 1 : undefined,
  });
}

/** Matches tab — Phase 3 stub (team service); repository resolves []. */
export function useMatchHistory(enabled: boolean) {
  return useQuery({
    queryKey: ['profile', 'history', 'matches'],
    queryFn: () => UserRepository.getMatchHistory(1),
    enabled,
  });
}

/** Challenges tab — Phase 2 stub (challenge service); repository resolves []. */
export function useChallengeHistory(enabled: boolean) {
  return useQuery({
    queryKey: ['profile', 'history', 'challenges'],
    queryFn: () => UserRepository.getChallengeHistory(1),
    enabled,
  });
}

/** Sponsor tab — Phase 2 stub (sponsor_fan_transactions); repository resolves []. */
export function useSponsorHistory(enabled: boolean) {
  return useQuery({
    queryKey: ['profile', 'history', 'sponsor'],
    queryFn: () => UserRepository.getSponsorHistory(1),
    enabled,
  });
}
