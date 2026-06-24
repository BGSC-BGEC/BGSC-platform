/**
 * Single source for the gateway base URL. Falls back to the local gateway.
 *
 * Note: Android emulators reach the host via 10.0.2.2, so set
 * EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 when running on Android.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
