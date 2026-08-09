/**
 * Single source for the gateway base URL. Falls back to the local gateway.
 *
 * Note: Android emulators reach the host via 10.0.2.2, so set
 * EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 when running on Android.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Web console URL for coordinator links (e.g. bracket management).
 * Set EXPO_PUBLIC_WEB_CONSOLE_URL in your .env / app.config.ts.
 * Left empty in development — any feature gated on this URL will be hidden
 * until the env var is configured.
 */
export const WEB_CONSOLE_URL: string =
  process.env.EXPO_PUBLIC_WEB_CONSOLE_URL ?? '';
