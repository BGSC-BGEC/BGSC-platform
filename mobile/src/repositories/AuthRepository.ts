import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { api, ApiError } from '../api/client';
import { API_BASE_URL, resolveMediaUrl } from '../api/config';
import { tokenStorage } from '../api/tokenStorage';
import type { ApiUser, AuthResult } from '../api/types';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  contact?: string;
  role: string;
  avatar_url?: string;
  isEmailVerified?: boolean;
  pointsBalance?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
  requiresProfileCompletion?: boolean;
}

export interface LoginDto {
  emailOrUsername: string;
  password?: string;
}

export interface RegisterDto {
  email: string;
  username: string;
  fullName: string;
  password: string;
  contact?: string;
}

/** Login hit a soft-deleted account: the password was right, the account can still be restored. */
export class AccountDeactivatedError extends Error {
  constructor(public daysRemaining: number | null) {
    super('This account is scheduled for deletion.');
    this.name = 'AccountDeactivatedError';
  }
}

export function mapUser(raw: ApiUser): User {
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email,
    fullName: raw.profile?.full_name ?? undefined,
    contact: raw.profile?.phone_number ?? undefined,
    role: raw.role,
    avatar_url: resolveMediaUrl(raw.profile?.avatar_url),
    isEmailVerified: raw.is_email_verified,
    pointsBalance: raw.points_balance,
  };
}

/** Backend wants E.164 (+919876543210); the form pre-fills "+91 ". */
function toE164(contact?: string): string | null {
  const digits = (contact ?? '').replace(/[\s()-]/g, '');
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
}

async function persist(result: AuthResult): Promise<AuthResponse> {
  await tokenStorage.set(result.tokens.access_token, result.tokens.refresh_token);
  return { user: mapUser(result.user), token: result.tokens.access_token };
}

const GOOGLE_ERRORS: Record<string, string> = {
  google_oauth_not_configured: 'Google sign-in isn’t set up yet. Please use your email and password.',
  google_email_unverified: 'Your Google email isn’t verified. Verify it with Google, or use your email and password.',
  account_deactivated: 'This account is scheduled for deletion. Log in with your password to restore it.',
  invalid_oauth_state: 'Google sign-in timed out. Please try again.',
  server_error: 'Google sign-in failed. Please try again.',
};

/** Shared by the email-verification and password-reset code checks. */
function codeError(err: unknown): unknown {
  if (err instanceof ApiError && err.code === 'invalid_or_expired_code') {
    // The server answers wrong, expired and used-up codes alike (no account enumeration).
    return new Error('That code is incorrect or has expired. After 5 wrong tries, request a new code.');
  }
  if (err instanceof ApiError && err.code === 'too_many_requests') {
    return new Error('Too many tries. Wait a few minutes, then request a new code.');
  }
  return err;
}

export class AuthRepository {
  /** POST /auth/login — `login` accepts an email or a username. */
  async login(dto: LoginDto): Promise<AuthResponse> {
    try {
      const result = await api.post<AuthResult>('/auth/login', {
        login: dto.emailOrUsername,
        password: dto.password,
      });
      return persist(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw new Error('Incorrect email/username or password.');
      }
      if (err instanceof ApiError && err.code === 'account_deactivated') {
        throw new AccountDeactivatedError((err.body?.days_remaining as number | undefined) ?? null);
      }
      if (err instanceof ApiError && err.status === 429) {
        throw new Error('Too many attempts. Wait 15 minutes, then try again.');
      }
      if (err instanceof ApiError && err.status === 403) {
        throw new Error('This account has been suspended.');
      }
      throw err;
    }
  }

