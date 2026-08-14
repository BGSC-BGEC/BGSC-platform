import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/use-colors';

export interface ScreenProps {
  children: ReactNode;
  /** Horizontal padding (master §6.1: 16 everywhere). */
  padded?: boolean;
  scroll?: boolean;
  /** Extra bottom inset for FAB clearance, tab bars, etc. */
  bottomInset?: number;
}

/**
 * Standard screen canvas (master §3.3): deep teal gradient base, 16 px
 * horizontal padding, scrollable by default. Every drawer screen wraps
 * content in this.
 */
export function Screen({ children, padded = true, scroll = true, bottomInset = 24 }: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const content = (
    <View style={[padded && styles.padded, { paddingBottom: insets.bottom + bottomInset }]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.canvas, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  padded: { paddingHorizontal: 16 },
});
