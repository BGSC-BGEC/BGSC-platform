import { router } from 'expo-router';
import {
  DrawerContentScrollView,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Side drawer content (master §2.3): brand + user (or guest prompt), the
 * registered drawer screens, and a footer with theme switch + login/logout.
 */
export function DrawerContent(props: DrawerContentComponentProps) {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <DrawerContentScrollView {...props}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Logo />
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {status === 'authenticated' && user
              ? `${user.username} · ${user.role}`
              : 'Guest — read-only access'}
          </Text>
        </View>

        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <ThemeToggle />
        {status === 'authenticated' ? (
          <Pressable
            onPress={() => void logout()}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            style={[styles.action, { borderColor: colors.border }]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>Logout</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            accessibilityLabel="Login or register"
            style={[styles.action, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={[styles.actionText, { color: colors.primaryText }]}>Login / Register</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  subtitle: { fontFamily: FONTS.body, fontSize: 13 },
  footer: { padding: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  action: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionText: { fontFamily: FONTS.semibold, fontSize: 14 },
});
