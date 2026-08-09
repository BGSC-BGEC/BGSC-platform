import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EventRepository } from '@/core/repositories/EventRepository';
import type {
  LeaderboardEntry,
  PlatformEvent,
  RegisterPayload,
  Registration,
} from '@/core/types';

/**
 * TanStack Query hooks wrapping EventRepository (master doc §12.3).
 *
 * Query keys follow §12.3 conventions:
 *   ['events']            — full list (filters applied client-side, repo has no status param)
 *   ['events','detail',id] — single event
 *   ['events','leaderboard',id]
 *   ['events','registration',id] — own registration for an event
 */

/** Full event list — one query; status/category filtering is client-side (§2.4 persistence rule). */
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    // TODO(events): real pagination when the list grows — repo already accepts { page, limit }.
    queryFn: () => EventRepository.list({ page: 1, limit: 100 }),
    staleTime: 60_000,
  });
}

export function useEventDetail(id: string) {
  return useQuery({
    queryKey: ['events', 'detail', id],
    queryFn: () => EventRepository.getById(id),
    enabled: !!id,
  });
}

export function useEventLeaderboard(id: string) {
  return useQuery({
    queryKey: ['events', 'leaderboard', id],
    queryFn: () => EventRepository.getLeaderboard(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Own registration for an event. `GET /events/:id/my-registration` is NOT in
 * event-service.md (Phase 1) — the repo still hits it; any failure (404/401)
 * resolves to `null` = "not registered". TODO(events): drop the catch once the
 * endpoint lands; until then the registered state is driven by the register
 * mutation's own response.
 */
export function useMyRegistration(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['events', 'registration', id],
    queryFn: async () => {
      try {
        return await EventRepository.getMyRegistration(id);
      } catch {
        return null;
      }
    },
    enabled: enabled && !!id,
    staleTime: 30_000,
  });
}

export function useRegisterEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => EventRepository.register(eventId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', 'detail', eventId] });
      qc.invalidateQueries({ queryKey: ['events', 'registration', eventId] });
    },
  });
}

export function useWithdrawRegistration(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    // TODO(events): event-service.md has no unregister endpoint (Phase 1);
    // the repo's DELETE /events/:id/registrations/:registrationId is assumed
    // from the master doc. Verify against the gateway when it ships.
    mutationFn: (_registrationId?: string) =>
      EventRepository.withdrawRegistration(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', 'detail', eventId] });
      qc.invalidateQueries({ queryKey: ['events', 'registration', eventId] });
    },
  });
}

export function useApplyForCaptain(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    // TODO(events): captain applications (§7.5) have no backend endpoint yet (Phase 2).
    mutationFn: () => EventRepository.applyForCaptain(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', 'detail', eventId] });
    },
  });
}

export type { LeaderboardEntry, PlatformEvent, Registration };
