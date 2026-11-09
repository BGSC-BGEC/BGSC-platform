import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StackActions, useNavigation, useRoute, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { useAuth } from '../../store/auth';
import { authRepository, SignUpAgainError } from '../../src/repositories/AuthRepository';
import { AuthScaffold } from '../../src/auth/AuthScaffold';
import { AuthBanner } from '../../src/auth/AuthBanner';
import { OtpCells } from '../../src/auth/OtpCells';
import { getErrorMessage } from '../../src/api/client';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';

const RESEND_COOLDOWN_S = 60;

type Params = { email?: string; contact?: string; expiresIn?: number };

/**
 * v2 Verify your email (56:2070). Logged-out step between Create account and Get started:
 * the account is only created once this code is verified.
 */
export default function VerifyEmailScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { email, contact, expiresIn } = (useRoute().params ?? {}) as Params;
  const { completeRegistration } = useAuth();
  const { colors } = useTheme();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resent, setResent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(email ? null : 'Start sign-up again to get a code.');
  // The pending sign-up is gone: the only way forward is Create account again.
  const [expired, setExpired] = useState(!email);

  const validMinutes = expiresIn ? Math.max(1, Math.round(expiresIn / 60)) : 10;

  // Register keeps its form on the stack below, so going back lets the member fix their email.
  const backToRegister = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch(StackActions.replace('Register'));
  };

  const verify = async () => {
    if (!email || otp.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      // On success the navigator swaps to onboarding (Get started) on its own.
      await completeRegistration(email, otp, contact);
    } catch (err) {
      if (err instanceof SignUpAgainError) setExpired(true);
      setError(getErrorMessage(err));
      setOtp('');
      setBusy(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email || cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_S);
    try {
      await authRepository.resendVerification(email);
      setResent(true);
      setError(null);
      setOtp('');
    } catch {
      setCooldown(0);
    }
  };

  const mm = Math.floor(cooldown / 60);
  const ss = String(cooldown % 60).padStart(2, '0');

  return (
    <AuthScaffold onBack={backToRegister} gap={24}>
      <View style={styles.top}>
        <View style={[styles.ringOuter, { backgroundColor: colors.accentMuted }]}>
          <View style={[styles.ringInner, { backgroundColor: colors.primarySolid }]}>
            <Icon name="message" size={36} color="white" />
          </View>
        </View>
        <Typography variant="displayHero" color="text" align="center" style={styles.title}>
          Check your inbox.
        </Typography>
        <Typography variant="body" color="textMuted" align="center">
          We sent a 6-digit code to
        </Typography>
        <Typography variant="mono" color="text" align="center">
          {email ?? 'your email'}
        </Typography>
      </View>

      {error ? <AuthBanner message={error} /> : null}

      {expired ? (
        <Button label="Sign up again" fullWidth onPress={backToRegister} />
      ) : (
        <>
          <OtpCells value={otp} onChange={setOtp} disabled={busy} />
          <Typography variant="bodySmall" color="textMuted" align="center">
            The code is valid for {validMinutes} minute{validMinutes === 1 ? '' : 's'}.
          </Typography>

          <Button label="Verify" fullWidth loading={busy} disabled={otp.length !== 6} onPress={() => void verify()} />
        </>
      )}

      {expired ? null : (
        <View style={styles.inline}>
          <Typography variant="body" color="textMuted" style={styles.small}>
            {resent && cooldown > 0 ? 'Sent again.' : 'Didn’t get it?'}
          </Typography>
          {cooldown > 0 ? (
            <Typography variant="mono" color="textMuted" style={styles.mono}>
              Resend in {mm}:{ss}
            </Typography>
          ) : (
            <Pressable onPress={resend} hitSlop={8} accessibilityRole="button">
              <Typography color="text" style={styles.link}>
                Resend
              </Typography>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.inline}>
        <Typography variant="bodySmall" color="textMuted">
          Check spam · Wrong email?
        </Typography>
        <Pressable onPress={backToRegister} hitSlop={8} accessibilityRole="button" accessibilityHint="Goes back to Create account">
          <Typography color="text" style={styles.link}>
            Change it
          </Typography>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  top: { alignSelf: 'stretch', alignItems: 'center', gap: 16, paddingTop: 24 },
  ringOuter: { padding: 24, borderRadius: 999 },
  ringInner: { padding: 20, borderRadius: 999 },
  title: { fontSize: 36, lineHeight: 52 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  small: { fontSize: 13 },
  mono: { fontSize: 12 },
  link: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 12, lineHeight: 20, textDecorationLine: 'underline' },
});
