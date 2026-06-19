/**
 * Base Repository
 * Abstract class for all repositories to extend
 * Handles common patterns and API communication
 */

import ApiClient from '../client';
import { ApiResponse, PaginatedResponse } from '../../types';

export abstract class BaseRepository {
  protected apiClient: ApiClient;
  protected basePath: string;

  constructor(apiClient: ApiClient, basePath: string) {
    this.apiClient = apiClient;
    this.basePath = basePath;
  }

  protected async get<T>(
    path: string,
    params?: Record<string, any>
  ): Promise<T> {
    const url = `${this.basePath}${path}`;
    return this.apiClient.get<T>(url, { params });
  }

  protected async post<T>(
    path: string,
    data?: any
  ): Promise<T> {
    const url = `${this.basePath}${path}`;
    return this.apiClient.post<T>(url, data);
  }

  protected async patch<T>(
    path: string,
    data?: any
  ): Promise<T> {
    const url = `${this.basePath}${path}`;
    return this.apiClient.patch<T>(url, data);
  }

  protected async put<T>(
    path: string,
    data?: any
  ): Promise<T> {
    const url = `${this.basePath}${path}`;
    return this.apiClient.put<T>(url, data);
  }

  protected async delete<T>(path: string): Promise<T> {
    const url = `${this.basePath}${path}`;
    return this.apiClient.delete<T>(url);
  }

  protected async getPaginated<T>(
    path: string,
    page: number = 1,
    limit: number = 20,
    filters?: Record<string, any>
  ): Promise<PaginatedResponse<T>> {
    const params = { page, limit, ...filters };
    return this.get<PaginatedResponse<T>>(path, params);
  }

  protected handleError(error: any): never {
    console.error('Repository error:', error);
    throw error;
  }
}
