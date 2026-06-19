/**
 * API Client for BGSC Platform
 * Centralized HTTP client with interceptors for auth, error handling, etc.
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { ApiError } from '../types';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  onTokenRefresh?: () => Promise<string>;
  onUnauthorized?: () => void;
}

class ApiClient {
  private client: AxiosInstance;
  private refreshTokenPromise: Promise<string> | null = null;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh and errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // Handle 401 - token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Prevent multiple token refresh requests
            if (!this.refreshTokenPromise) {
              this.refreshTokenPromise = this.performTokenRefresh();
            }

            const newToken = await this.refreshTokenPromise;
            this.refreshTokenPromise = null;

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.refreshTokenPromise = null;
            this.config.onUnauthorized?.();
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private async performTokenRefresh(): Promise<string> {
    if (this.config.onTokenRefresh) {
      return await this.config.onTokenRefresh();
    }
    throw new Error('Token refresh not configured');
  }

  private getAccessToken(): string | null {
    // This will be implemented by the app using localStorage/AsyncStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  }

  private formatError(error: AxiosError<ApiError>): ApiError {
    if (error.response?.data) {
      return error.response.data;
    }
    return {
      statusCode: error.response?.status || 500,
      message: error.message || 'An error occurred',
    };
  }

  // HTTP Methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  setAuthToken(token: string) {
    localStorage.setItem('accessToken', token);
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  clearAuthToken() {
    localStorage.removeItem('accessToken');
    delete this.client.defaults.headers.common.Authorization;
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export default ApiClient;
