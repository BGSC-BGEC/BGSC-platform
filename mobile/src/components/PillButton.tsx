import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export type PillButtonVariant = 'primary' | 'light' | 'ghost' | 'destructive';

export interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: object;
}

/**
 * Pill button (master doc §7.1).
 * - primary: accent fill, accentText — one per view.
 * - light: primary fill (light-ink on dark canvas).
 * - ghost: transparent, 1px border.
 * - destructive: danger text/fill for hard-delete (always pair with a confirm step).
 * In-flight → spinner + "Please wait…". Disabled → border bg + textMuted.
 */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityLabel,
  style,
}: PillButtonProps) {
  const colors = useColors();

  const fill: Record<PillButtonVariant, string> = {
    primary: colors.accent,
    light: colors.primary,
    ghost: 'transparent',
    destructive: 'transparent',
  };
  const labelColor: Record<PillButtonVariant, string> = {
    primary: colors.accentText,
    light: colors.primaryText,
    ghost: colors.text,
    destructive: colors.danger,
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: isDisabled ? colors.border : fill[variant],
          borderWidth: variant === 'ghost' || variant === 'destructive' ? 1 : 0,
          borderColor: isDisabled ? colors.border : colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={isDisabled ? colors.textMuted : labelColor[variant]} />
          <Text style={[styles.label, { color: isDisabled ? colors.textMuted : labelColor[variant] }]}>
            {' '}
            Please wait…
          </Text>
        </>
      ) : (
        <Text style={[styles.label, { color: isDisabled ? colors.textMuted : labelColor[variant] }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
  },
});
