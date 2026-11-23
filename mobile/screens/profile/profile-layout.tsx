import type { ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { useResponsive } from '../../src/responsive';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha } from '../../src/theme/colors';

// Room the floating footer covers (button + padding), so the last field can scroll clear of it.
const FOOTER_SPACE = 96;

export function ProfileLayout({
  title,
  children,
  refreshing = false,
  onRefresh,
  isRoot = false,
  footer,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Tab/root screen: show the menu button instead of a back button with nowhere to go. */
  isRoot?: boolean;
  /** Floats over the bottom of the screen (and rides above the keyboard), e.g. a "Save changes" button. */
  footer?: ReactNode;
}) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, isCompactPhone } = useResponsive();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader title={title} showBackButton={!isRoot} showMenuButton={isRoot} />
    {/* Scrolls the focused field above the keyboard on both platforms. */}
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      bottomOffset={footer ? FOOTER_SPACE : 24}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          padding: gutter,
          paddingBottom: Math.max(insets.bottom + 90, 110) + (footer ? FOOTER_SPACE : 0),
          gap: isCompactPhone ? 16 : 20,
        },
      ]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </KeyboardAwareScrollView>
    {footer ? (
      // Absolute children ignore SafeAreaView's padding, so the dock pads the home indicator itself.
      // With the keyboard up that strip is under the keyboard, so `opened` drops it back down.
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={styles.footerDock} pointerEvents="box-none">
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: gutter,
              paddingBottom: 12 + insets.bottom,
              backgroundColor: withAlpha(colors.background, 0.9),
              borderTopColor: withAlpha(colors.border, 0.6),
            },
          ]}
        >
          <View style={[styles.footerInner, shadow('raised')]}>{footer}</View>
        </View>
      </KeyboardStickyView>
    ) : null}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  footerDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  footer: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: { width: '100%', maxWidth: 720, alignSelf: 'center', borderRadius: 16 },
});
