import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../icons/Icon';
import { FONT_FAMILIES } from '../theme/typography';

export interface SearchInputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  containerStyle?: ViewStyle;
  autoFocus?: boolean;
}

export function SearchInput({
  value: controlledValue,
  onChangeText,
  onSearch,
  placeholder = 'Search...',
  debounceMs = 300,
  containerStyle,
  autoFocus = false,
}: SearchInputProps) {
  const { colors, isDark } = useTheme();
  const [internalValue, setInternalValue] = useState(controlledValue ?? '');
  const [focused, setFocused] = useState(false);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (text: string) => {
    setInternalValue(text);
    onChangeText?.(text);
  };

  const handleClear = () => {
    setInternalValue('');
    onChangeText?.('');
    onSearch?.('');
  };

  useEffect(() => {
    if (!onSearch) return;
    const timer = setTimeout(() => {
      onSearch(value);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs, onSearch]);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: focused ? colors.borderActive : colors.border,
          backgroundColor: colors.surfaceMuted,
        },
        containerStyle,
      ]}
    >
      <BlurView
        intensity={35}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      <Icon
        name="search"
        size="sm"
        color={focused ? 'text' : 'textSubtle'}
        style={styles.searchIcon}
      />

      <RNTextInput
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={() => onSearch?.(value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { color: colors.text }]}
      />

      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clearButton}
        >
          <Icon name="close" size="xs" color="textSubtle" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: FONT_FAMILIES.bodyRegular,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

