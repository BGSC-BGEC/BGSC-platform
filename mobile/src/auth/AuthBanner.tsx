import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

/** v2 inline banner on auth screens: errors (401 / 429 / restore) or a success notice. */
export function AuthBanner({ message, icon, tone = 'danger' }: { message: string; icon?: IconName; tone?: 'danger' | 'success' }) {
  const { colors } = useTheme();
  const ok = tone === 'success';
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, ok
          ? { backgroundColor: colors.successMuted, borderColor: colors.success }
          : { backgroundColor: colors.dangerMuted, borderColor: colors.danger }]}
    >
      <Icon name={icon ?? (ok ? 'check' : 'lock')} size={16} color={tone} />
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
