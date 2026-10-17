import { api, cleanParams } from '../api/client';
import type {
  EventLeaderboard,
  GlobalLeaderboard,
  LeaderboardDomain,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardSource,
} from '../api/types';

export interface GlobalQuery {
  period?: LeaderboardPeriod;
  domain?: LeaderboardDomain;
  source?: LeaderboardSource;
  page?: number;
  limit?: number;
}

export class LeaderboardRepository {
  /** GET /leaderboards/global — season points across members. `source=challenge` is the challenge board. */
  global(query: GlobalQuery = {}): Promise<GlobalLeaderboard> {
    return api.get<GlobalLeaderboard>('/leaderboards/global', {
      params: cleanParams({ limit: 50, page: 1, ...query }),
    });
  }

  /**
   * There is no "my global rank" endpoint, so walk the pages until the member
   * is found (capped so it never runs away on a huge board).
   */
  async findMyGlobalRank(userId: string, query: GlobalQuery = {}, maxPages = 5) {
    for (let page = 1; page <= maxPages; page += 1) {
      const res = await this.global({ ...query, page, limit: 100 });
      const mine = res.standings.find((s) => s.user_id === userId);
      if (mine) return mine;
      if (page >= res.total_pages) break;
    }
    return null;
  }

  /** GET /leaderboards/events/:ref */
  event(eventRef: string, params: { page?: number; limit?: number; search?: string } = {}): Promise<EventLeaderboard> {
    return api.get<EventLeaderboard>(`/leaderboards/events/${encodeURIComponent(eventRef)}`, {
      params: cleanParams({ limit: 50, ...params }),
    });
  }

  /** GET /leaderboards/events/:ref/me — 404 entry_not_found when not participating. */
  myEventEntry(eventRef: string): Promise<LeaderboardEntry> {
    return api.get<LeaderboardEntry>(`/leaderboards/events/${encodeURIComponent(eventRef)}/me`);
  }
}

export const leaderboardRepository = new LeaderboardRepository();
