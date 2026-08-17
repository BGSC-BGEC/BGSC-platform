import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthShell } from '@/components/auth/AuthShell';
import { OrDivider } from '@/components/auth/OrDivider';
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
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const CONTACT_RE = /^\d{10}$/;

type Tab = 'Login' | 'Sign Up';

export default function LoginScreen() {
  useAuthScreen({ redirectIfAuthed: true });
  const colors = lightColors;
  const toast = useToast();
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const google = useGoogleAuth();
  const { returnTo, tab: tabParam } = useLocalSearchParams<{ returnTo?: string; tab?: string }>();

  const [tab, setTab] = useState<Tab>(tabParam === 'register' ? 'Sign Up' : 'Login');

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [loginBanner, setLoginBanner] = useState<string | null>(null);

  // Register state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [contactDigits, setContactDigits] = useState('');
  const [tos, setTos] = useState(false);
  const [regAttempted, setRegAttempted] = useState(false);
  const [regBanner, setRegBanner] = useState<string | null>(null);

  const submitting = status === 'loading';
  const contact = `+91 ${contactDigits}`;

  const switchTab = (t: Tab) => {
    setTab(t);
    setLoginBanner(null);
    setRegBanner(null);
  };

  // ── Login ──────────────────────────────────────────────────────────────────

  const loginErrors = {
    identifier: identifier.trim().length >= 3 ? null : 'Please enter your email or username',
    password: loginPassword.length >= 8 ? null : 'Password must be at least 8 characters',
  };
  const canLogin = !loginErrors.identifier && !loginErrors.password;

  const onLogin = async () => {
    setLoginBanner(null);
    if (!canLogin) { setLoginAttempted(true); return; }
    try {
      await login({ usernameOrEmail: identifier.trim(), password: loginPassword });
      const isLocalPath = returnTo && /^\/(?!\/)/.test(returnTo);
      router.replace(isLocalPath ? (returnTo as Href) : '/(drawer)');
    } catch {
      setLoginBanner(useAuthStore.getState().error ?? 'Incorrect email/username or password.');
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────

  const regErrors = {
    username: USERNAME_RE.test(username) ? null : 'Username: 3–50 letters, numbers, underscores',
    email: EMAIL_RE.test(email.trim()) ? null : 'Please enter a valid email address',
    password: PASSWORD_RE.test(regPassword) ? null : 'Min 8 chars, 1 uppercase, 1 number, 1 special',
    repeat: repeat === regPassword ? null : 'Passwords do not match',
    contact: CONTACT_RE.test(contactDigits) ? null : 'Please enter a valid phone number',
    tos: tos ? null : 'You must accept the Terms of Service',
  };
  const canRegister = Object.values(regErrors).every((e) => e === null);
  const err = (key: keyof typeof regErrors) => (regAttempted ? regErrors[key] : null);

  const onSignUp = async () => {
    setRegBanner(null);
    if (!canRegister) { setRegAttempted(true); return; }
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password: regPassword,
        acceptedTos: true,
        contact: `+91${contactDigits}`,
      });
      router.replace('/auth/otp');
    } catch {
      setRegBanner(useAuthStore.getState().error ?? "Couldn't create your account — please try again.");
    }
  };

  return (
    <AuthShell
      tabs={{
        options: ['Login', 'Sign Up'],
        value: tab,
        onChange: (v) => switchTab(v as Tab),
      }}
    >
      {tab === 'Login' ? (
        <>
          <GlassInput
            label="Email or Username"
            value={identifier}
            onChangeText={(t) => { setIdentifier(t); setLoginBanner(null); }}
            placeholder="example@email.com"
            autoCapitalize="none"
            textContentType="username"
            error={loginAttempted ? loginErrors.identifier : null}
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
              value={loginPassword}
              onChangeText={(t) => { setLoginPassword(t); setLoginBanner(null); }}
              placeholder="••••••••"
              secureTextEntry
              textContentType="password"
              error={loginAttempted ? loginErrors.password : null}
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

          {loginBanner ? (
            <View style={[styles.banner, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
              <Text style={[styles.bannerText, { color: colors.text }]}>{loginBanner}</Text>
            </View>
          ) : null}

          <PillButton
            label="Login"
            variant="primary"
            loading={submitting}
            disabled={!canLogin || submitting}
            onPress={() => void onLogin()}
            accessibilityLabel="Log in"
          />

          <OrDivider />

          <PillButton
            label="Login with Google"
            variant="ghost"
            loading={google.loading}
            disabled={google.loading}
            onPress={() => void google.start()}
            accessibilityLabel="Login with Google"
          />
        </>
      ) : (
        <>
          <GlassInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="gamer_tag"
            autoCapitalize="none"
            textContentType="username"
            error={err('username')}
            accessibilityLabel="Username"
            scheme="light"
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
            scheme="light"
          />
          <GlassInput
            label="Password"
            value={regPassword}
            onChangeText={setRegPassword}
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
            error={err('password')}
            accessibilityLabel="Password"
            scheme="light"
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
            scheme="light"
          />
          <GlassInput
            label="Contact"
            value={contact}
            onChangeText={(t) => setContactDigits(t.replace(/\D/g, '').replace(/^91/, '').slice(0, 10))}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            error={err('contact')}
            accessibilityLabel="Contact phone number"
            scheme="light"
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
          {regAttempted && regErrors.tos ? (
            <Text style={[styles.tosError, { color: colors.danger }]}>{regErrors.tos}</Text>
          ) : null}

          {regBanner ? (
            <View style={[styles.banner, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
              <Text style={[styles.bannerText, { color: colors.text }]}>{regBanner}</Text>
              <Pressable
                onPress={() => switchTab('Login')}
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
            disabled={!canRegister || submitting}
            onPress={() => void onSignUp()}
            accessibilityLabel="Create account"
          />

          <OrDivider />

          <PillButton
            label="Sign Up with Google"
            variant="ghost"
            loading={google.loading}
            disabled={google.loading}
            onPress={() => void google.start()}
            accessibilityLabel="Sign up with Google"
          />
        </>
      )}
    </AuthShell>
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
});
