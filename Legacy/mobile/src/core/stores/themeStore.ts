import { create } from 'zustand';
import { storage } from '../storage';

const THEME_KEY = 'bgsc.theme';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  /** User preference — `system` follows the OS scheme. */
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => Promise<void>;
  loadTheme: () => Promise<void>;
}

/** Theme store (master doc §2.5): light / dark / system, persisted. */
export const useThemeStore = create<ThemeState>((set) => ({
  // Dark is the primary theme (master §4.2) — boot dark regardless of OS.
  theme: 'dark',

  setTheme: async (theme) => {
    set({ theme });
    await storage.setItem(THEME_KEY, theme);
  },

  loadTheme: async () => {
    const saved = await storage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      set({ theme: saved });
    }
  },
}));
