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

interface ApiNotification {
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

  /** POST /notifications/:id/read */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await api.post(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.log('Error marking notification as read:', error);
    }
  }

  /** POST /notifications/read-all */
  async markAllAsRead(): Promise<void> {
    try {
      await api.post('/notifications/read-all');
    } catch (error) {
      console.log('Error marking all notifications as read:', error);
    }
  }

  /** DELETE /notifications/:id — dismisses the notification */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.log('Error deleting notification:', error);
    }
  }
}

export const notificationsRepository = new NotificationsRepository();
