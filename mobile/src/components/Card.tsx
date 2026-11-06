import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../typography/Typography';
import { ANIMATION } from '../theme/spacing';

export type CardVariant = 'solid' | 'elevated' | 'accent' | 'layered' | 'inner';

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
  variant = 'solid',
  selected = false,
  onPress,
  accessibilityLabel,
  style,
}: CardProps) {
  const { colors, shadow, mode } = useTheme();
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

  let backgroundColor = colors.surface;
  let borderColor = 'transparent';
  let borderWidth = 0;
  let cardShadow = shadow('raised');
  let borderRadius = 24;

  switch (variant) {
    case 'solid':
      backgroundColor = colors.surface;
      cardShadow = shadow('raised');
      break;
    case 'elevated':
      backgroundColor = colors.surfaceElevated;
      cardShadow = shadow('elevated');
      break;
    case 'accent':
      backgroundColor = colors.accentMuted;
      borderColor = colors.accent;
      borderWidth = 1;
      cardShadow = shadow('raised');
      break;
    case 'layered':
      // Special layered card with inner surface
      backgroundColor = colors.surface;
      cardShadow = shadow('raised');
      break;
    case 'inner':
      // Inner card surface (lighter)
      backgroundColor = colors.surfaceInner;
      cardShadow = shadow('flat');
      borderRadius = 20;
      break;
  }

  if (selected) {
    borderColor = colors.accent;
    borderWidth = 2;
  }

  const containerStyle = [
    styles.card,
    {
      backgroundColor,
      borderColor,
      borderWidth,
      borderRadius,
    },
    cardShadow,
    style,
  ];

  const content = <>{children}</>;

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
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return <View style={containerStyle}>{content}</View>;
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
    overflow: 'visible',
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
