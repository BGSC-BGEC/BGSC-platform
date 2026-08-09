import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { ChallengeRepository } from '@/core/repositories/ChallengeRepository';
import type {
  ChallengeDifficulty,
  ChallengeDomain,
  SubmitProofDto,
} from '@/core/types';

export interface ChallengeFilters {
  domain: ChallengeDomain | null;
  /** null = all difficulties selected (no filter). */
  difficulties: ChallengeDifficulty[] | null;
}

/**
 * Challenge queries (master §12.3 key conventions). The challenge-service is
 * Phase 2 — the repository serves mock data; keys are already final so the
 * swap to real endpoints is invisible to callers.
 */
export function useChallenges(filters: ChallengeFilters) {
  return useInfiniteQuery({
    queryKey: ['challenges', { domain: filters.domain, difficulties: filters.difficulties }],
    queryFn: ({ pageParam }) =>
      ChallengeRepository.listChallenges({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 30 ? allPages.length + 1 : undefined,
  });
}

export function useChallengeDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['challenges', 'detail', id],
    queryFn: () => ChallengeRepository.getChallenge(id),
    enabled: options?.enabled ?? true,
  });
}

/** In-progress challenges for the points dashboard strip (points spec §9.3). */
export function useActiveChallenges(userId: string) {
  return useQuery({
    queryKey: ['challenges', 'active', userId],
    queryFn: () => ChallengeRepository.getActiveChallenges(),
  });
}

export function useAcceptChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => ChallengeRepository.acceptChallenge(challengeId),
    onSuccess: (_data, challengeId) => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
      qc.invalidateQueries({ queryKey: ['challenges', 'detail', challengeId] });
      qc.invalidateQueries({ queryKey: ['points', 'balance'] });
    },
  });
}

export function useChallengeSubmission(
  challengeId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['challenges', 'submission', challengeId],
    queryFn: () => ChallengeRepository.getSubmission(challengeId),
    enabled: options?.enabled ?? true,
  });
}

export function useSubmitProof(challengeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SubmitProofDto) => ChallengeRepository.submitProof(challengeId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['challenges', 'submission', challengeId] });
      qc.invalidateQueries({ queryKey: ['challenges', 'detail', challengeId] });
      qc.invalidateQueries({ queryKey: ['challenges', 'active'] });
    },
  });
}
