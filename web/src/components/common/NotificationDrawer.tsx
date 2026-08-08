import React from 'react';
import { SlideOverDrawer } from './SlideOverDrawer';
import { useAdmin } from '../../context/AdminContext';
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export const NotificationDrawer: React.FC = () => {
  const {
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    setCurrentTab,
  } = useAdmin();

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <SlideOverDrawer
      isOpen={notificationDrawerOpen}
      onClose={() => setNotificationDrawerOpen(false)}
      width="400px"
      title={
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-teal-400" />
          <span>System Notifications</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-900 font-mono text-xs font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
      }
      subtitle="Real-time operational alerts, ticket submissions & auction milestones"
      footer={
        <div className="w-full flex items-center justify-between">
          <button
            onClick={markAllNotificationsRead}
            className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read</span>
          </button>
          <button
            onClick={() => setNotificationDrawerOpen(false)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No notifications to display</div>
        ) : (
          notifications.map((notif) => {
            let Icon = Info;
            let iconColor = 'text-sky-400';
            let bgClass = 'bg-slate-800/80 border-slate-700';

            if (notif.type === 'urgent') {
              Icon = AlertCircle;
              iconColor = 'text-red-400';
              bgClass = 'bg-red-950/20 border-red-800/30';
            } else if (notif.type === 'warning') {
              Icon = AlertTriangle;
              iconColor = 'text-amber-400';
              bgClass = 'bg-amber-950/20 border-amber-800/30';
            }

            return (
              <div
                key={notif.id}
                onClick={() => {
                  markNotificationRead(notif.id);
                  if (notif.linkTab) {
                    setCurrentTab(notif.linkTab);
                    setNotificationDrawerOpen(false);
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:border-slate-500 relative group ${bgClass}`}
              >
                {notif.unread && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-slate-800" />
                )}
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="text-xs font-semibold text-slate-100 group-hover:text-teal-300 transition-colors">
                      {notif.title}
                    </div>
                    <div className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.description}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-2">{notif.timestamp}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SlideOverDrawer>
  );
};
