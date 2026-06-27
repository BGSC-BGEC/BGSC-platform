import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

function tokenFromUrl(url: string | null): string | null {
  if (!url) return null;
  // The auth-service returns the token in the URL fragment: ...#access_token=...
  const hashIndex = url.indexOf('#');
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const params = new URLSearchParams(fragment || url.split('?')[1] || '');
  return params.get('access_token');
}

/**
 * Handles the Google OAuth2 redirect on mobile/web. Mirrors the web app's
 * /auth/callback. Native cookie round-tripping is a known follow-up (see README).
 */
export default function AuthCallbackScreen() {
  const colors = useColors();
  const adoptToken = useAuthStore((s) => s.adoptToken);
  const incomingUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const token = tokenFromUrl(incomingUrl);
    if (!token) return; // wait until the deep link URL is available
    ran.current = true;

    adoptToken(token)
      .then(() => router.replace('/'))
      .catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed'));
  }, [incomingUrl, adoptToken]);

  return (
    <Screen center>
      {error ? (
        <>
          <Text style={{ color: colors.danger, marginBottom: 16 }}>{error}</Text>
          <Pressable
            onPress={() => router.replace('/login')}
            style={[styles.button, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>Back to login</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
