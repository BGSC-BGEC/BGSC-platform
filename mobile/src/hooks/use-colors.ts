import { colorsFor, type ThemeColors } from '@/core/theme/tokens';
import { useThemeStore } from '@/core/stores/themeStore';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Active semantic tokens for the resolved theme (master doc §4.2).
 *
 * Resolution: themeStore preference wins; `system` falls back to the OS scheme.
 * Never hardcode hex — always read colours through this hook.
 */
export function useColors(): ThemeColors {
  const preference = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  return colorsFor(preference === 'system' ? system : preference);
}
