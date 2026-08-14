import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useColors } from '@/hooks/use-colors';

export interface FABProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}

/**
 * Floating action button (master doc §7.7): 56 dp circle, accent bg, + icon,
 * fixed bottom-right (bottom 24, right 20).
 */
export function FAB({ onPress, icon = 'add', accessibilityLabel }: FABProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.accentText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
