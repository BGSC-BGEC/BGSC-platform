import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { AuthRepository } from '@/core/repositories/AuthRepository';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';
import { Logo } from '@/components/logo';

type Tab = 'login' | 'signup';

const SCREEN_H = Dimensions.get('window').height;

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'login');

  // Login
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Sign Up
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPwd, setSignupPwd] = useState('');
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [repeatPwd, setRepeatPwd] = useState('');
  const [showRepeatPwd, setShowRepeatPwd] = useState(false);
  const [repeatPwdError, setRepeatPwdError] = useState<string | null>(null);
  const [contact, setContact] = useState('+91');
  const [acceptedTos, setAcceptedTos] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginDisabled = !usernameOrEmail.trim() || !loginPwd.trim();
  // contact must have at least 7 numeric digits (+91 = 2 digits, need 5 more)
  const signupDisabled =
    !username.trim() ||
    !email.trim() ||
    !signupPwd.trim() ||
    !repeatPwd.trim() ||
    signupPwd !== repeatPwd ||
    contact.replace(/\D/g, '').length < 7 ||
    !acceptedTos;

  const switchTab = (t: Tab) => {
    setTab(t);
    setError(null);
    setRepeatPwdError(null);
  };

  const onRepeatPwdBlur = () => {
    if (repeatPwd && signupPwd !== repeatPwd) {
      setRepeatPwdError("Passwords don't match.");
    } else {
      setRepeatPwdError(null);
    }
  };

  const onLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login({ usernameOrEmail, password: loginPwd });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect email/username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSignUp = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await register({ username, email, password: signupPwd, acceptedTos, contact });
      // Auth-service creates the account immediately with no email-verify step.
      // OTP screen will be re-enabled once the backend implements POST /auth/verify-email.
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    await WebBrowser.openBrowserAsync(AuthRepository.googleAuthUrl());
  };

  const onForgot = () => {
    Alert.alert('Forgot Password', 'Coming soon — use the web portal for now.');
  };

  const openTos = () => Alert.alert('Terms of Service', 'Coming soon.');
  const openPrivacy = () => Alert.alert('Privacy Policy', 'Coming soon.');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero banner — swap View for <Image> when pixel-art asset is ready */}
          <View style={[s.hero, { backgroundColor: colors.surfaceMuted, height: SCREEN_H * 0.38 }]} />

          {/* Wordmark */}
          <View style={s.wordmark}>
            <Logo />
          </View>

          {/* Segmented toggle */}
          <View style={[s.toggleTrack, { backgroundColor: colors.surfaceMuted }]}>
            {(['login', 'signup'] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => switchTab(t)}
                style={[s.segment, tab === t && [s.segmentActive, { backgroundColor: colors.surface }]]}
              >
                <Text style={[s.segmentLabel, { color: tab === t ? colors.text : colors.textMuted }]}>
                  {t === 'login' ? 'Login' : 'Sign Up'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={s.form}>
            {tab === 'login' ? (
              <>
                <Field
                  label="EMAIL OR USERNAME"
                  value={usernameOrEmail}
                  onChangeText={setUsernameOrEmail}
                  autoCapitalize="none"
                  placeholder="example@email.com"
                  colors={colors}
                />
                {/* Forgot? lives on the PASSWORD label row per spec §4.2 */}
                <Field
                  label="PASSWORD"
                  value={loginPwd}
                  onChangeText={setLoginPwd}
                  secureTextEntry={!showLoginPwd}
                  placeholder="••••••••"
                  colors={colors}
                  labelRight={
                    <Pressable onPress={onForgot} hitSlop={8}>
                      <Text style={[s.link, { color: colors.accent }]}>Forgot?</Text>
                    </Pressable>
                  }
                  right={
                    <EyeToggle visible={showLoginPwd} onPress={() => setShowLoginPwd((v) => !v)} color={colors.textMuted} />
                  }
                />

                <Checkbox
                  checked={rememberMe}
                  onToggle={() => setRememberMe((v) => !v)}
                  label="Remember me for a month"
                  colors={colors}
                />

                {/* Error banner above the button per spec §4.3 */}
                {error ? (
                  <View style={[s.errorBanner, { backgroundColor: colors.danger + '1A', borderColor: colors.danger }]}>
                    <Text style={[s.errorBannerText, { color: colors.danger }]}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={onLogin}
                  disabled={loginDisabled || submitting}
                  style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: loginDisabled || submitting ? 0.5 : 1 }]}
                >
                  <Text style={[s.primaryLabel, { color: colors.primaryText }]}>
                    {submitting ? 'Please wait…' : 'Login'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Field
                  label="USERNAME"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="your_username"
                  colors={colors}
                />
                <Field
                  label="EMAIL"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="example@email.com"
                  colors={colors}
                />
                <Field
                  label="PASSWORD"
                  value={signupPwd}
                  onChangeText={setSignupPwd}
                  secureTextEntry={!showSignupPwd}
                  placeholder="••••••••"
                  colors={colors}
                  right={
                    <EyeToggle visible={showSignupPwd} onPress={() => setShowSignupPwd((v) => !v)} color={colors.textMuted} />
                  }
                />
                {/* onBlur triggers mismatch check per spec §5.3 */}
                <Field
                  label="REPEAT PASSWORD"
                  value={repeatPwd}
                  onChangeText={(v) => { setRepeatPwd(v); if (repeatPwdError) setRepeatPwdError(null); }}
                  onBlur={onRepeatPwdBlur}
                  secureTextEntry={!showRepeatPwd}
                  placeholder="••••••••"
                  colors={colors}
                  error={repeatPwdError ?? undefined}
                  right={
                    <EyeToggle visible={showRepeatPwd} onPress={() => setShowRepeatPwd((v) => !v)} color={colors.textMuted} />
                  }
                />
                <Field
                  label="CONTACT"
                  value={contact}
                  onChangeText={setContact}
                  keyboardType="phone-pad"
                  colors={colors}
                />

                {/* ToS/Privacy are tappable links per spec §5.2 */}
                <Checkbox
                  checked={acceptedTos}
                  onToggle={() => setAcceptedTos((v) => !v)}
                  colors={colors}
                  label={
                    <>
                      {'By signing up, you agree to our '}
                      <Text onPress={openTos} style={{ color: colors.accent }}>ToS</Text>
                      {' and '}
                      <Text onPress={openPrivacy} style={{ color: colors.accent }}>Privacy Policy</Text>
                    </>
                  }
                />

                {/* Error banner above the button per spec §4.3 / §5 */}
                {error ? (
                  <View style={[s.errorBanner, { backgroundColor: colors.danger + '1A', borderColor: colors.danger }]}>
                    <Text style={[s.errorBannerText, { color: colors.danger }]}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={onSignUp}
                  disabled={signupDisabled || submitting}
                  style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: signupDisabled || submitting ? 0.5 : 1 }]}
                >
                  <Text style={[s.primaryLabel, { color: colors.primaryText }]}>
                    {submitting ? 'Please wait…' : 'Sign Up'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* OR divider */}
          <View style={s.orRow}>
            <View style={[s.orLine, { backgroundColor: colors.border }]} />
            <Text style={[s.orText, { color: colors.textMuted }]}>OR</Text>
            <View style={[s.orLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Google */}
          <Pressable onPress={onGoogle} style={[s.outlineBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[s.googleG, { color: colors.text }]}>G</Text>
            <Text style={[s.outlineLabel, { color: colors.text }]}>
              {tab === 'login' ? 'Login with Google' : 'Sign Up with Google'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EyeToggle({ visible, onPress, color }: { visible: boolean; onPress: () => void; color: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.eyeBtn}>
      <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={color} />
    </Pressable>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
  colors,
}: {
  checked: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable onPress={onToggle} style={s.checkRow} hitSlop={4}>
      <View
        style={[
          s.checkBox,
          {
            borderColor: checked ? colors.accent : colors.border,
            backgroundColor: checked ? colors.accent : 'transparent',
          },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={12} color={colors.accentText} />}
      </View>
      <Text style={[s.checkLabel, { color: colors.textMuted, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  colors,
  right,
  labelRight,
  error,
  ...input
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  colors: ReturnType<typeof useColors>;
  right?: React.ReactNode;
  labelRight?: React.ReactNode;
  error?: string;
}) {
  return (
    <View style={s.fieldWrap}>
      <View style={s.labelRow}>
        <Text style={[s.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
        {labelRight}
      </View>
      <View
        style={[
          s.inputRow,
          { borderColor: error ? colors.danger : colors.border, backgroundColor: colors.surface },
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[s.inputText, { color: colors.text }]}
          {...input}
        />
        {right}
      </View>
      {error ? <Text style={[s.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flexGrow: 1 },

  // Hero
  hero: { width: '100%' },

  // Wordmark
  wordmark: { alignItems: 'center', marginTop: 20, marginBottom: 20 },

  // Toggle
  toggleTrack: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 999, padding: 4, marginBottom: 20 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  segmentActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  segmentLabel: { fontSize: 15, fontWeight: '600' },

  // Form
  form: { paddingHorizontal: 16 },

  // Field
  fieldWrap: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  fieldError: { fontSize: 12, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 52,
  },
  inputText: { flex: 1, fontSize: 15 },
  eyeBtn: { paddingLeft: 8 },

  link: { fontSize: 13, fontWeight: '600' },

  // Checkbox
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  checkBox: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkLabel: { fontSize: 13 },

  // Error banner (above primary button)
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorBannerText: { fontSize: 13 },

  // Primary button
  primaryBtn: { borderRadius: 999, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryLabel: { fontSize: 16, fontWeight: '600' },

  // OR divider
  orRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 20, gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontWeight: '500' },

  // Google button
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 999,
    height: 52,
    gap: 10,
  },
  googleG: { fontSize: 16, fontWeight: '700' },
  outlineLabel: { fontSize: 15, fontWeight: '500' },
});
