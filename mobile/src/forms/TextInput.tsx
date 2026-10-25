import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Label, Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  helperText?: string;
  showCharCount?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  allowClear?: boolean;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: object;
  rounded?: boolean;
}

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  helperText,
  showCharCount = false,
  maxLength,
  leftIcon,
  rightIcon,
  allowClear = false,
  disabled = false,
  containerStyle,
  inputStyle,
  rounded = true,
  ...rest
}: TextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [passwordHidden, setPasswordHidden] = useState(secureTextEntry);

  const hasValue = Boolean(value && value.length > 0);
  const currentLength = value?.length ?? 0;
  const borderColor = error
    ? colors.danger
    : focused
    ? colors.borderActive
    : colors.border;

  const handleClear = () => {
    onChangeText?.('');
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Label style={styles.label}>{label}</Label>}

      <View
        style={[
          styles.inputContainer,
          {
            borderRadius: rounded ? 16 : 14,
            backgroundColor: colors.surface,
            borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >

        {leftIcon && (
          <View style={styles.leftIconWrapper}>
            <Icon
              name={leftIcon}
              size="sm"
              color={focused ? 'text' : 'textSubtle'}
            />
          </View>
        )}

        <RNTextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={passwordHidden}
          editable={!disabled}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            { color: colors.text },
            !leftIcon && styles.inputLeftPadded,
            inputStyle,
          ]}
          {...rest}
        />

        {allowClear && hasValue && !disabled && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear input"
            style={styles.actionButton}
          >
            <Icon name="close" size="xs" color="textSubtle" />
          </Pressable>
        )}

        {secureTextEntry && !disabled && (
          <Pressable
            onPress={() => setPasswordHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? 'Show password' : 'Hide password'}
            style={styles.actionButton}
          >
            <Icon
              name={passwordHidden ? 'eye' : 'eye-off'}
              size="sm"
              color="textSubtle"
            />
          </Pressable>
        )}

        {rightIcon && !secureTextEntry && (
          <View style={styles.actionButton}>
            <Icon name={rightIcon} size="sm" color="textSubtle" />
          </View>
        )}
      </View>

      {error || helperText || (showCharCount && maxLength) ? (
        <View style={styles.footerRow}>
          {error ? (
            <Typography variant="bodySmall" color="danger" style={styles.feedbackText}>
              {error}
            </Typography>
          ) : helperText ? (
            <Typography variant="bodySmall" color="textSubtle" style={styles.feedbackText}>
              {helperText}
            </Typography>
          ) : (
            <View />
          )}
          {showCharCount && maxLength ? (
            <Typography variant="caption" color="textSubtle">
              {currentLength}/{maxLength}
            </Typography>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Alias per mobile-v2-build-split.md Phase 0 contract (`src/forms/Field.tsx`). */
export const Field = TextInput;
export type FieldProps = TextInputProps;

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
    width: '100%',
  },
  label: {
    marginBottom: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  leftIconWrapper: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 15,
    minHeight: 50,
    paddingVertical: 12,
  },
  inputLeftPadded: {
    paddingLeft: 4,
  },
  actionButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  feedbackText: {
    flex: 1,
    fontSize: 11,
    marginTop: 2,
    paddingHorizontal: 4,
  },
});
