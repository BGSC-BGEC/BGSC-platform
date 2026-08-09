import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { EventRepository } from '@/core/repositories/EventRepository';
import { HallOfFameRepository } from '@/core/repositories/HallOfFameRepository';
import { LeaderboardRepository } from '@/core/repositories/LeaderboardRepository';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { LeaderboardEntry } from '@/core/types';

/**
 * Leaderboard queries (master doc §12.3 key conventions, leaderboard.md).
 *
 * Reads reuse the existing event/hall-of-fame repositories — no new read
 * endpoints exist in event-service.md Phase 1 beyond `GET /events/:id/leaderboard`.
 */

export type SponsorSort = 'fans' | 'wins' | 'users';
export type SponsorTimeFilter = 'semester' | 'year' | 'all';

/**
 * Top-3 podium preview per browser card (leaderboard.md §3.3). One
 * `GET /events/:id/leaderboard` per visible event, keyed by event id.
 */
export function useLeaderboardPreviews(eventIds: string[]) {
  return useQueries({
    queries: eventIds.map((eventId) => ({
      queryKey: ['events', 'leaderboard', eventId],
      queryFn: () => EventRepository.getLeaderboard(eventId),
      staleTime: 30_000,
    })),
  });
}

/**
 * Sponsor standings (leaderboard.md §5). The hall-of-fame sponsor-champions
 * endpoint is the closest live aggregate — it returns exactly the card shape
 * (rank, name, logo, totalFans, eventsWonCount, affiliatedUserCount).
 *
 * TODO(Phase 2): switch to a dedicated sponsor-service aggregate endpoint
 * (sponsor-service.md documents none) that accepts the time window — today
 * the `time` filter re-queries the same fixed aggregate.
 */
export function useSponsorStandings(time: SponsorTimeFilter) {
  return useQuery({
    queryKey: ['sponsors', 'leaderboard', time],
    queryFn: () => HallOfFameRepository.getSponsorChampions(),
    staleTime: 60_000,
  });
}

/** The user's own affiliation (leaderboard.md §5.4) — real endpoint, guest-safe (null). */
export function useMySponsorStats() {
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['sponsors', 'mine'],
    queryFn: () => UserRepository.getSponsorStats(),
    enabled,
  });
}

/**
 * Points investment (leaderboard.md §4.4). The backend endpoint is Phase 2,
 * so on success we optimistically re-rank the cached standings (mock has no
 * server effect) — this keeps the mechanic demonstrable end to end.
 */
export function useInvestPoints(eventId: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: (amount: number) => LeaderboardRepository.investPoints(eventId, amount),
    onSuccess: (_res, amount) => {
      qc.setQueryData<LeaderboardEntry[]>(['events', 'leaderboard', eventId], (prev) => {
        if (!prev || !userId) return prev;
        const own = prev.find((e) => e.userId === userId);
        const ownScore = (own?.score ?? 0) + amount;
        const rest = prev.filter((e) => e.userId !== userId);
        return [...rest, { rank: 0, userId, score: ownScore, submittedAt: new Date().toISOString() }]
          .sort((a, b) => b.score - a.score)
          .map((e, i) => ({ ...e, rank: i + 1 }));
      });
      // TODO(Phase 2): invalidate ['events','leaderboard',eventId] and
      // ['points','balance',userId] when the invest endpoint actually mutates
      // server state — today that refetch would just overwrite the optimistic rank.
    },
  });
}
