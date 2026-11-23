import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { GlassSurface } from '../navigation/GlassSurface';

export interface StickyCTABarProps {
  /** "12 slots left" */
  title: string;
  /** "Closes in 3d 6h" */
  subtitle?: string;
  cta?: { label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'destructive'; loading?: boolean; disabled?: boolean };
}

/**
 * v2 sticky bottom bar — context text on the left, primary action on the right, on the tab bar's
 * liquid glass with rounded top corners.
 * Render it as a sibling *after* the ScrollView so it stays pinned.
 */
export function StickyCTABar({ title, subtitle, cta }: StickyCTABarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 32) },
      ]}
    >
      <GlassSurface panel fill radius={BAR_RADIUS} style={styles.glass} />
      <View style={styles.text}>
        <Typography variant="body" color="text" style={styles.title} numberOfLines={1}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
      {cta ? (
        <Button
          label={cta.label}
          variant={cta.variant ?? 'primary'}
          onPress={cta.onPress}
          loading={cta.loading}
          disabled={cta.disabled}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

const BAR_RADIUS = 22;

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 20 },
  glass: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: FONT_FAMILIES.bodySemiBold },
  cta: { minWidth: 150 },
});
