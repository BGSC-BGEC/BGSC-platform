/**
 * Theme Store (Zustand) - Web
 * Global theme state management (light/dark mode)
 */

import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeStoreState {
  isDarkMode: boolean;
  themeMode: ThemeMode;

  // Actions
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  initialize: () => Promise<void>;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  // Initial State
  isDarkMode: false,
  themeMode: 'light',

  // Actions
  setThemeMode: (mode) => {
    const isDarkMode = mode === 'dark';
    set({ themeMode: mode, isDarkMode });
    localStorage.setItem('themeMode', mode);
    // Update document class for Tailwind dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  toggleTheme: () => {
    const { isDarkMode } = get();
    const newMode = isDarkMode ? 'light' : 'dark';
    get().setThemeMode(newMode);
  },

  initialize: async () => {
    try {
      const savedTheme = localStorage.getItem('themeMode');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
        get().setThemeMode(savedTheme);
      }
    } catch (error) {
      console.error('Failed to initialize theme:', error);
    }
  },
}));
