import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

/**
 * Standard Error state view for failed network requests or screen errors.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this data. Please check your connection and try again.',
  onRetry,
  retryLabel = 'Try Again',
  style,
}: ErrorStateProps) {
  const { colors } = useTheme();

  const handleRetry = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerMuted }]}>
        <Icon name="alert-circle" size="xl" color="danger" />
      </View>

      <Typography variant="h3" color="text" align="center" style={styles.title}>
        {title}
      </Typography>

      <Typography
        variant="body"
        color="textMuted"
        align="center"
        style={styles.message}
      >
        {message}
      </Typography>

      {onRetry && (
        <Pressable
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon name="refresh" size="sm" color="primaryText" />
          <Typography variant="button" color="primaryText">
            {retryLabel}
          </Typography>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    maxWidth: 280,
  },
  message: {
    maxWidth: 320,
    marginBottom: 8,
  },
  button: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

