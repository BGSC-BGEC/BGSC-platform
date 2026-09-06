const BASE_URL: string =
(import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api'

// 2. Custom options interface allowing flexible JSON payloads
interface RequestOptions extends Omit<RequestInit, 'body'> {
body?: unknown
}


async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers, ...customConfig } = options

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

    if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`
    try {
        const errorData = await response.json()
        if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        errorMessage = String(errorData.message)
        }
    } catch {
        // Non-JSON response body; keep default message
    }
    throw new Error(errorMessage)
    }

    // 7. Parse 204 No Content or JSON Body
    if (response.status === 204) {
    return null as T
    }

    return (await response.json()) as T
}


export const apiClient = {
    get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

    post: <T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body: data }),

    put: <T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: data }),

    delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}

export default apiClient