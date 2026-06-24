import * as SecureStore from 'expo-secure-store';

/**
 * Platform storage adapter (mobile). Uses expo-secure-store so the access token
 * is kept in the device keychain/keystore. Same async signature as the web
 * adapter so the rest of `core/` is identical across platforms.
 *
 * Keys may only contain alphanumerics plus `.`, `-`, `_`.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* ignore keychain errors */
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
  },
};
