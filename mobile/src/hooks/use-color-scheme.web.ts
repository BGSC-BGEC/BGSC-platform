import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/core/stores/themeStore';

// Hydration-safe client flag (true on the client, false during static render)
// without a setState-in-effect.
const emptySubscribe = () => () => {};
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Web variant: same resolution as native, but guards against SSR/static-render
 * hydration mismatches by returning 'light' until hydrated.
 */
export function useColorScheme(): 'light' | 'dark' {
  const hasHydrated = useHasHydrated();
  const system = useRNColorScheme();
  const mode = useThemeStore((s) => s.mode);

  if (!hasHydrated) {
    return 'light';
  }
  if (mode === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return mode;
}
