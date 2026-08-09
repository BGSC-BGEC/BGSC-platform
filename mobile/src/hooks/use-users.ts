import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { UserRepository } from '@/core/repositories/UserRepository';

export type UserSortKey = 'last_seen' | 'created_at_desc' | 'created_at_asc' | 'points' | 'alpha';

export function useUsers(params: {
  search: string;
  role: string | null;
  status: string | null;
  sort: UserSortKey;
}) {
  const sortMap: Record<UserSortKey, string> = {
    last_seen: 'last_seen',
    created_at_desc: 'created_at_desc',
    created_at_asc: 'created_at_asc',
    points: 'points_desc',
    alpha: 'display_name_asc',
  };

  return useQuery({
    queryKey: ['users', 'list', params],
    queryFn: () =>
      UserRepository.listUsers({
        limit: 50,
        search: params.search || undefined,
        role: params.role ?? undefined,
        status: params.status ?? undefined,
        sort: sortMap[params.sort],
        summary: true,
      }),
    staleTime: 30_000,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      UserRepository.updateUserRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}

export function useDisableAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => UserRepository.disableAccount(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'list'] });
    },
  });
}

/** Debounced search string — fires the query only after 300 ms of silence. */
export function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  const ref = useRef(value);
  ref.current = value;
  useEffect(() => {
    const t = setTimeout(() => setDebounced(ref.current), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
