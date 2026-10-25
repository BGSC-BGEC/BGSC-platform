import { api, cleanParams } from '../api/client';
import type { PointsSummary, PointTransactionPage } from '../api/types';

export class PointsRepository {
  breakdown(): Promise<{ balance: number; breakdown: Array<{ source: string; total: number; count: number }> }> {
    return api.get('/points/me/breakdown');
  }

  opportunities(): Promise<{ opportunities: Array<{ reason: string; label: string; source: string; amount: number | null; expires_after_days: number | null }> }> {
    return api.get('/points/opportunities');
  }

  /** GET /points/me */
  me(): Promise<PointsSummary> {
    return api.get<PointsSummary>('/points/me');
  }

  /** GET /points/me/transactions — newest first, keyset `next_cursor`. */
  transactions(query: { limit?: number; cursor?: string | null; type?: string; source?: string } = {}): Promise<PointTransactionPage> {
    return api.get<PointTransactionPage>('/points/me/transactions', { params: cleanParams({ limit: 20, ...query }) });
  }
}

export const pointsRepository = new PointsRepository();
