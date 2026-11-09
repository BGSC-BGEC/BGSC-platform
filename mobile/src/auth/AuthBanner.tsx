import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

const DEFAULT_ICON: Record<'danger' | 'success' | 'info', IconName> = { danger: 'lock', success: 'check', info: 'info-circle' };

/** v2 inline banner on auth screens: errors (401 / 429 / restore), a success notice, or a neutral info notice. */
export function AuthBanner({ message, icon, tone = 'danger' }: { message: string; icon?: IconName; tone?: 'danger' | 'success' | 'info' }) {
  const { colors } = useTheme();
  const palette =
    tone === 'success'
      ? { backgroundColor: colors.successMuted, borderColor: colors.success }
      : tone === 'info'
        ? { backgroundColor: colors.infoMuted, borderColor: colors.info }
        : { backgroundColor: colors.dangerMuted, borderColor: colors.danger };
  return (
    <View accessibilityRole="alert" style={[styles.banner, palette]}>
      <Icon name={icon ?? DEFAULT_ICON[tone]} size={16} color={tone} />
      <Typography variant="bodySmall" color="text" style={styles.text}>
        {message}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  text: { flex: 1 },
});
