import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthRepository } from '@/core/repositories/AuthRepository';
import { useColors } from '@/hooks/use-colors';

const RESEND_COOLDOWN = 60;

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const safeEmail = typeof email === 'string' ? email : '';

  const [digits, setDigits] = useState(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  const cellRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const code = digits.join('');

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const onChangeDigit = (index: number, value: string) => {
    // Handle paste of full 4-digit code
    if (value.length === 4 && /^\d{4}$/.test(value)) {
      setDigits(value.split(''));
      cellRefs.current[3]?.blur();
      return;
    }
    const ch = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = ch;
    setDigits(next);
    if (ch && index < 3) cellRefs.current[index + 1]?.focus();
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      cellRefs.current[index - 1]?.focus();
    }
  };

  const onContinue = async () => {
    if (!safeEmail) {
      setError('Missing email — go back and try again.');
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      await AuthRepository.verifyEmail({ email: safeEmail, code });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect code, try again.');
      setDigits(['', '', '', '']);
      cellRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (countdown > 0 || !safeEmail) return;
    try {
      await AuthRepository.resendOtp({ email: safeEmail });
      setCountdown(RESEND_COOLDOWN);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
          {/* Back */}
          <Pressable onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.surface }]} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <Text style={[s.heading, { color: colors.text }]}>Verification Code</Text>
          <Text style={[s.subtitle, { color: colors.textMuted }]}>
            We have sent the verification code to your email address
            {safeEmail ? `\n${maskEmail(safeEmail)}` : ''}
          </Text>

          {/* OTP cells */}
          <View style={s.cellRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { cellRefs.current[i] = r; }}
                value={d}
                onChangeText={(v) => onChangeDigit(i, v)}
                onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
                keyboardType="numeric"
                maxLength={4}
                selectTextOnFocus
                style={[
                  s.cell,
                  {
                    borderColor: d ? colors.accent : colors.border,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  },
                ]}
              />
            ))}
          </View>

          {error ? <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text> : null}

          <Pressable
            onPress={onContinue}
            disabled={code.length < 4 || verifying}
            style={[
              s.primaryBtn,
              { backgroundColor: colors.primary, opacity: code.length < 4 || verifying ? 0.5 : 1 },
            ]}
          >
            <Text style={[s.primaryLabel, { color: colors.primaryText }]}>
              {verifying ? 'Please wait…' : 'Continue'}
            </Text>
          </Pressable>

          {/* Resend */}
          <Pressable onPress={onResend} disabled={countdown > 0} style={s.resendRow}>
            <Text style={[s.resendText, { color: countdown > 0 ? colors.textMuted : colors.accent }]}>
              {countdown > 0 ? `Resend in 0:${String(countdown).padStart(2, '0')}` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },

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

  heading: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 20, marginBottom: 32 },

  cellRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 24 },
  cell: {
    width: 62,
    height: 62,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },

  errorText: { fontSize: 13, marginBottom: 10, textAlign: 'center' },

  primaryBtn: { borderRadius: 999, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryLabel: { fontSize: 16, fontWeight: '600' },

  resendRow: { alignItems: 'center', marginTop: 20 },
  resendText: { fontSize: 14, fontWeight: '500' },
});
