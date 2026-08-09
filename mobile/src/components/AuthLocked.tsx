import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export interface AuthLockedProps {
  /** e.g. "your points & challenges" — fills the copy. */
  subject: string;
}

/**
 * Auth-required screen gate (master §2.4): guests see this locked state with
 * a Login CTA instead of the data. The return path is preserved so the user
 * lands back here after sign-in.
 */
export function AuthLocked({ subject }: AuthLockedProps) {
  const colors = useColors();
  const pathname = usePathname();

  return (
    <View style={styles.root}>
      <GlassCard accessibilityLabel="Sign in required">
        <View style={[styles.iconWrap, { borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Sign in to view {subject}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Points, challenges, and submissions are tied to your account.
        </Text>
        <PillButton
          variant="primary"
          label="Login / Register"
          onPress={() =>
            router.replace({ pathname: '/login', params: { returnTo: pathname } })
          }
          accessibilityLabel="Go to login"
          style={styles.button}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 24,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    marginTop: 6,
  },
  button: {
    marginTop: 20,
  },
});
