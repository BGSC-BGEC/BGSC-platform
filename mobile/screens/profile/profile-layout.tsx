import type { ReactNode } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { useResponsive } from '../../src/responsive';
import { useTheme } from '../../src/theme/ThemeProvider';

export function ProfileLayout({ title, children, refreshing = false, onRefresh, isRoot = false }: { title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; /** Tab/root screen: show the menu button instead of a back button with nowhere to go. */ isRoot?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, isCompactPhone } = useResponsive();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title={title} showBackButton={!isRoot} showMenuButton={isRoot} />
    {/* Scrolls the focused field above the keyboard on both platforms. */}
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { padding: gutter, paddingBottom: Math.max(insets.bottom + 90, 110), gap: isCompactPhone ? 16 : 20 },
      ]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </KeyboardAwareScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ content: { width: '100%', maxWidth: 720, alignSelf: 'center' } });