  /** POST /auth/register — the account is signed in immediately. */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    try {
      const result = await api.post<AuthResult>('/auth/register', {
        email: dto.email,
        username: dto.username,
        full_name: dto.fullName,
        password: dto.password,
      });
      const response = await persist(result);

      // Contact number is optional and stored on the profile, not the account.
      const phone = toE164(dto.contact);
      if (phone) {
        try {
          const updated = await api.patch<ApiUser>('/users/me', { phone_number: phone });
          response.user = mapUser(updated);
        } catch {
          // Non-blocking: the member can add their number later from Edit profile.
        }
      }
      return response;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw new Error('That email or username is already registered.');
      }
      if (err instanceof ApiError && err.code === 'validation_failed') {
        const field = err.fields?.[0]?.key;
        if (field === 'username') throw new Error('Usernames are 3–30 letters, numbers or underscores.');
        if (field === 'password') throw new Error('Passwords must be at least 8 characters.');
        if (field === 'email') throw new Error('Please enter a valid email address.');
        if (field === 'full_name') throw new Error('Please enter your full name.');
      }
      throw err;
    }
  }

  /** GET /users/me — used to restore a session on app start. */
  async me(): Promise<User> {
    return mapUser(await api.get<ApiUser>('/users/me'));
  }

  /** POST /auth/resend-verification — emails a fresh 6-digit code (valid 10 min); always 200. */
  async resendVerification(email: string): Promise<void> {
    await api.post('/auth/resend-verification', { email });
  }

  /** POST /auth/verify-email — checks the 6-digit code from the verification email. */
  async verifyEmail(email: string, otp: string): Promise<void> {
    try {
      await api.post('/auth/verify-email', { email, otp });
    } catch (err) {
      throw codeError(err);
    }
  }

  /** POST /account/reactivate — restores a soft-deleted account and signs it in. */
  async reactivate(dto: LoginDto): Promise<AuthResponse> {
    try {
      const result = await api.post<AuthResult>('/account/reactivate', {
        login: dto.emailOrUsername,
        password: dto.password,
      });
      return persist(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        throw new Error('This account is gone for good. You can sign up again with the same email.');
      }
      if (err instanceof ApiError && err.code === 'admin_review_required') {
        throw new Error('This account needs a quick check by the BGSC team before it can be restored.');
      }
      throw err;
    }
  }

  /** PATCH /users/me — onboarding interests (free-form labels). */
  async setInterests(interests: string[]): Promise<User> {
    return mapUser(await api.patch<ApiUser>('/users/me', { interests }));
  }

  /**
   * Google sign-in via the browser (PKCE). The backend redirects back to the app
   * with a one-time `login_code`, which is exchanged together with the verifier.
   * Resolves null when the member closes the browser.
   */
  async googleSignIn(): Promise<AuthResponse | null> {
    // Hex keeps the verifier inside the PKCE charset; 32 bytes → 64 chars.
    const verifier = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
    const challenge = (
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 })
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    // ponytail: expo-linking isn't installed; this mirrors its createURL for Expo Go vs dev/prod builds.
    const redirectUri =
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient
        ? `${Constants.linkingUri.replace(/\/+$/, '')}/auth/callback`
        : 'bgsc://auth/callback';
    const result = await WebBrowser.openAuthSessionAsync(
      `${API_BASE_URL}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}`,
      redirectUri,
    );
    if (result.type !== 'success') return null;

    const param = (key: string) => {
      const match = result.url.match(new RegExp(`[?&#]${key}=([^&#]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };
    const failure = param('error');
    if (failure) throw new Error(GOOGLE_ERRORS[failure] ?? GOOGLE_ERRORS.server_error);
    const loginCode = param('login_code');
    if (!loginCode) throw new Error(GOOGLE_ERRORS.server_error);

    try {
      return await persist(
        await api.post<AuthResult>('/auth/google/exchange', { login_code: loginCode, code_verifier: verifier }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.code in GOOGLE_ERRORS) throw new Error(GOOGLE_ERRORS[err.code]);
      throw err;
    }
  }

  /** POST /auth/forgot-password — emails a 6-digit code; always 200 so accounts cannot be enumerated. */
  async forgotPassword(email: string): Promise<{ success: boolean }> {
    await api.post('/auth/forgot-password', { email });
    return { success: true };
  }

  /** POST /auth/reset-password — the server revokes every session, so the member logs in again. */
  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/reset-password', { email, otp, new_password: newPassword });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_failed' && err.fields?.[0]?.key === 'new_password') {
        throw new Error('Passwords must be 8–72 characters.');
      }
      throw codeError(err);
    }
  }

  /** POST /auth/logout — best effort, tokens are always cleared locally. */
  async logout(): Promise<void> {
    try {
      const { refreshToken } = await tokenStorage.get();
      await api.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {});
    } catch {
      // Ignore — the session is dropped locally regardless.
    } finally {
      await tokenStorage.clear();
    }
  }

  async hasStoredSession(): Promise<boolean> {
    const { accessToken, refreshToken } = await tokenStorage.get();
    return Boolean(accessToken || refreshToken);
  }
}

export const authRepository = new AuthRepository();
