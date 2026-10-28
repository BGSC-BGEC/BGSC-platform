import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';

import { AuthScaffold } from '../../src/auth/AuthScaffold';
import { AuthBanner } from '../../src/auth/AuthBanner';
import { OtpCells } from '../../src/auth/OtpCells';
import { TextInput } from '../../src/forms/TextInput';
import { Button } from '../../src/components/Button';
import { Typography } from '../../src/typography/Typography';
import { authRepository } from '../../src/repositories/AuthRepository';
import { getErrorMessage } from '../../src/api/client';

const RESEND_COOLDOWN_S = 60;

/** Forgot password — no v2 frame; follows the v2 auth layout. Email → 6-digit code + new password. */
export default function ForgotPassword() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setError(null);
    const trimmed = (sentTo ?? email).trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Enter the email linked to your BGSC account.');
      return;
    }
    if (cooldown > 0) return;
    setSubmitting(true);
    try {
      await authRepository.forgotPassword(trimmed);
      // The server answers the same way whether or not the account exists.
      setSentTo(trimmed);
      setOtp('');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async () => {
    if (!sentTo) return;
    setError(null);
    if (otp.length !== 6) return setError('Enter the 6-digit code from the email.');
    if (password.length < 8) return setError('Passwords must be at least 8 characters.');
    if (password !== confirm) return setError('The passwords don’t match.');
    setSubmitting(true);
    try {
      await authRepository.resetPassword(sentTo, otp, password);
      navigation.dispatch(StackActions.replace('Login', { notice: 'Password updated. Log in with your new password.' }));
    } catch (err) {
      setError(getErrorMessage(err));
      setOtp('');
    } finally {
      setSubmitting(false);
    }
  };

  const mm = Math.floor(cooldown / 60);
  const ss = String(cooldown % 60).padStart(2, '0');

  return (
    <AuthScaffold onBack={() => navigation.goBack()}>
      <View style={styles.heading}>
        <Typography variant="displayHero" color="text" style={styles.title}>
          Reset your password.
        </Typography>
        <Typography variant="body" color="textMuted">
          We’ll email you a 6-digit code to set a new one. It’s valid for 10 minutes.
        </Typography>
      </View>

      {error ? <AuthBanner message={error} /> : null}

      {sentTo ? (
        <>
          <AuthBanner tone="success" message={`If an account exists for ${sentTo}, a code is on its way.`} />
          <OtpCells value={otp} onChange={setOtp} disabled={submitting} />
          <TextInput
            label="NEW PASSWORD"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
          />
          <TextInput
            label="CONFIRM PASSWORD"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={reset}
          />
          <Button label="Reset password" fullWidth loading={submitting} onPress={reset} />
          <Button
            label={cooldown > 0 ? `Resend code in ${mm}:${ss}` : 'Resend code'}
            variant="ghost"
            fullWidth
            disabled={submitting || cooldown > 0}
            onPress={send}
          />
        </>
      ) : (
        <>
          <TextInput
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="f2025xxxx@goa.bits-pilani.ac.in"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <Button label="Send code" fullWidth loading={submitting} onPress={send} />
        </>
      )}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  title: { fontSize: 38, lineHeight: 52 },
});
