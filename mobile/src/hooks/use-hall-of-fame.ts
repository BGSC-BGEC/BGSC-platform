import { useQuery } from '@tanstack/react-query';

import { HallOfFameRepository } from '@/core/repositories/HallOfFameRepository';

/**
 * Hall of Fame queries (master §12.3 conventions). Public read — no auth,
 * no guest gate (hall-of-fame spec §1). Data is append-only, so a 60 s
 * staleTime keeps pull-to-refresh as the freshness mechanism.
 */
export function useHallOfFameEventWinners() {
  return useQuery({
    queryKey: ['hall-of-fame', 'event-winners'],
    queryFn: () => HallOfFameRepository.getEventWinners(),
    staleTime: 60_000,
  });
}

export function useHallOfFameSponsorChampions() {
  return useQuery({
    queryKey: ['hall-of-fame', 'sponsor-champions'],
    queryFn: () => HallOfFameRepository.getSponsorChampions(),
    staleTime: 60_000,
  });
}
