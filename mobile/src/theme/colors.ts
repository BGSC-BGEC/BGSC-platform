/**
 * Premium Neumorphic Color Palette
 * Based on soft, layered design with subtle shadows
 */

export const PALETTE = {
  // Light mode - Soft beige/cream tones
  lightBase: '#E8E4DF',           // Main background (light warm gray)
  lightCard: '#EBE7E2',           // Card surface
  lightCardInner: '#F5F2ED',      // Inner card layer (lighter)
  lightText: '#4A4A4A',           // Primary text
  lightTextMuted: '#8A8A8A',      // Secondary text
  lightShadowDark: '#D1CCC7',     // Dark shadow
  lightShadowLight: '#FFFFFF',    // Light highlight shadow

  // Dark mode - Soft slate/charcoal tones
  darkBase: '#2C3135',            // Main background (dark slate)
  darkCard: '#33383D',            // Card surface
  darkCardInner: '#3A4045',       // Inner card layer (lighter)
  darkText: '#E8E8E8',            // Primary text
  darkTextMuted: '#9A9A9A',       // Secondary text
  darkShadowDark: '#1E2226',      // Dark shadow
  darkShadowLight: '#3D4449',     // Light highlight shadow

  // Accent colors
  orange: '#E07A3F',              // Primary CTA (warm orange)
  orangeDark: '#D4632A',          // Darker orange for press states
  red: '#E74C3C',                 // Error/love/favorite
  blue: '#5B8FA8',                // Info/links
  green: '#34D27B',               // Success
  yellow: '#F59E0B',              // Warning

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
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
  /** Card surface */
  surface: string;
  /** Inner card layer (lighter than surface) */
  surfaceInner: string;
  /** Elevated surface variant */
  surfaceElevated: string;
  /** Muted surface for inputs */
  surfaceMuted: string;

  /** Primary body and heading text */
  text: string;
  /** Secondary and helper text */
  textMuted: string;
  /** Subtle text (disabled, placeholders) */
  textSubtle: string;

  /** Neumorphic dark shadow */
  shadowDark: string;
  /** Neumorphic light highlight shadow */
  shadowLight: string;

  /** Default hairline borders */
  border: string;
  /** Active / focused borders */
  borderActive: string;

  /** Primary brand CTA */
  primary: string;
  /** Text on primary button */
  primaryText: string;
  /** Darker primary for press states */
  primaryDark: string;

  /** Accent colors */
  accent: string;
  accentMuted: string;

  /** System feedback states */
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  dangerMuted: string;
  info: string;
  infoMuted: string;

  /** Utility */
  white: string;
  black: string;
  surfaceHighlight: string;
}

/**
 * Light theme - Soft beige neumorphism
 */
export const lightThemeColors: UIThemeColors = {
  background: PALETTE.lightBase,
  surface: PALETTE.lightCard,
  surfaceInner: PALETTE.lightCardInner,
  surfaceElevated: PALETTE.lightCardInner,
  surfaceMuted: PALETTE.lightBase,

  text: PALETTE.lightText,
  textMuted: PALETTE.lightTextMuted,
  textSubtle: withAlpha(PALETTE.lightText, 0.5),

  shadowDark: PALETTE.lightShadowDark,
  shadowLight: PALETTE.lightShadowLight,

  border: withAlpha(PALETTE.lightText, 0.1),
  borderActive: PALETTE.orange,

  primary: PALETTE.orange,
  primaryText: PALETTE.white,
  primaryDark: PALETTE.orangeDark,

  accent: PALETTE.orange,
  accentMuted: withAlpha(PALETTE.orange, 0.15),

  success: PALETTE.green,
  successMuted: withAlpha(PALETTE.green, 0.15),

  warning: PALETTE.yellow,
  warningMuted: withAlpha(PALETTE.yellow, 0.15),

  danger: PALETTE.red,
  dangerMuted: withAlpha(PALETTE.red, 0.15),

  info: PALETTE.blue,
  infoMuted: withAlpha(PALETTE.blue, 0.15),

  white: PALETTE.white,
  black: PALETTE.black,
  surfaceHighlight: withAlpha(PALETTE.orange, 0.08),
};

/**
 * Dark theme - Soft slate neumorphism
 */
export const darkThemeColors: UIThemeColors = {
  background: PALETTE.darkBase,
  surface: PALETTE.darkCard,
  surfaceInner: PALETTE.darkCardInner,
  surfaceElevated: PALETTE.darkCardInner,
  surfaceMuted: PALETTE.darkBase,

  text: PALETTE.darkText,
  textMuted: PALETTE.darkTextMuted,
  textSubtle: withAlpha(PALETTE.darkText, 0.5),

  shadowDark: PALETTE.darkShadowDark,
  shadowLight: PALETTE.darkShadowLight,

  border: withAlpha(PALETTE.darkText, 0.1),
  borderActive: PALETTE.orange,

  primary: PALETTE.orange,
  primaryText: PALETTE.white,
  primaryDark: PALETTE.orangeDark,

  accent: PALETTE.orange,
  accentMuted: withAlpha(PALETTE.orange, 0.15),

  success: PALETTE.green,
  successMuted: withAlpha(PALETTE.green, 0.15),

  warning: PALETTE.yellow,
  warningMuted: withAlpha(PALETTE.yellow, 0.15),

  danger: PALETTE.red,
  dangerMuted: withAlpha(PALETTE.red, 0.15),

  info: PALETTE.blue,
  infoMuted: withAlpha(PALETTE.blue, 0.15),

  white: PALETTE.white,
  black: PALETTE.black,
  surfaceHighlight: withAlpha(PALETTE.orange, 0.08),
};

export type ThemeMode = 'dark' | 'light';

export function getThemeColors(mode: ThemeMode): UIThemeColors {
  return mode === 'light' ? lightThemeColors : darkThemeColors;
}


