import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { notificationsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PushNotificationToggle from '../components/ui/PushNotificationToggle';

const NotificationTypeIcon = ({ type }) => {
  switch (type) {
    case 'FriendRequest':
      return <span className="text-lg">👋</span>;
    case 'ClubInvite':
      return <span className="text-lg">🏓</span>;
    case 'EventUpdate':
      return <span className="text-lg">📅</span>;
    case 'GameReady':
      return <span className="text-lg">🎮</span>;
    case 'Message':
      return <span className="text-lg">💬</span>;
    case 'System':
      return <span className="text-lg">🔔</span>;
    case 'Announcement':
      return <span className="text-lg">📢</span>;
    case 'Event':
      return <span className="text-lg">📅</span>;
    case 'Club':
      return <span className="text-lg">🏓</span>;
    case 'Certification':
      return <span className="text-lg">🏆</span>;
    case 'GameScore':
      return <span className="text-lg">🎯</span>;
    case 'Test':
      return <span className="text-lg">🧪</span>;
    default:
      return <Bell className="w-5 h-5" />;
  }
};

const NotificationItem = ({ notification, onMarkRead, onDelete }) => {
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const content = (
    <div className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50/50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${!notification.isRead ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <NotificationTypeIcon type={notification.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </h3>
              {notification.message && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
              )}
              <span className="text-xs text-gray-400 mt-1 block">{timeAgo(notification.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              {!notification.isRead && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead(notification.id); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(notification.id); }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {!notification.isRead && (
          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return <Link to={notification.actionUrl} className="block">{content}</Link>;
  }

  return content;
};

const Notifications = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('all'); // 'all', 'unread'

  const pageSize = 20;

  const loadNotifications = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const response = await notificationsApi.getNotifications({
        unreadOnly: filter === 'unread',
        page,
        pageSize
      });

      if (response.success) {
        setNotifications(response.data || []);
        setUnreadCount(response.unreadCount || 0);
        setTotalCount(response.totalCount || 0);
        setTotalPages(response.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [isAuthenticated, page, filter]);

  const handleMarkRead = async (id) => {
    try {
      const response = await notificationsApi.markAsRead(id);
      if (response.success) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await notificationsApi.markAllAsRead();
      if (response.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await notificationsApi.delete(id);
      if (response.success) {
        const deletedNotification = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        setTotalCount(prev => prev - 1);
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleDeleteRead = async () => {
    if (!confirm('Delete all read notifications?')) return;

    try {
      const response = await notificationsApi.deleteRead();
      if (response.success) {
        setNotifications(prev => prev.filter(n => !n.isRead));
        loadNotifications(); // Refresh to get accurate counts
      }
    } catch (err) {
      console.error('Error deleting read notifications:', err);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete all notifications? This cannot be undone.')) return;

    try {
      const response = await notificationsApi.deleteAll();
      if (response.success) {
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error deleting all notifications:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view notifications</h2>
          <p className="text-gray-500">You need to be logged in to see your notifications.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
            )}
          </div>
          <button
            onClick={loadNotifications}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Push Notification Settings */}
        <PushNotificationToggle className="mb-4" />

        {/* Actions Bar */}
        <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setFilter('all'); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === 'all' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setFilter('unread'); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === 'unread' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            {notifications.some(n => n.isRead) && (
              <button
                onClick={handleDeleteRead}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear read
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500">{error}</p>
              <button onClick={loadNotifications} className="mt-2 text-blue-600 hover:underline">
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-gray-500 text-sm">
                {filter === 'unread'
                  ? "You're all caught up!"
                  : "When you receive notifications, they'll appear here."}
              </p>
            </div>
          ) : (
            <>
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({totalCount} total)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Delete All Button */}
        {notifications.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={handleDeleteAll}
              className="text-sm text-red-600 hover:text-red-700 hover:underline"
            >
              Delete all notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
