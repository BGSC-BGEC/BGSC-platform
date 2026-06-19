import { Pressable, StyleSheet, Text } from 'react-native';

import { useThemeStore } from '@/core/stores/themeStore';
import { useColors } from '@/hooks/use-colors';

const LABELS: Record<string, string> = {
  light: '☀️  Light',
  dark: '🌙  Dark',
  system: '💻  System',
};

export function ThemeToggle() {
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <Pressable
      onPress={toggle}
      style={[styles.button, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.text, { color: colors.text }]}>Theme: {LABELS[mode]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: { fontSize: 14, fontWeight: '500' },
});
