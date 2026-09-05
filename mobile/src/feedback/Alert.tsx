import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title: string;
  description?: string;
  onDismiss?: () => void;
  style?: ViewStyle;
}

const ALERT_CONFIG: Record<
  AlertVariant,
  {
    icon: IconName;
    colorKey: 'info' | 'success' | 'warning' | 'danger';
    bgKey: 'infoMuted' | 'successMuted' | 'warningMuted' | 'dangerMuted';
  }
> = {
  info: { icon: 'info-circle', colorKey: 'info', bgKey: 'infoMuted' },
  success: { icon: 'check-circle', colorKey: 'success', bgKey: 'successMuted' },
  warning: { icon: 'warning', colorKey: 'warning', bgKey: 'warningMuted' },
  error: { icon: 'alert-circle', colorKey: 'danger', bgKey: 'dangerMuted' },
};

/**
 * Inline alert banner for notices, warnings, and contextual messages.
 */
export function Alert({
  variant = 'info',
  title,
  description,
  onDismiss,
  style,
}: AlertProps) {
  const { colors } = useTheme();
  const config = ALERT_CONFIG[variant];
  const accentColor = colors[config.colorKey];
  const bgColor = colors[config.bgKey];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor: accentColor,
        },
        style,
      ]}
    >
      <View style={styles.iconWrapper}>
        <Icon name={config.icon} size="md" color={accentColor} />
      </View>

      <View style={styles.content}>
        <Typography variant="h4" color="text" style={styles.title}>
          {title}
        </Typography>
        {description && (
          <Typography variant="bodySmall" color="textMuted">
            {description}
          </Typography>
        )}
      </View>

      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss alert"
          style={styles.dismiss}
        >
          <Icon name="close" size="sm" color="textMuted" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconWrapper: {
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
  },
  dismiss: {
    padding: 2,
  },
});

