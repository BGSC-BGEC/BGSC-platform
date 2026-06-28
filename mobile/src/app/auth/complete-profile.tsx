import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthRepository } from '@/core/repositories/AuthRepository';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

export default function CompleteProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Email is known from Google OAuth — show read-only as context per spec §7.2
  const googleEmail = useAuthStore((s) => s.user?.email ?? null);

  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [repeatPwd, setRepeatPwd] = useState('');
  const [showRepeat, setShowRepeat] = useState(false);
  const [repeatPwdError, setRepeatPwdError] = useState<string | null>(null);
  const [contact, setContact] = useState('+91');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    !password.trim() ||
    !repeatPwd.trim() ||
    password !== repeatPwd ||
    contact.replace(/\D/g, '').length < 7 ||
    !acceptedTos ||
    submitting;

  const onRepeatBlur = () => {
    if (repeatPwd && password !== repeatPwd) {
      setRepeatPwdError("Passwords don't match.");
    } else {
      setRepeatPwdError(null);
    }
  };

  const onFinish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await AuthRepository.completeGoogleProfile({ password, contact });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const openTos = () => Alert.alert('Terms of Service', 'Coming soon.');
  const openPrivacy = () => Alert.alert('Privacy Policy', 'Coming soon.');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.surface }]} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <Text style={[s.heading, { color: colors.text }]}>Complete your profile</Text>

          {/* Email read-only context per spec §7.2 */}
          {googleEmail ? (
            <View style={[s.emailBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[s.emailLabel, { color: colors.textMuted }]}>SIGNED IN AS</Text>
              <Text style={[s.emailValue, { color: colors.text }]}>{googleEmail}</Text>
            </View>
          ) : null}

          <Field
            label="SET A PASSWORD"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            placeholder="••••••••"
            colors={colors}
            right={
              <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={8} style={s.eyeBtn}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </Pressable>
            }
          />
          <Field
            label="REPEAT PASSWORD"
            value={repeatPwd}
            onChangeText={(v) => { setRepeatPwd(v); if (repeatPwdError) setRepeatPwdError(null); }}
            onBlur={onRepeatBlur}
            secureTextEntry={!showRepeat}
            placeholder="••••••••"
            colors={colors}
            error={repeatPwdError ?? undefined}
            right={
              <Pressable onPress={() => setShowRepeat((v) => !v)} hitSlop={8} style={s.eyeBtn}>
                <Ionicons name={showRepeat ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </Pressable>
            }
          />
          <Field
            label="CONTACT"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
            colors={colors}
          />

          {/* ToS/Privacy are tappable links per spec §7.2 */}
          <Pressable onPress={() => setAcceptedTos((v) => !v)} style={s.checkRow} hitSlop={4}>
            <View
              style={[
                s.checkBox,
                {
                  borderColor: acceptedTos ? colors.accent : colors.border,
                  backgroundColor: acceptedTos ? colors.accent : 'transparent',
                },
              ]}
            >
              {acceptedTos && <Ionicons name="checkmark" size={12} color={colors.accentText} />}
            </View>
            <Text style={[s.checkLabel, { color: colors.textMuted, flexShrink: 1 }]}>
              {'By signing up, you agree to our '}
              <Text onPress={openTos} style={{ color: colors.accent }}>ToS</Text>
              {' and '}
              <Text onPress={openPrivacy} style={{ color: colors.accent }}>Privacy Policy</Text>
            </Text>
          </Pressable>

          {error ? (
            <View style={[s.errorBanner, { backgroundColor: colors.danger + '1A', borderColor: colors.danger }]}>
              <Text style={[s.errorBannerText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onFinish}
            disabled={disabled}
            style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}
          >
            <Text style={[s.primaryLabel, { color: colors.primaryText }]}>
              {submitting ? 'Please wait…' : 'Finish'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  colors,
  right,
  error,
  ...input
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  colors: ReturnType<typeof useColors>;
  right?: React.ReactNode;
  error?: string;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
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

const s = StyleSheet.create({
  container: { paddingHorizontal: 16 },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  heading: { fontSize: 22, fontWeight: '700', marginBottom: 20 },

  emailBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  emailLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  emailValue: { fontSize: 14 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
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

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  checkBox: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkLabel: { fontSize: 13 },

  errorBanner: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorBannerText: { fontSize: 13 },

  primaryBtn: { borderRadius: 999, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryLabel: { fontSize: 16, fontWeight: '600' },
});
