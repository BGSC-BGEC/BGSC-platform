/**
 * Design tokens — canonical palette from UI-UX-Master-Doc.md §4.2.
 *
 * Dark (primary): deep teal glassmorphism over near-black teal canvas.
 * Light (override): warm cream canvas with white glass.
 *
 * Never hardcode hex in components — read from `useColors()`.
 */

export interface ThemeColors {
  /** App canvas (master §4.2). */
  background: string;
  /** Subtle section background. */
  backgroundMid: string;
  /** Glass card/panel fill — pair with blur(20px) (RN: BlurView intensity ~55). */
  surface: string;
  /** Non-blurred fallback for low-perf devices / no backdrop-filter support. */
  surfaceSolid: string;
  /** Input bg, chips, muted blocks. */
  surfaceMuted: string;
  /** Primary body text. */
  text: string;
  /** Labels, subtitles, helpers. */
  textMuted: string;
  /** Hairlines, dividers. */
  border: string;
  /** Focus / selected border (sage tint, brighter). */
  borderActive: string;
  /** Primary button fill (light-ink on dark canvas). */
  primary: string;
  /** Text on primary button. */
  primaryText: string;
  /** Brand accent — links, active chips, CTAs (burnt orange). */
  accent: string;
  /** Text on accent fill. */
  accentText: string;
  /** Accent tint background (active chip / highlighted card). */
  accentMuted: string;
  success: string;
  danger: string;
  info: string;
}

export const darkColors: ThemeColors = {
  background: '#060D0E',
  backgroundMid: '#0F2426',
  surface: 'rgba(15, 36, 38, 0.55)',
  surfaceSolid: '#163832',
  surfaceMuted: 'rgba(10, 26, 27, 0.40)',
  text: '#DAF1DE',
  textMuted: '#8EB69B',
  border: 'rgba(142, 182, 155, 0.15)',
  borderActive: 'rgba(142, 182, 155, 0.40)',
  primary: '#DAF1DE',
  primaryText: '#060D0E',
  accent: '#E8662A',
  accentText: '#FFFFFF',
  accentMuted: 'rgba(232, 102, 42, 0.15)',
  success: '#34D27B',
  danger: '#F2686C',
  info: '#5B9CF8',
};

export const lightColors: ThemeColors = {
  background: '#FAF7F2',
  backgroundMid: '#F2EEE7',
  surface: 'rgba(255, 255, 255, 0.70)',
  surfaceSolid: '#FFFFFF',
  surfaceMuted: '#F2EEE7',
  text: '#1B1714',
  textMuted: '#8C857A',
  border: '#E7E1D6',
  borderActive: '#235347',
  primary: '#1F1B17',
  primaryText: '#FFFFFF',
  accent: '#E8662A',
  accentText: '#FFFFFF',
  accentMuted: 'rgba(232, 102, 42, 0.12)',
  success: '#22C55E',
  danger: '#E5484D',
  info: '#3B82F6',
};

export const colorsFor = (mode: 'light' | 'dark'): ThemeColors =>
  mode === 'dark' ? darkColors : lightColors;

/** Category / tag colours (master doc §4.4) — for event/announcement pills ONLY. */
export const CATEGORY_COLORS: Record<string, string> = {
  BGEC: '#3B82F6',
  FitSoc: '#8B5CF6',
  Airball: '#F59E0B',
  Offside: '#EF4444',
  PowerPlay: '#22C55E',
  'Around The Net': '#06B6D4',
  Deuce: '#F97316',
  'Highlight Events': '#EC4899',
  Teams: '#14B8A6',
};

/** Event status colours (master doc §4.4): upcoming blue · ongoing green · past muted grey. */
export const STATUS_COLORS = {
  upcoming: '#3B82F6',
  ongoing: '#22C55E',
  past: '#8EB69B',
} as const;

export type ThemeStatus = keyof typeof STATUS_COLORS;

/** Challenge domain pill colours (points spec §5.2): sports green · esports blue · game dev purple · general grey. */
export const DOMAIN_COLORS: Record<string, string> = {
  sports: '#22C55E',
  esports: '#3B82F6',
  game_dev: '#8B5CF6',
  general: '#8EB69B',
};

/** Challenge difficulty colours (points spec §5.1): easy green · medium amber · hard orange · legend gold. */
export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22C55E',
  medium: '#F59E0B',
  hard: '#F97316',
  legend: '#F2B84B',
};

/** Feedback severity badge colours (feedback spec §8) — tinted fill + text on glass. */
export const SEVERITY_COLORS = {
  low: { bg: 'rgba(52, 210, 123, 0.15)', text: '#34D27B' },
  medium: { bg: 'rgba(251, 191, 36, 0.15)', text: '#FCD34D' },
  high: { bg: 'rgba(251, 146, 60, 0.15)', text: '#FB923C' },
  critical: { bg: 'rgba(242, 104, 108, 0.15)', text: '#F2686C' },
} as const;

/** WhatsApp brand green (feedback spec §8) — used only for the WhatsApp contact CTA. */
export const WHATSAPP_BRAND = '#25D366';
