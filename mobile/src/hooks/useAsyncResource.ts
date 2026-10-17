import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage } from '../api/client';

export interface AsyncResource<T> {
  data: T | undefined;
  /** True only for the first load (no data yet) */
  loading: boolean;
  /** True while a pull-to-refresh is in flight */
  refreshing: boolean;
  error: string | null;
  /** Re-run the loader; pass `{ silent: true }` to skip the refreshing spinner (used by polling) */
  reload: (opts?: { silent?: boolean }) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
}

/**
 * Loads data from a repository call and tracks loading / refreshing / error state.
 * The loader re-runs whenever `deps` change. Stale responses are ignored.
 */
export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList,
  options: { enabled?: boolean } = {},
): AsyncResource<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | undefined>();
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await loaderRef.current();
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      // Keep showing the last good data during silent polling failures.
      if (mode !== 'silent') setError(getErrorMessage(err));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const reload = useCallback(
    (opts?: { silent?: boolean }) => run(opts?.silent ? 'silent' : 'refresh'),
    [run],
  );

  return { data, loading, refreshing, error, reload, setData };
}
