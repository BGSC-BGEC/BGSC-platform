import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

/**
 * Dynamic Status Bar (spec §3.1) — the persistent context-aware top bar.
 *  - Left:   side-drawer toggle
 *  - Center: contextual logo (swaps per module)
 *  - Right:  profile avatar (authed) or Login button (guest)
 *
 * Wired as the Drawer's custom `header`.
 */

/** Maps a route to the contextual brand shown in the center (spec §3.1). */
const ROUTE_BRAND: Record<string, string> = {
  index: 'BGSC',
  events: 'BGEC',
  media: 'FitSoc',
};

// Minimal shape of the props the Drawer navigator passes to a custom header.
interface HeaderProps {
  navigation: { toggleDrawer: () => void };
  route: { name: string };
}

export function DynamicStatusBar({ navigation, route }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const brand = ROUTE_BRAND[route.name] ?? 'BGSC';

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}>
      <Pressable
        onPress={navigation.toggleDrawer}
        hitSlop={12}
        accessibilityLabel="Open navigation drawer">
        <Text style={[styles.menu, { color: colors.text }]}>☰</Text>
      </Pressable>

      <Logo label={brand} />

      {user ? (
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityLabel="Open profile">
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accentText }]}>
              {user.username.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/login')}
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.loginText, { color: colors.primaryText }]}>Login</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menu: { fontSize: 24, width: 32 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  loginBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  loginText: { fontSize: 14, fontWeight: '600' },
});
