import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Screen } from '@/components/screen';
import { Logo } from '@/components/logo';
import { AuthRepository } from '@/core/repositories/AuthRepository';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

export default function LoginScreen() {
  const colors = useColors();
  const login = useAuthStore((s) => s.login);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login({ usernameOrEmail, password });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
        <Text style={[styles.title, { color: colors.text }]}>Sign in</Text>

        <Field
          label="Username or email"
          value={usernameOrEmail}
          onChangeText={setUsernameOrEmail}
          autoCapitalize="none"
          colors={colors}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          colors={colors}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={submitting}
          onPress={onSubmit}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}>
          <Text style={[styles.primaryText, { color: colors.primaryText }]}>
            {submitting ? 'Please wait…' : 'Sign in'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(AuthRepository.googleAuthUrl())}
          style={[styles.outlineBtn, { borderColor: colors.border }]}>
          <Text style={[styles.outlineText, { color: colors.text }]}>Continue with Google</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/register')} style={styles.switch}>
          <Text style={{ color: colors.primary }}>Don&apos;t have an account? Register</Text>
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
  error: { color: '#dc2626', marginBottom: 8 },
  primaryBtn: { borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  primaryText: { fontSize: 15, fontWeight: '600' },
  outlineBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  outlineText: { fontSize: 15, fontWeight: '500' },
  switch: { alignItems: 'center', marginTop: 16 },
});
