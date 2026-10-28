const BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000'

// Custom options interface allowing flexible JSON payloads
interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  _retry?: boolean
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return null

  try {
    const refreshUrl = `${BASE_URL.replace(/\/+$/, '')}/auth/refresh`
    const res = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
      return null
    }

    const result = await res.json()
    const tokens = result?.data?.tokens || result?.tokens
    if (tokens?.access_token) {
      localStorage.setItem('auth_token', tokens.access_token)
      if (tokens.refresh_token) {
        localStorage.setItem('refresh_token', tokens.refresh_token)
      }
      return tokens.access_token as string
    }

    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    return null
  } catch {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    return null
  }
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
    const newAccessToken = await tryRefreshToken()
    if (newAccessToken) {
      return request<T>(endpoint, { ...options, _retry: true })
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
