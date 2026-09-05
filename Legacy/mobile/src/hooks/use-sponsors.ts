import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  SponsorRepository,
  type NewsletterCategory,
} from '@/core/repositories/SponsorRepository';
import { useAuthStore } from '@/core/stores/authStore';

/**
 * Sponsor & newsletter queries (master §12.3 key conventions: ['sponsors', ...]).
 */

export function useActiveSponsors() {
  return useQuery({
    queryKey: ['sponsors', 'active'],
    queryFn: () => SponsorRepository.getActiveSponsors(),
    staleTime: 60_000,
  });
}

export function useMyAffiliation() {
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['sponsors', 'mine'],
    queryFn: () => SponsorRepository.getMyAffiliation(),
    enabled,
    staleTime: 60_000,
  });
}

export function useSponsorPrizes() {
  return useQuery({
    queryKey: ['sponsors', 'prizes'],
    queryFn: () => SponsorRepository.getPrizes(),
    staleTime: 60_000,
  });
}

export function usePastSponsors() {
  return useQuery({
    queryKey: ['sponsors', 'archive'],
    queryFn: () => SponsorRepository.getPastSponsors(),
    staleTime: 120_000,
  });
}

export function useNewsletterSubs() {
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['sponsors', 'newsletters'],
    queryFn: () => SponsorRepository.getNewsletterSubscriptions(),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateNewsletterSubs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subs: NewsletterCategory[]) =>
      SponsorRepository.updateNewsletterSubscriptions(subs),
    onMutate: async (subs) => {
      await qc.cancelQueries({ queryKey: ['sponsors', 'newsletters'] });
      const prev = qc.getQueryData<NewsletterCategory[]>(['sponsors', 'newsletters']);
      qc.setQueryData(['sponsors', 'newsletters'], subs);
      return { prev };
    },
    onError: (_err, _subs, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(['sponsors', 'newsletters'], ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['sponsors', 'newsletters'] });
    },
  });
}

export function useChangeSponsor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sponsorId: string) => SponsorRepository.updateAffiliation(sponsorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsors', 'mine'] });
    },
  });
}
