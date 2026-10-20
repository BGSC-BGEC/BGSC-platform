import { api, cleanParams } from '../api/client';
import type { Announcement, AnnouncementCategory, AnnouncementHead, AnnouncementList } from '../api/types';

export interface AnnouncementQuery {
  category?: AnnouncementCategory;
  pinned?: boolean;
  limit?: number;
  cursor?: string | null;
}

export class AnnouncementsRepository {
  /** GET /announcements — keyset pagination via `next_cursor`. */
  list(query: AnnouncementQuery = {}): Promise<AnnouncementList> {
    const { pinned, ...rest } = query;
    return api.get<AnnouncementList>('/announcements', {
      params: cleanParams({ limit: 20, ...rest, pinned: pinned === undefined ? undefined : String(pinned) }),
    });
  }

  /** GET /announcements/:id */
  get(id: string): Promise<Announcement> {
    return api.get<Announcement>(`/announcements/${encodeURIComponent(id)}`);
  }

  /** GET /announcements/heads — the "From the heads" strip on Home. */
  heads(): Promise<AnnouncementHead[]> {
    return api.get<AnnouncementHead[]>('/announcements/heads');
  }

  /** GET /announcements/unread-count — counts since the last "mark all read". */
  async unreadCount(): Promise<number> {
    return (await api.get<{ count: number }>('/announcements/unread-count')).count;
  }

  /** POST /announcements/read-all */
  markAllRead(): Promise<unknown> {
    return api.post('/announcements/read-all');
  }

  /** POST /announcements/:id/read — 204 */
  markRead(id: string): Promise<unknown> {
    return api.post(`/announcements/${encodeURIComponent(id)}/read`);
  }
}

export const announcementsRepository = new AnnouncementsRepository();
