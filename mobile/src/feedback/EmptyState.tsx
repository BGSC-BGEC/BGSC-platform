import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/**
 * Standard Empty state placeholder for feeds, lists, or searches.
 */
export function EmptyState({
  icon = 'sparkles',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  const handleAction = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAction?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Icon name={icon} size="xl" color="textMuted" />
      </View>

      <Typography variant="h3" color="text" align="center" style={styles.title}>
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body"
          color="textMuted"
          align="center"
          style={styles.description}
        >
          {description}
        </Typography>
      )}

      {actionLabel && onAction && (
        <Pressable
          onPress={handleAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Typography variant="button" color="accentText">
            {actionLabel}
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
    gap: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    maxWidth: 280,
  },
  description: {
    maxWidth: 320,
    marginBottom: 8,
  },
  button: {
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

