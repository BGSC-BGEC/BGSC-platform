import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Spinner } from '../feedback/Spinner';
import { Typography } from '../typography/Typography';
import { ANIMATION } from '../theme/spacing';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'glass'
  | 'outline'
  | 'ghost'
  | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: 'pill' | 'rounded';
  leftIcon?: IconName;
  rightIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const SIZE_SPECS = {
  sm: { height: 36, px: 16, fontSize: 13, iconSize: 'xs' as const },
  md: { height: 48, px: 20, fontSize: 15, iconSize: 'sm' as const },
  lg: { height: 54, px: 24, fontSize: 16, iconSize: 'md' as const },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  leftIcon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const spec = SIZE_SPECS[size];
  const borderRadius = shape === 'pill' ? 999 : 14;
  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: ANIMATION.press.scale,
        tension: ANIMATION.spring.tension,
        friction: ANIMATION.spring.friction,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: ANIMATION.press.opacity,
        duration: ANIMATION.press.duration,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (isDisabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: ANIMATION.spring.tension,
        friction: ANIMATION.spring.friction,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIMATION.press.duration,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = () => {
    if (isDisabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Determine colors according to Uxintace palette
  let backgroundColor = 'transparent';
  let borderColor = 'transparent';
  let textColor: string = colors.text;

  switch (variant) {
    case 'primary': // Orange CTA
      backgroundColor = colors.primary;
      textColor = colors.primaryText;
      break;
    case 'secondary': // Deep Moss Green
      backgroundColor = colors.secondary;
      textColor = colors.secondaryText;
      break;
    case 'glass':
      backgroundColor = colors.surface;
      borderColor = colors.border;
      textColor = colors.text;
      break;
    case 'outline':
      backgroundColor = 'transparent';
      borderColor = colors.border;
      textColor = colors.text;
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      textColor = colors.text;
      break;
    case 'destructive':
      backgroundColor = colors.danger;
      textColor = colors.primaryText;
      break;
  }

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        { transform: [{ scale }], opacity },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.button,
          fullWidth && styles.fullWidth,
          {
            height: spec.height,
            paddingHorizontal: spec.px,
            borderRadius,
            backgroundColor: isDisabled ? colors.surfaceMuted : backgroundColor,
            borderColor: isDisabled ? colors.border : borderColor,
            borderWidth: borderColor !== 'transparent' ? 1 : 0,
            opacity: isDisabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        {variant === 'glass' && !isDisabled && (
          <BlurView
            intensity={35}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}

        {loading ? (
          <>
            <Spinner
              size="small"
              color={isDisabled ? colors.textSubtle : textColor}
            />
            <Typography
              variant="button"
              style={[
                styles.label,
                { fontSize: spec.fontSize, color: isDisabled ? colors.textSubtle : textColor },
              ]}
            >
              Please wait...
            </Typography>
          </>
        ) : (
          <>
            {leftIcon && (
              <Icon
                name={leftIcon}
                size={spec.iconSize}
                color={isDisabled ? colors.textSubtle : textColor}
              />
            )}
            <Typography
              variant="button"
              style={[
                styles.label,
                { fontSize: spec.fontSize, color: isDisabled ? colors.textSubtle : textColor },
              ]}
            >
              {label}
            </Typography>
            {rightIcon && (
              <Icon
                name={rightIcon}
                size={spec.iconSize}
                color={isDisabled ? colors.textSubtle : textColor}
              />
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  fullWidth: {
    alignSelf: 'stretch',
    width: '100%',
  },
  label: {
    fontWeight: '600',
  },
});

