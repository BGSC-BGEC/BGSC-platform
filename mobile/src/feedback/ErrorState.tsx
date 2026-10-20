import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../theme/colors';
import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

/** v2 error banner — red-tinted card, icon tile, title, hint and a "Retry" link. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'Check your connection. Pull down to refresh or retry.',
  onRetry,
  retryLabel = 'Retry',
  style,
}: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.card, { backgroundColor: colors.dangerMuted, borderColor: withAlpha(colors.danger, 0.4) }, style]}
    >
      <View style={[styles.iconTile, { backgroundColor: colors.danger }]}>
        <Icon name="activity" size={18} color="white" />
      </View>
      <View style={styles.text}>
        <Typography variant="body" color="text" style={styles.title}>
          {title}
        </Typography>
        <Typography variant="bodySmall" color="textMuted">
          {message}
        </Typography>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button" accessibilityLabel={retryLabel}>
            <Typography variant="button" style={[styles.retry, { color: colors.dangerText }]}>
              {retryLabel}
            </Typography>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1 },
  iconTile: { padding: 8, borderRadius: 12 },
  text: { flex: 1, gap: 8 },
  title: { fontFamily: FONT_FAMILIES.bodySemiBold },
  retry: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13 },
});
