import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { Logo } from '@/components/logo';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

export default function RegisterScreen() {
  const colors = useColors();
  const register = useAuthStore((s) => s.register);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await register({ username, email, password, acceptedTos });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Logo />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Create account</Text>

        <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" colors={colors} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          colors={colors}
        />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry colors={colors} />

        <View style={styles.tosRow}>
          <Switch value={acceptedTos} onValueChange={setAcceptedTos} />
          <Text style={[styles.tosText, { color: colors.textMuted }]}>
            I accept the Terms of Service and Privacy Policy.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={submitting || !acceptedTos}
          onPress={onSubmit}
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: submitting || !acceptedTos ? 0.6 : 1 },
          ]}>
          <Text style={[styles.primaryText, { color: colors.primaryText }]}>
            {submitting ? 'Please wait…' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} style={styles.switch}>
          <Text style={{ color: colors.primary }}>Already have an account? Sign in</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  colors,
  ...input
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  fieldWrap: { marginBottom: 12, gap: 4 },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  tosRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  tosText: { flex: 1, fontSize: 13 },
  error: { color: '#dc2626', marginBottom: 8 },
  primaryBtn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  primaryText: { fontSize: 15, fontWeight: '600' },
  switch: { alignItems: 'center', marginTop: 16 },
});
