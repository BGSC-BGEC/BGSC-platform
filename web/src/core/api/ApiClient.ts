import { API_BASE_URL } from '../env'
import { ApiError } from './ApiError'

interface RequestOptions {
  /** Skip Authorization header + the 401→refresh→retry dance (used by auth endpoints). */
  skipAuth?: boolean
  signal?: AbortSignal
}

interface AuthHooks {
  /** Returns the current access token, or null when logged out. */
  getToken: () => string | null
  /**
   * Attempts to refresh the access token (using the httpOnly refresh cookie).
   * Returns the new token on success, or null on failure.
   */
  refresh: () => Promise<string | null>
}

/**
 * Thin fetch wrapper for the API Gateway (the Model layer's transport).
 *
 * - Injects `Authorization: Bearer <token>` from the registered auth hooks.
 * - Sends `credentials: 'include'` so the auth-service's httpOnly refresh
 *   cookie rides along.
 * - On a 401 for an authed request, transparently refreshes once and retries.
 */
class ApiClient {
  private baseUrl: string
  private auth: AuthHooks = {
    getToken: () => null,
    refresh: async () => null,
  }

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /** Wired up by the auth store at startup so transport can reach token state. */
  setAuthHooks(hooks: AuthHooks): void {
    this.auth = hooks
  }

  get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, opts)
  }

  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, opts)
  }

  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, opts)
  }

  delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, opts)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: RequestOptions = {},
    isRetry = false,
  ): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    if (!opts.skipAuth) {
      const token = this.auth.getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: opts.signal,
    })

    // Transparent refresh-and-retry, exactly once, for authed requests.
    if (res.status === 401 && !opts.skipAuth && !isRetry) {
      const newToken = await this.auth.refresh()
      if (newToken) {
        return this.request<T>(method, path, body, opts, true)
      }
    }

    return this.parse<T>(res)
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    const data = text ? safeJson(text) : undefined

    if (!res.ok) {
      const message =
        (isRecord(data) && typeof data.message === 'string'
          ? data.message
          : undefined) ?? `Request failed with status ${res.status}`
      throw new ApiError(res.status, message, data)
    }

    return data as T
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** App-wide singleton. Repositories import this. */
export const apiClient = new ApiClient(API_BASE_URL)
