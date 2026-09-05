import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AnnouncementRepository } from '@/core/repositories/AnnouncementRepository';
import type { AnnouncementTag } from '@/core/types';

/**
 * TanStack Query hooks wrapping AnnouncementRepository (master doc §12.3).
 *
 * Query keys follow §12.3 conventions:
 *   ['announcements'] — full announcement list (filtering is client-side)
 */

/** Full announcement list — category filtering happens in the tab (single-select pill rail). */
export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    // TODO(announcements): real pagination (20/page) when the feed grows — repo already accepts { page, limit }.
    queryFn: () => AnnouncementRepository.list({ page: 1, limit: 50 }),
    staleTime: 60_000,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string; tags: AnnouncementTag[] }) =>
      AnnouncementRepository.create(input.title, input.body, input.tags),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });
}
