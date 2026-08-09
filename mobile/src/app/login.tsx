import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuthScreen } from '@/components/auth/use-auth-screen';
import { useGoogleAuth } from '@/components/auth/useGoogleAuth';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

/**
 * Login (handoffSpec §4 / auth-mobile-spec §4): identifier + password,
 * "Forgot?" link, remember-me checkbox, primary Login CTA, OR divider and the
 * Google OAuth button. Errors surface from `authStore.error` as an inline
 * banner above the CTA; the button shows "Please wait…" while submitting.
 */
export default function LoginScreen() {
  useAuthScreen({ redirectIfAuthed: true });
  const colors = lightColors;
  const toast = useToast();
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const google = useGoogleAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const submitting = status === 'loading';

  const fieldErrors = {
    identifier:
      identifier.trim().length >= 3 ? null : 'Please enter your email or username',
    password: password.length >= 8 ? null : 'Password must be at least 8 characters',
  };
  const showIdentifierError = attempted ? fieldErrors.identifier : null;
  const showPasswordError = attempted ? fieldErrors.password : null;
  const canSubmit = !fieldErrors.identifier && !fieldErrors.password;

  const onLogin = async () => {
    setBanner(null);
    if (!canSubmit) {
      setAttempted(true);
      return;
    }
    try {
      await login({ usernameOrEmail: identifier.trim(), password });
      const target = returnTo && returnTo.startsWith('/') ? (returnTo as Href) : ('/(drawer)/' as Href);
      router.replace(target);
    } catch {
      // authStore.login set `error` before rethrowing — surface it.
      setBanner(
        useAuthStore.getState().error ??
          'Incorrect email/username or password.',
      );
    }
  };

  return (
    <AuthShell
      tabs={{
        options: ['Login', 'Sign Up'],
        value: 'Login',
        onChange: (v) => {
          if (v === 'Sign Up') router.replace('/register');
        },
      }}
    >
      <GlassInput
        label="Email or Username"
        value={identifier}
        onChangeText={(t) => {
          setIdentifier(t);
          setBanner(null);
        }}
        placeholder="example@email.com"
        autoCapitalize="none"
        textContentType="username"
        error={showIdentifierError}
        accessibilityLabel="Email or username"
        scheme="light"
      />

      <View>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
          <Text
            onPress={() => toast.show('Password reset — coming soon.')}
            accessibilityRole="link"
            accessibilityLabel="Forgot password"
            style={[styles.link, { color: colors.accent }]}
          >
            Forgot?
          </Text>
        </View>
        <GlassInput
          label=""
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setBanner(null);
          }}
          placeholder="••••••••"
          secureTextEntry
          textContentType="password"
          error={showPasswordError}
          accessibilityLabel="Password"
          scheme="light"
        />
      </View>

      <AuthCheckbox
        checked={remember}
        onChange={() => setRemember((r) => !r)}
        accessibilityLabel="Remember me for a month"
      >
        <Text style={[styles.caption, { color: colors.text }]}>Remember me for a month</Text>
      </AuthCheckbox>

      {banner ? (
        <View style={[styles.banner, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
          <Text style={[styles.bannerText, { color: colors.text }]}>{banner}</Text>
        </View>
      ) : null}

      <PillButton
        label="Login"
        variant="primary"
        loading={submitting}
        disabled={!canSubmit || submitting}
        onPress={() => void onLogin()}
        accessibilityLabel="Log in"
      />

      <OrDivider />

      <PillButton
        label="Login with google"
        variant="ghost"
        loading={google.loading}
        disabled={google.loading}
        onPress={() => void google.start()}
        accessibilityLabel="Login with Google"
      />
    </AuthShell>
  );
}

/** "─── OR ───" divider (handoffSpec §3.7). */
function OrDivider() {
  const colors = lightColors;
  return (
    <View style={styles.orRow}>
      <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.orText, { color: colors.textMuted }]}>OR</Text>
      <View style={[styles.orLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  link: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    textDecorationLine: 'underline',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
  },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
});
