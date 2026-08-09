import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/core/stores/authStore';
import { useThemeStore } from '@/core/stores/themeStore';

interface UseAuthScreenOptions {
  /** Bounce logged-in users off the auth funnel (handoffSpec §13.2). Login/register only. */
  redirectIfAuthed?: boolean;
}

/**
 * Auth screens are light-mode only (ORCHESTRATOR.md: light token override
 * `background: #FAF7F2`; master doc §4.2). Pins the resolved theme to light
 * for this screen's lifetime so every shared component (GlassInput,
 * SegmentedToggle, Toast…) renders light tokens even on dark-OS devices, and
 * restores the user's preference on unmount.
 *
 * The pin writes zustand state directly — no persistence — so a force-quit
 * on an auth screen can never clobber the saved theme preference.
 */
export function useAuthScreen({ redirectIfAuthed = false }: UseAuthScreenOptions = {}): void {
  useEffect(() => {
    const saved = useThemeStore.getState().theme;
    useThemeStore.setState({ theme: 'light' });
    return () => useThemeStore.setState({ theme: saved });
  }, []);

  useEffect(() => {
    if (redirectIfAuthed && useAuthStore.getState().status === 'authenticated') {
      router.replace('/(drawer)');
    }
  }, [redirectIfAuthed]);
}
