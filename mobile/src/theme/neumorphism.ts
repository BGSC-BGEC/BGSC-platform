import { ViewStyle } from 'react-native';

/**
 * Premium Neumorphism Shadow Utilities
 * Based on soft, layered design with dual-tone shadows
 */

export interface NeumorphicShadow {
  light: ViewStyle;
  dark: ViewStyle;
}

/**
 * Flat/Raised state - soft elevation with dual shadows
 * This creates the classic neumorphic look with both dark and light shadows
 */
export const neumorphicRaised = {
  light: {
    shadowColor: '#D1CCC7', // Dark shadow (bottom-right)
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  dark: {
    shadowColor: '#1E2226', // Dark shadow (bottom-right)
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
};

/**
 * Pressed/Inset state - appears pushed into the surface
 */
export const neumorphicPressed = {
  light: {
    shadowColor: '#D1CCC7',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 0,
  },
  dark: {
    shadowColor: '#1E2226',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 0,
  },
};

/**
 * Subtle elevation - minimal shadow for nested elements
 */
export const neumorphicFlat = {
  light: {
    shadowColor: '#D1CCC7',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 2,
  },
  dark: {
    shadowColor: '#1E2226',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 2,
  },
};

/**
 * High elevation - prominent shadows for floating elements
 */
export const neumorphicElevated = {
  light: {
    shadowColor: '#D1CCC7',
    shadowOffset: { width: 12, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  dark: {
    shadowColor: '#1E2226',
    shadowOffset: { width: 12, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
};

/**
 * Inner shadow effect for inputs and inset elements
 */
export const neumorphicInner = {
  light: {
    shadowColor: '#D1CCC7',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 0,
  },
  dark: {
    shadowColor: '#1E2226',
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 0,
  },
};

/**
 * Helper to get neumorphic style based on current theme mode
 */
export function getNeumorphicShadow(
  style: 'pressed' | 'flat' | 'raised' | 'elevated' | 'inner',
  mode: 'light' | 'dark'
): ViewStyle {
  const shadows = {
    pressed: neumorphicPressed,
    flat: neumorphicFlat,
    raised: neumorphicRaised,
    elevated: neumorphicElevated,
    inner: neumorphicInner,
  };

  return shadows[style][mode];
}

/**
 * Complete neumorphic style with background and shadow
 * Use this for card-like elements with soft, raised appearance
 */
export function getNeumorphicStyle(
  backgroundColor: string,
  shadowType: 'pressed' | 'flat' | 'raised' | 'elevated' | 'inner',
  mode: 'light' | 'dark',
  borderRadius: number = 24
): ViewStyle {
  return {
    backgroundColor,
    borderRadius,
    ...getNeumorphicShadow(shadowType, mode),
  };
}

/**
 * Multi-layered card style (like in the reference images)
 * Creates a card within a card effect with proper shadows
 */
export function getNeumorphicLayeredCard(
  outerBg: string,
  innerBg: string,
  mode: 'light' | 'dark'
): {
  outer: ViewStyle;
  inner: ViewStyle;
} {
  return {
    outer: {
      backgroundColor: outerBg,
      borderRadius: 24,
      padding: 16,
      ...getNeumorphicShadow('raised', mode),
    },
    inner: {
      backgroundColor: innerBg,
      borderRadius: 20,
      padding: 16,
      ...getNeumorphicShadow('flat', mode),
    },
  };
}

/**
 * Circular button/icon style with neumorphic shadows
 */
export function getNeumorphicCircle(
  size: number,
  backgroundColor: string,
  mode: 'light' | 'dark',
  pressed: boolean = false
): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    ...getNeumorphicShadow(pressed ? 'pressed' : 'flat', mode),
  };
}

