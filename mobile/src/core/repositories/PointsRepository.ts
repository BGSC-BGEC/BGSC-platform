import { apiClient } from '../api/ApiClient';
import type { PointsBalance, PointTransaction } from '../types';

export const PointsRepository = {
  // M-17: accept userId for future parameterisation; today the endpoint is
  // /points/me/balance (session-based, ignores the param) — Phase 2 will use it.
  getBalance(_userId?: string): Promise<PointsBalance> {
    return apiClient.get<PointsBalance>('/points/me/balance');
  },

  // M-17: accept userId for parameterisation; today the session-based endpoint
  // ignores it — Phase 2 will use it to scope per-user queries.
  async getTransactions(_userId?: string, page = 1, limit = 30): Promise<PointTransaction[]> {
    const dtos = await apiClient.get<any[]>(`/points/me/transactions?page=${page}&limit=${limit}`);
    return dtos.map((d) => ({
      ...d,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString(),
    }));
  },
};
