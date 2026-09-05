import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/core/stores/themeStore';
import {
  type UIThemeColors,
  type ThemeMode,
  darkThemeColors,
  lightThemeColors,
} from './colors';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: UIThemeColors;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: 'light' | 'dark' | 'system';
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const storeTheme = useThemeStore((s) => s.theme);
  const setStoreTheme = useThemeStore((s) => s.setTheme);
  const systemScheme = useRNColorScheme();

  const selectedTheme = initialMode ?? storeTheme;
  const resolvedMode: ThemeMode =
    selectedTheme === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : selectedTheme;

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = resolvedMode === 'dark';
    return {
      mode: resolvedMode,
      isDark,
      colors: isDark ? darkThemeColors : lightThemeColors,
      setMode: (m) => void setStoreTheme(m),
    };
  }, [resolvedMode, setStoreTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Access the active theme and colors within any UI component.
 * Fallback to darkThemeColors if used outside of ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context) return context;

  // Standalone fallback: hook into themeStore + systemScheme directly
  const storeTheme = useThemeStore.getState().theme;
  const resolved: ThemeMode = storeTheme === 'light' ? 'light' : 'dark';
  return {
    mode: resolved,
    isDark: resolved === 'dark',
    colors: resolved === 'dark' ? darkThemeColors : lightThemeColors,
    setMode: (m) => void useThemeStore.getState().setTheme(m),
  };
}

