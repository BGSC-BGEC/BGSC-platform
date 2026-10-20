import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { Button } from '../components/Button';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/** v2 empty state — tinted icon circle, bold title, muted copy, optional outline action. */
export function EmptyState({ icon = 'sparkles', title, description, actionLabel, onAction, style }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentMuted }]}>
        <Icon name={icon} size={28} color="primary" />
      </View>
      <Typography variant="h3" color="text" align="center">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body" color="textMuted" align="center" style={styles.description}>
          {description}
        </Typography>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="outline" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  iconCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  description: { maxWidth: 320 },
  action: { minWidth: 160 },
});
