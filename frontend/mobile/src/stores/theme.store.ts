/**
 * Theme Store (Zustand)
 * Global theme state management (light/dark mode)
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    AsyncStorage.setItem('themeMode', mode).catch((err) =>
      console.error('Failed to save theme preference:', err)
    );
  },

  toggleTheme: () => {
    const { isDarkMode } = get();
    const newMode = isDarkMode ? 'light' : 'dark';
    get().setThemeMode(newMode);
  },

  initialize: async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
        set({ themeMode: savedTheme, isDarkMode: savedTheme === 'dark' });
      }
    } catch (error) {
      console.error('Failed to initialize theme:', error);
    }
  },
}));
