import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Typography } from '../typography/Typography';
import { ANIMATION } from '../theme/spacing';

export type IconButtonVariant =
  | 'glass'
  | 'ghost'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outline';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: 'circle' | 'rounded';
  badge?: number | boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
}

const BUTTON_DIMENSIONS = {
  sm: 34,
  md: 44,
  lg: 52,
} as const;

const ICON_SIZE_MAPPING = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

export function IconButton({
  icon,
  onPress,
  variant = 'glass',
  size = 'md',
  shape = 'circle',
  badge,
  disabled = false,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const { colors, isDark } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  const dim = BUTTON_DIMENSIONS[size];
  const borderRadius = shape === 'circle' ? dim / 2 : 12;

  const handlePressIn = () => {
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Determine icon color & button background based on variant and Uxintace palette
  let backgroundColor = 'transparent';
  let borderColor = 'transparent';
  let iconColor: string = colors.text;

  switch (variant) {
    case 'primary': // Orange CTA
      backgroundColor = colors.primary;
      iconColor = colors.primaryText;
      break;
    case 'secondary': // Deep Moss Green
      backgroundColor = colors.secondary;
      iconColor = colors.secondaryText;
      break;
    case 'accent': // Orange
      backgroundColor = colors.accent;
      iconColor = colors.accentText;
      break;
    case 'outline':
      backgroundColor = 'transparent';
      borderColor = colors.border;
      iconColor = colors.text;
      break;
    case 'ghost':
      backgroundColor = 'transparent';
      iconColor = colors.text;
      break;
    case 'glass':
    default:
      backgroundColor = colors.surface;
      borderColor = colors.border;
      iconColor = colors.text;
      break;
  }

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={[
          styles.container,
          {
            width: dim,
            height: dim,
            borderRadius,
            backgroundColor: disabled ? colors.surfaceMuted : backgroundColor,
            borderColor: disabled ? colors.border : borderColor,
            borderWidth: borderColor !== 'transparent' ? 1 : 0,
            opacity: disabled ? 0.45 : 1,
          },
          style,
        ]}
      >
        {variant === 'glass' && !disabled && (
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Icon
          name={icon}
          size={ICON_SIZE_MAPPING[size]}
          color={disabled ? colors.textSubtle : iconColor}
        />
        {badge !== undefined && badge !== false && (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.accent, borderColor: colors.background },
            ]}
          >
            {typeof badge === 'number' && (
              <Typography variant="labelSmall" color="accentText" style={styles.badgeText}>
                {badge > 99 ? '99+' : badge}
              </Typography>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 11,
  },
});

