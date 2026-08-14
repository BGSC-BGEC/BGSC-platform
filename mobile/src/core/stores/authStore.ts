import { create } from 'zustand';
import { apiClient } from '../api/ApiClient';
import { ApiError } from '../api/ApiError';
import { AuthRepository } from '../repositories/AuthRepository';
import { UserRepository } from '../repositories/UserRepository';
import { storage } from '../storage';
import type { AuthResponse, LoginInput, RegisterInput, User } from '../types';

const TOKEN_KEY = 'bgsc.accessToken';

type AuthStatus = 'unknown' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  /** Adopt a token obtained out-of-band (e.g. the Google OAuth callback). */
  adoptToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Rehydrate session from persisted token on app start. */
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'unknown',
  error: null,

  login: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const res = await AuthRepository.login(input);
      await applyAuth(set, res);
    } catch (err) {
      set({ status: 'unauthenticated', error: messageOf(err) });
      throw err;
    }
  },

  register: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const res = await AuthRepository.register(input);
      await applyAuth(set, res);
    } catch (err) {
      set({ status: 'unauthenticated', error: messageOf(err) });
      throw err;
    }
  },

  adoptToken: async (token) => {
    // H-04: set token in-memory so getMe() can use it, but don't persist to
    // keychain until the token is validated — prevents storing invalid tokens.
    set({ status: 'loading', error: null, accessToken: token });
    try {
      const user = await UserRepository.getMe();
      await storage.setItem(TOKEN_KEY, token); // only persist after confirmed valid
      set({ user, status: 'authenticated' });
    } catch (err) {
      set({ accessToken: null, status: 'unauthenticated', error: messageOf(err) });
      throw err;
    }
  },

  logout: async () => {
    try {
      await AuthRepository.logout();
    } catch {
      /* best-effort; clear locally regardless */
    }
    await storage.removeItem(TOKEN_KEY);
    set({ accessToken: null, user: null, status: 'unauthenticated', error: null });
  },

  loadSession: async () => {
    const token = await storage.getItem(TOKEN_KEY);
    if (!token) {
      set({ status: 'unauthenticated' });
      return;
    }
    set({ accessToken: token, status: 'loading' });
    try {
      const user = await UserRepository.getMe();
      set({ user, status: 'authenticated' });
    } catch (err) {
      // H-03: only wipe the persisted token when the server explicitly rejects
      // it (401). Transient errors (network timeout, 5xx) must not evict a valid
      // session — the user would lose their session every time they open the app
      // offline or on a flaky connection.
      if (err instanceof ApiError && err.status === 401) {
        await storage.removeItem(TOKEN_KEY);
        set({ accessToken: null, user: null, status: 'unauthenticated' });
      } else {
        // Keep the token in state so the refresh hook can retry it. Mark as
        // unauthenticated so the UI prompts a login; on the next foreground the
        // session will be re-validated.
        set({ user: null, status: 'unauthenticated' });
      }
    }
  },
}));

async function applyAuth(
  set: (partial: Partial<AuthState>) => void,
  res: AuthResponse,
): Promise<void> {
  await storage.setItem(TOKEN_KEY, res.accessToken);
  set({ accessToken: res.accessToken, user: res.user, status: 'authenticated' });
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

// Wire the transport layer to auth state: token injection + refresh-on-401.
//
// Deduplication singleton: when the access token expires while multiple queries
// are in-flight simultaneously (the normal case after any screen navigation),
// every concurrent 401 must share the same refresh promise rather than each
// calling AuthRepository.refresh() independently. Rotation backends invalidate
// the refresh token after the first use, so requests 2-N would each get a
// 401/403, hit the catch, and log the user out despite a valid session.
let refreshInFlight: Promise<string | null> | null = null;

apiClient.setAuthHooks({
  getToken: () => useAuthStore.getState().accessToken,
  refresh: () => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const { accessToken } = await AuthRepository.refresh();
        await storage.setItem(TOKEN_KEY, accessToken);
        useAuthStore.setState({ accessToken });
        return accessToken;
      } catch {
        await storage.removeItem(TOKEN_KEY);
        useAuthStore.setState({
          accessToken: null,
          user: null,
          status: 'unauthenticated',
        });
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  },
});
