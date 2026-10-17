import { Platform } from 'react-native';

/**
 * Gateway base URL. Every backend service sits behind this single origin
 * (no /api prefix — paths go straight through, e.g. `${API_BASE_URL}/events`).
 *
 * Set EXPO_PUBLIC_API_URL in mobile/.env. When unset we fall back to the local
 * gateway: Android emulators reach the host machine on 10.0.2.2.
 * On a physical device use your computer's LAN IP, e.g. http://192.168.1.20:3000
 */
const FALLBACK_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || FALLBACK_URL).replace(/\/+$/, '');

/** Upload URLs come back relative (`/uploads/...`); make them absolute for <Image>. */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
