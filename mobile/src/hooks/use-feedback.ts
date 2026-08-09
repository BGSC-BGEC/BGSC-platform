import { useMutation, useQuery } from '@tanstack/react-query';

import { FeedbackRepository } from '@/core/repositories/FeedbackRepository';
import type { FeedbackInput } from '@/core/repositories/FeedbackRepository';

/** Submit a feedback ticket (spec §3.3). No cache to invalidate — tickets are not listed on this screen. */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: FeedbackInput) => FeedbackRepository.submit(input),
  });
}

/** FAQ knowledge base (query key ['feedback', 'faqs'], master §12.3). */
export function useFaqs() {
  return useQuery({
    queryKey: ['feedback', 'faqs'],
    queryFn: () => FeedbackRepository.listFaqs(),
    staleTime: 60 * 60 * 1000, // FAQ content is static for the term
  });
}

/** Active coordinators roster. */
export function useCoordinators() {
  return useQuery({
    queryKey: ['feedback', 'coordinators'],
    queryFn: () => FeedbackRepository.listCoordinators(),
  });
}

/** Past coordinators — Hall of Admin (read-only archive). */
export function useLegacyAdmins() {
  return useQuery({
    queryKey: ['feedback', 'legacy-admins'],
    queryFn: () => FeedbackRepository.listLegacyAdmins(),
  });
}
