import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

/** v2 inline error banner on auth screens (401 / 429 / restore errors). */
export function AuthBanner({ message, icon = 'lock' }: { message: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: colors.dangerMuted, borderColor: colors.danger }]}
    >
      <Icon name={icon} size={16} color="danger" />
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
