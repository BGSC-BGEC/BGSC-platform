import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

export interface OtpCellsProps {
  value: string;
  onChange: (code: string) => void;
  /** Cell count (6 per auth specs; task override of handoffSpec's 4). */
  length?: number;
  error?: string | null;
  disabled?: boolean;
}

/**
 * OTP digit input (handoffSpec §6.3): hidden numeric TextInput driving a row
 * of rounded cells — JetBrains Mono digits, empty cells mint/grey, filled
 * cells white, active cell border emphasised, danger border on error. Typing
 * fills forward, backspace clears backward, paste fills all. Digits only.
 *
 * TODO(auth): cell shake + red flash on wrong code (handoffSpec §6.7) — needs
 * an Animated per-cell; skipped for the first pass.
 */
export function OtpCells({ value, onChange, length = 6, error = null, disabled = false }: OtpCellsProps) {
  const colors = lightColors;
  const inputRef = useRef<TextInput | null>(null);

  const digits = value.split('');
  const activeIndex = Math.min(digits.length, length - 1);

  return (
    <View>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityRole="button"
        accessibilityLabel={`Enter the ${length}-digit verification code`}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.9 : 1 }]}
      >
        {Array.from({ length }, (_, i) => {
          const digit = digits[i] ?? '';
          const isActive = !disabled && i === activeIndex && value.length < length;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  borderColor: error ? colors.danger : isActive ? colors.borderActive : colors.border,
                  backgroundColor: digit ? colors.surfaceSolid : colors.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.digit, { color: colors.text }]}>{digit}</Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        caretHidden
        editable={!disabled}
        accessibilityLabel={`${length}-digit verification code`}
        style={styles.hiddenInput}
      />

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cell: {
    width: 46,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: FONTS.mono,
    fontSize: 22,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    fontFamily: FONTS.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
});
