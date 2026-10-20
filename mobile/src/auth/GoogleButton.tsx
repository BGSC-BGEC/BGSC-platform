import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

interface GoogleButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

const GOOGLE_BLUE = '#4285F5';

/** v2 "Continue with Google" — bordered card button with the blue G. */
export function GoogleButton({ label, onPress, disabled = false }: GoogleButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Typography style={styles.g}>G</Typography>
      <Typography color="text" style={styles.label}>
        {label}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  g: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 18, lineHeight: 24, color: GOOGLE_BLUE },
  label: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14, lineHeight: 20 },
});
