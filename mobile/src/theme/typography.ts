import type { TextStyle } from 'react-native';

/**
 * The app uses two families:
 * - Barlow Condensed (display): headlines and numbers people compare (scores, ranks, bids, prices).
 * - Inter (body/UI): everything people read or tap.
 * Graduate is only for the BGSC wordmark and the default player card. Card-only fonts
 * (e.g. Pixelify for the Minecraft card) are loaded inside their card, not here.
 */
export const FONT_FAMILIES = {
  hero: 'BarlowCondensed_700Bold',
  /** Varsity block letters for the BGSC wordmark. */
  brand: 'Graduate_400Regular',
  /** Elegant high-contrast serif for the BGSC wordmark in the home top bar. */
  wordmark: 'PlayfairDisplay_900Black',

  headingBold: 'BarlowCondensed_700Bold',
  headingHeavy: 'BarlowCondensed_700Bold',

  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',

  /** Numbers that line up in columns: Inter with tabular figures (see TYPOGRAPHY_STYLES.mono). */
  mono: 'Inter_500Medium',

  condensed: 'BarlowCondensed_600SemiBold',
  condensedHeavy: 'BarlowCondensed_800ExtraBold',
} as const;

export type TypographyVariant =
  | 'displayHero'
  | 'displayTitle'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'label'
  | 'labelSmall'
  | 'caption'
  | 'mono'
  | 'button';

export const TYPOGRAPHY_STYLES: Record<TypographyVariant, TextStyle> = {
  displayHero: {
    fontFamily: FONT_FAMILIES.hero,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: 0,
  },

  displayTitle: {
    fontFamily: FONT_FAMILIES.headingHeavy,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: 0,
  },

  h1: {
    fontFamily: FONT_FAMILIES.headingBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0,
  },

  h2: {
    fontFamily: FONT_FAMILIES.headingBold,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: 0,
  },

  h3: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 18,
    lineHeight: 24,
  },

  h4: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
  },

  bodyLarge: {
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
  },

  body: {
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
  },

  bodySmall: {
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },

  label: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  labelSmall: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  caption: {
    fontFamily: FONT_FAMILIES.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },

  mono: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },

  button: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
};

