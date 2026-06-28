import { apiClient } from '../api/ApiClient';
import type { PointsBalance, PointTransaction } from '../types';

export const PointsRepository = {
  getBalance(): Promise<PointsBalance> {
    return apiClient.get<PointsBalance>('/points/me/balance');
  },

  async getTransactions(page = 1, limit = 30): Promise<PointTransaction[]> {
    const dtos = await apiClient.get<any[]>(`/points/me/transactions?page=${page}&limit=${limit}`);
    return dtos.map((d) => ({
      ...d,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date(d.createdAt).toISOString(),
    }));
  },
};
