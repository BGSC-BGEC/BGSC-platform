import apiClient from '../../services/apiclient';

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

export class NotificationsRepository {
  /**
   * Fetch user notifications with pagination
   */
  async getNotifications(page: number = 1, limit: number = 20): Promise<NotificationsResponse> {
    try {
      const response = await apiClient.get<NotificationsResponse>('/notifications', {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      // Fallback mock data for development
      return {
        notifications: [
          {
            id: '1',
            title: 'New Event: Football Championship',
            message: 'Registration is now open for the Football Championship!',
            type: 'event',
            read: false,
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            title: 'Points Earned!',
            message: 'You earned 150 points from the Coding Workshop',
            type: 'success',
            read: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: '3',
            title: 'System Announcement',
            message: 'Platform maintenance scheduled for tomorrow at 2 AM',
            type: 'announcement',
            read: true,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
        unreadCount: 2,
        total: 3,
      };
    }
  }

  /**
   * Get unread notification count only
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return response.data.count;
    } catch (error) {
      return 2; // Mock unread count
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await apiClient.patch(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.log('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.patch('/notifications/mark-all-read');
    } catch (error) {
      console.log('Error marking all notifications as read:', error);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await apiClient.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.log('Error deleting notification:', error);
    }
  }
}

export const notificationsRepository = new NotificationsRepository();
