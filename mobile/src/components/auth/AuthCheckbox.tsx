import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { lightColors } from '@/core/theme/tokens';

export interface AuthCheckboxProps {
  checked: boolean;
  onChange: () => void;
  accessibilityLabel: string;
  children: ReactNode;
}

/**
 * Checkbox + label row (handoffSpec §3.8): 20×20 box with 1.5px teal border,
 * teal fill + white check when checked, whole row tappable with a 44px touch
 * target. Used for "Remember me" and the ToS consent line.
 */
export function AuthCheckbox({ checked, onChange, accessibilityLabel, children }: AuthCheckboxProps) {
  const colors = lightColors;

  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: colors.borderActive,
            backgroundColor: checked ? colors.borderActive : 'transparent',
          },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={14} color={colors.accentText} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 44,
    paddingVertical: 6,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  label: {
    flex: 1,
  },
});
