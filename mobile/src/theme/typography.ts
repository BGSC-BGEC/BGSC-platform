import type { TextStyle } from 'react-native';

export const FONT_FAMILIES = {
  hero: 'BebasNeue_400Regular',
  headingBold: 'BarlowCondensed_700Bold',
  headingHeavy: 'BarlowCondensed_800ExtraBold',
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
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
    fontSize: 54,
    lineHeight: 58,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  displayTitle: {
    fontFamily: FONT_FAMILIES.headingHeavy,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  h1: {
    fontFamily: FONT_FAMILIES.headingBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0.3,
  },
  h2: {
    fontFamily: FONT_FAMILIES.headingBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  h3: {
    fontFamily: FONT_FAMILIES.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  h4: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bodyLarge: {
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0,
  },
  label: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  labelSmall: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: FONT_FAMILIES.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  mono: {
    fontFamily: FONT_FAMILIES.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  button: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
};

