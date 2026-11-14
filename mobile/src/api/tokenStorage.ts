import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'bgsc_access_token';
const REFRESH_KEY = 'bgsc_refresh_token';

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

async function read(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
      return;
    }
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn('Token storage failed:', err);
  }
}

// In-memory copy so every request does not hit the keychain.
let cache: StoredTokens | null = null;

export const tokenStorage = {
  async get(): Promise<StoredTokens> {
    if (cache) return cache;
    cache = { accessToken: await read(ACCESS_KEY), refreshToken: await read(REFRESH_KEY) };
    return cache;
  },

  async set(accessToken: string, refreshToken: string): Promise<void> {
    cache = { accessToken, refreshToken };
    await Promise.all([write(ACCESS_KEY, accessToken), write(REFRESH_KEY, refreshToken)]);
  },

  async clear(): Promise<void> {
    cache = { accessToken: null, refreshToken: null };
    await Promise.all([write(ACCESS_KEY, null), write(REFRESH_KEY, null)]);
  },
};

// ---------------------------------------------------------------------------
// Google sign-in PKCE verifier. Kept on disk so the redirect can still be
// exchanged when it arrives as a deep link (Android may kill the app while the
// browser is open, or the auth session may report "dismiss").
// ---------------------------------------------------------------------------
const GOOGLE_PKCE_KEY = 'bgsc_google_pkce';
// Matches the backend's login_code lifetime with room to spare; older verifiers are ignored.
const GOOGLE_PKCE_TTL_MS = 15 * 60 * 1000;

export interface PendingGoogleSignIn {
  verifier: string;
  redirectUri: string;
}

// Serialises take() so the auth session and the deep-link fallback can't both exchange one code.
let pkceQueue: Promise<unknown> = Promise.resolve();

export const googleSignInStorage = {
  async save(pending: PendingGoogleSignIn): Promise<void> {
    await write(GOOGLE_PKCE_KEY, JSON.stringify({ ...pending, createdAt: Date.now() }));
  },

  /** Reads and deletes the verifier: only the first caller gets it. */
  take(): Promise<PendingGoogleSignIn | null> {
    const next = pkceQueue.then(async () => {
      const raw = await read(GOOGLE_PKCE_KEY);
      if (!raw) return null;
      await write(GOOGLE_PKCE_KEY, null);
      try {
        const parsed = JSON.parse(raw) as PendingGoogleSignIn & { createdAt?: number };
        if (!parsed.verifier || Date.now() - (parsed.createdAt ?? 0) > GOOGLE_PKCE_TTL_MS) return null;
        return { verifier: parsed.verifier, redirectUri: parsed.redirectUri };
      } catch {
        return null;
      }
    });
    pkceQueue = next.catch(() => null);
    return next;
  },

  async clear(): Promise<void> {
    await write(GOOGLE_PKCE_KEY, null);
  },
};
