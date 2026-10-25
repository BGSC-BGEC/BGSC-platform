import { api, cleanParams } from '../api/client';

export interface StravaStatus { connected: boolean; athlete_id: string | null; last_synced_at: string | null }
export interface StravaActivity { _id: string; type: string; name: string; distance_meters: number; moving_time_seconds: number; start_date: string; is_private: boolean }
export interface StravaPage { activities: StravaActivity[]; next_cursor: string | null }
export const stravaRepository = {
  status: () => api.get<StravaStatus>('/strava/status'),
  connect: () => api.get<{ url: string }>('/strava/connect'),
  link: (body: { code: string; state: string; scope: string }) => api.post<StravaStatus>('/strava/link', body),
  activities: (cursor?: string) => api.get<StravaPage>('/strava/activities', { params: cleanParams({ limit: 20, cursor }) }),
  sync: () => api.post<{ synced: number; skipped: number; has_more: boolean }>('/strava/sync'),
  disconnect: () => api.delete<void>('/strava/disconnect'),
};
