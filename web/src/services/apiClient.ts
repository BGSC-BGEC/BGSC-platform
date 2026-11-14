const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000'

// Custom options interface allowing flexible JSON payloads
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  _retry?: boolean
}

// Outcome of a refresh attempt:
// - 'ok': a usable access token is now in localStorage
// - 'rejected': the server refused the refresh token (401/403); session is gone
// - 'error': transient failure (network, 408, 429, 5xx); session is kept
type RefreshResult =
  | { kind: 'ok'; token: string }
  | { kind: 'rejected' }
  | { kind: 'error' }

// Lets the auth store react to a dead session without apiClient importing it
// (authStore already imports apiClient, so a direct import would be circular).
type SessionExpiredListener = () => void
const sessionExpiredListeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

function clearSession() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('auth_user')
  sessionExpiredListeners.forEach((listener) => listener())
}

// Single-flight: the backend rotates refresh tokens, so concurrent 401s must
// share one refresh call instead of racing each other with the same token.
let refreshPromise: Promise<RefreshResult> | null = null

function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(): Promise<RefreshResult> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return { kind: 'rejected' }

  let res: Response
  try {
    const refreshUrl = `${BASE_URL.replace(/\/+$/, '')}/auth/refresh`
    res = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    // Network failure: keep the session for the next attempt
    return { kind: 'error' }
  }

  if (res.status === 401 || res.status === 403) {
    // Another tab may have rotated the token while we were waiting; if so,
    // our token was just retired and the stored one is still valid.
    const currentRefresh = localStorage.getItem('refresh_token')
    const currentAccess = localStorage.getItem('auth_token')
    if (currentRefresh && currentRefresh !== refreshToken && currentAccess) {
      return { kind: 'ok', token: currentAccess }
    }
    return { kind: 'rejected' }
  }

  if (!res.ok) return { kind: 'error' }

  try {
    const result = await res.json()
    const tokens = result?.data?.tokens || result?.tokens
    if (tokens?.access_token) {
      localStorage.setItem('auth_token', tokens.access_token)
      if (tokens.refresh_token) {
        localStorage.setItem('refresh_token', tokens.refresh_token)
      }
      return { kind: 'ok', token: tokens.access_token as string }
    }
  } catch {
    // Malformed body; treat as transient
  }
  return { kind: 'error' }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, _retry, ...customConfig } = options

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${BASE_URL.replace(/\/+$/, '')}${normalizedEndpoint}`

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = localStorage.getItem('auth_token') || localStorage.getItem('token')
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  const config: RequestInit = {
    ...customConfig,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  }

  if (body !== undefined) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  const response = await fetch(url, config)

  if (
    response.status === 401 &&
    !_retry &&
    !normalizedEndpoint.startsWith('/auth/login') &&
    !normalizedEndpoint.startsWith('/auth/google') &&
    !normalizedEndpoint.startsWith('/auth/refresh')
  ) {
    // Token already replaced (by a refresh that finished while this request
    // was in flight, or by another tab): just retry with the current one.
    const currentToken = localStorage.getItem('auth_token')
    if (currentToken && currentToken !== token) {
      return request<T>(endpoint, { ...options, _retry: true })
    }

    const outcome = await refreshAccessToken()
    if (outcome.kind === 'ok') {
      return request<T>(endpoint, { ...options, _retry: true })
    }
    if (outcome.kind === 'rejected' && localStorage.getItem('auth_token') === token) {
      // Only the first waiter clears; later ones see tokens already gone
      clearSession()
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`
    try {
      const errorData = await response.json()
      if (errorData && typeof errorData === 'object') {
        if ('error' in errorData && typeof errorData.error === 'string') {
          errorMessage = errorData.error
        } else if ('message' in errorData && typeof errorData.message === 'string') {
          errorMessage = errorData.message
        }
      }
    } catch {
      // Non-JSON response body; keep default HTTP message
    }
    throw new Error(errorMessage)
  }

  if (response.status === 204) {
    return null as T
  }

  const result = await response.json()

  if (
    result &&
    typeof result === 'object' &&
    'success' in result &&
    result.success === true &&
    'data' in result
  ) {
    return (result as { data: T }).data
  }

  return result as T
}

export const apiClient = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body: data }),

  put: <T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: data }),

  patch: <T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body: data }),

  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}

export default apiClient
