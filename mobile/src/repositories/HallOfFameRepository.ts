import { api, cleanParams } from '../api/client';
import type { HallOfFameCategory, HallOfFameEntry, PageResult } from '../api/types';

export interface HallOfFameQuery {
  category?: HallOfFameCategory;
  year?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export class HallOfFameRepository {
  /** GET /hall-of-fame — sorted by year (newest first), then featured order. */
  list(query: HallOfFameQuery = {}): Promise<PageResult<HallOfFameEntry>> {
    return api.get<PageResult<HallOfFameEntry>>('/hall-of-fame', {
      params: cleanParams({ limit: 50, ...query }),
    });
  }

  /** GET /hall-of-fame/featured */
  async featured(): Promise<HallOfFameEntry[]> {
    const res = await api.get<{ items: HallOfFameEntry[] }>('/hall-of-fame/featured');
    return res.items;
  }

  /** GET /hall-of-fame/:slugOrId */
  get(ref: string): Promise<HallOfFameEntry> {
    return api.get<HallOfFameEntry>(`/hall-of-fame/${encodeURIComponent(ref)}`);
  }
}

export const hallOfFameRepository = new HallOfFameRepository();
