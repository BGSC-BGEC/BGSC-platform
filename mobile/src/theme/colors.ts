/**
 * Premium Neumorphic Color Palette
 * Based on soft, layered design with subtle shadows
 */

export const PALETTE = {
  // Light mode — the v2 "Auth" palette (sign-in / sign-up screens)
  lightBase: '#FFF8F2',           // Main background (warm cream)
  lightCard: '#FFF8F2',           // Card surface
  lightCardInner: '#FFFFFF',      // Inputs, tab track
  lightText: '#111111',           // Primary text
  lightTextMuted: '#6B7280',      // Secondary text
  lightBorder: '#E5E7EB',         // Hairlines and input borders
  lightDangerText: '#C0392B',     // Danger text on cream
  lightShadowDark: '#D1CCC7',     // Dark shadow
  lightShadowLight: '#FFFFFF',    // Light highlight shadow

  // Dark mode - Soft slate/charcoal tones
  darkBase: '#2C3135',            // Main background (dark slate)
  darkCard: '#33383D',            // Card surface
  darkCardInner: '#3A4045',       // Inner card layer (lighter)
  darkText: '#E8E8E8',            // Primary text
  darkTextMuted: '#ABABAB',       // Secondary text (v2 contrast fix)
  darkShadowDark: '#1E2226',      // Dark shadow
  darkShadowLight: '#3D4449',     // Light highlight shadow

  // Accent colors
  orange: '#E07A3F',              // Primary CTA (warm orange)
  orangeDark: '#D4632A',          // Darker orange for press states
  orangeSolid: '#BD5420',         // Solid orange behind white text (avatars) — passes contrast
  red: '#E74C3C',                 // Error/love/favorite
  redText: '#FF6B5E',             // Danger text on dark surfaces
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
  /** Solid primary fill behind white text (avatars, badges) */
  primarySolid: string;

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
  /** Danger-coloured text (Log out, destructive links) */
  dangerText: string;
  info: string;
  infoMuted: string;

  /** 16% neutral tint (muted pills) */
  mutedTint: string;

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

  border: PALETTE.lightBorder,
  borderActive: PALETTE.orange,

  primary: PALETTE.orange,
  primaryText: PALETTE.white,
  primaryDark: PALETTE.orangeDark,
  primarySolid: PALETTE.orangeSolid,

  accent: PALETTE.orange,
  accentMuted: withAlpha(PALETTE.orange, 0.16),

  success: PALETTE.green,
  successMuted: withAlpha(PALETTE.green, 0.16),

  warning: PALETTE.yellow,
  warningMuted: withAlpha(PALETTE.yellow, 0.16),

  danger: PALETTE.red,
  dangerMuted: withAlpha(PALETTE.red, 0.16),
  dangerText: PALETTE.lightDangerText,

  info: PALETTE.blue,
  infoMuted: withAlpha(PALETTE.blue, 0.16),

  mutedTint: withAlpha('#9A9A9A', 0.16),
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
  primarySolid: PALETTE.orangeSolid,

  accent: PALETTE.orange,
  accentMuted: withAlpha(PALETTE.orange, 0.16),

  success: PALETTE.green,
  successMuted: withAlpha(PALETTE.green, 0.16),

  warning: PALETTE.yellow,
  warningMuted: withAlpha(PALETTE.yellow, 0.16),

  danger: PALETTE.red,
  dangerMuted: withAlpha(PALETTE.red, 0.16),
  dangerText: PALETTE.redText,

  info: PALETTE.blue,
  infoMuted: withAlpha(PALETTE.blue, 0.16),

  mutedTint: withAlpha('#9A9A9A', 0.16),
  white: PALETTE.white,
  black: PALETTE.black,
  surfaceHighlight: withAlpha(PALETTE.orange, 0.08),
};

export type ThemeMode = 'dark' | 'light';

export function getThemeColors(mode: ThemeMode): UIThemeColors {
  return mode === 'light' ? lightThemeColors : darkThemeColors;
}


