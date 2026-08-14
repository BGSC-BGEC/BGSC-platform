import { QueryClient } from '@tanstack/react-query';

// L-05: add a global query error handler for crash reporting / toast fallback.
// Errors that components don't handle themselves surface here.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.action.type === 'error') {
    // Forward to a crash reporter when one is wired (e.g. Sentry.captureException).
    // Currently a no-op placeholder — replace with real reporter in Phase 2.
    if (__DEV__) {
      console.warn('[query-client] query error:', event.action.error);
    }
  }
});
