import { create } from 'zustand';
import { storage } from '../storage';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'bgsc.theme';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Cycle light → dark → system. */
  toggle: () => void;
}

/**
 * Holds the user's theme preference. The effective light/dark scheme is
 * resolved in `hooks/use-color-scheme` by combining this with the OS scheme.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',

  setMode: (mode) => {
    set({ mode });
    void storage.setItem(THEME_KEY, mode);
  },

  toggle: () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().mode) + 1) % order.length];
    get().setMode(next);
  },
}));

// Hydrate the persisted preference on startup.
void storage.getItem(THEME_KEY).then((v) => {
  if (v === 'light' || v === 'dark' || v === 'system') {
    useThemeStore.setState({ mode: v });
  }
});
