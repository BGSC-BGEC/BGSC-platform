/**
 * Design tokens shared by both clients. The web app mostly styles via Tailwind
 * classes, but exposes these so non-Tailwind contexts (e.g. canvas, charts) and
 * the mobile app read from one source of truth.
 */
export interface ThemeColors {
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
  primary: string
  primaryText: string
}

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  primary: '#7c3aed',
  primaryText: '#ffffff',
}

export const darkColors: ThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  border: '#334155',
  primary: '#a78bfa',
  primaryText: '#0f172a',
}

export const colorsFor = (mode: 'light' | 'dark'): ThemeColors =>
  mode === 'dark' ? darkColors : lightColors
