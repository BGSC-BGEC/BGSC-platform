import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { PointsRepository } from '@/core/repositories/PointsRepository';
import type { TransactionFilter } from '@/core/types';

/**
 * Points queries (master §12.3 key conventions).
 * Balance updates arrive via FCM push → cache invalidation, so a 30 s
 * staleTime is plenty (master §10 / points spec §10).
 */
export function usePointsBalance(userId: string) {
  return useQuery({
    queryKey: ['points', 'balance', userId],
    // M-17: userId was in the query key but never passed to getBalance().
    // Pass it so Phase 2 can parameterise the call per-user.
    queryFn: () => PointsRepository.getBalance(userId),
    staleTime: 30_000,
  });
}

/**
 * Paginated transaction history (30/page). `filter` is part of the query key
 * so switching chips re-fetches; the restored PointsRepository does not pass
 * a filter to the backend yet (points-service.md documents no transactions
 * endpoint) — items are filtered client-side. TODO(Phase 2): pass `filter`
 * as a query param once the service exposes it.
 */
export function usePointTransactions(userId: string, filter: TransactionFilter) {
  return useInfiniteQuery({
    // M-17: userId now passed to queryFn too (consistent with usePointsBalance).
    queryKey: ['points', 'transactions', userId, filter],
    queryFn: ({ pageParam }) => PointsRepository.getTransactions(userId, pageParam, 30),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 30 ? allPages.length + 1 : undefined,
  });
}
