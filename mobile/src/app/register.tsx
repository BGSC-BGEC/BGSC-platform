import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

const USERNAME_RE = /^[a-zA-Z0-9_]{3,50}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
// Backend rule (authservice.md): min 8, 1 uppercase, 1 number, 1 special.
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const CONTACT_RE = /^\d{10}$/;

/**
 * Register (handoffSpec §5 / auth-mobile-spec §5): username + email +
 * password + repeat + contact (+91 prefix) + ToS consent. Submits via
 * `authStore.register` (which persists the session) then routes to the OTP
 * screen for email verification, per the auth flow state machine.
 */
export default function RegisterScreen() {
  useAuthScreen({ redirectIfAuthed: true });
  const colors = lightColors;
  const toast = useToast();
  const status = useAuthStore((s) => s.status);
  const register = useAuthStore((s) => s.register);
  const google = useGoogleAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [contactDigits, setContactDigits] = useState('');
  const [tos, setTos] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const submitting = status === 'loading';

  const contact = `+91 ${contactDigits}`;
  const onChangeContact = (t: string) =>
    setContactDigits(t.replace(/\D/g, '').replace(/^91/, '').slice(0, 10));

  const errors = {
    username: USERNAME_RE.test(username) ? null : 'Username: 3–50 letters, numbers, underscores',
    email: EMAIL_RE.test(email.trim()) ? null : 'Please enter a valid email address',
    password: PASSWORD_RE.test(password) ? null : 'Min 8 chars, 1 uppercase, 1 number, 1 special',
    repeat: repeat === password ? null : 'Passwords do not match',
    contact: CONTACT_RE.test(contactDigits) ? null : 'Please enter a valid phone number',
    tos: tos ? null : 'You must accept the Terms of Service',
  };
  const canSubmit = Object.values(errors).every((e) => e === null);

  const onSignUp = async () => {
    setBanner(null);
    if (!canSubmit) {
      setAttempted(true);
      return;
    }
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        acceptedTos: true,
        contact: `+91${contactDigits}`,
      });
      // Spec flow: new signups verify the email next (handoffSpec §15).
      router.replace({ pathname: '/auth/otp', params: { email: email.trim() } });
    } catch {
      setBanner(
        useAuthStore.getState().error ??
          "Couldn't create your account — please try again.",
      );
    }
  };

  const err = (key: keyof typeof errors) => (attempted ? errors[key] : null);

  return (
    <AuthShell
      tabs={{
        options: ['Login', 'Sign Up'],
        value: 'Sign Up',
        onChange: (v) => {
          if (v === 'Login') router.replace('/login');
        },
      }}
    >
      <GlassInput
        label="Username"
        value={username}
        onChangeText={setUsername}
        placeholder="gamer_tag"
        autoCapitalize="none"
        textContentType="username"
        error={err('username')}
        accessibilityLabel="Username"
      />

      <GlassInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="example@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        textContentType="emailAddress"
        error={err('email')}
        accessibilityLabel="Email"
      />

      <GlassInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        error={err('password')}
        accessibilityLabel="Password"
      />

      <GlassInput
        label="Repeat Password"
        value={repeat}
        onChangeText={setRepeat}
        placeholder="••••••••"
        secureTextEntry
        textContentType="password"
        error={err('repeat')}
        accessibilityLabel="Repeat password"
      />

      <GlassInput
        label="Contact"
        value={contact}
        onChangeText={onChangeContact}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        error={err('contact')}
        accessibilityLabel="Contact phone number"
      />

      <AuthCheckbox
        checked={tos}
        onChange={() => setTos((t) => !t)}
        accessibilityLabel="Accept terms of service and privacy policy"
      >
        <Text style={[styles.caption, { color: colors.text }]}>
          By signing up, you agree to our{' '}
          <Text
            onPress={() => toast.show('Terms of Service — coming soon.')}
            accessibilityRole="link"
            style={[styles.link, { color: colors.accent }]}
          >
            ToS
          </Text>{' '}
          and{' '}
          <Text
            onPress={() => toast.show('Privacy Policy — coming soon.')}
            accessibilityRole="link"
            style={[styles.link, { color: colors.accent }]}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </AuthCheckbox>
      {attempted && errors.tos ? (
        <Text style={[styles.tosError, { color: colors.danger }]}>{errors.tos}</Text>
      ) : null}

      {banner ? (
        <View style={[styles.banner, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
          <Text style={[styles.bannerText, { color: colors.text }]}>{banner}</Text>
          <Pressable
            onPress={() => router.replace('/login')}
            accessibilityRole="link"
            accessibilityLabel="Log in instead"
            hitSlop={8}
          >
            <Text style={[styles.bannerLink, { color: colors.accent }]}>Log in instead</Text>
          </Pressable>
        </View>
      ) : null}

      <PillButton
        label="Sign Up"
        variant="primary"
        loading={submitting}
        disabled={!canSubmit || submitting}
        onPress={() => void onSignUp()}
        accessibilityLabel="Create account"
      />

      <OrDivider />

      <PillButton
        label="Sign Up with google"
        variant="ghost"
        loading={google.loading}
        disabled={google.loading}
        onPress={() => void google.start()}
        accessibilityLabel="Sign up with Google"
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
  caption: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  tosError: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: -12,
  },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bannerText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerLink: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    textDecorationLine: 'underline',
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
