import { router, usePathname } from 'expo-router';
import { useCallback } from 'react';

import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';

/**
 * Guest gate for write actions (master doc §0.6, home-page.md §14.1).
 *
 * Pattern: preserve intent → readable snackbar → explicit "Log in" action that
 * routes to /login with `returnTo` so the user lands back on this surface.
 * No auto-redirect — the spec requires the message to stay readable.
 */
export function useRequireAuth() {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  const toast = useToast();

  return useCallback(
    (message: string): boolean => {
      if (status === 'authenticated') return true;
      toast.show(message, {
        actionLabel: 'Log in',
        onAction: () =>
          router.replace({ pathname: '/login', params: { returnTo: pathname } }),
      });
      return false;
    },
    [status, pathname, toast],
  );
}
