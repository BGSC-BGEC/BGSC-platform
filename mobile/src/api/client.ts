import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

import { API_BASE_URL } from './config';
import { tokenStorage } from './tokenStorage';

/**
 * Error thrown by every repository call. Mirrors the backend error body:
 *   { error: 'snake_case_code', details?, fields?: [{ key, code, message? }] }
 */
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Array<{ key: string; code: string; message?: string }>;
  details?: unknown;
  body?: Record<string, unknown>;

  constructor(status: number, code: string, body?: Record<string, unknown>) {
    super(describeErrorCode(code, body));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
    this.fields = body?.fields as ApiError['fields'];
    this.details = body?.details;
  }
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  network_error: 'Could not reach the BGSC server. Check your connection and try again.',
  timeout: 'The server took too long to respond. Please try again.',
  unauthorized: 'Your session has expired. Please log in again.',
  forbidden: 'You do not have permission to do that.',
  not_found: 'We could not find what you were looking for.',
  conflict: 'That conflicts with existing data. Refresh and try again.',
  too_many_requests: 'Too many attempts. Please wait a moment and try again.',
  bad_gateway: 'This service is temporarily unavailable. Please try again shortly.',
  internal_error: 'Something went wrong on our side. Please try again.',
  validation_failed: 'Some details are invalid. Please check the highlighted fields.',
  // auth
  invalid_or_expired_token: 'This link is invalid or has expired.',
  account_deactivated: 'This account is scheduled for deletion.',
  // events
  event_not_found: 'This event could not be found. It may have been removed.',
  event_is_not_an_auction_league: 'This event does not have a player auction.',
  // registrations
  already_registered: 'You are already registered for this event.',
  registration_rejected: 'Your registration for this event was rejected.',
  form_not_found: 'The registration form is not available yet.',
  form_not_published: 'Registration for this event has not opened yet.',
  registration_closed: 'Registration for this event is closed.',
  not_yet_open: 'Registration has not opened yet.',
  capacity_full: 'This event is full.',
  event_cancelled: 'This event has been cancelled.',
  event_past: 'This event has already finished.',
  role_mismatch: 'Pick a valid registration role for this event.',
  cancel_window_closed: 'The cancellation window for this event has closed.',
  captain_has_team: 'Disband or hand over your team before cancelling.',
  upload_quota_exceeded: 'Upload limit reached. Please try again later.',
  // auction
  auction_not_live: 'The auction is not live right now.',
  lot_not_on_block: 'This player is no longer on the block.',
  not_auction_captain: 'Only approved captains can place bids.',
  cannot_bid_on_self: 'You cannot bid on yourself.',
  already_highest_bidder: 'You already hold the highest bid.',
  captain_has_no_team: 'Create your team before bidding.',
  team_locked: 'Your team roster is locked.',
  captain_not_confirmed: 'Your captain registration is not confirmed yet.',
  team_roster_full: 'Your roster is already full.',
  insufficient_purse: 'Your team does not have enough credits for this bid.',
  bid_below_minimum: 'Your bid is below the minimum allowed.',
  conflict_concurrent_bid: 'Someone bid just before you. The price has been refreshed — try again.',
  // teams
  team_full: 'This team is already full.',
  team_name_taken: 'That team name is taken. Try another.',
  team_not_found: 'This team no longer exists.',
  team_disbanded: 'This team has been disbanded.',
  team_is_disbanded: 'This team has been disbanded.',
  team_not_open: 'This team is not taking players right now.',
  team_not_accepting_members: 'This team is not taking players right now.',
  invite_only: 'This team is invite only. Ask the captain for their code.',
  invite_code_not_found: 'That invite code doesn’t match any team.',
  already_in_team: 'You are already on a team for this event.',
  already_member: 'You are already on this team.',
  captain_already_has_team: 'You already have a team for this event.',
  captain_not_approved: 'Core hasn’t approved you as captain yet.',
  not_registered_as_member: 'Register for this event as a member to join a team.',
  member_not_registered: 'Register for this event first.',
  max_teams_reached: 'This event has reached its team limit.',
  teaming_not_enabled: 'This event doesn’t use teams.',
  auction_league: 'Teams in this event are picked at the auction.',
  edit_window_closed: 'Registration is closed, so details can no longer be edited.',
  edits_not_allowed: 'This event doesn’t allow editing registrations.',
  cannot_edit_inactive_registration: 'This registration is no longer active.',
  already_cancelled: 'This registration was already cancelled.',
  auction_in_progress: 'The auction is in progress — this can’t change right now.',
  event_service_unavailable: 'Events are temporarily unavailable. Please try again shortly.',
  mime_not_accepted: 'That file type isn’t accepted. Use JPG, PNG, WEBP or PDF.',
  unsupported_media_type: 'That file type isn’t accepted. Use JPG, PNG, WEBP or PDF.',
  payload_too_large: 'That file is too big. The limit is 10MB.',
  empty_body: 'The file was empty. Pick it again.',
  // leaderboards
  no_leaderboard_for_event: 'This event does not have a leaderboard.',
  entry_not_found: 'You do not have a position on this leaderboard yet.',
};

