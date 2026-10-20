import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

export interface StickyCTABarProps {
  /** "12 slots left" */
  title: string;
  /** "Closes in 3d 6h" */
  subtitle?: string;
  cta?: { label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'destructive'; loading?: boolean; disabled?: boolean };
}

/**
 * v2 sticky bottom bar — context text on the left, primary action on the right.
 * Render it as a sibling *after* the ScrollView so it stays pinned.
 */
export function StickyCTABar({ title, subtitle, cta }: StickyCTABarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 32) },
      ]}
    >
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

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 20, borderTopWidth: 1 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: FONT_FAMILIES.bodySemiBold },
  cta: { minWidth: 150 },
});
