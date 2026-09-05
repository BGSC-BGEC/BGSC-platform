import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { Label, Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';

export interface TextAreaProps extends Omit<RNTextInputProps, 'style' | 'multiline'> {
  label?: string;
  error?: string | null;
  helperText?: string;
  showCharCount?: boolean;
  minHeight?: number;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: object;
}

export function TextArea({
  label,
  value = '',
  onChangeText,
  placeholder,
  error,
  helperText,
  showCharCount = false,
  maxLength,
  minHeight = 110,
  disabled = false,
  containerStyle,
  inputStyle,
  ...rest
}: TextAreaProps) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
    ? colors.borderActive
    : colors.border;

  const currentLength = value?.length ?? 0;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Label style={styles.label}>{label}</Label>}

      <View
        style={[
          styles.inputContainer,
          {
            minHeight,
            borderColor,
            backgroundColor: colors.surfaceMuted,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <BlurView
          intensity={30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />

        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          multiline
          maxLength={maxLength}
          editable={!disabled}
          textAlignVertical="top"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { color: colors.text },
            inputStyle,
          ]}
          {...rest}
        />

        {showCharCount && maxLength && (
          <View style={styles.countWrapper}>
            <Typography variant="caption" color="textSubtle">
              {currentLength}/{maxLength}
            </Typography>
          </View>
        )}
      </View>

      {error ? (
        <Typography variant="bodySmall" color="danger" style={styles.feedbackText}>
          {error}
        </Typography>
      ) : helperText ? (
        <Typography variant="bodySmall" color="textSubtle" style={styles.feedbackText}>
          {helperText}
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    width: '100%',
  },
  label: {
    marginBottom: 2,
  },
  inputContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 15,
    minHeight: 80,
  },
  countWrapper: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  feedbackText: {
    fontSize: 11,
    marginTop: 2,
    paddingHorizontal: 4,
  },
});
