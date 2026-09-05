import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Label, Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  helperText?: string;
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
  leftIcon,
  rightIcon,
  allowClear = false,
  disabled = false,
  containerStyle,
  inputStyle,
  rounded = true,
  ...rest
}: TextInputProps) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const [passwordHidden, setPasswordHidden] = useState(secureTextEntry);

  const hasValue = Boolean(value && value.length > 0);
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
            borderColor,
            borderRadius: rounded ? 999 : 14,
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
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={passwordHidden}
          editable={!disabled}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
    overflow: 'hidden',
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
    height: '100%',
    paddingVertical: 0,
  },
  inputLeftPadded: {
    paddingLeft: 4,
  },
  actionButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 11,
    marginTop: 2,
    paddingHorizontal: 4,
  },
});
