import { colorsFor, type ThemeColors } from '@/core/theme/tokens';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Shared design tokens (surface, primary, border, …) for the active scheme. */
export function useColors(): ThemeColors {
  return colorsFor(useColorScheme());
}
