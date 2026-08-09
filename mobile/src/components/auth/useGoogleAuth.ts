import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { useToast } from '@/components/Toast';
import { AuthRepository } from '@/core/repositories/AuthRepository';

/**
 * Google OAuth (auth specs §6 / §8): opens the system browser at the
 * gateway's `/auth/google`, then hands the redirect off to `/auth/callback`
 * which adopts the token and routes on. On platforms where the deep link
 * doesn't fire (Android), the returned URL is forwarded as query params so
 * the callback screen still has the token.
 */
export function useGoogleAuth() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const start = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      const result = await WebBrowser.openAuthSessionAsync(
        AuthRepository.googleAuthUrl(),
        redirectUrl,
      );
      if (result.type === 'success' && result.url) {
        router.replace({ pathname: '/auth/callback', params: extractParams(result.url) });
      }
      // 'cancel' / 'dismiss' → the user backed out; stay on the form.
    } catch {
      toast.show("Couldn't reach the server — check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return { loading, start };
}

/** Flatten query + fragment key=value pairs into route params. */
function extractParams(url: string): Record<string, string> {
  const [preHash, hash = ''] = url.split('#');
  const query = preHash.split('?')[1] ?? '';
  return { ...parsePairs(query), ...parsePairs(hash) };
}

function parsePairs(part: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    if (key) out[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return out;
}
