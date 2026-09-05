import React from 'react';
import {
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'slate'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: IconName;
  outlined?: boolean;
  style?: ViewStyle;
}

export function Badge({
  label,
  variant = 'muted',
  size = 'md',
  icon,
  outlined = false,
  style,
}: BadgeProps) {
  const { colors } = useTheme();

  // Map variant to theme colors
  let textColor: string = colors.text;
  let bgColor: string = colors.surfaceMuted;
  let borderColor: string = colors.border;

  switch (variant) {
    case 'primary':
    case 'accent':
      textColor = colors.accent;
      bgColor = colors.accentMuted;
      borderColor = colors.accent;
      break;
    case 'secondary':
      textColor = colors.secondaryText;
      bgColor = colors.secondary;
      borderColor = colors.secondary;
      break;
    case 'slate':
      textColor = colors.slate;
      bgColor = colors.slateMuted;
      borderColor = colors.slate;
      break;
    case 'success':
      textColor = colors.success;
      bgColor = colors.successMuted;
      borderColor = colors.success;
      break;
    case 'warning':
      textColor = colors.warning;
      bgColor = colors.warningMuted;
      borderColor = colors.warning;
      break;
    case 'danger':
      textColor = colors.danger;
      bgColor = colors.dangerMuted;
      borderColor = colors.danger;
      break;
    case 'muted':
    default:
      textColor = colors.textMuted;
      bgColor = colors.surfaceMuted;
      borderColor = colors.border;
      break;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          height: isSmall ? 22 : 26,
          paddingHorizontal: isSmall ? 8 : 10,
          backgroundColor: outlined ? 'transparent' : bgColor,
          borderColor: outlined ? borderColor : 'transparent',
          borderWidth: outlined ? 1 : 0,
        },
        style,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={isSmall ? 10 : 12}
          color={textColor}
          style={styles.icon}
        />
      )}
      <Typography
        variant={isSmall ? 'labelSmall' : 'label'}
        style={[
          styles.labelText,
          { color: textColor },
        ]}
      >
        {label}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  labelText: {
    fontSize: 10,
    lineHeight: 12,
  },
});

