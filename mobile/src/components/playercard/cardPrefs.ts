import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * The player's card choices, kept on this device per account: style, logo, and whether they have
 * been offered the "customize your card" prompt. Same storage as the auth tokens (keychain on
 * device, localStorage on web).
 *
 * ponytail: device-local. Others viewing the card see the default until the choice moves to the
 * account (`player_card.card_style` / `card_logo`).
 */
export interface CardPrefs {
  style?: string;
  logo?: string;
  introSeen?: boolean;
}

const key = (userId: string) => `bgsc_card_prefs_${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function loadCardPrefs(userId: string): Promise<CardPrefs> {
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(key(userId))
        : await SecureStore.getItemAsync(key(userId));
    return raw ? (JSON.parse(raw) as CardPrefs) : {};
  } catch {
    return {};
  }
}

/** Merges `patch` into what is stored. A failed write only loses the preference. */
export async function saveCardPrefs(userId: string, patch: CardPrefs): Promise<void> {
  try {
    const next = JSON.stringify({ ...(await loadCardPrefs(userId)), ...patch });
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key(userId), next);
    else await SecureStore.setItemAsync(key(userId), next);
  } catch (err) {
    console.warn('Saving card preferences failed:', err);
  }
}
