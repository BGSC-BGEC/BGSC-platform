import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

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
  const systemScheme = useRNColorScheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode | 'system'>(
    initialMode ?? 'system',
  );

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
      setMode: setSelectedTheme,
    };
  }, [resolvedMode]);

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
  const resolved: ThemeMode = 'dark';
  return {
    mode: resolved,
    isDark: resolved === 'dark',
    colors: resolved === 'dark' ? darkThemeColors : lightThemeColors,
    setMode: () => undefined,
  };
}

