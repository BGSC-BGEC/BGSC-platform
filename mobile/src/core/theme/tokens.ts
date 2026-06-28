/**
 * Design tokens shared by both clients. Mirrors the web copy so colors stay in
 * sync. The mobile app reads these via `useColors()` for non-template UI.
 *
 * Theme: warm cream surfaces + dark-ink primary actions + burnt-orange accent.
 * See `design-system.md` (repo root) for the canonical palette, usage rules,
 * and component recipes. Never hardcode hex in screens — read from `useColors()`.
 */
export interface ThemeColors {
  background: string;
  surface: string;
  /** Subtle filled areas: input fills, chip backings, muted blocks. */
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  /** Primary action fill (dark-ink button). */
  primary: string;
  primaryText: string;
  /** Brand emphasis: links, active chips, selection, FAB, highlights. */
  accent: string;
  accentText: string;
  /** Accent tint background (active chip / highlighted card). */
  accentMuted: string;
  success: string;
  danger: string;
  info: string;
}

export const lightColors: ThemeColors = {
  background: '#faf7f2',
  surface: '#ffffff',
  surfaceMuted: '#f2eee7',
  text: '#1b1714',
  textMuted: '#8c857a',
  border: '#e7e1d6',
  primary: '#1f1b17',
  primaryText: '#ffffff',
  accent: '#e8662a',
  accentText: '#ffffff',
  accentMuted: '#e8662a1f',
  success: '#22c55e',
  danger: '#e5484d',
  info: '#3b82f6',
};

export const darkColors: ThemeColors = {
  background: '#14110d',
  surface: '#201c17',
  surfaceMuted: '#2a251f',
  text: '#f5f0e8',
  textMuted: '#a39b8d',
  border: '#342e26',
  primary: '#f1eade',
  primaryText: '#1b1714',
  accent: '#f2783c',
  accentText: '#1b1714',
  accentMuted: '#f2783c24',
  success: '#34d27b',
  danger: '#f2686c',
  info: '#5b9cf8',
};

export const colorsFor = (mode: 'light' | 'dark'): ThemeColors =>
  mode === 'dark' ? darkColors : lightColors;
