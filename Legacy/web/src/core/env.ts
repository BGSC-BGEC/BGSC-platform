/** Single source for the gateway base URL. Falls back to the local gateway. */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
