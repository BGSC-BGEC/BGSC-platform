/**
 * Platform storage adapter. Web uses localStorage (synchronous, but exposed as
 * async to match the mobile expo-secure-store adapter's signature so the rest
 * of core is identical across platforms).
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}
