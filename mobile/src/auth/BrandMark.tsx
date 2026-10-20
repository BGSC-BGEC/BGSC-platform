import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

const SIZES = {
  sm: { icon: 13, text: 22 }, // landing
  md: { icon: 18, text: 30 }, // login
  lg: { icon: 29, text: 48 }, // splash
};

/** Orange trophy tile + "BGSC" wordmark. */
export function BrandMark({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const { colors } = useTheme();
  const s = SIZES[size];
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="BGSC">
      <View style={[styles.tile, { backgroundColor: colors.primarySolid }]}>
        <Icon name="trophy" size={s.icon} color="white" />
      </View>
      <Typography
        color="text"
        style={{ fontFamily: FONT_FAMILIES.bodyBlack, fontSize: s.text, lineHeight: s.text * 1.15, letterSpacing: -1 }}
      >
        BGSC
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { padding: 8, borderRadius: 12 },
});
