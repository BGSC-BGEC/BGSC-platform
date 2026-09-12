import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthBackground, AuthBackButton, AuthCard } from '../../src/auth';
import { TextInput } from '../../src/forms/TextInput';
import { Button } from '../../src/components/Button';
import { Typography } from '../../src/typography/Typography';

export default function ForgotPassword() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setMessage(null);
    setError(null);
    if (!email.trim() || !email.includes('@')) {
      setError('Enter the university email linked to your BGSC account.');
      return;
    }
    setMessage(`A reset link has been sent to ${email.trim()}.`);
  };

  return (
    <AuthBackground heroHeight={260}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthCard style={styles.card}>
            <AuthBackButton onPress={() => navigation.goBack()} />
            <View style={styles.header}>
              <Typography variant="h1">Reset your password</Typography>
              <Typography variant="body" color="textMuted">We will send a reset link to your registered email.</Typography>
            </View>
            <TextInput label="EMAIL" value={email} onChangeText={setEmail} placeholder="example@email.com" autoCapitalize="none" keyboardType="email-address" />
            {error ? (
              <View style={styles.feedbackBox}>
                <Typography variant="body" style={styles.errorText}>
                  {error}
                </Typography>
              </View>
            ) : null}
            {message ? (
              <View style={styles.successBox}>
                <Typography variant="body" style={styles.successText}>{message}</Typography>
                <Button label="Back to login" variant="outline" labelColor="#111111" fullWidth onPress={() => navigation.goBack()} />
              </View>
            ) : (
              <Button label="Send reset link" fullWidth onPress={submit} />
            )}
          </AuthCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  card: { minHeight: 380, paddingTop: 18, gap: 20 },
  header: { gap: 8, marginTop: 8 },
  feedbackBox: {
    backgroundColor: '#FDECEC',
    borderColor: '#C62828',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: -8,
  },
  successBox: {
    backgroundColor: '#EAF6EC',
    borderColor: '#2E7D32',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  errorText: { color: '#8E1B1B' },
  successText: { color: '#111111' },
});
