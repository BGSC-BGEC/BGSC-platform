import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

export interface StatTileProps {
  value: string | number;
  caption: string;
  style?: StyleProp<ViewStyle>;
}

export function StatTile({ value, caption, style }: StatTileProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surfaceInner }, style]}>
      <Typography variant="h3" align="center" numberOfLines={1}>
        {value}
      </Typography>
      <Typography variant="caption" color="textMuted" align="center" numberOfLines={1} style={styles.caption}>
        {caption}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 64, borderRadius: 16, paddingHorizontal: 6, paddingVertical: 12, gap: 4 },
  caption: { fontSize: 12 },
});
