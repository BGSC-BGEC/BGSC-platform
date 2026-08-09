import { StyleSheet, Text } from 'react-native';

import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Brand wordmark — Bebas Neue display (master §5.2: hero only; the brand mark
 * is a display glyph, kept at 32 sp to stay in the hero band).
 */
export function Logo({ label = 'BGSC' }: { label?: string }) {
  const colors = useColors();
  return <Text style={[styles.logo, { color: colors.text }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  logo: {
    fontFamily: FONTS.hero,
    fontSize: 32,
    letterSpacing: 1.5,
  },
});
