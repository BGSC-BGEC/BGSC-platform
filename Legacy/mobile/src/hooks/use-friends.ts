import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FriendRepository } from '@/core/repositories/FriendRepository';
import { useAuthStore } from '@/core/stores/authStore';

/**
 * Friends domain queries (master §12.3 key conventions: ['friends', ...]).
 * The friends-service is Phase 2 — the repository serves mock data; keys are
 * already final so the swap to real endpoints is invisible to callers.
 */

export function useFriends() {
  // M-14: friends data is user-specific — skip for unauthenticated visitors.
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => FriendRepository.listFriends(),
    staleTime: 60_000,
    enabled,
  });
}

export function useFriendRequests() {
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['friends', 'requests'],
    queryFn: () => FriendRepository.listRequests(),
    staleTime: 30_000,
    enabled,
  });
}

export function useFriendActivities() {
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['friends', 'activities'],
    queryFn: () => FriendRepository.listActivities(),
    staleTime: 60_000,
    enabled,
  });
}

export function useFriendAchievements() {
  const enabled = useAuthStore((s) => s.status === 'authenticated');
  return useQuery({
    queryKey: ['friends', 'achievements'],
    queryFn: () => FriendRepository.listAchievements(),
    staleTime: 60_000,
    enabled,
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => FriendRepository.sendRequest(userId),
    // M-13: invalidate friends list so the "Add Friend" button reflects sent state.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friends', 'requests'] });
    },
  });
}
