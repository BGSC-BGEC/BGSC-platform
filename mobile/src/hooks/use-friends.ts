import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FriendRepository } from '@/core/repositories/FriendRepository';

/**
 * Friends domain queries (master §12.3 key conventions: ['friends', ...]).
 * The friends-service is Phase 2 — the repository serves mock data; keys are
 * already final so the swap to real endpoints is invisible to callers.
 */

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => FriendRepository.listFriends(),
    staleTime: 60_000,
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => FriendRepository.listRequests(),
    staleTime: 30_000,
  });
}

export function useFriendActivities() {
  return useQuery({
    queryKey: ['friends', 'activities'],
    queryFn: () => FriendRepository.listActivities(),
    staleTime: 60_000,
  });
}

export function useFriendAchievements() {
  return useQuery({
    queryKey: ['friends', 'achievements'],
    queryFn: () => FriendRepository.listAchievements(),
    staleTime: 60_000,
  });
}

export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FriendRepository.acceptRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

export function useDeclineFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FriendRepository.declineRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] });
    },
  });
}

export function useSendFriendRequest() {
  return useMutation({
    mutationFn: (userId: string) => FriendRepository.sendRequest(userId),
  });
}
