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

  backgroundMid: '#123323',

  surface: '#183D2D',

  surfaceSolid: '#183D2D',

  surfaceMuted: '#1C3427',

  surfaceElevated: '#214936',

  text: PALETTE.cream,

  textMuted: PALETTE.mint,

  textSubtle: PALETTE.sage,

  border: withAlpha(PALETTE.mint, 0.14),

  borderActive: withAlpha(PALETTE.orange, 0.85),

  primary: PALETTE.orange,
  primaryText: PALETTE.white,

  secondary: PALETTE.moss,
  secondaryText: PALETTE.cream,

  accent: PALETTE.orange,
  accentText: PALETTE.white,

  accentMuted: withAlpha(PALETTE.orange, 0.14),

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
  background: PALETTE.mint,
  backgroundMid: '#A5BBA7',

  surface: PALETTE.mint,
  surfaceSolid: PALETTE.mint,

  surfaceMuted: '#A3B9A5',
  surfaceElevated: PALETTE.cream,

  text: PALETTE.forest,
  textMuted: PALETTE.moss,
  textSubtle: PALETTE.sage,

  border: withAlpha(PALETTE.cream, 0.35),
  borderActive: PALETTE.orange,

  primary: PALETTE.orange,
  primaryText: PALETTE.white,

  secondary: PALETTE.moss,
  secondaryText: PALETTE.cream,

  accent: PALETTE.orange,
  accentText: PALETTE.white,
  accentMuted: withAlpha(PALETTE.orange, 0.14),

  slate: PALETTE.slate,
  slateMuted: withAlpha(PALETTE.slate, 0.16),

  success: PALETTE.success,
  successMuted: withAlpha(PALETTE.success, 0.14),

  warning: PALETTE.warning,
  warningMuted: withAlpha(PALETTE.warning, 0.14),

  danger: PALETTE.danger,
  dangerMuted: withAlpha(PALETTE.danger, 0.14),

  info: PALETTE.slate,
  infoMuted: withAlpha(PALETTE.slate, 0.14),
};

export type ThemeMode = 'dark' | 'light';

export function getThemeColors(mode: ThemeMode): UIThemeColors {
  return mode === 'light' ? lightThemeColors : darkThemeColors;
}

