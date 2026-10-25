import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { useResponsive } from '../../src/responsive';
import { useTheme } from '../../src/theme/ThemeProvider';

export function ProfileLayout({ title, children, refreshing = false, onRefresh }: { title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, isCompactPhone } = useResponsive();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title={title} showBackButton showMenuButton={false} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { padding: gutter, paddingBottom: Math.max(insets.bottom + 24, 40), gap: isCompactPhone ? 16 : 20 },
        ]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ content: { width: '100%', maxWidth: 720, alignSelf: 'center' } });

