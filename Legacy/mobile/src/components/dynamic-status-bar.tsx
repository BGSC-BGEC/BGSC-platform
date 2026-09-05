import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/logo';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/** Maps a route to the contextual brand shown in the center (master §9 home). */
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

/**
 * Dynamic status bar — persistent context-aware top bar (master §2.3):
 * left drawer toggle, centre contextual brand, right avatar (authed) or
 * Login (guest). Canvas background + hairline border; glass-free so the
 * drawer screens' glass reads clearly beneath it.
 */
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
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={navigation.toggleDrawer}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Open navigation drawer"
        style={styles.side}
      >
        <Ionicons name="menu" size={24} color={colors.text} />
      </Pressable>

      <Logo label={brand} />

      {user ? (
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={styles.side}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accentText }]}>
              {user.username.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/login')}
          accessibilityRole="button"
          accessibilityLabel="Login"
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
        >
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
  side: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
  },
  loginBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  loginText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});
