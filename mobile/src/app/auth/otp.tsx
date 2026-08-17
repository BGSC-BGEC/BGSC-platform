import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { OtpCells } from '@/components/auth/OtpCells';
import { useAuthScreen } from '@/components/auth/use-auth-screen';
import { PillButton } from '@/components/PillButton';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/core/api/ApiError';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * OTP verification (handoffSpec §6 / auth-mobile-spec §6): 6 JetBrains Mono
 * cells, 30 s resend countdown, verify via `AuthRepository.verifyEmail`.
 * Reached after local registration; verification creates and persists the
 * first authenticated session.
 */
export default function OtpScreen() {
  useAuthScreen();
  const colors = lightColors;
  const toast = useToast();
  const pending = useAuthStore((s) => s.pendingRegistration);
  const verifyEmail = useAuthStore((s) => s.verifyEmail);
  const resendRegistrationCode = useAuthStore((s) => s.resendRegistrationCode);
  const email = pending?.email ?? '';

  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const busyRef = useRef(false);

  // Countdown → "Resend code" link (handoffSpec §6.6: 30 s).
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const onCodeChange = (t: string) => {
    setCode(t);
    if (t.length !== CODE_LENGTH) {
      busyRef.current = false;
      setOtpError(null);
    }
  };

  const verify = useCallback(
    async (value: string) => {
      if (!email || value.length !== CODE_LENGTH || busyRef.current) return;
      busyRef.current = true;
      setVerifying(true);
      setOtpError(null);
      try {
        await verifyEmail(value);
        // H-30: busyRef.current was never reset on the success path, so the
        // auto-submit effect would refuse to re-trigger if the user tried
        // again after a navigation failure. Reset it before navigating.
        busyRef.current = false;
        toast.show('Email verified — welcome to BGSC!');
        router.replace('/(drawer)');
      } catch (err) {
        busyRef.current = false;
        const msg = err instanceof Error ? err.message : '';
        if (/expired/i.test(msg)) {
          setOtpError('Code expired — resend a new one.');
        } else if (err instanceof ApiError && (err.status === 400 || err.status === 401)) {
          setOtpError('Incorrect code, try again.');
        } else {
          setOtpError("Couldn't verify the code — check your connection.");
        }
      } finally {
        setVerifying(false);
      }
    },
    [email, toast, verifyEmail],
  );

  // Auto-submit on the last digit (handoffSpec §6.3).
  useEffect(() => {
    if (code.length === CODE_LENGTH && code.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: submit exactly once when the 6th digit lands
      void verify(code);
    }
  }, [code, verify]);

  const onResend = async () => {
    if (!email || resending) return;
    setResending(true);
    try {
      await resendRegistrationCode();
      setSeconds(RESEND_SECONDS);
      setOtpError(null);
      toast.show('Verification code sent.');
    } catch {
      toast.show("Couldn't send the code — check your connection.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      compact
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/login'); }}
      heading="Verification Code"
      subtitle="We have sent the verification code to your email address."
    >
      {!email ? (
        <View style={[styles.missing, { backgroundColor: colors.accentMuted, borderColor: colors.border }]}>
          <Text style={[styles.missingText, { color: colors.text }]}>
            Missing your email — please go back and sign up again.
          </Text>
          <Pressable
            onPress={() => router.replace({ pathname: '/login', params: { tab: 'register' } })}
            accessibilityRole="link"
            accessibilityLabel="Back to sign up"
            hitSlop={8}
          >
            <Text style={[styles.missingLink, { color: colors.accent }]}>Back to Sign Up</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <OtpCells
            value={code}
            onChange={onCodeChange}
            length={CODE_LENGTH}
            error={otpError}
            disabled={verifying}
          />

          {seconds > 0 ? (
            <Text style={[styles.countdown, { color: colors.textMuted }]}>
              Resend in 0:{String(seconds).padStart(2, '0')}
            </Text>
          ) : (
            <Pressable
              onPress={() => void onResend()}
              disabled={resending}
              accessibilityRole="button"
              accessibilityLabel="Resend code"
              style={({ pressed }) => [styles.resend, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.resendText, { color: colors.accent }]}>
                {resending ? 'Sending…' : 'Resend code'}
              </Text>
            </Pressable>
          )}

          <PillButton
            label="Continue"
            variant="primary"
            loading={verifying}
            disabled={code.length !== CODE_LENGTH || verifying}
            onPress={() => void verify(code)}
            accessibilityLabel="Verify code"
          />
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  countdown: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  resendText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  missing: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  missingText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
  },
  missingLink: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
