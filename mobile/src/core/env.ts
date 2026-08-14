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

/**
 * App share base URL (L-15). Use EXPO_PUBLIC_APP_URL in staging so share
 * links point at the correct environment rather than hardcoding production.
 */
export const APP_URL: string =
  process.env.EXPO_PUBLIC_APP_URL ?? 'https://bgsc.app';

// M-03: assert required env vars at startup in production so mis-configured
// builds surface a clear error rather than silently hitting localhost.
if (process.env.NODE_ENV === 'production' && !process.env.EXPO_PUBLIC_API_URL) {
  console.error('[env] EXPO_PUBLIC_API_URL is not set — all API requests will fail.');
}
