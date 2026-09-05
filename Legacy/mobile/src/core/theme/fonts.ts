/**
 * Font families — master doc §5.1.
 *
 * Hero (32 sp+): Bebas Neue 400 only.
 * UI headings (18–28 sp): Barlow Condensed 700/800.
 * Body / all UI: Inter 400/500/600/700.
 * Monospace: JetBrains Mono 500 (OTP, timestamps).
 *
 * Reference from this constant — never inline family-name strings (master §15.4).
 */
export const FONTS = {
  hero: 'BebasNeue_400Regular',
  heading: 'BarlowCondensed_700Bold',
  headingHeavy: 'BarlowCondensed_800ExtraBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export type FontKey = keyof typeof FONTS;
