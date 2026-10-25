import { api } from '../api/client';
import { tokenStorage } from '../api/tokenStorage';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'event' | 'announcement';
  read: boolean;
  createdAt: string;
  data?: any;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export interface ApiNotification {
  _id: string;
  category: 'announcement' | 'event' | 'challenge' | 'system';
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

function mapType(n: ApiNotification): Notification['type'] {
  if (n.category === 'announcement') return 'announcement';
  if (n.category === 'event') return 'event';
  if (/sold|won|confirmed|approved|earned/.test(n.type)) return 'success';
  if (/rejected|declined|cancel|unsold|warning/.test(n.type)) return 'warning';
  return 'info';
}

async function signedIn() {
  const { accessToken } = await tokenStorage.get();
  return Boolean(accessToken);
}

export class NotificationsRepository {
  /** GET /notifications — in-app inbox (cursor paginated; first page only here). */
  async getNotifications(_page: number = 1, limit: number = 20): Promise<NotificationsResponse> {
    if (!(await signedIn())) return { notifications: [], unreadCount: 0, total: 0 };
    const res = await api.get<{ notifications: ApiNotification[]; next_cursor: string | null }>('/notifications', {
      params: { limit },
    });
    const notifications = res.notifications.map<Notification>((n) => ({
      id: n._id,
      title: n.title,
      message: n.body,
      type: mapType(n),
      read: Boolean(n.read_at),
      createdAt: n.created_at,
      data: n.data,
    }));
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      total: notifications.length,
    };
  }

  /** GET /notifications/unread-count */
  async getUnreadCount(): Promise<number> {
    if (!(await signedIn())) return 0;
    const res = await api.get<{ count: number }>('/notifications/unread-count');
    return res.count;
  }

  inbox(query: { cursor?: string; unread?: boolean; category?: string } = {}) {
    return api.get<{ notifications: ApiNotification[]; next_cursor: string | null }>('/notifications', { params: { limit: 20, ...query } });
  }

  preferences() {
    return api.get<{ in_app: Record<'announcement' | 'event' | 'challenge' | 'system', boolean> }>('/notifications/preferences');
  }

  updatePreferences(body: { in_app: Partial<Record<'announcement' | 'event' | 'challenge' | 'system', boolean>> }) {
    return api.patch<{ in_app: Record<'announcement' | 'event' | 'challenge' | 'system', boolean> }>('/notifications/preferences', body);
  }

  /** These errors must reach the screen so failed writes are never shown as successful. */
  async markAsRead(notificationId: string): Promise<void> {
    await api.post(`/notifications/${encodeURIComponent(notificationId)}/read`);
  }

  async markAllAsRead(): Promise<void> {
    await api.post('/notifications/read-all');
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${encodeURIComponent(notificationId)}`);
  }
}

export const notificationsRepository = new NotificationsRepository();
