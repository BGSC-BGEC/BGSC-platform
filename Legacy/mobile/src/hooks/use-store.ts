import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { StoreRepository } from '@/core/repositories/StoreRepository';
import type { RedemptionInput } from '@/core/types';

/** Store catalog (master §12.3 key conventions: ['store', ...]). */
export function useStoreItems() {
  return useQuery({
    queryKey: ['store', 'items'],
    queryFn: () => StoreRepository.listItems(),
  });
}

/** Own order history. */
export function useStoreOrders() {
  return useQuery({
    queryKey: ['store', 'orders'],
    queryFn: () => StoreRepository.listOrders(),
  });
}

/**
 * Redeem the cart for points. On success invalidate the whole store domain
 * AND the points balance — the backend writes a ledger `spend` row (source
 * 'store'), so the balance card must refetch (master §12.3).
 */
export function useRedeemStoreItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RedemptionInput) => StoreRepository.redeem(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store'] });
      queryClient.invalidateQueries({ queryKey: ['points', 'balance'] });
    },
  });
}
