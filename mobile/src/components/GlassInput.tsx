import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useThemeStore } from '@/core/stores/themeStore';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';
import { darkColors, lightColors } from '@/core/theme/tokens';

export interface GlassInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string | null;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  textContentType?: 'emailAddress' | 'password' | 'username' | 'telephoneNumber' | 'none';
  accessibilityLabel?: string;
  /** Force a blur tint — use 'light' on light-canvas screens (e.g. auth). */
  scheme?: 'light' | 'dark';
}

/**
 * Glass input (master doc §7.2): glass surface bg, 1px border, pill radius
 * (999), ~48 dp, UPPERCASE label above (Inter 11/600, textMuted, letterSpacing
 * 0.6). Focus → borderActive. Error → danger border + message. Password →
 * trailing eye toggle.
 */
export function GlassInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  textContentType = 'none',
  accessibilityLabel,
  scheme,
}: GlassInputProps) {
  const themeColors = useColors();
  const preference = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  const resolved = scheme ?? ((preference === 'system' ? system : preference) === 'light' ? 'light' : 'dark');
  const blurTint: 'light' | 'dark' = resolved;
  // When scheme is forced (auth screens), use that palette for all colors too.
  const colors = scheme ? (scheme === 'light' ? lightColors : darkColors) : themeColors;
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);

  const borderColor = error ? colors.danger : focused ? colors.borderActive : colors.border;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.wrap, { borderColor, borderRadius: multiline ? 16 : 999 }]}>
        <BlurView intensity={30} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel ?? label}
          style={[
            styles.input,
            multiline && styles.multiline,
            { color: colors.text },
          ]}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={8}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  eye: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
