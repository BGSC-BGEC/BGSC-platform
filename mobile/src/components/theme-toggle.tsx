import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeStore, type ThemePreference } from '@/core/stores/themeStore';
import { useColors } from '@/hooks/use-colors';

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

/** Cycles light → dark → system on tap (master §2.5 theme store). */
export function ThemeToggle() {
  const colors = useColors();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const icon =
    theme === 'dark' ? 'moon' : theme === 'light' ? 'sunny' : 'phone-portrait-outline';

  return (
    <Pressable
      onPress={() => void setTheme(next)}
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${theme}. Tap to switch.`}
      style={[styles.button, { borderColor: colors.border }]}
    >
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Ionicons name="swap-horizontal" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
