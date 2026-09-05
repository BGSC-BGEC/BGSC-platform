/**
 * Palette directly derived from mobile/color/f932fc38-8800-4c3e-ad9b-54679a8e5b7b.png
 *
 * 1. #0F2A1D — Dark Forest Green (Deep canvas / rich dark background)
 * 2. #375534 — Deep Moss Green (Secondary dark / elevated surface fill)
 * 3. #6B9071 — Sage Green (Muted green accent / subtitles / inactive tabs)
 * 4. #AEC3B0 — Soft Mint / Sage Frost (Hairlines / borders / muted text / tags)
 * 5. #E3EED4 — Pale Honeydew / Cream (Primary text on dark / light canvas base)
 * 6. #E07A3F — Warm Burnt Orange (Primary CTA / interactive highlights / active tags)
 * 7. #5B8FA8 — Ocean Slate / Steel Blue (Secondary accent / information / links)
 */

export const PALETTE = {
  forest: '#0F2A1D',
  moss: '#375534',
  sage: '#6B9071',
  mint: '#AEC3B0',
  cream: '#E3EED4',
  orange: '#E07A3F',
  slate: '#5B8FA8',

  // Utility tints / shades
  white: '#FFFFFF',
  black: '#000000',
  danger: '#F2686C',
  warning: '#F59E0B',
  success: '#34D27B',
  info: '#5B8FA8',
} as const;

/** Converts a 6-digit hex code and alpha (0-1) to rgba string */
export function withAlpha(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface UIThemeColors {
  /** Canvas background */
  background: string;
  /** Section / card underlying canvas variant */
  backgroundMid: string;
  /** Primary frosted glass card surface overlay */
  surface: string;
  /** Non-blurred opaque fallback surface */
  surfaceSolid: string;
  /** Muted surface for inputs, chips, search bars */
  surfaceMuted: string;
  /** Higher elevation surface */
  surfaceElevated: string;

  /** Primary body and heading text */
  text: string;
  /** Secondary and helper text */
  textMuted: string;
  /** Subtle text (captions, disabled, placeholders) */
  textSubtle: string;

  /** Default hairline borders */
  border: string;
  /** Active / focused borders */
  borderActive: string;

  /** Primary brand CTA — warm burnt orange from palette */
  primary: string;
  /** Text on primary button */
  primaryText: string;

  /** Secondary action fill — deep moss green from palette */
  secondary: string;
  /** Text on secondary button */
  secondaryText: string;

  /** Brand highlight accent — orange */
  accent: string;
  /** Text on accent */
  accentText: string;
  /** Translucent accent tint for pills and cards */
  accentMuted: string;

  /** Ocean slate accent from palette */
  slate: string;
  slateMuted: string;

  /** System feedback states */
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  info: string;
  infoMuted: string;
}

/**
 * Dark theme (Default):
 * Deep forest canvas (#0F2A1D), moss green elevated surfaces (#375534),
 * frosted sage glass overlays, crisp cream text (#E3EED4), and warm orange CTA (#E07A3F).
 */
export const darkThemeColors: UIThemeColors = {
  background: PALETTE.forest,
  backgroundMid: '#143526',
  surface: withAlpha(PALETTE.moss, 0.45),
  surfaceSolid: '#183D2D',
  surfaceMuted: withAlpha(PALETTE.forest, 0.60),
  surfaceElevated: '#1D4534',

  text: PALETTE.cream,
  textMuted: PALETTE.mint,
  textSubtle: PALETTE.sage,

  border: withAlpha(PALETTE.mint, 0.18),
  borderActive: withAlpha(PALETTE.mint, 0.50),

  primary: PALETTE.orange,
  primaryText: PALETTE.white,

  secondary: PALETTE.moss,
  secondaryText: PALETTE.cream,

  accent: PALETTE.orange,
  accentText: PALETTE.white,
  accentMuted: withAlpha(PALETTE.orange, 0.16),

  slate: PALETTE.slate,
  slateMuted: withAlpha(PALETTE.slate, 0.18),

  success: PALETTE.success,
  successMuted: withAlpha(PALETTE.success, 0.16),
  warning: PALETTE.warning,
  warningMuted: withAlpha(PALETTE.warning, 0.16),
  danger: PALETTE.danger,
  dangerMuted: withAlpha(PALETTE.danger, 0.16),
  info: PALETTE.slate,
  infoMuted: withAlpha(PALETTE.slate, 0.16),
};

/**
 * Light theme:
 * Crisp organic honeydew cream canvas, moss-forest ink text,
 * frosted white glass overlays, and energetic orange CTA.
 */
export const lightThemeColors: UIThemeColors = {
  background: '#F8FAF5',
  backgroundMid: '#EEF4EA',
  surface: 'rgba(255, 255, 255, 0.85)',
  surfaceSolid: '#FFFFFF',
  surfaceMuted: withAlpha(PALETTE.cream, 0.70),
  surfaceElevated: '#FFFFFF',

  text: PALETTE.forest,
  textMuted: PALETTE.moss,
  textSubtle: PALETTE.sage,

  border: withAlpha(PALETTE.sage, 0.22),
  borderActive: PALETTE.moss,

  primary: PALETTE.orange,
  primaryText: PALETTE.white,

  secondary: PALETTE.moss,
  secondaryText: PALETTE.cream,

  accent: PALETTE.orange,
  accentText: PALETTE.white,
  accentMuted: withAlpha(PALETTE.orange, 0.12),

  slate: PALETTE.slate,
  slateMuted: withAlpha(PALETTE.slate, 0.14),

  success: '#22C55E',
  successMuted: 'rgba(34, 197, 94, 0.14)',
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.14)',
  danger: '#E5484D',
  dangerMuted: 'rgba(229, 72, 77, 0.14)',
  info: PALETTE.slate,
  infoMuted: withAlpha(PALETTE.slate, 0.14),
};

export type ThemeMode = 'dark' | 'light';

export function getThemeColors(mode: ThemeMode): UIThemeColors {
  return mode === 'light' ? lightThemeColors : darkThemeColors;
}

