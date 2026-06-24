import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

/** Themed full-bleed page background used by every screen. */
export function Screen({ children, center }: { children: ReactNode; center?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.base,
        center && styles.center,
        { backgroundColor: colors.background },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