function describeErrorCode(code: string, body?: Record<string, unknown>): string {
  if (typeof body?.message === 'string' && body.message) return body.message;
  return FRIENDLY_MESSAGES[code] ?? 'Something went wrong. Please try again.';
}

/** Human-readable message for any thrown value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return FRIENDLY_MESSAGES.internal_error;
}

/** Maps a 422 validation response to `{ fieldKey: message }`. */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.fields) return {};
  return Object.fromEntries(
    err.fields.map((f) => [f.key, f.message ?? (f.code === 'required' ? 'This field is required.' : 'This value is invalid.')]),
  );
}

// ---------------------------------------------------------------------------
// Session expiry hook — the auth store registers a handler to log the user out
// when the refresh token is rejected.
// ---------------------------------------------------------------------------
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

http.interceptors.request.use(async (config) => {
  const { accessToken } = await tokenStorage.get();
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshing: Promise<string | null | undefined> | null = null;

/** New access token; null when the server rejected the refresh; undefined when it couldn't be reached (keep the session). */
async function refreshAccessToken(): Promise<string | null | undefined> {
  const { refreshToken } = await tokenStorage.get();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 15000 });
    const tokens = res.data?.data?.tokens;
    if (!tokens?.access_token || !tokens?.refresh_token) return null;
    // Refresh tokens rotate, so both must be stored.
    await tokenStorage.set(tokens.access_token, tokens.refresh_token);
    return tokens.access_token as string;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    return status != null && status >= 400 && status < 500 ? null : undefined;
  }
}

// '/account/reactivate' runs on held credentials of a deleted account; a 401 there is final, not a refresh cue.
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/account/reactivate'];

http.interceptors.response.use(
  (response) => {
    // Unwrap the { success: true, data } envelope used by every service.
    const body = response.data;
    if (body && typeof body === 'object' && body.success === true && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    if (status === 401 && config && !config._retried && !NO_REFRESH_PATHS.some((p) => url.startsWith(p))) {
      config._retried = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
        return http(config);
      }
      // Offline or server down: a network blip must not log anyone out.
      if (newToken === undefined) return Promise.reject(new ApiError(0, 'network_error'));
      const { accessToken } = await tokenStorage.get();
      if (accessToken) {
        await tokenStorage.clear();
        onSessionExpired?.();
      }
    }

    if (!error.response) {
      const code = error.code === 'ECONNABORTED' ? 'timeout' : 'network_error';
      return Promise.reject(new ApiError(0, code));
    }
    const body = (error.response.data ?? {}) as Record<string, unknown>;
    const code = typeof body.error === 'string' ? body.error : `http_${status}`;
    return Promise.reject(new ApiError(status ?? 0, code, body));
  },
);

/** Thin typed helpers; responses are already unwrapped from the envelope. */
export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => http.get<T>(url, config).then((r) => r.data),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.post<T>(url, body, config).then((r) => r.data),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => http.patch<T>(url, body, config).then((r) => r.data),
  delete: <T>(url: string, config?: AxiosRequestConfig) => http.delete<T>(url, config).then((r) => r.data),
};

/** Drops undefined / empty values so they are not sent as query params. */
export function cleanParams(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = Array.isArray(value) ? value.join(',') : (value as string | number | boolean);
  }
  return out;
}

export default http;
