import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { useAuthScreen } from '@/components/auth/use-auth-screen';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useAuthStore } from '@/core/stores/authStore';
import { FONTS } from '@/core/theme/fonts';
import { lightColors } from '@/core/theme/tokens';

interface ParsedCallback {
  accessToken?: string;
  isNewUser: boolean;
  error?: string;
}

/**
 * Google OAuth redirect handler (auth specs §8 / handoffSpec §15): parses the
 * access token from the redirect URL — query params (Android forwarding via
 * `useGoogleAuth`) or URL fragment (native deep link) — adopts it via
 * `authStore.adoptToken`, then routes to Complete Profile for new users
 * (explicit flag, or a profile still missing contact) and the drawer
 * otherwise.
 */
export default function AuthCallbackScreen() {
  useAuthScreen();
  const colors = lightColors;
  const adoptToken = useAuthStore((s) => s.adoptToken);
  const url = Linking.useURL();
  const query = useLocalSearchParams<Record<string, string | string[]>>();
  const [failed, setFailed] = useState<string | null>(null);

  const { accessToken, isNewUser, error: urlError } = useMemo(
    () => parseCallback(url, query),
    [url, query],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        await adoptToken(accessToken);
        if (cancelled) return;
        const user = useAuthStore.getState().user;
        // TODO(auth): confirm `contact == null` as the new-Google-user signal
        // with the backend team; an explicit isNewUser flag wins when present.
        const needsProfile = isNewUser || !user?.contact;
        router.replace(needsProfile ? '/auth/complete-profile' : '/(drawer)');
      } catch {
        if (!cancelled) setFailed("Couldn't sign you in — please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isNewUser, adoptToken]);

  const error = urlError ?? failed ?? (!accessToken ? 'Sign-in failed — no access token received.' : null);

  return (
    <AuthShell compact>
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <PillButton
            label="Back to login"
            variant="primary"
            onPress={() => router.replace('/login')}
            accessibilityLabel="Back to login"
          />
        </View>
      ) : (
        <View style={styles.loadingWrap}>
          <SkeletonBlock width={120} height={16} radius={8} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Signing you in…</Text>
        </View>
      )}
    </AuthShell>
  );
}

function parseCallback(
  url: string | null,
  query: Record<string, string | string[]>,
): ParsedCallback {
  const get = (v: string | string[] | undefined): string | undefined =>
    typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;

  let fragment: Record<string, string> = {};
  let search: Record<string, string> = {};
  if (url) {
    const [preHash, hash = ''] = url.split('#');
    fragment = parsePairs(hash);
    search = parsePairs(preHash.split('?')[1] ?? '');
  }

  const isNew = (v: string | undefined) => v === 'true' || v === '1';

  // Token resolution order:
  //   1. expo-router query params  — Android forwards deep-link params here
  //   2. URL fragment (#)          — the correct delivery channel for native
  //
  // Query-string fallbacks (search.access_token / search.token) are
  // intentionally absent: tokens in query strings appear in server access
  // logs, proxy logs, and browser history (audit C-08).
  return {
    accessToken:
      get(query.access_token) ??
      get(query.token) ??
      fragment.access_token ??
      fragment.token,
    isNewUser:
      isNew(get(query.isNewUser)) ||
      get(query.profileComplete) === 'false' ||
      isNew(fragment.isNewUser) ||
      isNew(search.isNewUser),
    error: get(query.error) ?? fragment.error ?? search.error,
  };
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

const styles = StyleSheet.create({
  loadingWrap: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 40,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  errorWrap: {
    gap: 20,
    paddingTop: 8,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
