import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/core/stores/themeStore';

/**
 * Resolves the effective light/dark scheme by combining the user's stored
 * preference (themeStore) with the OS scheme. `system` defers to the OS.
 */
export function useColorScheme(): 'light' | 'dark' {
  const system = useRNColorScheme();
  const mode = useThemeStore((s) => s.mode);

  if (mode === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return mode;
}
