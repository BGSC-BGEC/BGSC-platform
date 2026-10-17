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
