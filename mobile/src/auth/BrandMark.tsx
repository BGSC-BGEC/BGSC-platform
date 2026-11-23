import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BgscLogo } from '../components/BgscLogo';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';

const SIZES = {
  sm: { logo: 34, text: 22 }, // landing
  md: { logo: 46, text: 30 }, // login
  lg: { logo: 76, text: 48 }, // splash
};

/** BGSC crest + wordmark. */
export function BrandMark({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="BGSC">
      <BgscLogo size={s.logo} />
      <Typography
        color="text"
        style={{ fontFamily: FONT_FAMILIES.bodyBold, fontSize: s.text, lineHeight: s.text * 1.15, letterSpacing: -1 }}
      >
        BGSC
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
