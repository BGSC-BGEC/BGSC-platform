import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../responsive/useResponsive';

export function OtpCells({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const { isCompactPhone } = useResponsive();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={[styles.row, isCompactPhone && styles.rowCompact]} pointerEvents="none">
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              isCompactPhone && styles.cellCompact,
              {
                backgroundColor: colors.surface,
                borderColor: focused && index === Math.min(value.length, 5) ? colors.primary : colors.border,
              },
            ]}
          >
            <Typography variant={isCompactPhone ? 'h3' : 'h2'} align="center">
              {value[index] || ' '}
            </Typography>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, 6))}
        maxLength={6}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel="Six-digit verification code"
        editable={!disabled}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  rowCompact: { gap: 6 },
  cell: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 10, borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  cellCompact: { minHeight: 48, borderRadius: 12, paddingVertical: 8 },
  input: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.02, color: 'transparent', fontSize: 1 },
});
