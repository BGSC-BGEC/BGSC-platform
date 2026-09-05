import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Typography } from '../typography/Typography';
import { Icon } from '../icons/Icon';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: number | string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <Typography variant="h3" color="text">
          {title}
        </Typography>

        {badge !== undefined && (
          <View style={styles.badge}>
            <Typography variant="labelSmall" color="accentText">
              {badge}
            </Typography>
          </View>
        )}
      </View>

      {subtitle && (
        <Typography variant="caption" color="textMuted">
          {subtitle}
        </Typography>
      )}

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.actionButton}
        >
          <Typography variant="button" color="accent" style={styles.actionText}>
            {actionLabel}
          </Typography>
          <Icon name="chevron-right" size="xs" color="accent" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(224, 122, 63, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    position: 'absolute',
    right: 0,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
  },
});

