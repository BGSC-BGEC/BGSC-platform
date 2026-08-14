import * as SecureStore from 'expo-secure-store';

/**
 * Platform storage adapter (mobile). Uses expo-secure-store so the access token
 * is kept in the device keychain/keystore. Same async signature as the web
 * adapter so the rest of `core/` is identical across platforms.
 *
 * Keys may only contain alphanumerics plus `.`, `-`, `_`.
 *
 * H-02: setItem now propagates keychain errors so callers (authStore) can detect
 * a failed token write and surface it rather than silently losing the session.
 * removeItem remains best-effort (swallows) because logout cleanup is not
 * safety-critical — a stale token is rejected on the next 401 anyway.
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
    // Propagate so auth flows know the token was not persisted (H-02).
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* best-effort: a stale persisted token is invalidated server-side on next use */
    }
  },
};
