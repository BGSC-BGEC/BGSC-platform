import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store's web shim is an empty object — its methods don't exist on
// web. Fall back to localStorage so session persistence works in Expo web.
const useLocalStorage = Platform.OS === 'web' || !SecureStore.getItemAsync;

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (useLocalStorage) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (useLocalStorage) {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (useLocalStorage) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* best-effort */
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* best-effort */
    }
  },
};
