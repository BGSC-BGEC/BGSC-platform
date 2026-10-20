import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AuthScaffold } from '../../src/auth/AuthScaffold';
import { AuthBanner } from '../../src/auth/AuthBanner';
import { TextInput } from '../../src/forms/TextInput';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { authRepository } from '../../src/repositories/AuthRepository';
import { getErrorMessage } from '../../src/api/client';

/** Forgot password — no v2 frame; follows the v2 auth layout. */
export default function ForgotPassword() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Enter the email linked to your BGSC account.');
      return;
    }
    setSubmitting(true);
    try {
      await authRepository.forgotPassword(trimmed);
      // The server answers the same way whether or not the account exists.
      setSentTo(trimmed);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScaffold onBack={() => navigation.goBack()}>
      <View style={styles.heading}>
        <Typography variant="displayHero" color="text" style={styles.title}>
          Reset your password.
        </Typography>
        <Typography variant="body" color="textMuted">
          We’ll email you a link to set a new one. It’s valid for 1 hour.
        </Typography>
      </View>

      {error ? <AuthBanner message={error} /> : null}

      {sentTo ? (
        <View style={[styles.sent, { backgroundColor: colors.successMuted, borderColor: colors.success }]} accessibilityRole="alert">
          <Icon name="check" size={16} color="success" />
          <Typography variant="bodySmall" color="text" style={styles.sentText}>
            If an account exists for {sentTo}, a reset link is on its way.
          </Typography>
        </View>
      ) : null}

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
        onSubmitEditing={submit}
      />
      <Button label={sentTo ? 'Send again' : 'Send reset link'} fullWidth loading={submitting} onPress={submit} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  title: { fontSize: 38, lineHeight: 52 },
  sent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  sentText: { flex: 1 },
});
