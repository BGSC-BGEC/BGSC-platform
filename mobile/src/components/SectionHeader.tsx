import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: number | string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/** v2/SectionHeader — serif section title with an optional orange "See all" action. */
export function SectionHeader({ title, subtitle, badge, actionLabel, onAction, style }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <Typography variant="h2" color="text" numberOfLines={1} style={styles.title}>
            {title}
          </Typography>
          {badge !== undefined && (
            <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
              <Typography variant="labelSmall" color="primary">
                {badge}
              </Typography>
            </View>
          )}
        </View>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel}>
            <Typography variant="button" color="primary" style={styles.action}>
              {actionLabel}
            </Typography>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? (
        <Typography variant="bodySmall" color="textMuted">
          {subtitle}
        </Typography>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 30, gap: 12 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  action: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
});
