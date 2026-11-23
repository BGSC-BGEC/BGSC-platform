import { Platform } from 'react-native';

/**
 * Shared "liquid glass" design tokens for navigation surfaces (bottom tab bar, side
 * drawer), so both read as one design language and change together.
 */

export const IS_IOS = Platform.OS === 'ios';

/** Active item: opaque coral pill, a gentle diagonal shade only (no white sheen). */
export const GLASS_ACTIVE_FILL = ['#E68A70', '#D9745A'] as const;
/** Icon/label colour on the coral pill (dark: white on coral is only ~2.9:1). */
export const GLASS_ACTIVE_INK = '#141821';
/** Coloured glow under the active pill (iOS only). */
export const GLASS_ACTIVE_GLOW = '#DF7A5E';

export function glassTokens(isDark: boolean) {
  return {
    /** Tint over the blur. Android has no real blur here, so its tint is heavier. */
    tint: isDark
      ? IS_IOS ? 'rgba(16, 20, 32, 0.22)' : 'rgba(18, 22, 34, 0.9)'
      : IS_IOS ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.92)',
    /** Heavier tint for panels holding body text (sheets, popups), so copy stays readable over a scrim. */
    panelTint: isDark
      ? IS_IOS ? 'rgba(20, 24, 36, 0.72)' : 'rgba(22, 26, 38, 0.96)'
      : IS_IOS ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.97)',
    blurIntensity: isDark ? 70 : 85,
    blurTint: (IS_IOS
      ? isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'
      : isDark ? 'dark' : 'light') as 'systemUltraThinMaterialDark' | 'systemUltraThinMaterialLight' | 'dark' | 'light',
    /** Rim: top edge kept close to the sides so it never reads as a white line. */
    rim: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.55)',
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.85)',
      borderBottomColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.1)',
    },
    /** Curved-surface light: top highlight, faint bottom glow, diagonal streak. */
    highlight: isDark
      ? (['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'] as const)
      : (['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as const),
    bottomGlow: isDark
      ? (['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)'] as const)
      : (['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)'] as const),
    streak: isDark
      ? (['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)'] as const)
      : (['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)'] as const),
    /** Inactive icon/label colour. */
    inactiveInk: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(15, 23, 42, 0.65)',
  };
}
