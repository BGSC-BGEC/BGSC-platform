import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Icon } from '../icons/Icon';
import { useTheme } from '../theme/ThemeProvider';

interface AuthBackButtonProps {
  onPress: () => void;
  style?: ViewStyle;
}

/** v2 square back button for auth screens (sits over the hero). */
export function AuthBackButton({ onPress, style }: AuthBackButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name="arrow-left" size={20} color="text" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 8, borderRadius: 12, borderWidth: 1 },
  pressed: { opacity: 0.6 },
});
