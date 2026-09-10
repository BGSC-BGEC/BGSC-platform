import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../typography/Typography';
import { Badge } from './Badge';
import { useTheme } from '../theme/ThemeProvider';
import { notificationsRepository, type Notification } from '../repositories/NotificationsRepository';

interface AppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showMenuButton?: boolean;
  showNotifications?: boolean;
}

export function AppHeader({
  title = 'BGSC',
  showBackButton = false,
  showMenuButton = true,
  showNotifications = true,
}: AppHeaderProps) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await notificationsRepository.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.log('Error loading unread count:', error);
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsRepository.getNotifications();
      setNotifications(response.notifications);
    } catch (error) {
      console.log('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await notificationsRepository.markAsRead(notification.id);
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }
    setNotificationsVisible(false);
    // Navigate based on notification type
    // navigation.navigate('EventDetail', { id: notification.data?.eventId });
  };

  const handleMarkAllRead = async () => {
    await notificationsRepository.markAllAsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openNotifications = () => {
    setNotificationsVisible(true);
    loadNotifications();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'event':
        return 'calendar';
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'announcement':
        return 'megaphone';
      default:
        return 'information-circle';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, paddingTop: insets.top + 8 },
        ]}
      >
        <View style={styles.leftSection}>
          {showBackButton ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ) : showMenuButton ? (
            <Pressable
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="menu" size={24} color={colors.text} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.centerSection}>
          <Typography variant="h3" style={{ color: colors.text }}>
            {title}
          </Typography>
        </View>

        <View style={styles.rightSection}>
          {showNotifications && (
            <Pressable
              onPress={openNotifications}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Typography variant="caption" style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Typography>
                </View>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {/* Notifications Modal */}
      <Modal
        visible={notificationsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Typography variant="h2">Notifications</Typography>
              <View style={styles.modalActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Typography variant="bodySmall" color="primary">
                      Mark all read
                    </Typography>
                  </TouchableOpacity>
                )}
                <Pressable onPress={() => setNotificationsVisible(false)}>
                  <Ionicons name="close" size={28} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.notificationsList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleNotificationPress(item)}
                  style={({ pressed }) => [
                    styles.notificationItem,
                    {
                      backgroundColor: item.read ? colors.surface : colors.surfaceHighlight,
                    },
                    pressed && styles.notificationPressed,
                  ]}
                >
                  <View style={styles.notificationIcon}>
                    <Ionicons
                      name={getNotificationIcon(item.type)}
                      size={24}
                      color={item.read ? colors.textMuted : colors.primary}
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <Typography
                      variant="bodyBold"
                      style={{ color: item.read ? colors.textMuted : colors.text }}
                    >
                      {item.title}
                    </Typography>
                    <Typography variant="bodySmall" color="textMuted" numberOfLines={2}>
                      {item.message}
                    </Typography>
                    <Typography variant="caption" color="textMuted" style={styles.notificationTime}>
                      {formatTime(item.createdAt)}
                    </Typography>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                  <Typography variant="body" color="textMuted" style={styles.emptyText}>
                    No notifications yet
                  </Typography>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: 4,
    borderRadius: 20,
  },
  iconPressed: {
    opacity: 0.6,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationsList: {
    padding: 16,
    gap: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  notificationPressed: {
    opacity: 0.7,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTime: {
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    marginTop: 8,
  },
});
