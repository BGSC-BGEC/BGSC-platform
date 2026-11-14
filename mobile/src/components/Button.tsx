import React, { useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
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
  labelColor?: string;
  style?: ViewStyle;
  /** Outer wrapper style — use for flex sizing inside rows (`{ flex: 1 }`) */
  containerStyle?: ViewStyle;
}

const SIZE_SPECS = {
  sm: { height: 36, px: 16, fontSize: 13, iconSize: 'xs' as const },
  md: { height: 48, px: 20, fontSize: 14, iconSize: 'sm' as const },
  lg: { height: 54, px: 24, fontSize: 16, iconSize: 'md' as const },
};

/**
 * Liquid Crystal Button:
 * - Primary: Solar orange liquid capsule with specular glass rim, inner highlight, and ambient glow.
 * - Outline / Glass: Translucent frosted glass with backdrop blur, specular border, and inner reflection.
 */
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
  labelColor,
  style,
  containerStyle,
}: ButtonProps) {
  const { colors, isDark, shadow } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const spec = SIZE_SPECS[size];
  const borderRadius = shape === 'pill' ? 9999 : 14;
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

  const orangeAccent = colors.primary || '#f97316';

  let backgroundColor = 'transparent';
  let borderColor = 'transparent';
  let borderTopColor = 'transparent';
  let textColor: string = colors.text;
  let shadowStyle: object = {};

  switch (variant) {
    case 'primary':
      backgroundColor = orangeAccent;
      borderColor = withAlpha(orangeAccent, 0.65);
      borderTopColor = 'rgba(255, 255, 255, 0.45)';
      textColor = '#FFFFFF';
      shadowStyle = {
        shadowColor: orangeAccent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 10,
        elevation: 6,
      };
      break;

    case 'secondary':
      backgroundColor = withAlpha(colors.surfaceInner, 0.85);
      borderColor = withAlpha(colors.border, 0.8);
      borderTopColor = withAlpha('#FFFFFF', 0.22);
      textColor = colors.text;
      break;

    case 'glass':
      backgroundColor = withAlpha(colors.surface, 0.65);
      borderColor = withAlpha('#FFFFFF', 0.2);
      borderTopColor = withAlpha('#FFFFFF', 0.35);
      textColor = colors.text;
      shadowStyle = shadow('flat');
      break;

    case 'outline':
      backgroundColor = withAlpha(colors.surface, 0.72);
      borderColor = withAlpha('#FFFFFF', 0.16);
      borderTopColor = withAlpha('#FFFFFF', 0.3);
      textColor = colors.text;
      shadowStyle = shadow('flat');
      break;

    case 'ghost':
      backgroundColor = 'transparent';
      textColor = colors.text;
      break;

    case 'destructive':
      backgroundColor = colors.danger;
      borderColor = withAlpha(colors.danger, 0.6);
      borderTopColor = 'rgba(255, 255, 255, 0.35)';
      textColor = colors.primaryText;
      shadowStyle = {
        shadowColor: colors.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
      };
      break;
  }

  const resolvedTextColor = labelColor ?? textColor;

  return (
    <Animated.View
      style={[
        fullWidth && styles.fullWidth,
        containerStyle,
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
            minHeight: spec.height,
            paddingHorizontal: spec.px,
            borderRadius,
            backgroundColor: isDisabled ? colors.surfaceMuted : backgroundColor,
            borderColor: isDisabled ? colors.border : borderColor,
            borderTopColor: isDisabled ? colors.border : borderTopColor,
            borderWidth: borderColor !== 'transparent' ? 1 : 0,
            opacity: isDisabled ? 0.5 : 1,
          },
          shadowStyle,
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

        {variant === 'primary' && !isDisabled && (
          <View pointerEvents="none" style={styles.primaryMeniscus} />
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
                color={isDisabled ? colors.textSubtle : resolvedTextColor}
              />
            )}
            <Typography
              variant="button"
              numberOfLines={1}
              style={[
                styles.label,
                styles.shrink,
                {
                  fontSize: spec.fontSize,
                  color: isDisabled ? colors.textSubtle : resolvedTextColor,
                  ...(variant === 'primary' && {
                    textShadowColor: 'rgba(0, 0, 0, 0.25)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }),
                },
              ]}
            >
              {label}
            </Typography>
            {rightIcon && (
              <Icon
                name={rightIcon}
                size={spec.iconSize}
                color={isDisabled ? colors.textSubtle : resolvedTextColor}
              />
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
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
    fontWeight: '700',
  },
  primaryMeniscus: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
