import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { ANIMATION } from '../theme/spacing';

export type CardVariant = 'glass' | 'solid' | 'elevated' | 'accent';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'glass',
  selected = false,
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const { colors, isDark } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

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
    onPress?.();
  };

  let backgroundColor = 'transparent';
  let borderColor = colors.border;

  switch (variant) {
    case 'solid':
      backgroundColor = colors.surfaceSolid;
      break;
    case 'elevated':
      backgroundColor = colors.surfaceElevated;
      break;
    case 'accent':
      backgroundColor = colors.accentMuted;
      borderColor = colors.accent;
      break;
    case 'glass':
    default:
      backgroundColor = 'transparent';
      break;
  }

  if (selected) {
    borderColor = colors.accent;
  }

  const surfaceOverlay = (
    <>
      {variant === 'glass' && (
        <BlurView
          intensity={50}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              variant === 'glass'
                ? selected
                  ? colors.accentMuted
                  : colors.surface
                : backgroundColor,
          },
        ]}
      />
    </>
  );

  const containerStyle = [
    styles.card,
    {
      borderColor,
    },
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={[{ transform: [{ scale }], opacity }]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={containerStyle}
        >
          {surfaceOverlay}
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={containerStyle}>
      {surfaceOverlay}
      {children}
    </View>
  );
}

// Subcomponents for Card
export function CardHeader({
  title,
  subtitle,
  rightAction,
  style,
}: {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerTitles}>
        {title && (
          <Typography variant="h3" color="text">
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="caption" color="textMuted">
            {subtitle}
          </Typography>
        )}
      </View>
      {rightAction && <View style={styles.headerAction}>{rightAction}</View>}
    </View>
  );
}

export function CardBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.body, style]}>{children}</View>;
}

export function CardFooter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.footer, { borderTopColor: colors.border }, style]}>
      {children}
    </View>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitles: {
    flex: 1,
    gap: 2,
  },
  headerAction: {
    alignItems: 'flex-end',
  },
  body: {
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
});

