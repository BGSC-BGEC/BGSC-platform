import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

function parseCallbackUrl(url: string | null): { token: string | null; isNewUser: boolean } {
  if (!url) return { token: null, isNewUser: false };
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  // Isolate fragment and query independently to avoid one masking the other
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
  const params = new URLSearchParams(fragment || query);
  return {
    token: params.get('access_token'),
    isNewUser: params.get('is_new_user') === 'true',
  };
}

export default function AuthCallbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const adoptToken = useAuthStore((s) => s.adoptToken);
  const incomingUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  // Fail-safe: if no token arrives within 12s, surface an error
  useEffect(() => {
    const t = setTimeout(() => {
      if (!ran.current) setError('No auth token received. Please try again.');
    }, 12_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ran.current) return;
    const { token, isNewUser } = parseCallbackUrl(incomingUrl);
    if (!token) return;
    ran.current = true;

    adoptToken(token)
      .then(() => {
        if (isNewUser) {
          router.replace('/auth/complete-profile');
        } else {
          router.replace('/');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed'));
  }, [incomingUrl, adoptToken]);

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      {error ? (
        <>
          <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
          <Pressable
            onPress={() => router.replace('/login')}
            style={[s.btn, { backgroundColor: colors.primary }]}
          >
            <Text style={[s.btnLabel, { color: colors.primaryText }]}>Back to login</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[s.signingIn, { color: colors.textMuted }]}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  signingIn: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center' },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  btnLabel: { fontSize: 15, fontWeight: '600' },
});
