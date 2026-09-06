export const SPACING = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export type SpacingKey = keyof typeof SPACING;

export const RADIUS = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof RADIUS;

export const BLUR_INTENSITY = {
  subtle: 25,
  card: 55,
  heavy: 80,
} as const;

export const ANIMATION = {
  durationFast: 150,
  durationNormal: 220,
  durationSlow: 350,
  spring: {
    tension: 90,
    friction: 14,
  },
  press: {
    scale: 0.98,
    opacity: 0.9,
    duration: 120,
  },
} as const;

