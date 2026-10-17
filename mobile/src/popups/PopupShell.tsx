import React from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import type { UIThemeColors } from '../theme/colors';

export type PopupTone = 'success' | 'error' | 'info' | 'warning' | 'primary';

const TONE_CONFIG: Record<
  PopupTone,
  { icon: IconName; color: keyof UIThemeColors; bg: keyof UIThemeColors }
> = {
  success: { icon: 'check-circle', color: 'success', bg: 'successMuted' },
  error: { icon: 'alert-circle', color: 'danger', bg: 'dangerMuted' },
  info: { icon: 'info-circle', color: 'info', bg: 'infoMuted' },
  warning: { icon: 'warning', color: 'warning', bg: 'warningMuted' },
  primary: { icon: 'help-circle-outline', color: 'primary', bg: 'accentMuted' },
};

export interface PopupShellProps {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  message?: string;
  tone?: PopupTone;
  icon?: IconName;
  /** Close when the dimmed backdrop is tapped */
  dismissOnBackdrop?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Centered popup card shared by every dialog in the app.
 * Matches the confirmation modal used on the registration screen.
 */
export function PopupShell({
  visible,
  onRequestClose,
  title,
  message,
  tone,
  icon,
  dismissOnBackdrop = true,
  children,
  style,
}: PopupShellProps) {
  const { colors, shadow } = useTheme();
  const config = tone ? TONE_CONFIG[tone] : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdrop ? onRequestClose : undefined}
          accessibilityLabel="Close popup"
        />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            shadow('elevated'),
            style,
          ]}
          accessibilityViewIsModal
        >
          {config ? (
            <View style={[styles.iconCircle, { backgroundColor: colors[config.bg] }]}>
              <Icon name={icon ?? config.icon} size="lg" color={config.color} />
            </View>
          ) : null}
          <Typography variant="h2">{title}</Typography>
          {message ? (
            <Typography variant="body" color="textMuted">
              {message}
            </Typography>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 16 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
